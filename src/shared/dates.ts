/**
 * Date reasoning shared by both compile targets.
 *
 * A Task's `deadline` and `scheduledDate` are LOCAL calendar days stored as
 * `YYYY-MM-DD` text — they are days, not instants (see the conventions header
 * of `src/worker/db/schema.ts`). That is why deciding whether a Task is
 * overdue cannot be a comparison against a UTC timestamp: at 02:30 UTC the
 * owner's calendar still shows the previous day, and a Task due "today" would
 * be reported overdue for three hours every night.
 *
 * This module carries no imports so it stays usable from the browser bundle
 * and the Worker alike, matching the constraint stated at the top of
 * `src/shared/api.ts`.
 */

/**
 * The one zone the assistant reasons about days in. There is exactly one owner
 * (CON-002), so there is exactly one calendar. Named here rather than inlined
 * so it cannot drift from `recurrence_series.timezone`, whose schema default is
 * the same value.
 */
export const PRAESTO_TIMEZONE = "America/Sao_Paulo";

/**
 * The local calendar day at `now` in `timeZone`, as `YYYY-MM-DD`.
 *
 * `en-CA` is the locale whose short date format is already ISO-ordered, so the
 * formatter returns the wanted shape directly and no string surgery is needed.
 */
export function todayIn(now: Date, timeZone: string = PRAESTO_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The single named source of "the meaning of a deadline" (PRD Decisions Log,
 * 2026-08-03): a Task carries only a local calendar day, so "1 h before the
 * deadline" has nothing to count back from until an end-of-day convention is
 * picked. 23:59 local is that convention — named once, here, so the day the
 * owner asks for a different answer it is a one-line change.
 */
export const END_OF_DAY_LOCAL_MINUTES = 23 * 60 + 59;

/**
 * The IANA-zone UTC offset (in minutes, east-of-UTC positive) that applies at
 * the given UTC instant. `Intl.DateTimeFormat` is a display formatter, not an
 * offset calculator — this diffs its `formatToParts` rendering of `instant`
 * against a `Date.UTC` reconstruction of that same rendering, which is the
 * only way to recover the offset without hard-coding one.
 */
export function offsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const year = lookup.get("year");
  const month = lookup.get("month");
  const day = lookup.get("day");
  const hour = lookup.get("hour");
  const minute = lookup.get("minute");
  const second = lookup.get("second");
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error(`Intl.DateTimeFormat did not return the expected parts for ${timeZone}`);
  }

  const asIfUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return (asIfUtc - instant.getTime()) / 60_000;
}

/**
 * Converts a local calendar `day` (`YYYY-MM-DD`) plus an `offsetMinutes`
 * countdown into the epoch-seconds instant that many minutes before
 * `END_OF_DAY_LOCAL_MINUTES` (23:59) local time in `timeZone` (AC-3, AC-14).
 *
 * Reads no ambient clock: every instant is derived from `day`/`offsetMinutes`
 * and the explicit `timeZone` argument, never from `Date.now()`. The offset
 * is recomputed from the target wall-clock moment itself (via
 * `offsetMinutesAt`, refined once) rather than assumed fixed, because
 * Brazil's historical DST years are still representable dates even though
 * `America/Sao_Paulo` has carried a fixed -03:00 offset since 2019.
 */
export function offsetToInstant(
  day: string,
  offsetMinutes: number,
  timeZone: string = PRAESTO_TIMEZONE,
): number {
  const [yearText, monthText, dayText] = day.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const date = Number(dayText);

  const totalMinutesFromMidnight = END_OF_DAY_LOCAL_MINUTES - offsetMinutes;
  const hours = Math.floor(totalMinutesFromMidnight / 60);
  const minutes = totalMinutesFromMidnight - hours * 60;

  // The target wall-clock moment, expressed as if it were already UTC — a
  // convenient number to diff against, not a real instant. `Date.UTC` rolls
  // over out-of-range hours/minutes (including negative ones) into the
  // adjacent day/month/year on its own.
  const wallClockAsIfUtc = Date.UTC(year, month - 1, date, hours, minutes, 0);

  const firstPassOffset = offsetMinutesAt(new Date(wallClockAsIfUtc), timeZone);
  let instantMs = wallClockAsIfUtc - firstPassOffset * 60_000;

  // Refine once against the actual candidate instant, in case the first pass
  // landed on the other side of a DST transition from the target wall clock.
  const secondPassOffset = offsetMinutesAt(new Date(instantMs), timeZone);
  if (secondPassOffset !== firstPassOffset) {
    instantMs = wallClockAsIfUtc - secondPassOffset * 60_000;
  }

  return Math.floor(instantMs / 1000);
}

/**
 * Splits an epoch-seconds instant into its local calendar day (`YYYY-MM-DD`)
 * and time (`HH:mm`) in `timeZone` — the inverse shape `localPartsToInstant`
 * consumes for the absolute-Reminder date/time inputs. Reads no ambient
 * clock beyond the `epochSeconds` handed in.
 */
export function instantToLocalParts(
  epochSeconds: number,
  timeZone: string = PRAESTO_TIMEZONE,
): { day: string; time: string } {
  const instant = new Date(epochSeconds * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);

  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const year = lookup.get("year");
  const month = lookup.get("month");
  const day = lookup.get("day");
  const hour = lookup.get("hour");
  const minute = lookup.get("minute");
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new Error(`Intl.DateTimeFormat did not return the expected parts for ${timeZone}`);
  }

  return { day: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

/**
 * Converts a local calendar `day` (`YYYY-MM-DD`) plus a local `time`
 * (`HH:mm`) into the epoch-seconds instant they name in `timeZone` — the
 * absolute-Reminder counterpart to `offsetToInstant`'s relative one, sharing
 * the exact same two-pass DST-refinement technique.
 */
export function localPartsToInstant(
  day: string,
  time: string,
  timeZone: string = PRAESTO_TIMEZONE,
): number {
  const [yearText, monthText, dayText] = day.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const date = Number(dayText);
  const [hourText, minuteText] = time.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  const wallClockAsIfUtc = Date.UTC(year, month - 1, date, hours, minutes, 0);

  const firstPassOffset = offsetMinutesAt(new Date(wallClockAsIfUtc), timeZone);
  let instantMs = wallClockAsIfUtc - firstPassOffset * 60_000;

  const secondPassOffset = offsetMinutesAt(new Date(instantMs), timeZone);
  if (secondPassOffset !== firstPassOffset) {
    instantMs = wallClockAsIfUtc - secondPassOffset * 60_000;
  }

  return Math.floor(instantMs / 1000);
}
