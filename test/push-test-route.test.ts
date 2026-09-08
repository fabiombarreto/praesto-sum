// PRPs/prds/push-channel-proven.prd.md AC-3 dead-endpoints-are-pruned,
// AC-4 transient-failures-are-not-pruned, AC-8 manual-test-push-reports-its-outcome
//
// Route suite for `POST /api/push/test` (`src/worker/routes/push.ts`, phase 2
// subscription-lifecycle, plan Task 5 / plan AC-A2, AC-A3, AC-A4). The push
// service's HTTP response is controlled with `vi.stubGlobal("fetch", ...)` —
// the same seam `test/google-routes.test.ts` already uses for its own
// outbound calls. This is NOT a mock of the SUT (the route plus the D1
// database under test); it substitutes only the external push service's
// response, which is the only way to deterministically observe a 404/410 or
// a 5xx from `sendPush()` without ever reaching a real push service or
// device — `sendPush()`'s own signing/encryption path still runs for real
// against genuine P-256 keys (mirroring `test/push-send-adapter.test.ts`'s
// `crypto.subtle`-generated-key idiom), only the final `fetch()` call is
// substituted.
//
// Written BEFORE the Implementer (test-first): `src/worker/routes/push.ts`
// does not exist yet, so this file is RED for the right reason (route not
// mounted, 404) until plan Tasks 1, 2, 4, 5 and 6 land.

import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../src/worker/db/client";
import {
  PUSH_DISPATCH_ATTEMPT_ID,
  pushDispatchAttempts,
  pushSubscriptions,
} from "../src/worker/db/schema";

const TEST_PUSH = "https://example.com/api/push/test";

function auth(): RequestInit {
  return { method: "POST", headers: { Authorization: `Bearer ${env.API_BEARER_TOKEN}` } };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A structurally valid P-256 key pair — correct lengths and shape, so
 * `@block65/webcrypto-web-push`'s `buildPushPayload` accepts it and proceeds
 * into its real signing/encryption path before the (stubbed) network call,
 * exactly like `test/push-send-adapter.test.ts`'s own helper.
 */
async function generateP256Keys(): Promise<{ p256dh: string; auth: string }> {
  const keyPair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const rawPublicKey = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer,
  );
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return { p256dh: base64UrlEncode(rawPublicKey), auth: base64UrlEncode(authSecret) };
}

async function seedSubscription(id: string, endpoint: string): Promise<void> {
  const keys = await generateP256Keys();
  await createDb(env)
    .insert(pushSubscriptions)
    .values({ id, endpoint, p256dh: keys.p256dh, auth: keys.auth });
}

async function endpointsStillStored(): Promise<string[]> {
  const rows = await createDb(env).select().from(pushSubscriptions);
  return rows.map((row) => row.endpoint);
}

/** Routes each stubbed response by matching the request's own target URL. */
function stubFetchByEndpoint(responses: Record<string, () => Response>) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const reply = responses[url];
    if (reply === undefined) {
      throw new Error(`Unstubbed fetch to ${url} — a real network call would fire`);
    }
    return reply();
  });
}

beforeEach(async () => {
  await createDb(env).delete(pushSubscriptions);
  // Phase 3 cron-heartbeat (plan Task 8): also reset the singleton dispatch-
  // attempt row so each test starts from "no attempt has ever been made".
  await createDb(env).delete(pushDispatchAttempts);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/push/test — AC-A4 (PRD AC-8): zero stored subscriptions", () => {
  it("reports ok:false with an explicit error, never a vacuous success", async () => {
    const res = await exports.default.fetch(TEST_PUSH, auth());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; error?: string; results: unknown[] };
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
    expect((body.error ?? "").length).toBeGreaterThan(0);
    expect(body.results).toEqual([]);
  });
});

