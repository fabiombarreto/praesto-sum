/**
 * Pure recurrence expansion, shared by both compile targets (ADR-0006).
 *
 * This module resolves a `RecurrenceRule` into local-calendar-day occurrence
 * dates — `firstOccurrence`, `nextOccurrence` and `expandOccurrences` — plus
 * `occurrenceReminderInstants`, which composes `offsetToInstant` to turn an
 * occurrence day into the absolute UTC instants its Reminders fire at.
 *
 * It reads no ambient clock (no `Date.now()`, no bare `new Date()` — every
 * `Date` constructed below is built from an explicit numeric instant derived
 * from a caller-supplied day string) and touches no database: every temporal
 * input — including "the day it was completed", for completion-anchored
 * series — arrives as an explicit argument, exactly like `src/shared/dates.ts`.
 *
 * This module carries no imports outside `src/shared/` so it stays usable
 * from the browser bundle and the Worker alike (importing `./dates`, a
 * same-directory sibling, is the one allowed exception — see `dates.ts`'s own
 * header). Unit 17 (`recurring-events`) reuses these four exports unchanged
 * to expand Event series.
 */

import { offsetToInstant } from "./dates";

/**
 * A Recurrence Series' rule, hand-written in `src/shared` rather than
 * imported from `src/worker/db/schema.ts` (that import would pull the ORM
 * into the SPA bundle, which AC-1 forbids). Its fields and literal-union
 * enums structurally mirror `recurrenceSeries`'s rule columns exactly
 * (`src/worker/db/schema.ts:63-79`), the same hand-written-mirror convention
 * `TaskDto`/`TaskStatus` already set in `src/shared/api.ts`; drift is caught
 * for real once a future `src/worker/dto.ts` mapping builds a `RecurrenceRule`
 * from a `RecurrenceSeries` row field by field, never by this declaration.
 *
 * `byWeekday` is taken already decoded as `number[] | null` — this pure
 * module knows nothing of the JSON-text storage format; that decode is a
 * Phase 2 concern at the route boundary.
 */
export interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  /** ISO weekday numbers (1 = Monday … 7 = Sunday), or `null`. */
  byWeekday: number[] | null;
  byMonthday: number | null;
  /** First date of the series, local calendar day (`YYYY-MM-DD`). */
  dtstart: string;
  /** IANA zone the rule is resolved in before converting to instants. */
  timezone: string;
  /**
   * 'calendar' keeps the original track and skips missed dates; 'completion'
   * computes the next date from the actual completion date.
   */
  anchorMode: "calendar" | "completion";
  endKind: "never" | "until" | "count";
  untilDate: string | null;
  maxCount: number | null;
}

/** Arguments to `nextOccurrence`. */
export interface NextOccurrenceArgs {
  /** The reference local calendar day; the result is strictly after this. */
  after: string;
  /**
   * The local calendar day the current occurrence was completed on. Required
   * (and used instead of `after`) when `rule.anchorMode === "completion"`;
   * ignored entirely for `"calendar"` anchoring (AC-6).
   */
  completedOn?: string;
  /**
   * Closed occurrences so far (`done_count + missed_count`, PRD Decision D6),
   * computed by the caller. Only consulted when `rule.endKind === "count"`.
   */
  closedCount?: number;
}

/** Arguments to `expandOccurrences`. */
export interface ExpandArgs {
  /** Inclusive lower bound, local calendar day. */
  from: string;
  /** Inclusive upper bound, local calendar day. */
  to: string;
}

/** A local calendar day broken into its Y/M/D components (month is 1-12). */
interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseDay(day: string): DateParts {
  const [yearText, monthText, dayText] = day.split("-");
  return { year: Number(yearText), month: Number(monthText), day: Number(dayText) };
}

function formatDay(parts: DateParts): string {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The number of real days in `month` (1-12) of `year`, leap years included. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the following JS-indexed month is the last real day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(parts: DateParts, days: number): DateParts {
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + days * 86_400_000);
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  };
}

/** Whole days between two `YYYY-MM-DD` days (`b - a`); may be negative. */
function daysBetween(a: string, b: string): number {
  const aParts = parseDay(a);
  const bParts = parseDay(b);
  const aMs = Date.UTC(aParts.year, aParts.month - 1, aParts.day);
  const bMs = Date.UTC(bParts.year, bParts.month - 1, bParts.day);
  return (bMs - aMs) / 86_400_000;
}

