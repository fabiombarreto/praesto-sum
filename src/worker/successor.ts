import { occurrenceReminderInstants, type RecurrenceRule } from "../shared/recurrence";
import type { createDb } from "./db/client";
import { reminders, tasks, type RecurrenceSeries } from "./db/schema";

/**
 * Successor-building helpers shared by the Task routes (complete / delete) and
 * the cron's missed sweep (unit 10). They build statements and never execute
 * them: the caller splices them into its own `db.batch([...])`.
 */

/**
 * Maps a `recurrenceSeries` row to `src/shared/recurrence.ts`'s
 * `RecurrenceRule`. `byWeekday` is decoded here — the route boundary
 * `src/shared/recurrence.ts:34-36`'s own doc comment anticipates — since
 * Phase 2's `POST /api/series` only ever encoded it for storage and never
 * needed to read it back (`firstOccurrence` never consults it).
 */
export function buildRecurrenceRule(series: RecurrenceSeries): RecurrenceRule {
  return {
    freq: series.freq,
    interval: series.interval,
    byWeekday: series.byWeekday === null ? null : (JSON.parse(series.byWeekday) as number[]),
    byMonthday: series.byMonthday,
    dtstart: series.dtstart,
    timezone: series.timezone,
    anchorMode: series.anchorMode,
    endKind: series.endKind,
    untilDate: series.untilDate,
    maxCount: series.maxCount,
  };
}

/**
 * Builds (never executes) the Task-insert-plus-Reminders statements for a new
 * occurrence of `series` on `occurrenceDate`, generalizing
 * `src/worker/routes/series.ts:169-220`'s first-occurrence materialization
 * shape to read the template from an existing `RecurrenceSeries` row instead
 * of a validated POST body. The caller splices `statements` into its own
 * `db.batch([...])` array alongside the Task-status-changing statement, so
 * the whole write — closing/skipping the current occurrence AND spawning the
 * next one — stays one atomic operation.
 *
 * `options.armReminders === false` omits the Reminder inserts (a successor
 * that is still dated before today gets none — missed-sweep D-B).
 */
export async function buildSuccessorStatements(
  db: ReturnType<typeof createDb>,
  series: RecurrenceSeries,
  occurrenceDate: string,
  options: { armReminders?: boolean } = {},
): Promise<{ successorId: string; statements: unknown[] }> {
  const armReminders = options.armReminders ?? true;
  const reminderOffsets =
    series.reminderOffsets === null ? [] : (JSON.parse(series.reminderOffsets) as number[]);
  const reminderInstants = armReminders
    ? occurrenceReminderInstants(occurrenceDate, reminderOffsets, series.timezone)
    : [];

  const successorId = crypto.randomUUID();

  return {
    successorId,
    statements: [
      db
        .insert(tasks)
        .values({
          id: successorId,
          // Non-null: recurrence_series_template_chk guarantees title is set for kind='task'.
          title: series.title!,
          description: series.description,
          deadline: series.dateMode === "deadline" ? occurrenceDate : null,
          scheduledDate: series.dateMode === "scheduled" ? occurrenceDate : null,
          priority: series.priority,
          lifeAreaId: series.lifeAreaId,
          seriesId: series.id,
          occurrenceDate,
        })
        .returning(),
      ...reminderInstants.map((instant, index) =>
        db.insert(reminders).values({
          id: crypto.randomUUID(),
          taskId: successorId,
          fireAt: new Date(instant * 1000),
          originOffsetMinutes: reminderOffsets[index] ?? null,
        }),
      ),
    ],
  };
}

/**
 * Builds (never executes) the insert of one catch-up occurrence recorded as
 * `missed`: the series template, the date in `deadline` or `scheduledDate` per
 * `dateMode`, no `completedAt` (`tasks_completed_at_chk`) and no Reminders.
 */
export function buildMissedOccurrenceStatement(
  db: ReturnType<typeof createDb>,
  series: RecurrenceSeries,
  occurrenceDate: string,
) {
  return db.insert(tasks).values({
    id: crypto.randomUUID(),
    // Non-null: recurrence_series_template_chk guarantees title is set for kind='task'.
    title: series.title!,
    description: series.description,
    status: "missed",
    completedAt: null,
    detached: false,
    deadline: series.dateMode === "deadline" ? occurrenceDate : null,
    scheduledDate: series.dateMode === "scheduled" ? occurrenceDate : null,
    priority: series.priority,
    lifeAreaId: series.lifeAreaId,
    seriesId: series.id,
    occurrenceDate,
  });
}

/** True for a D1/SQLite unique-index violation (e.g. a lost race on a series' open or occurrence row). */
export function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
