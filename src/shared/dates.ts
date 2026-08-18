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
