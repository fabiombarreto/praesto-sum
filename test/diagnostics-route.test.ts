// PRPs/prds/push-channel-proven.prd.md AC-7 diagnostics-endpoint-is-bearer-gated-and-complete
//
// Route suite for `GET /api/diagnostics` (`src/worker/routes/diagnostics.ts`,
// phase 3 cron-heartbeat, plan Task 9 / plan AC-A3). Composes four facts —
// last cron run, derived freshness, stored-subscription count, last dispatch
// attempt — and is bearer-gated like every other `/api/*` route (no auth code
// of its own; `requireToken` already applies once mounted below the existing
// gate line).
//
// Preconditions are seeded directly against the D1 tables via Drizzle (the
// same idiom `test/push-test-route.test.ts` and `test/google-routes.test.ts`
// use for their own fixture rows) rather than through another route, so this
// suite exercises `GET /api/diagnostics` in isolation from
// `POST /api/push/test`'s own write path (covered separately in
// `test/push-test-route.test.ts`).
//
// Written BEFORE the Implementer (test-first): `src/worker/routes/diagnostics.ts`,
// `cron_runs` and `push_dispatch_attempts` do not exist yet, so this file is
// RED for the right reason (route not mounted / missing tables) until plan
// Tasks 1, 2, 3, 6, 7, 9 and 10 land.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/worker/db/client";
import {
  cronRuns,
  PUSH_DISPATCH_ATTEMPT_ID,
  pushDispatchAttempts,
  pushSubscriptions,
} from "../src/worker/db/schema";

const DIAGNOSTICS = "https://example.com/api/diagnostics";

function auth(): RequestInit {
  return { headers: { Authorization: `Bearer ${env.API_BEARER_TOKEN}` } };
}

interface DiagnosticsBody {
  lastRun: {
    instant: number;
    outcome: string;
    durationMs: number;
    errorMessage: string | null;
  } | null;
  freshness: string;
  subscriptionCount: number;
  lastDispatch: {
    instant: number;
    results: { endpoint: string; outcome: { kind: string; statusCode?: number } }[];
  } | null;
}

beforeEach(async () => {
  const db = createDb(env);
  await db.delete(cronRuns);
  await db.delete(pushDispatchAttempts);
  await db.delete(pushSubscriptions);
});

describe("GET /api/diagnostics — AC-A3 (PRD AC-7): bearer gate", () => {
  it("answers 401 and leaks no diagnostics field without a valid bearer token", async () => {
    const res = await exports.default.fetch(DIAGNOSTICS);

    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).not.toContain("lastRun");
    expect(body).not.toContain("subscriptionCount");
    expect(body).not.toContain("freshness");
    expect(body).not.toContain("lastDispatch");
  });
});

describe("GET /api/diagnostics — AC-A3 (PRD AC-7): empty state", () => {
  it("reports null lastRun, unknown freshness, zero subscriptionCount and null lastDispatch when nothing has ever happened", async () => {
    const res = await exports.default.fetch(DIAGNOSTICS, auth());

    expect(res.status).toBe(200);
    const body = (await res.json()) as DiagnosticsBody;
    expect(body.lastRun).toBeNull();
    expect(body.freshness).toBe("unknown");
    expect(body.subscriptionCount).toBe(0);
    expect(body.lastDispatch).toBeNull();
  });
});

describe("GET /api/diagnostics — AC-A3 (PRD AC-7): populated response", () => {
  it("carries the last cron run's instant and outcome, the derived fresh state, the subscription count, and the last dispatch attempt", async () => {
    const db = createDb(env);
    const startedAt = new Date(Date.now() - 60_000); // 1 minute ago -> fresh
    await db.insert(cronRuns).values({
      id: "run-1",
      startedAt,
      outcome: "success",
      durationMs: 42,
      errorMessage: null,
    });
    await db.insert(pushSubscriptions).values([
      { id: "sub-1", endpoint: "https://push.invalid/diag-one", p256dh: "k1", auth: "a1" },
      { id: "sub-2", endpoint: "https://push.invalid/diag-two", p256dh: "k2", auth: "a2" },
    ]);
    const attemptedAt = new Date(Date.now() - 30_000);
    const results = [
      {
        endpoint: "https://push.invalid/diag-one",
        outcome: { kind: "delivered", statusCode: 201 },
      },
    ];
    await db.insert(pushDispatchAttempts).values({
      id: PUSH_DISPATCH_ATTEMPT_ID,
      attemptedAt,
      results: JSON.stringify(results),
    });

    const res = await exports.default.fetch(DIAGNOSTICS, auth());

    expect(res.status).toBe(200);
    const body = (await res.json()) as DiagnosticsBody;
    expect(body.lastRun?.outcome).toBe("success");
    expect(body.lastRun?.durationMs).toBe(42);
    expect(body.lastRun?.errorMessage).toBeNull();
    expect(body.lastRun?.instant).toBe(Math.floor(startedAt.getTime() / 1000));
    expect(body.freshness).toBe("fresh");
    expect(body.subscriptionCount).toBe(2);
    expect(body.lastDispatch?.instant).toBe(Math.floor(attemptedAt.getTime() / 1000));
    expect(body.lastDispatch?.results).toEqual(results);
  });

  it("reports stale when the last cron run is 10 minutes old or more", async () => {
    const db = createDb(env);
    await db.insert(cronRuns).values({
      id: "run-old",
      startedAt: new Date(Date.now() - 11 * 60_000),
      outcome: "success",
      durationMs: 5,
      errorMessage: null,
    });

    const res = await exports.default.fetch(DIAGNOSTICS, auth());

    const body = (await res.json()) as DiagnosticsBody;
    expect(body.freshness).toBe("stale");
  });

  it("surfaces a failed cron run's outcome and error message rather than hiding the failure", async () => {
    const db = createDb(env);
    await db.insert(cronRuns).values({
      id: "run-fail",
      startedAt: new Date(),
      outcome: "failure",
      durationMs: 3,
      errorMessage: "boom - the job body threw",
    });

    const res = await exports.default.fetch(DIAGNOSTICS, auth());

    const body = (await res.json()) as DiagnosticsBody;
    expect(body.lastRun?.outcome).toBe("failure");
    expect(body.lastRun?.errorMessage).toBe("boom - the job body threw");
  });
});