/** ISO weekday of a day: 1 = Monday … 7 = Sunday. */
function isoWeekday(day: string): number {
  const parts = parseDay(day);
  const jsDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/** The Monday (ISO week start) of the week `day` falls in. */
function weekStartDay(day: string): string {
  const parts = parseDay(day);
  const weekday = isoWeekday(day);
  return formatDay(addDays(parts, -(weekday - 1)));
}

/**
 * The next daily-track date strictly after `after`, re-derived from
 * `rule.dtstart` and `rule.interval` (never incremented from a previous
 * result).
 */
function findNextDaily(rule: RecurrenceRule, after: string): string {
  const start = parseDay(rule.dtstart);
  const diffDays = daysBetween(rule.dtstart, after);
  let period = Math.max(0, Math.floor(diffDays / rule.interval) + 1);
  let candidate = formatDay(addDays(start, period * rule.interval));
  // Defensive: guarantees strict monotonicity even at the diffDays<0 boundary.
  while (candidate <= after) {
    period += 1;
    candidate = formatDay(addDays(start, period * rule.interval));
  }
  return candidate;
}

/**
 * The next weekly-track date strictly after `after`. Weeks are grouped into
 * blocks of `rule.interval` (block 0 is `rule.dtstart`'s own ISO week);
 * within a qualifying block, occurrences fall on every weekday in
 * `rule.byWeekday` (or `rule.dtstart`'s own weekday when unset), ascending.
 */
function findNextWeekly(rule: RecurrenceRule, after: string): string {
  const weekdays =
    rule.byWeekday !== null && rule.byWeekday.length > 0
      ? [...rule.byWeekday].sort((a, b) => a - b)
      : [isoWeekday(rule.dtstart)];

  const dtstartWeekStart = weekStartDay(rule.dtstart);
  const afterWeekStart = weekStartDay(after);
  const weekIndexOfAfter = daysBetween(dtstartWeekStart, afterWeekStart) / 7;
  let blockStart = Math.max(0, Math.floor(weekIndexOfAfter / rule.interval) * rule.interval);

  const dtstartWeekStartParts = parseDay(dtstartWeekStart);
  for (let guard = 0; guard < 100_000; guard += 1) {
    const weekStartParts = addDays(dtstartWeekStartParts, blockStart * 7);
    for (const weekday of weekdays) {
      const candidate = formatDay(addDays(weekStartParts, weekday - 1));
      if (candidate > after) return candidate;
    }
    blockStart += rule.interval;
  }
  throw new RangeError("findNextWeekly: exceeded the internal search guard");
}

/**
 * The next monthly- or yearly-track date strictly after `after`. Each
 * candidate period is re-derived independently from `rule.dtstart` (month or
 * year offset by `period * rule.interval`) and the configured day
 * (`rule.byMonthday`, or `rule.dtstart`'s own day when unset), clamped
 * `BACKWARD` to the target month's real last day on overflow (PRD Decision
 * D1) — never inherited from a previously clamped candidate, so a later leap
 * year restores the real day instead of staying clamped (AC-3, AC-5).
 */
function findNextMonthlyOrYearly(
  rule: RecurrenceRule,
  after: string,
  freq: "monthly" | "yearly",
): string {
  const start = parseDay(rule.dtstart);
  const day = rule.byMonthday ?? start.day;

  function candidateForPeriod(period: number): DateParts {
    if (freq === "monthly") {
      const totalMonths = start.month - 1 + period * rule.interval;
      const year = start.year + Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;
      return { year, month, day: Math.min(day, daysInMonth(year, month)) };
    }
    const year = start.year + period * rule.interval;
    const month = start.month;
    return { year, month, day: Math.min(day, daysInMonth(year, month)) };
  }

  let period = 0;
  let candidate = formatDay(candidateForPeriod(period));
  while (candidate <= after) {
    period += 1;
    candidate = formatDay(candidateForPeriod(period));
  }
  return candidate;
}

/** Dispatches to the frequency-specific stepping function. */
function findNextTrackDate(rule: RecurrenceRule, after: string): string {
  switch (rule.freq) {
    case "daily":
      return findNextDaily(rule, after);
    case "weekly":
      return findNextWeekly(rule, after);
    case "monthly":
      return findNextMonthlyOrYearly(rule, after, "monthly");
    case "yearly":
      return findNextMonthlyOrYearly(rule, after, "yearly");
  }
}

/**
 * Completion-anchored stepping (PRD Decision D5): computes the next
 * occurrence of `completedOn`'s track — daily's step, or `byWeekday`'s next
 * weekday, or `byMonthday`'s day-of-month/year (or `completedOn`'s own
 * day/weekday when unset) — treating `completedOn` as the anchor (rather
 * than continuing `rule.dtstart`'s calendar track), matching the schema's
 * own doc comment: "computes the next date from the actual completion
 * date".
 *
 * For `freq: "daily"` this is always exactly `rule.interval` days forward,
 * since the step itself IS the target. For `"weekly"`/`"monthly"`/`"yearly"`
 * it is the next date the target weekday/day-of-month falls on strictly
 * after `completedOn` — which can be as little as one day away (when
 * `completedOn` lands before the target day within its own period) and up
 * to a full `rule.interval` period away (when it lands on or after the
 * target day) — NOT a fixed "one period forward" in every case. Example:
 * `{ freq: "monthly", byMonthday: 25 }` completed on the 10th returns the
 * 25th of the SAME month, 15 days later, not a month later. This gap for
 * completed-extremely-late series beyond AC-7's single daily worked example
 * is recorded as an open, untested corner in the PRD's Technical Risks
 * table — deliberate, not silently assumed away.
 */
function stepToNextOccurrenceFromCompletion(rule: RecurrenceRule, completedOn: string): string {
  const virtualRule: RecurrenceRule = { ...rule, dtstart: completedOn };
  return findNextTrackDate(virtualRule, completedOn);
}

function isWithinEndCondition(
  rule: RecurrenceRule,
  candidate: string,
  closedCount: number | undefined,
): boolean {
  if (rule.endKind === "until") {
    return rule.untilDate === null || candidate <= rule.untilDate;
  }
  if (rule.endKind === "count") {
    const count = closedCount ?? 0;
    return rule.maxCount === null || count < rule.maxCount;
  }
  return true;
}

/** The series' own first occurrence: `rule.dtstart`, verbatim. */
export function firstOccurrence(rule: RecurrenceRule): string {
  return rule.dtstart;
}

/**
 * The next occurrence on `rule`'s track, or `null` once an end condition
 * (PRD Decision D6) has been reached.
 *
 * For `anchorMode: "calendar"`, the result is the next date on the
 * `rule.dtstart` track strictly after `args.after` — `args.completedOn` is
 * ignored entirely, so a late completion never derails the track (AC-6).
 *
 * For `anchorMode: "completion"`, the result is computed from
 * `args.completedOn` instead (PRD Decision D5); calling without
 * `completedOn` throws `TypeError` rather than silently reading the clock
 * (AC-7).
 */
export function nextOccurrence(rule: RecurrenceRule, args: NextOccurrenceArgs): string | null {
  let candidate: string;
  if (rule.anchorMode === "completion") {
    if (args.completedOn === undefined) {
      throw new TypeError(
        "nextOccurrence: rule.anchorMode is 'completion' but completedOn was not provided",
      );
    }
    candidate = stepToNextOccurrenceFromCompletion(rule, args.completedOn);
  } else {
    candidate = findNextTrackDate(rule, args.after);
  }
  return isWithinEndCondition(rule, candidate, args.closedCount) ? candidate : null;
}

/**
 * Every occurrence date in `[from, to]`, ascending, by repeated
 * `nextOccurrence` stepping from `firstOccurrence`. Throws `RangeError` when
 * the window exceeds 366 days — the guard against a runaway loop for unit
 * 17's bounded Event expansion (AC-9).
 *
 * Only supported for `anchorMode: "calendar"` rules. A completion-anchored
 * series' occurrences beyond the first are not enumerable ahead of time — by
 * PRD Decision D5, each one is computed from the actual day its predecessor
 * was completed on, an event that (by definition, for any occurrence still
 * in the future) has not happened yet. Calling this on a completion-anchored
 * rule throws a named, documented `TypeError` rather than letting a
 * "completedOn was not provided" error leak up from an internal stepping
 * guard — this is a deliberate refusal, not an accidental gap. (The
 * completed-extremely-late corner this same limitation touches is already
 * recorded as an open, untested question in the PRD's Technical Risks
 * table.)
 */
export function expandOccurrences(rule: RecurrenceRule, args: ExpandArgs): string[] {
  if (rule.anchorMode === "completion") {
    throw new TypeError(
      "expandOccurrences: rule.anchorMode is 'completion' — a completion-anchored " +
        "series' future occurrences depend on completion events that have not " +
        "happened yet, so the window cannot be enumerated ahead of time. Call " +
        "nextOccurrence with each occurrence's actual completedOn instead.",
    );
  }

  const { from, to } = args;
  if (daysBetween(from, to) > 366) {
    throw new RangeError(
      `expandOccurrences: window from ${from} to ${to} exceeds the 366-day runaway-loop guard`,
    );
  }

  const results: string[] = [];
  let current: string | null = firstOccurrence(rule);
  while (current !== null && current < from) {
    current = nextOccurrence(rule, { after: current });
  }
  while (current !== null && current <= to) {
    results.push(current);
    current = nextOccurrence(rule, { after: current });
  }
  return results;
}

/**
 * The absolute UTC instants (epoch seconds) an occurrence's Reminders fire
 * at, one per offset in `offsets` — composing `offsetToInstant` once per
 * offset rather than reimplementing its DST-aware conversion (AC-10),
 * mirroring the call-site pattern at `src/worker/routes/reminders.ts:58-60`.
 */
export function occurrenceReminderInstants(day: string, offsets: number[], tz: string): number[] {
  return offsets.map((offset) => offsetToInstant(day, offset, tz));
}
