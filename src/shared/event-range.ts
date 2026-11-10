/**
 * Day-range validation and owner-zone instants (events-and-day-view PRD AC-11 and
 * AC-18, phase 2). One pure module shared by `GET /api/events` (at most 62 days) and
 * `GET /api/google/events` (at most 31 days), so the two routes cannot disagree about
 * what a span is.
 *
 * A span is the INCLUSIVE count of calendar days: `from = to` is 1 day. Clock-free and
 * database-free: every day and instant is derived from an explicit argument, and its
 * only imports are its same-directory sibling `./events`. It is compiled into every
 * target, so it carries no DOM globals, no Worker globals and no Drizzle import.
 */

import { EVENT_DEFAULT_TIMEZONE, isValidLocalDay } from "./events";
import { shiftLocalDay, wallClockToInstant } from "./events";

/** The longest range `GET /api/events` answers, in inclusive calendar days. */
export const EVENT_RANGE_MAX_DAYS = 62;

/** The longest window `GET /api/google/events` fetches, in inclusive calendar days. */
export const GOOGLE_RANGE_MAX_DAYS = 31;

/** The query parameter a range error is about. */
export type DayRangeParam = "from" | "to";

/** Why a range is refused; the prose shown to the caller is the route's concern. */
export type DayRangeErrorCode = "required" | "invalid_date" | "to_before_from" | "too_long";

export interface DayRangeError {
  param: DayRangeParam;
  code: DayRangeErrorCode;
}

/** A range's outcome: the validated days and their inclusive count, or the first refusal. */
export type DayRangeResult =
  { ok: true; from: string; to: string; days: number } | { ok: false; error: DayRangeError };

/** The refusal of `param` for `code`, in the shape `validateDayRange` returns. */
function fail(param: DayRangeParam, code: DayRangeErrorCode): { ok: false; error: DayRangeError } {
  return { ok: false, error: { param, code } };
}

const DAY_MS = 86_400_000;

/** The number of whole days from the epoch to the calendar `day` (`YYYY-MM-DD`, already valid). */
function dayNumber(day: string): number {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / DAY_MS;
}

/**
 * Validates a `from`/`to` pair of local days and counts the days it covers,
 * returning the FIRST failure in a fixed order: `from` missing, `from` not a real
 * day, `to` missing, `to` not a real day, `to` before `from`, then a span longer
 * than `maxDays`. `days` is inclusive, so `2026-10-20` to `2026-12-20` is 62.
 */
export function validateDayRange(
  from: string | undefined,
  to: string | undefined,
  maxDays: number,
): DayRangeResult {
  if (from === undefined) return fail("from", "required");
  if (!isValidLocalDay(from)) return fail("from", "invalid_date");
  if (to === undefined) return fail("to", "required");
  if (!isValidLocalDay(to)) return fail("to", "invalid_date");
  if (to < from) return fail("to", "to_before_from");

  const days = dayNumber(to) - dayNumber(from) + 1;
  if (days > maxDays) return fail("to", "too_long");

  return { ok: true, from, to, days };
}

/**
 * The half-open interval `[startAt, endAt)` of epoch seconds that the local days
 * `from` through `to` cover in `timeZone`: local midnight of `from` up to, but not
 * including, local midnight of the day after `to`. Both bounds go through
 * `wallClockToInstant`, so the RFC 5545 gap and overlap rules apply at a day
 * boundary too, and a day on which the clocks change is 23 or 25 hours long.
 */
export function dayRangeInstants(
  from: string,
  to: string,
  timeZone: string = EVENT_DEFAULT_TIMEZONE,
): { startAt: number; endAt: number } {
  return {
    startAt: wallClockToInstant(from, "00:00", timeZone),
    endAt: wallClockToInstant(shiftLocalDay(to, 1), "00:00", timeZone),
  };
}
