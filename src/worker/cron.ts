import * as cronModule from "./cron";
import { createDb } from "./db/client";
import { cronRuns } from "./db/schema";

/**
 * `scheduled()`'s job body (unit 6 phase 3, PRD AC-5 / AC-6 / unit 7).
 *
 * Intentionally empty placeholder: unit 7 will land the due-Reminder scan
 * here. This phase reads no Reminder. Exported specifically so a test can
 * override its behavior (e.g. `vi.mock("../src/worker/cron", ...)`) to force
 * a throw and exercise `runCronHeartbeat`'s failure path without any real
 * job logic existing yet.
 */
export async function runScheduledJob(_env: Env): Promise<void> {}

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
