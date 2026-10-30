/**
 * The day screen's decidable half (unit 14 `events-and-day-view`, phase 3).
 *
 * `DayScreen` is verified by eye (`docs/context/methodology.md`: the UI stays
 * manual), so every DECISION it makes lives here, where a test can reach it: the
 * heading, the neighbouring days, whether the *Hoje* control shows, what each
 * row's time column reads, how the rows split into sections, the empty text and
 * the two request paths. Each of those can be wrong silently — a heading a day
 * off, a label that drifts from the Google row's, a request that quietly changes
 * the unit-4 URL.
 *
 * Every clock time is read in the owner's zone (`PRAESTO_TIMEZONE`, plan
 * decision D3-1) with the same formatter `formatEventTime` uses, so a Google row
 * on `/day` reads exactly as it does on *Hoje*.
 *
 * Like every module in `src/shared`, this compiles into both targets: no DOM
 * globals, no runtime dependencies and no clock — `today` is always an argument.
 */

import { PRAESTO_TIMEZONE } from "./dates";
import { dayItemPlacement, type DayRange } from "./day-range";
import type { DayItem, ExternalDayItem, LocalDayItem } from "./day-item";
import { shiftLocalDay } from "./events";
import { ALL_DAY_LABEL } from "./format";

/** What an empty day says. The PRD's own copy (AC-24). */
export const DAY_VIEW_EMPTY = "Nada neste dia.";

/** U+2013, between a start and an end: no spaces around it. */
const RANGE_SEPARATOR = "–";

/**
 * The pt-BR long date of `day`, with the year only when it is not `today`'s
 * year: `terça-feira, 20 de outubro`, and `terça-feira, 20 de outubro de 2026`
 * read from 2027. The date is formatted at UTC noon in UTC, so the owner's zone
 * can never move it a day.
 */
export function formatDayHeading(day: string, today: string): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  };
  if (day.slice(0, 4) !== today.slice(0, 4)) options.year = "numeric";

  return new Intl.DateTimeFormat("pt-BR", options).format(
    new Date(Date.UTC(year, month - 1, date, 12)),
  );
}

/** The days the arrows step to. Month and year boundaries cross correctly. */
export function adjacentDays(day: string): { previous: string; next: string } {
  return { previous: shiftLocalDay(day, -1), next: shiftLocalDay(day, 1) };
}

/** The *Hoje* control shows only when another date is on screen. */
export function showTodayControl(day: string, today: string): boolean {
  return day !== today;
}

/** `HH:mm` of an instant in the owner's zone — the formatter `formatEventTime` uses. */
function formatClock(epochMs: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: PRAESTO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochMs));
}

/**
 * What the leading time column of a row reads when `item` is listed on `day`.
 *
 *  - an all-day item reads `ALL_DAY_LABEL` on every day it covers;
 *  - a timed item that begins on `day` reads `HH:mm` in `start` mode and
 *    `HH:mm–HH:mm` in `range` mode (`HH:mm` alone when its end is not after its
 *    start);
 *  - a timed item that began on an earlier day reads `até HH:mm` of its end in
 *    both modes — a 23:00 to 01:00 item reads `23:00–01:00` on its first day
 *    and `até 01:00` on the second. The continuation wording is this plan's
 *    own (D3-10), one function to change.
 *
 * For a Google item that begins on `day`, the `start` result is exactly
 * `formatEventTime(payload.start)`.
 */
export function formatDayItemTime(
  item: ExternalDayItem | LocalDayItem,
  day: string,
  mode: "start" | "range",
): string {
  const placement = dayItemPlacement(item);
  if (placement === null) return "";
  if (placement.kind === "allDay") return ALL_DAY_LABEL;
  if (placement.kind === "task") return "";

  if (placement.firstDay < day) return `até ${formatClock(placement.endMs)}`;

  const start = formatClock(placement.startMs);
  if (mode === "start" || placement.endMs <= placement.startMs) return start;
  return `${start}${RANGE_SEPARATOR}${formatClock(placement.endMs)}`;
}

/**
 * Splits one day's items into the screen's three sections by placement kind.
 * It splits and never sorts: ordering is `itemsInRange`'s job, so each section
 * keeps its relative order. What cannot be placed (a closed or undated Task) is
 * dropped.
 */
export function splitDayItems(items: readonly DayItem[]): {
  allDay: DayItem[];
  timed: DayItem[];
  tasks: DayItem[];
} {
  const sections: { allDay: DayItem[]; timed: DayItem[]; tasks: DayItem[] } = {
    allDay: [],
    timed: [],
    tasks: [],
  };

  for (const item of items) {
    const placement = dayItemPlacement(item);
    if (placement === null) continue;
    if (placement.kind === "allDay") sections.allDay.push(item);
    else if (placement.kind === "timed") sections.timed.push(item);
    else sections.tasks.push(item);
  }

  return sections;
}

/** The request for the local commitments of a range of days. */
export function eventsRangePath(range: DayRange): string {
  return `/api/events?from=${range.from}&to=${range.to}`;
}

/**
 * The request for Google's events. With no range it is exactly the unit-4
 * literal, so *Hoje*'s request stays byte-identical.
 */
export function googleEventsPath(range?: DayRange): string {
  return range === undefined
    ? "/api/google/events"
    : `/api/google/events?from=${range.from}&to=${range.to}`;
}
