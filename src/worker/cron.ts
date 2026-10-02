import { and, eq, isNull, lte, sql } from "drizzle-orm";
import * as cronModule from "./cron";
import { createDb } from "./db/client";
import {
  cronRuns,
  pushSubscriptions,
  recurrenceSeries,
  reminders,
  tasks,
  type RecurrenceSeries,
  type Task,
} from "./db/schema";
import { todayIn } from "../shared/dates";
import { planMissedSweep, type MissedSweepPlan } from "../shared/missed-sweep";
import { classifyPushOutcome, type PushOutcome } from "../shared/push-outcome";
import { buildNotificationPayload } from "../shared/push-payload";
import { pathOf, taskRouteOf } from "../shared/app-route";
import { sendPush } from "./push/send";
import {
  buildMissedOccurrenceStatement,
  buildRecurrenceRule,
  buildSuccessorStatements,
  isUniqueConflict,
} from "./successor";

type Db = ReturnType<typeof createDb>;

/**
 * Writes one series' missed-sweep plan as a single `db.batch` (unit 10): the
 * open occurrence closes as `missed` FIRST (`tasks_series_single_open_unq` is
 * checked immediately, so the successor insert needs the open slot free), then
 * the catch-up `missed` rows, then the successor (with or without Reminders as
 * the plan says), then the guarded series counter/status update. The guard
 * makes a lost race — the owner's manual completion, an overlapping run or a
 * skip-delete — match no row, so the counters never move twice; the unique
 * indexes reject any duplicate row and roll the whole batch back.
 *
 * A unique-index conflict means another writer got there first: it returns
 * without throwing. Every other error propagates unchanged.
 */
export async function writeMissedSweepPlan(
  db: Db,
  series: RecurrenceSeries,
  openTask: Task | null,
  plan: MissedSweepPlan,
): Promise<void> {
  const statements: unknown[] = [];

  if (plan.closeOpenAsMissed && openTask !== null) {
    statements.push(
      db
        .update(tasks)
        .set({ status: "missed" })
        .where(and(eq(tasks.id, openTask.id), eq(tasks.status, "open"))),
    );
  }

  for (const date of plan.extraMissedDates) {
    statements.push(buildMissedOccurrenceStatement(db, series, date));
  }

  if (plan.successor !== null) {
    const successor = await buildSuccessorStatements(db, series, plan.successor.date, {
      armReminders: plan.successor.armReminders,
    });
    statements.push(...successor.statements);
  }

  if (plan.missedCountDelta > 0 || plan.endSeries) {
    const set = {
      missedCount: series.missedCount + plan.missedCountDelta,
      ...(plan.endSeries ? { status: "ended" as const } : {}),
    };
    const guard =
      openTask !== null
        ? and(
            eq(recurrenceSeries.id, series.id),
            eq(recurrenceSeries.doneCount, series.doneCount),
            eq(recurrenceSeries.missedCount, series.missedCount),
            sql`exists (select 1 from tasks where id = ${openTask.id} and status = 'missed')`,
          )
        : and(
            eq(recurrenceSeries.id, series.id),
            eq(recurrenceSeries.status, "active"),
            sql`not exists (select 1 from tasks where series_id = ${series.id} and status = 'open')`,
          );
    statements.push(db.update(recurrenceSeries).set(set).where(guard));
  }

  if (statements.length === 0) return;

  try {
    await db.batch(statements as never);
  } catch (error) {
    if (isUniqueConflict(error)) return;
    throw error;
  }
}

function isNoChange(plan: MissedSweepPlan): boolean {
  return !plan.closeOpenAsMissed && plan.successor === null && !plan.endSeries;
}

/**
 * The missed sweep (unit 10): for every open series occurrence, plan against
 * the series' LOCAL day and write the plan; then repair every active series
 * that has no open occurrence. One-off Tasks (`series_id` null) are never
 * selected. Each series is written independently: a unique-index conflict
 * skips that series only, and any other failure is remembered while the loop
 * continues, then thrown once after the last series.
 */
