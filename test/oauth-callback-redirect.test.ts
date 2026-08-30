// PRPs/prds/google-calendar-read.prd.md AC-3 (a valid callback stores the
// credential exactly once) — the delta phase 5 adds to this AC's own
// contract. AC-3's exchange/store/consume behaviour is already covered by
// test/oauth-callback.test.ts:159-168 ("exchanges the code and stores the
// refresh token", asserting `status < 400`) and :202-208 ("never echoes the
// refresh token"), and BOTH pass unmodified against either a 200 or a 302,
// because neither asserts an exact status code or inspects headers. What
// they do NOT cover, and what this phase's Task 9 changes, is WHERE the
// success response sends the owner: today it is a dead-end plain-text page;
// this phase makes it a redirect into /settings?google=connected, per the
// plan's AC-A2 and the file's own comment ("Phase 4 replaces this with a
// redirect into the app" — never delivered until now).
//
// Source plan: PRPs/plans/google-calendar-read-phase-5-consent-made-visible.plan.md
// (Task 9 — src/worker/routes/oauth-callback.ts, success leg only; plan AC-A2)
//
// This is a NEW file rather than an edit to test/oauth-callback.test.ts on
// purpose: every assertion that file already makes keeps passing without a
// single line moving, and the missing property (the redirect target) gets
// its own narrow, additive coverage instead of touching a file that does not
// need to change. AC-2 (the refusal path) is untouched by Task 9 — see that
// file — and is not re-asserted here.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`): the
// success leg still returns the phase-2 plain-text body today, so this file
// is RED for the right reason (no 3xx status, no Location header) until plan
// Task 9 lands.

import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../src/worker/db/client";
import { googleConnections, oauthStates } from "../src/worker/db/schema";

const CALLBACK = "https://example.com/oauth/callback";
const NONCE_TTL_SECONDS = 10 * 60;

function stubFetch(reply: () => Response): void {
  vi.stubGlobal("fetch", async () => reply());
}

function tokenReply(): Response {
  return new Response(JSON.stringify({ refresh_token: "the-refresh-token" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function mintNonce(id: string): Promise<void> {
  const db = createDb(env);
  const expiresAt = Math.floor(Date.now() / 1000) + NONCE_TTL_SECONDS;
  await db.insert(oauthStates).values({ id, expiresAt: new Date(expiresAt * 1000) });
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

describe("the callback closes the loop on success (AC-3 delta, plan AC-A2)", () => {
  it("answers a 3xx redirect rather than the phase-2 plain-text page", async () => {
    await mintNonce("good-status");

    const res = await exports.default.fetch(`${CALLBACK}?code=auth-code&state=good-status`);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("points the redirect at /settings?google=connected", async () => {
    await mintNonce("good-location");

    const res = await exports.default.fetch(`${CALLBACK}?code=auth-code&state=good-location`);
    const location = res.headers.get("location") ?? "";

    // Accept either a relative or an absolute Location: `Response.redirect()`
    // resolves a relative target to an absolute URL per the Fetch spec, and
    // both forms send the browser to the same place. The path and query are
    // what the screen actually reads; the header's exact string form is not
    // part of the contract.
    const resolved = new URL(location, CALLBACK);
    expect(resolved.pathname).toBe("/settings");
    expect(resolved.searchParams.get("google")).toBe("connected");
  });
});
