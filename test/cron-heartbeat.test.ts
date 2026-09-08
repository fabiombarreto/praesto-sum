// PRPs/prds/push-channel-proven.prd.md AC-5 every-cron-run-is-recorded
//
// Route/module suite for `src/worker/cron.ts` (phase 3 cron-heartbeat, plan
// Task 4 / plan AC-A1). This is the single most important test this phase
// produces: AC-5 requires that a `cron_runs` row exists EVEN WHEN the job
// body throws, and the plan's own Risk table records that no shell-level
// VALIDATE exercises the throw path — coverage was deliberately deferred to
// this suite. An implementation that records a row only on success must fail
// the first test below.
//
// `runScheduledJob` is exported by `src/worker/cron.ts` "specifically so a
// test can override its behavior" (plan Task 4's own ACTION text) to force a
// throw without any real due-Reminder-scan logic existing yet (that logic is
// unit 7's scope; this phase's `runScheduledJob` is an intentionally empty
// placeholder). `runCronHeartbeat` invokes it through the module's own
// exported binding (a self-import, `import * as cronModule from "./cron"`
// inside cron.ts) rather than a bare local call — that self-import is the
// override seam the plan names.
//
// MOCKING MECHANISM — read before touching this file: a `vi.mock("../src/worker/cron",
// ...)` factory (Vitest's usual module-mocking API) does NOT work here. Vitest's
// transform-time module rewriting intercepts CROSS-module namespace imports
// (module A importing module B), but does not rewrite a module's *own*
// self-import of itself — verified by direct repro against both the default
// Node pool and this project's `@cloudflare/vitest-pool-workers` pool; a
// `vi.mock` + `importOriginal` factory here left `runScheduledJob` unmocked
// from cron.ts's own self-import, so throw-path tests never observed the
// override no matter how the hoisting was fixed. Instead we `import * as
// cronModule from "../src/worker/cron"` (the SAME cached module object
// `cron.ts`'s self-import resolves to) and `vi.spyOn(cronModule,
// "runScheduledJob")` — a runtime property mutation on the shared module
// exports object, not a transform-time rewrite, so cron.ts's own
// `cronModule.runScheduledJob(env)` call observes it. Verified directly: this
// spy-based test suite passes 4/4 against the current (correct)
// `finally`-block implementation, and the two throw-path tests below FAIL
// when `runCronHeartbeat` is edited to record only on the success path —
// i.e. this suite discriminates, which is AC-5's entire point.
//
// Written BEFORE the Implementer (test-first): `src/worker/cron.ts` and the
// `cron_runs` table do not exist yet, so this file is RED for the right
// reason (unresolved import / missing table) until plan Tasks 1, 2 and 4 land.

import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../src/worker/db/client";
import { cronRuns } from "../src/worker/db/schema";
import * as cronModule from "../src/worker/cron";

const { runCronHeartbeat } = cronModule;

beforeEach(async () => {
  await createDb(env).delete(cronRuns);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runCronHeartbeat — AC-A1 (PRD AC-5): a crashed run still produces a row", () => {
  it("records outcome failure with the thrown error's message when the job body throws", async () => {
    vi.spyOn(cronModule, "runScheduledJob").mockRejectedValue(
      new Error("boom - forced failure for AC-5"),
    );

    await runCronHeartbeat(env);

    const rows = await createDb(env).select().from(cronRuns);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe("failure");
    expect(rows[0]?.errorMessage).toBe("boom - forced failure for AC-5");
    expect(typeof rows[0]?.durationMs).toBe("number");
    expect(rows[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records outcome failure even when the thrown value is not an Error instance", async () => {
    vi.spyOn(cronModule, "runScheduledJob").mockRejectedValue("a plain string rejection");

    await runCronHeartbeat(env);

    const rows = await createDb(env).select().from(cronRuns);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe("failure");
    expect(rows[0]?.errorMessage).toContain("a plain string rejection");
  });
});

describe("runCronHeartbeat — AC-A1 (PRD AC-5): a completed run is recorded too", () => {
  it("records outcome success with no error message when the job body resolves", async () => {
    vi.spyOn(cronModule, "runScheduledJob").mockResolvedValue(undefined);
    const before = Date.now();

    await runCronHeartbeat(env);

    const rows = await createDb(env).select().from(cronRuns);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe("success");
    expect(rows[0]?.errorMessage).toBeNull();
    expect(rows[0]?.startedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(rows[0]?.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("writes exactly one row per invocation, never zero and never more than one", async () => {
    vi.spyOn(cronModule, "runScheduledJob").mockResolvedValue(undefined);

    await runCronHeartbeat(env);
    await runCronHeartbeat(env);

    const rows = await createDb(env).select().from(cronRuns);
    expect(rows).toHaveLength(2);
  });
});
