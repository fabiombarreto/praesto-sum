/**
 * Unit 4 `google-calendar-read`, phase 2 — the unauthenticated callback.
 *
 * Covers PRD **AC-2** (the callback refuses every state it did not mint) and
 * **AC-3** (a valid callback stores the credential exactly once).
 *
 * This is the project's first route reachable without a bearer token, so it is
 * the one place where ADR-0003 safeguard 4 is deliberately scoped rather than
 * upheld. The nonce is what closes it, and these tests are the argument: the
 * refusal path must make ZERO outbound calls and write NOTHING, or the route
 * is an unauthenticated trigger for traffic to a third party.
 *
 * `vi.stubGlobal("fetch", …)` is used rather than dependency injection because
 * the request travels through the real Hono app, where there is no parameter
 * to inject. It was verified to work under workerd in this pool.
 */

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../src/worker/db/client";
import { googleConnections, oauthStates } from "../src/worker/db/schema";

const CALLBACK = "https://example.com/oauth/callback";

let outbound: Request[] = [];

/** Replaces global fetch, recording every outbound call and replying as dictated. */
function stubFetch(reply: () => Response) {
  outbound = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    outbound.push(new Request(input as RequestInfo, init));
    return reply();
  });
}

function tokenReply(): Response {
  return new Response(JSON.stringify({ refresh_token: "the-refresh-token" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** A deliberate refusal is 4xx. A 500 is a crash, and must never satisfy a test that exists to prove the callback rejected on purpose. */
function expectRefused(res: Response): void {
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
}

/**
 * Inserts a nonce row.
 *
 * `createdAt` is derived as one TTL before `expiresAt` rather than pinned to
 * "now", because the schema enforces `expires_at > created_at` and an EXPIRED
 * nonce is one whose creation is also in the past — a nonce created now and
 * already expired is not a state the route can ever encounter. Deriving it
 * keeps every fixture a state production could actually produce.
 */
const NONCE_TTL_SECONDS = 10 * 60;

async function mintNonce(id: string, overrides: { expiresAt?: number; consumedAt?: number } = {}) {
  const db = createDb(env);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = overrides.expiresAt ?? now + NONCE_TTL_SECONDS;
  await db.insert(oauthStates).values({
    id,
    createdAt: new Date((expiresAt - NONCE_TTL_SECONDS) * 1000),
    expiresAt: new Date(expiresAt * 1000),
    consumedAt: overrides.consumedAt ? new Date(overrides.consumedAt * 1000) : null,
  });
}

async function connectionCount(): Promise<number> {
  const db = createDb(env);
  return (await db.select().from(googleConnections)).length;
}

async function nonce(id: string) {
  const db = createDb(env);
  const rows = await db.select().from(oauthStates).where(eq(oauthStates.id, id));
  return rows[0] ?? null;
}

beforeEach(async () => {
  const db = createDb(env);
  await db.delete(googleConnections);
  await db.delete(oauthStates);
  stubFetch(tokenReply);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the callback refuses every state it did not mint (AC-2)", () => {
  it("rejects a state that was never minted, without calling Google at all", async () => {
    const res = await exports.default.fetch(`${CALLBACK}?code=c&state=never-minted`);

    expectRefused(res);
    // The load-bearing assertion: an unauthenticated route must not be a
    // trigger for outbound traffic to a third party.
    expect(outbound).toHaveLength(0);
    expect(await connectionCount()).toBe(0);
  });

  it("rejects an already-consumed state", async () => {
    const now = Math.floor(Date.now() / 1000);
    await mintNonce("consumed", { consumedAt: now - 5 });

    const res = await exports.default.fetch(`${CALLBACK}?code=c&state=consumed`);

    expectRefused(res);
    expect(outbound).toHaveLength(0);
    expect(await connectionCount()).toBe(0);
  });

  it("rejects an expired state", async () => {
    const now = Math.floor(Date.now() / 1000);
    await mintNonce("expired", { expiresAt: now - 1 });

    const res = await exports.default.fetch(`${CALLBACK}?code=c&state=expired`);

    expectRefused(res);
    expect(outbound).toHaveLength(0);
    expect(await connectionCount()).toBe(0);
  });

  it("rejects a request carrying no state at all", async () => {
    const res = await exports.default.fetch(`${CALLBACK}?code=c`);

    expectRefused(res);
    expect(outbound).toHaveLength(0);
  });

  it("rejects a request carrying no code, without consuming the nonce", async () => {
    await mintNonce("valid-no-code");

    const res = await exports.default.fetch(`${CALLBACK}?state=valid-no-code`);

    expectRefused(res);
    expect(outbound).toHaveLength(0);
    // A malformed request must not burn a nonce the owner could still use.
    expect((await nonce("valid-no-code"))?.consumedAt ?? null).toBeNull();
  });

  it("rejects Google's own error redirect without calling Google", async () => {
    // The user pressing "Cancel" on the consent screen lands here.
    await mintNonce("denied");

    const res = await exports.default.fetch(`${CALLBACK}?error=access_denied&state=denied`);

    expectRefused(res);
    expect(outbound).toHaveLength(0);
    expect(await connectionCount()).toBe(0);
  });
});

describe("a valid callback stores the credential exactly once (AC-3)", () => {
  it("exchanges the code and stores the refresh token", async () => {
    await mintNonce("good");

    // `redirect: "manual"` — exports.default.fetch() auto-follows redirects
    // (it is the typed successor to the deprecated `SELF: Fetcher`), and the
    // success leg now answers 302 (phase 5, Task 9). An auto-followed request
    // for /settings has no Worker route in this harness and would surface as
    // a 404 here instead of the callback's own response. See
    // test/oauth-callback-redirect.test.ts's header comment and
    // PRPs/reports/google-calendar-read/phase-5/halt.json for the full
    // arbitration record (DISPUTE_UPHELD_TEST_WRONG). The assertion below is
    // unchanged: `status < 400` already accepted either the old 200 or the
    // new 302, which is why only the observation — never the contract —
    // needed correcting.
    const res = await exports.default.fetch(`${CALLBACK}?code=auth-code&state=good`, {
      redirect: "manual",
    });

    expect(res.status).toBeLessThan(400);
    expect(outbound).toHaveLength(1);
    expect(outbound[0]!.url).toBe("https://oauth2.googleapis.com/token");
    expect(await connectionCount()).toBe(1);
  });

  it("marks the nonce consumed", async () => {
    await mintNonce("good");

    await exports.default.fetch(`${CALLBACK}?code=auth-code&state=good`);

    expect((await nonce("good"))?.consumedAt ?? null).not.toBeNull();
  });

  it("makes a replay of the identical URL fail and change nothing", async () => {
    await mintNonce("good");
    await exports.default.fetch(`${CALLBACK}?code=auth-code&state=good`);
    outbound = [];

    const replay = await exports.default.fetch(`${CALLBACK}?code=auth-code&state=good`);

    expectRefused(replay);
    expect(outbound).toHaveLength(0);
    // Still exactly one connection — the replay neither duplicated nor
    // overwrote what the first call stored.
    expect(await connectionCount()).toBe(1);
  });

  it("stores no credential when Google rejects the exchange", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    await mintNonce("bad-code");

    const res = await exports.default.fetch(`${CALLBACK}?code=stale&state=bad-code`);

    expectRefused(res);
    expect(await connectionCount()).toBe(0);
  });

  it("never echoes the refresh token back in the response body", async () => {
    await mintNonce("good");

    const res = await exports.default.fetch(`${CALLBACK}?code=auth-code&state=good`);

    expect(await res.text()).not.toContain("the-refresh-token");
  });
});

describe("the callback is reachable without a bearer token", () => {
  it("does not answer 401 — it lives outside /api/*, where the gate applies", async () => {
    // If this ever starts answering 401, the bearer middleware has been
    // widened past /api/*, and the OAuth flow is silently broken in a way
    // only a real consent round-trip would reveal.
    const res = await exports.default.fetch(`${CALLBACK}?code=c&state=never-minted`);

    expect(res.status).not.toBe(401);
  });
});
