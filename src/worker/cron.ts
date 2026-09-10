import { and, eq, isNull, lte } from "drizzle-orm";
import * as cronModule from "./cron";
import { createDb } from "./db/client";
import { cronRuns, pushSubscriptions, reminders, tasks, type Task } from "./db/schema";
import { classifyPushOutcome, type PushOutcome } from "../shared/push-outcome";
import { buildNotificationPayload } from "../shared/push-payload";
import { pathOf, taskRouteOf } from "../shared/app-route";
import { sendPush } from "./push/send";

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
export async function runScheduledJob(env: Env): Promise<void> {
  const db = createDb(env);
  const now = new Date();

  const dueReminders = await db
    .select()
    .from(reminders)
    .where(and(isNull(reminders.sentAt), lte(reminders.fireAt, now)));

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  for (const reminder of dueReminders) {
    const [claimed] = await db
      .update(reminders)
      .set({ sentAt: now })
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