export async function sweepMissedOccurrences(db: Db, now: Date): Promise<void> {
  let firstFailure: { seriesId: string; message: string } | null = null;

  const sweepOne = async (series: RecurrenceSeries, openTask: Task | null) => {
    try {
      const plan = planMissedSweep({
        rule: buildRecurrenceRule(series),
        status: series.status,
        doneCount: series.doneCount,
        missedCount: series.missedCount,
        openOccurrenceDate: openTask === null ? null : openTask.occurrenceDate,
        lastClosedOccurrenceDate: null,
        today: todayIn(now, series.timezone),
      });
      if (isNoChange(plan)) return;
      await writeMissedSweepPlan(db, series, openTask, plan);
    } catch (error) {
      firstFailure ??= {
        seriesId: series.id,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const open = await db
    .select({ task: tasks, series: recurrenceSeries })
    .from(tasks)
    .innerJoin(recurrenceSeries, eq(tasks.seriesId, recurrenceSeries.id))
    .where(and(eq(tasks.status, "open"), eq(recurrenceSeries.kind, "task")))
    .orderBy(tasks.occurrenceDate, tasks.id);
  for (const row of open) await sweepOne(row.series, row.task);

  // Repair pass, read AFTER the first one so a series just rewritten is seen
  // with its fresh open occurrence.
  const active = await db
    .select()
    .from(recurrenceSeries)
    .where(and(eq(recurrenceSeries.kind, "task"), eq(recurrenceSeries.status, "active")));
  const openRows = await db
    .select({ seriesId: tasks.seriesId })
    .from(tasks)
    .where(eq(tasks.status, "open"));
  const withOpen = new Set(openRows.map((row) => row.seriesId));
  for (const series of active) {
    if (!withOpen.has(series.id)) await sweepOne(series, null);
  }

  if (firstFailure !== null) {
    const failure: { seriesId: string; message: string } = firstFailure;
    throw new Error(`missed sweep failed for series ${failure.seriesId}: ${failure.message}`);
  }
}

/**
 * `scheduled()`'s job body (unit 6 phase 3, PRD AC-5 / AC-6 / unit 7).
 *
 * The due-Reminder sweep (reminders phase 2, PRD AC-5/AC-6/AC-7/AC-9/AC-10):
 * scan `reminders` for rows whose `sentAt` is null and whose `fireAt` is at
 * or before now (no lower bound — AC-10); atomically claim each due row with
 * a conditional `UPDATE ... WHERE id = ? AND sent_at IS NULL` before doing
 * anything else (AC-5); skip dispatch — but leave the claim set — for a
 * Reminder whose linked Task is `done` or `missed` (AC-9); otherwise dispatch
 * through the already-proven `sendPush` / `classifyPushOutcome` /
 * `buildNotificationPayload` path to every stored subscription, pruning any
 * that classify `gone` (AC-7); and release the claim (`sentAt` back to
 * `null`) only when at least one dispatch attempt classified `retryable`
 * (AC-6). Exported specifically so a test can override its behavior (e.g.
 * `vi.mock("../src/worker/cron", ...)`) to force a throw and exercise
 * `runCronHeartbeat`'s failure path.
 */
export async function runScheduledJob(env: Env, now: Date = new Date()): Promise<void> {
  const db = createDb(env);

  // The missed sweep runs FIRST so a just-missed occurrence's Reminder is
  // skipped by the sweep below. `now` drives only this sweep; the Reminder
  // sweep keeps its own clock read. A failure is remembered and rethrown after
  // the Reminders went out, so `runCronHeartbeat` still records it.
  let sweepError: unknown = null;
  try {
    await sweepMissedOccurrences(db, now);
  } catch (error) {
    sweepError = error;
  }

  const reminderNow = new Date();

  const dueReminders = await db
    .select()
    .from(reminders)
    .where(and(isNull(reminders.sentAt), lte(reminders.fireAt, reminderNow)));

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  for (const reminder of dueReminders) {
    const [claimed] = await db
      .update(reminders)
      .set({ sentAt: reminderNow })
      .where(and(eq(reminders.id, reminder.id), isNull(reminders.sentAt)))
      .returning();
    if (claimed === undefined) continue;

    let task: Task | undefined;
    if (reminder.taskId !== null) {
      const [found] = await db.select().from(tasks).where(eq(tasks.id, reminder.taskId));
      task = found;
    }
    if (task !== undefined && (task.status === "done" || task.status === "missed")) continue;

    const payload = JSON.stringify(
      buildNotificationPayload({
        title: "Praesto",
        body: reminder.label ?? task?.title ?? "Lembrete",
        route: reminder.taskId !== null ? pathOf(taskRouteOf(reminder.taskId)) : "/",
        tag: `reminder-${reminder.id}`,
      }),
    );

    const subscriptions = await db.select().from(pushSubscriptions);
    const outcomes: PushOutcome[] = [];
    for (const subscription of subscriptions) {
      const result = await sendPush(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        vapid,
      );
      const outcome = classifyPushOutcome(result);
      outcomes.push(outcome);
      if (outcome.kind === "gone") {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      }
    }

    if (outcomes.some((outcome) => outcome.kind === "retryable")) {
      await db.update(reminders).set({ sentAt: null }).where(eq(reminders.id, reminder.id));
    }
  }

  if (sweepError !== null) throw sweepError;
}

/**
 * Times `runScheduledJob`, catches any throw, and writes exactly one
 * `cron_runs` row inside a `finally` block regardless of outcome — this is
 * what makes AC-5 hold: a crash inside `runScheduledJob` still leaves a
 * durable record rather than an absent one.
 *
 * `runScheduledJob` is invoked through this module's own exported binding
 * (`cronModule.runScheduledJob`, a self-import) rather than a bare local
 * call, because a bare local call resolves to the function's local binding
 * and does not observe a `vi.mock` override — this is Vitest's own
 * documented mocking pitfall, and the seam a test relies on to exercise the
 * failure path.
 */
export async function runCronHeartbeat(env: Env): Promise<void> {
  const startedAt = new Date();
  const startMs = Date.now();
  let outcome: "success" | "failure" = "success";
  let errorMessage: string | null = null;

  try {
    await cronModule.runScheduledJob(env);
  } catch (err) {
    outcome = "failure";
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    const durationMs = Date.now() - startMs;
    await createDb(env).insert(cronRuns).values({
      id: crypto.randomUUID(),
      startedAt,
      outcome,
      durationMs,
      errorMessage,
    });
  }
}
