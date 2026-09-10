// PRPs/prds/reminders.prd.md AC-8 The payload deep-links to the Task, not to
// the home screen.
//
// Source plan: PRPs/plans/reminders-phase-3-per-task-route-and-reminder-ui.plan.md
// (Task 2 — src/worker/cron.ts: import pathOf/taskRouteOf from
// ../shared/app-route and point the sweep's payload `route` field at the
// Task's path when `reminder.taskId !== null`, keeping `/` for a standalone
// Reminder; plan AC-A1).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): today
// `src/shared/app-route.ts` has no `taskRouteOf` export at all (a
// compile-time import error on the import below until plan Task 1 lands),
// and even once it does, `runScheduledJob`'s payload hard-codes
// `route: "/"` regardless of `reminder.taskId` (`src/worker/cron.ts:60`) — so
// the first assertion below is genuinely red until plan Task 2 lands too.
//
// Isolated in its own file, separate from test/cron-sweep.test.ts (phase 2's
// own suite), because this is the one assertion in the whole sweep that needs
// the PLAINTEXT payload `sendPush` is handed, before
// `@block65/webcrypto-web-push` encrypts it for the wire. Every other sweep
// behaviour (claim-before-send, retry-on-retryable, prune-on-gone, suppress
// closed Tasks, no-lower-bound overdue dispatch) is already proven there
// against the real encrypted round trip and stays untouched by this file.
//
// Mocking discipline — CORRECTED 2026-09-09 after an implementer-raised
// TEST_CONTRACT_DISPUTE, arbitrated DISPUTE_UPHELD_TEST_WRONG by
// code-reviewer (independent throwaway repro): a cross-module
// `vi.mock("../src/worker/push/send", () => ({ sendPush: ... }))` factory
// does NOT intercept the already-bound `import { sendPush } from
// "./push/send"` inside `src/worker/cron.ts` under this project's
// `@cloudflare/vitest-pool-workers` pool. `runScheduledJob` reaches
// `sendPush` only through `cron.ts`'s own binding, so with the old factory
// it called the REAL `sendPush`, which threw on this file's fixture
// `p256dh`/`auth` values (not valid base64/P-256 material),
// `classifyPushOutcome` swallowed the throw as retryable, and the mock was
// legitimately never invoked — failing for a reason unrelated to the AC-8
// route assertions this file exists to prove.
//
// Fix: `import * as sendModule from "../src/worker/push/send"` plus
// `vi.spyOn(sendModule, "sendPush")` — a runtime property mutation on the
// shared module-exports object, which `cron.ts`'s own import observes,
// exactly the pattern `test/cron-heartbeat.test.ts` already documents and
// verifies for this same pool (see that file's own "MOCKING MECHANISM"
// header comment). `sendPush` is still the documented thin, exempt network
// adapter (`docs/context/methodology.md`'s Browser-API split, restated in
// `src/worker/push/send.ts`'s own header) — not the SUT under test here
// (`runScheduledJob` is), no interface is violated, the spy is one level
// deep, and every assertion below checks an EFFECT — the actual `route`
// value inside the captured payload argument — never a bare
// `toHaveBeenCalled()`. This rewrite changes only the mocking mechanism:
// every assertion, including `toHaveBeenCalledTimes(1)`, is unchanged, and
// the suite still fails red against a `cron.ts` that hardcodes
// `route: "/"` (confirmed during arbitration).

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../src/worker/db/client";
import { pushSubscriptions, reminders, tasks } from "../src/worker/db/schema";
import { pathOf, routeFromPath, taskRouteOf } from "../src/shared/app-route";
import { runScheduledJob } from "../src/worker/cron";
import * as sendModule from "../src/worker/push/send";
import { DRAIN_BUDGET_MS, resetTaskTables } from "./isolation";

const sendPushMock = vi
  .spyOn(sendModule, "sendPush")
  .mockImplementation(async () => ({ ok: true, statusCode: 201 }));

beforeEach(async () => {
  await resetTaskTables();
  await createDb(env).delete(reminders);
  await createDb(env).delete(pushSubscriptions);
  sendPushMock.mockClear();
}, DRAIN_BUDGET_MS);

const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000);

async function insertSubscription(endpoint: string): Promise<void> {
  await createDb(env)
    .insert(pushSubscriptions)
    .values({ id: crypto.randomUUID(), endpoint, p256dh: "fake-p256dh", auth: "fake-auth" });
}

function parsedPayloadFromCall(callIndex: number): { data: { route: string } } {
  const call = sendPushMock.mock.calls[callIndex] as [unknown, string, unknown] | undefined;
  if (call === undefined) {
    throw new Error(`sendPush was not called at index ${callIndex}`);
  }
  return JSON.parse(call[1] as string) as { data: { route: string } };
}

describe("runScheduledJob — AC-A1 (PRD AC-8): the payload deep-links to the Task", () => {
  it("carries the Task's own path when the due Reminder is linked to a Task", async () => {
    const taskId = crypto.randomUUID();
    await createDb(env).insert(tasks).values({ id: taskId, title: "Renovar o passaporte" });
    await insertSubscription("https://push.invalid/ac8-task-linked");
    await createDb(env).insert(reminders).values({
      id: crypto.randomUUID(),
      taskId,
      label: null,
      fireAt: FIVE_MIN_AGO,
      originOffsetMinutes: null,
      sentAt: null,
    });

    await runScheduledJob(env);

    expect(sendPushMock).toHaveBeenCalledTimes(1);
    const payload = parsedPayloadFromCall(0);
    const expectedPath = pathOf(taskRouteOf(taskId));
    expect(payload.data.route).toBe(expectedPath);
    // AC-8's own round-trip contract: the path this payload carries survives
    // routeFromPath -> pathOf unchanged.
    expect(pathOf(routeFromPath(payload.data.route))).toBe(payload.data.route);
  }, 15_000);

  it("keeps a standalone Reminder's payload pointed at the home path", async () => {
    await insertSubscription("https://push.invalid/ac8-standalone");
    await createDb(env).insert(reminders).values({
      id: crypto.randomUUID(),
      taskId: null,
      label: "Beber água",
      fireAt: FIVE_MIN_AGO,
      originOffsetMinutes: null,
      sentAt: null,
    });

    await runScheduledJob(env);

    expect(sendPushMock).toHaveBeenCalledTimes(1);
    const payload = parsedPayloadFromCall(0);
    expect(payload.data.route).toBe("/");
  }, 15_000);
});