describe("POST /api/push/test — AC-A2 (PRD AC-3): a 404/410 response prunes exactly that endpoint", () => {
  it("deletes only the dead endpoint's row, leaves the live one stored, and names both outcomes", async () => {
    const DEAD = "https://push.invalid/dead-endpoint";
    const ALIVE = "https://push.invalid/alive-endpoint";
    await seedSubscription("sub-dead", DEAD);
    await seedSubscription("sub-alive", ALIVE);
    stubFetchByEndpoint({
      [DEAD]: () => new Response("gone", { status: 410 }),
      [ALIVE]: () => new Response(null, { status: 201 }),
    });

    const res = await exports.default.fetch(TEST_PUSH, auth());

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      results: { endpoint: string; outcome: { kind: string; statusCode?: number } }[];
    };
    expect(body.ok).toBe(true);
    const deadResult = body.results.find((r) => r.endpoint === DEAD);
    const aliveResult = body.results.find((r) => r.endpoint === ALIVE);
    expect(deadResult?.outcome.kind).toBe("gone");
    expect(aliveResult?.outcome.kind).toBe("delivered");
    expect(aliveResult?.outcome.statusCode).toBe(201);

    // "Exactly that row" — the dead endpoint is gone, the alive one is not.
    const remaining = await endpointsStillStored();
    expect(remaining).toEqual([ALIVE]);
  }, 10_000);
});

describe("POST /api/push/test — AC-A3 (PRD AC-4): a transient failure never prunes the subscription", () => {
  it("keeps the row stored and reports the retryable outcome with its status code", async () => {
    const FLAKY = "https://push.invalid/flaky-endpoint";
    await seedSubscription("sub-flaky", FLAKY);
    stubFetchByEndpoint({ [FLAKY]: () => new Response("unavailable", { status: 503 }) });

    const res = await exports.default.fetch(TEST_PUSH, auth());

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { endpoint: string; outcome: { kind: string; statusCode?: number } }[];
    };
    const result = body.results.find((r) => r.endpoint === FLAKY);
    expect(result?.outcome.kind).toBe("retryable");
    expect(result?.outcome.statusCode).toBe(503);

    // A transient error never silently discards the owner's only subscription.
    const remaining = await endpointsStillStored();
    expect(remaining).toEqual([FLAKY]);
  }, 10_000);
});

// PRPs/prds/push-channel-proven.prd.md AC-7 diagnostics-endpoint-is-bearer-gated-and-complete
//
// Phase 3 cron-heartbeat (plan Task 8 / plan AC-A3) teaches this same route to
// persist its own outcome into `push_dispatch_attempts` — the "last dispatch
// attempt" half of `GET /api/diagnostics`'s response (`test/diagnostics-route.test.ts`
// covers the read/compose side against directly-seeded rows; this block
// covers the real write path in isolation from that other route).
describe("POST /api/push/test — AC-A3 (PRD AC-7): persists its outcome as the last dispatch attempt", () => {
  it("upserts one push_dispatch_attempts row carrying the per-endpoint results", async () => {
    const ENDPOINT = "https://push.invalid/persisted-endpoint";
    await seedSubscription("sub-persist", ENDPOINT);
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response(null, { status: 201 }) });

    await exports.default.fetch(TEST_PUSH, auth());

    const rows = await createDb(env).select().from(pushDispatchAttempts);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(PUSH_DISPATCH_ATTEMPT_ID);
    const parsed = JSON.parse(rows[0]?.results ?? "[]") as {
      endpoint: string;
      outcome: { kind: string; statusCode?: number };
    }[];
    expect(parsed).toEqual([
      { endpoint: ENDPOINT, outcome: { kind: "delivered", statusCode: 201 } },
    ]);
  }, 10_000);

  it("upserts in place on a second call rather than accumulating rows", async () => {
    const ENDPOINT = "https://push.invalid/upsert-endpoint";
    await seedSubscription("sub-upsert", ENDPOINT);
    stubFetchByEndpoint({ [ENDPOINT]: () => new Response(null, { status: 201 }) });

    await exports.default.fetch(TEST_PUSH, auth());
    await exports.default.fetch(TEST_PUSH, auth());

    const rows = await createDb(env).select().from(pushDispatchAttempts);
    expect(rows).toHaveLength(1);
  }, 15_000);

  it("does not persist an attempt when there were zero stored subscriptions", async () => {
    const res = await exports.default.fetch(TEST_PUSH, auth());

    expect(res.status).toBe(200);
    const rows = await createDb(env).select().from(pushDispatchAttempts);
    expect(rows).toHaveLength(0);
  });
});
