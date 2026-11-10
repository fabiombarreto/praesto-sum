/**
 * The pure core of the Event (ADR-0016 decisions 1 and 4, events-and-day-view PRD
 * AC-1..AC-5): the limits, the source union and what each source may do, the
 * wall-clock to instant conversion, the all-day exclusive-end arithmetic and the
 * validator that both the route (phase 2) and the sheet (phase 4) will share, so
 * the two cannot drift on what a valid Event is.
 *
 * Clock-free and database-free: every instant and day is derived from an explicit
 * argument, never from an ambient clock. It uses only `Intl`, `Date.UTC` and its
 * same-directory sibling `./dates`, and it is compiled into every target, so it
 * carries no DOM globals, no Worker globals and no Drizzle import.
 */

import { instantToLocalParts, offsetMinutesAt, PRAESTO_TIMEZONE } from "./dates";

/**
 * The longest an Event title may be, counted after trimming (AC-3). Arbitrary, and
 * one constant to change if real use says otherwise (PRD Open Questions).
 */
export const EVENT_TITLE_MAX = 200;

/**
 * The longest an Event description may be, counted after trimming (AC-3).
 * Arbitrary, and one constant to change (PRD Open Questions).
 */
export const EVENT_DESCRIPTION_MAX = 5000;

/**
 * The longest an Event location may be, counted after trimming (AC-3). Arbitrary,
 * and one constant to change (PRD Open Questions).
 */
export const EVENT_LOCATION_MAX = 200;

/**
 * How long a timed Event lasts when the caller gives no end: one hour (AC-3).
 * Arbitrary, and one constant to change (PRD Open Questions).
 */
export const EVENT_DEFAULT_DURATION_SECONDS = 3600;

/** Where an Event came from. Unit 14 creates only `local` rows (ADR-0016). */
export const EVENT_SOURCES = ["local", "google"] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

/** What the UI may offer for an Event of a given source (AC-5). */
export interface EventCapabilities {
  editable: boolean;
  deletable: boolean;
  opensInGoogle: boolean;
}

/**
 * The TypeScript handbook's `never`-assertion idiom. Its real work happens at
 * compile time: a `switch` whose default reaches this stops compiling the
 * moment `EventSource` gains a member the switch does not handle. The throw is
 * the runtime half — a branch that should be unreachable must be loud rather
 * than silently return `undefined`.
 */
export function assertNeverEventSource(value: never): never {
  throw new Error(`Unhandled event source: ${String(value)}`);
}

/**
 * What an Event of `source` can do. An exhaustive switch: adding a member to
 * `EVENT_SOURCES` stops this compiling until the new source is decided (AC-5).
 */
export function eventCapabilities(source: EventSource): EventCapabilities {
  switch (source) {
    case "local":
      return { editable: true, deletable: true, opensInGoogle: false };
    case "google":
      return { editable: false, deletable: false, opensInGoogle: true };
    default:
      return assertNeverEventSource(source);
  }
}

/** The input field a validation error is about. */
export type EventField =
  | "title"
  | "description"
  | "location"
  | "allDay"
  | "startAt"
  | "endAt"
  | "startDate"
  | "endDate"
  | "timezone";

/** Why a field is refused; the prose shown to the owner is a later phase's concern. */
export type EventErrorCode =
  | "blank"
  | "too_long"
  | "required"
  | "not_allowed"
  | "invalid_date"
  | "unknown_zone"
  | "end_before_start"
  | "end_not_after_start";

export interface EventValidationError {
  field: EventField;
  code: EventErrorCode;
}

/** A validator's outcome: the value, or the first field it refused and why. */
export type EventResult<T> = { ok: true; value: T } | { ok: false; error: EventValidationError };

/** The refusal of `field` for `code`, in the shape every validator below returns. */
function fail(field: EventField, code: EventErrorCode): { ok: false; error: EventValidationError } {
  return { ok: false, error: { field, code } };
}

const DAY_MS = 86_400_000;

/**
 * The epoch-seconds instant that `day` (`YYYY-MM-DD`) at `time` (`HH:mm`) names in
 * `timeZone`, resolved the way RFC 5545 section 3.3.5 asks (AC-1):
 *
 *  - a time that occurs twice (the clock goes back) resolves to its FIRST
 *    occurrence;
 *  - a time that does not exist (the clock jumps forward) is read with the UTC
 *    offset from BEFORE the gap.
 *
 * It does not delegate to `localPartsToInstant`: inside a gap that function lands
 * on the offset AFTER it, and Reminders still depend on that behaviour, so the
 * shipped export is left as it is. The zone is a required argument; an unknown one
 * makes `Intl` throw, so callers check `isValidTimeZone` first.
 *
 * The method: read the wall clock as if it were UTC, probe the zone's offset a day
 * either side of it, and keep each offset whose candidate instant really has that
 * offset. An overlap leaves two such candidates (the earlier is the first
 * occurrence), an ordinary time leaves one, and a gap leaves none.
 */
