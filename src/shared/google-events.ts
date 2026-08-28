/**
 * Google's wire shape → Praesto's (unit 4 `google-calendar-read`, phase 3).
 *
 * One pure function is the whole boundary between a third party's payload and
 * this codebase. Everything the owner's calendar can say passes through here,
 * and what this function does not carry, nothing downstream can.
 *
 * Like every module in `src/shared`, it compiles into both the browser and the
 * Worker: no DOM globals, no runtime dependencies, and no reads of the clock —
 * `today` is an argument, exactly as in `dates.ts` and `task-groups.ts`.
 */

import type { CalendarEventDto, EventMoment } from "./api";
import { PRAESTO_TIMEZONE } from "./dates";

/** Google's default is 250; naming it makes the ceiling a decision rather than an inheritance. */
export const EVENTS_PAGE_SIZE = 250;

interface RawMoment {
  date?: unknown;
  dateTime?: unknown;
  timeZone?: unknown;
}

interface RawEvent {
  id?: unknown;
  summary?: unknown;
  location?: unknown;
  htmlLink?: unknown;
  start?: RawMoment;
  end?: RawMoment;
  attendees?: unknown;
}

function toMoment(raw: RawMoment | undefined): EventMoment | null {
  if (!raw) return null;

  // All-day first: a `date` carries no zone, and converting it through one is
  // how such events land a day off.
  if (typeof raw.date === "string" && raw.date !== "") return { date: raw.date };

  if (typeof raw.dateTime === "string") {
    const instant = Date.parse(raw.dateTime);
    if (Number.isNaN(instant)) return null;
    return { dateTime: instant, timeZone: typeof raw.timeZone === "string" ? raw.timeZone : null };
  }

  return null;
}

/**
 * Maps one event, or returns `null` when the payload cannot be placed on a day.
 *
 * `null` rather than a throw: a single unmappable row must cost that row and
 * never the whole day. A cancelled instance with no start, or a shape Google
 * introduces later, should subtract one commitment from the screen — not all
 * of them.
 */
export function toCalendarEventDto(raw: unknown, calendarId: string): CalendarEventDto | null {
  if (typeof raw !== "object" || raw === null) return null;
  const event = raw as RawEvent;

  if (typeof event.id !== "string" || event.id === "") return null;

  const start = toMoment(event.start);
  if (start === null) return null;
  const end = toMoment(event.end) ?? start;

  const summary = typeof event.summary === "string" ? event.summary.trim() : "";

  return {
    id: event.id,
    calendarId,
    // Empty and whitespace-only both mean "no title". Choosing what that READS
    // as belongs to the screen (ADR-0009 keeps this module free of pt-BR copy).
    title: summary === "" ? null : summary,
    allDay: "date" in start,
    start,
    end,
    location: typeof event.location === "string" && event.location !== "" ? event.location : null,
    // The ONLY thing the guest list contributes. Its length is read; not one
    // attendee value is copied anywhere.
    hasGuests: Array.isArray(event.attendees) && event.attendees.length > 0,
    htmlLink: typeof event.htmlLink === "string" ? event.htmlLink : null,
  };
}

/** The UTC offset in `timeZone` on `day`, as `+HH:MM` / `-HH:MM`. */
function offsetFor(day: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${day}T12:00:00Z`));

  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  // "GMT-03:00" → "-03:00"; bare "GMT" (UTC) → "+00:00".
  const offset = name.replace("GMT", "");
  return offset === "" ? "+00:00" : offset;
}

/** `day` shifted by `delta` calendar days, still `YYYY-MM-DD`. */
function shiftDay(day: string, delta: number): string {
  const shifted = new Date(`${day}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The RFC3339 window `events.list` is asked for.
 *
 * `timeMax` is **day `days + 1` at midnight**, not the end of day `days`,
 * because Google documents `timeMax` as an EXCLUSIVE upper bound on start
 * time. Naming the end of the last day would silently drop every event on it —
 * a bug that surfaces weeks later as "my Friday meeting is missing", far
 * enough from its cause to be expensive.
 *
 * Both bounds carry an explicit offset: Google rejects a bare timestamp.
 */
export function eventWindow(
  today: string,
  days: number,
  timeZone: string = PRAESTO_TIMEZONE,
): { timeMin: string; timeMax: string } {
  const last = shiftDay(today, days + 1);

  return {
    timeMin: `${today}T00:00:00${offsetFor(today, timeZone)}`,
    timeMax: `${last}T00:00:00${offsetFor(last, timeZone)}`,
  };
}
