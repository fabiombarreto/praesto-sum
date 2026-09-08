// PRPs/prds/push-channel-proven.prd.md AC-4 (previewed here as plan AC-A3)
//
// Unit-level suite for `sendPush()` (`src/worker/push/send.ts`), the thin
// `web-push` adapter phase 1 (push-send-spike) introduces. This is plan
// AC-A3, previewing PRD AC-4's outcome-mapping contract: a thrown or
// non-success result from the send library must surface its error and
// status code explicitly, never collapse to a bare `false`.
//
// Exercised directly (not through the HTTP route) so the assertion pins the
// adapter's own return-value contract. The subscription endpoint below is
// under the `.invalid` TLD, reserved by RFC 2606 to never resolve — no real
// push service or device is contacted, but the call still runs the whole
// VAPID-signing/encryption path this phase's spike exists to exercise
// inside workerd, before the (expected) network failure. This is exactly
// the automated half of the spike's own open question, described in the
// plan's `## Notes` ("TDD routing"): does calling into the library's
// signing/encryption path even run inside workerd without throwing.

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { sendPush } from "../src/worker/push/send";

const VAPID = {
  subject: env.VAPID_SUBJECT,
  publicKey: env.VAPID_PUBLIC_KEY,
  privateKey: env.VAPID_PRIVATE_KEY,
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A structurally valid P-256 subscription — correct key lengths and shape,
 * so `web-push` accepts it and proceeds into its real signing/encryption
 * path — pointed at an endpoint that is guaranteed unreachable.
 */
async function buildUnreachableSubscription(): Promise<{
  endpoint: string;
  keys: { p256dh: string; auth: string };
}> {
  const keyPair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const rawPublicKey = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer,
  );
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return {
    endpoint: "https://push.invalid/does-not-exist",
    keys: {
      p256dh: base64UrlEncode(rawPublicKey),
      auth: base64UrlEncode(authSecret),
    },
  };
}

describe("sendPush() — AC-A3 (PRD AC-4): a non-success outcome is surfaced, never swallowed", () => {
  it("returns an object naming ok:false with a non-empty error string, never a bare false", async () => {
    const subscription = await buildUnreachableSubscription();

    const result = await sendPush(subscription, JSON.stringify({ title: "spike" }), VAPID);

    // The contract itself: an object naming the outcome, never a bare
    // boolean the caller would have to guess the meaning of.
    expect(typeof result).toBe("object");
    expect(result).not.toBe(false);
    expect(typeof result.ok).toBe("boolean");

    // The endpoint is unreachable by construction (RFC 2606 `.invalid`), so
    // dispatch cannot succeed — this pins the failure branch of the
    // contract, whether the library throws during signing/encryption (the
    // spike's own open question) or only later, during the network call.
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect((result.error ?? "").length).toBeGreaterThan(0);
  }, 15_000);

  it("omits statusCode entirely when no HTTP response was ever obtained (exactOptionalPropertyTypes discipline)", async () => {
    const subscription = await buildUnreachableSubscription();

    const result = await sendPush(subscription, JSON.stringify({ title: "spike" }), VAPID);

    // `.invalid` never resolves, so no HTTP response can exist to carry a
    // status code. Task 1's own ACTION requires the key be ABSENT in that
    // case, never present-and-set-to-`undefined`.
    expect("statusCode" in result).toBe(false);
  }, 15_000);
});