export function wallClockToInstant(day: string, time: string, timeZone: string): number {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const wallClockAsIfUtc = Date.UTC(year, month - 1, date, hours, minutes, 0);

  const offsetBefore = offsetMinutesAt(new Date(wallClockAsIfUtc - DAY_MS), timeZone);
  const offsetAfter = offsetMinutesAt(new Date(wallClockAsIfUtc + DAY_MS), timeZone);

  const valid: number[] = [];
  for (const offset of new Set([offsetBefore, offsetAfter])) {
    const candidate = wallClockAsIfUtc - offset * 60_000;
    if (offsetMinutesAt(new Date(candidate), timeZone) === offset) valid.push(candidate);
  }

  if (valid.length > 0) return Math.floor(Math.min(...valid) / 1000);
  return Math.floor((wallClockAsIfUtc - offsetBefore * 60_000) / 1000);
}

/**
 * Splits an epoch-seconds instant into its local day (`YYYY-MM-DD`) and time
 * (`HH:mm`) in `timeZone` — the inverse of `wallClockToInstant` for every time
 * that is not inside a gap (AC-1).
 */
export function instantToWallClock(
  epochSeconds: number,
  timeZone: string,
): { day: string; time: string } {
  return instantToLocalParts(epochSeconds, timeZone);
}

const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when `day` is a real calendar day written `YYYY-MM-DD`: the shape matches
 * AND the day survives a `Date.UTC` round trip, so `2026-02-30` is false and
 * `2028-02-29` is true (AC-2).
 */
export function isValidLocalDay(day: string): boolean {
  if (!LOCAL_DAY_PATTERN.test(day)) return false;
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const roundTrip = new Date(Date.UTC(year, month - 1, date));
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === date
  );
}

/**
 * The local day `delta` days after `day` (before it, when negative), crossing month
 * and year boundaries. A `Date.UTC` shift on explicit components, never an ambient
 * clock (AC-2).
 */
