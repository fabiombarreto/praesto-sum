// PRPs/prds/push-channel-proven.prd.md AC-8 (previewed here as plan AC-A1/AC-A2)
//
// Route-level suite for `POST /api/push-spike` (plan Tasks 2-3), phase 1
// (push-send-spike) of push-channel-proven. Covers the two branches of the
// route's own outcome-legibility contract: at least one stored subscription
// (AC-A1) and zero stored subscriptions (AC-A2). The full per-endpoint
// outcome reporting AC-8 describes for every stored subscription is phase
// 2's `test-push` route (`limit(1)` here reads at most the single row this
// phase's spike is scoped to); this suite only proves the spike's own
// precursor contract.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/worker/db/client";
import { pushSubscriptions } from "../src/worker/db/schema";

const PUSH_SPIKE = "https://example.com/api/push-spike";

function auth(): RequestInit {
  return { method: "POST", headers: { Authorization: `Bearer ${env.API_BEARER_TOKEN}` } };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function buildUnreachableKeys(): Promise<{ p256dh: string; auth: string }> {
  const keyPair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const rawPublicKey = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer,
  );
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return { p256dh: base64UrlEncode(rawPublicKey), auth: base64UrlEncode(authSecret) };
}

beforeEach(async () => {
  await createDb(env).delete(pushSubscriptions);
});

describe("POST /api/push-spike — AC-A2 (PRD AC-8): zero stored subscriptions", () => {
  it("answers explicitly rather than a silent 200 with an empty body", async () => {
    const res = await exports.default.fetch(PUSH_SPIKE, auth());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "no stored subscription" });
  }, 15_000);
});

describe("POST /api/push-spike — AC-A1 (PRD AC-8): at least one stored subscription", () => {
  it("names whether the push service accepted the dispatch and its status code — never a bare/vacuous success", async () => {
    const keys = await buildUnreachableKeys();
    await createDb(env).insert(pushSubscriptions).values({
      id: "sub-spike-1",
      endpoint: "https://push.invalid/does-not-exist",
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    const res = await exports.default.fetch(PUSH_SPIKE, auth());
    const body = (await res.json()) as { ok: boolean; statusCode?: number; error?: string };

    // The response is never a bare/vacuous success: whichever way the
    // dispatch resolves, `ok` and either `statusCode` or `error` are
    // legible in the body, and the HTTP status matches the outcome (200 if
    // ok, 502 if not — the plan's own Task 2 contract).
    expect(typeof body.ok).toBe("boolean");
    if (body.ok) {
      expect(res.status).toBe(200);
      expect(typeof body.statusCode).toBe("number");
    } else {
      expect(res.status).toBe(502);
      expect(typeof body.error).toBe("string");
      expect((body.error ?? "").length).toBeGreaterThan(0);
    }

    // The endpoint is unreachable by construction (RFC 2606 `.invalid`), so
    // this pins the failure branch deterministically.
    expect(body.ok).toBe(false);
  }, 15_000);
});