export function shiftLocalDay(day: string, delta: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

/**
 * Turns a stored EXCLUSIVE all-day end into the inclusive last day shown to the
 * owner: Google stores `2026-10-28` for an Event that ends on the 27th (AC-2).
 */
export function displayEndDay(endDate: string): string {
  return shiftLocalDay(endDate, -1);
}

/**
 * The form-side half of the same rule: turns the owner's inclusive last day into
 * Google's exclusive end. A missing or equal last day is a single day, so
 * `2026-10-20` stores end `2026-10-21`; a last day before the start is refused,
 * naming `endDate` (AC-2).
 */
export function allDaySpanFromInclusive(
  startDate: string,
  lastDayInclusive?: string | null,
): EventResult<{ startDate: string; endDate: string }> {
  if (!isValidLocalDay(startDate)) return fail("startDate", "invalid_date");
  const lastDay = lastDayInclusive ?? startDate;
  if (!isValidLocalDay(lastDay)) return fail("endDate", "invalid_date");
  if (lastDay < startDate) return fail("endDate", "end_not_after_start");
  return { ok: true, value: { startDate, endDate: shiftLocalDay(lastDay, 1) } };
}

/**
 * The zone an Event is resolved in when the caller names none. Re-exported from
 * `./dates` so it cannot drift from `recurrence_series.timezone` (AC-3).
 */
export const EVENT_DEFAULT_TIMEZONE = PRAESTO_TIMEZONE;

/**
 * True when `Intl` knows `timeZone` as an IANA zone: the formatter constructs
 * without a `RangeError`. `Mars/Base` and the empty string are false (AC-3).
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

/**
 * The time fields of an Event as a caller supplies them. A timed Event carries
 * `startAt` and `endAt` (epoch seconds) and no days; an all-day Event carries
 * `startDate` and `endDate` (local days, the end EXCLUSIVE) and no instants.
 */
export interface EventTimesInput {
  allDay: boolean;
  startAt?: number | null;
  endAt?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

/** The time fields once resolved: every field present, the unused pair `null`. */
export interface EventTimes {
  allDay: boolean;
  startAt: number | null;
  endAt: number | null;
  startDate: string | null;
  endDate: string | null;
}

/** An Event as a caller supplies it, before any default or trim is applied. */
export interface EventInput extends EventTimesInput {
  title: string;
  description?: string | null;
  location?: string | null;
  timezone?: string | null;
}

/** An Event once validated: trimmed text, empty text as `null`, the end and zone filled. */
export interface ResolvedEvent {
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  startAt: number | null;
  endAt: number | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Checks and completes the time fields of an Event (AC-2, AC-3).
 *
 * A timed Event needs `startAt` (a missing or non-integer value is `required`); a
 * missing `endAt` becomes `startAt` plus `EVENT_DEFAULT_DURATION_SECONDS`, a given
 * `endAt` that is not a whole number of seconds is `invalid_date`, an `endAt` before
 * the start is `end_before_start`, and an `endAt` equal to the start is accepted.
 * An all-day Event needs a real `startDate`; a missing `endDate` becomes the next
 * day, and an `endDate` that is not after the start (equal or earlier) is
 * `end_not_after_start`. The other kind's fields are `not_allowed`.
 */
export function resolveEventTimes(input: EventTimesInput): EventResult<EventTimes> {
  if (input.allDay) {
    const startDate = input.startDate ?? null;
    if (startDate === null) return fail("startDate", "required");
    if (!isValidLocalDay(startDate)) return fail("startDate", "invalid_date");

    const givenEnd = input.endDate ?? null;
    if (givenEnd !== null && !isValidLocalDay(givenEnd)) return fail("endDate", "invalid_date");
    const endDate = givenEnd ?? shiftLocalDay(startDate, 1);
    if (endDate <= startDate) return fail("endDate", "end_not_after_start");

    if (isPresent(input.startAt)) return fail("startAt", "not_allowed");
    if (isPresent(input.endAt)) return fail("endAt", "not_allowed");
    return { ok: true, value: { allDay: true, startAt: null, endAt: null, startDate, endDate } };
  }

  const startAt = input.startAt ?? null;
  if (startAt === null || !Number.isInteger(startAt)) return fail("startAt", "required");

  const givenEnd = input.endAt ?? null;
  if (givenEnd !== null && !Number.isInteger(givenEnd)) return fail("endAt", "invalid_date");
  const endAt = givenEnd ?? startAt + EVENT_DEFAULT_DURATION_SECONDS;
  if (endAt < startAt) return fail("endAt", "end_before_start");

  if (isPresent(input.startDate)) return fail("startDate", "not_allowed");
  if (isPresent(input.endDate)) return fail("endDate", "not_allowed");
  return { ok: true, value: { allDay: false, startAt, endAt, startDate: null, endDate: null } };
}

/**
 * Judges optional text the way the title is judged: trimmed first, then measured.
 * An empty result is stored as `null`.
 */
function cleanOptionalText(
  raw: string | null | undefined,
  max: number,
  field: "description" | "location",
): EventResult<string | null> {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length > max) return fail(field, "too_long");
  return { ok: true, value: trimmed.length === 0 ? null : trimmed };
}

/**
 * Validates an Event the way both the route and the sheet must, returning the
 * FIRST failure in a fixed order: title, description, location, zone, then the
 * time fields. Text is trimmed before it is judged, and its length is the
 * `String.length` of the trimmed value (the unit `validateLifeAreaName` uses). A
 * missing or null zone becomes `EVENT_DEFAULT_TIMEZONE`. Typeof checks of an
 * untrusted JSON body belong to the route, not here (AC-3).
 */
export function validateEventInput(input: EventInput): EventResult<ResolvedEvent> {
  const title = input.title.trim();
  if (title.length === 0) return fail("title", "blank");
  if (title.length > EVENT_TITLE_MAX) return fail("title", "too_long");

  const description = cleanOptionalText(input.description, EVENT_DESCRIPTION_MAX, "description");
  if (!description.ok) return description;
  const location = cleanOptionalText(input.location, EVENT_LOCATION_MAX, "location");
  if (!location.ok) return location;

  const timezone = input.timezone ?? EVENT_DEFAULT_TIMEZONE;
  if (!isValidTimeZone(timezone)) return fail("timezone", "unknown_zone");

  const times = resolveEventTimes(input);
  if (!times.ok) return times;

  return {
    ok: true,
    value: {
      title,
      description: description.value,
      location: location.value,
      ...times.value,
      timezone,
    },
  };
}
