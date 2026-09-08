import { buildPushPayload } from "@block65/webcrypto-web-push";

/**
 * Thin adapter around `@block65/webcrypto-web-push` (phase 1,
 * push-send-spike). Isolates the library-dependent call so it never leaks
 * into `src/shared` — this is the exempt thin edge, not decidable logic
 * (`docs/context/methodology.md`, 2026-08-11).
 *
 * `web-push@3.6.7` was the incumbent (ADR-0005), but the spike proved it
 * hangs indefinitely inside workerd rather than completing or throwing —
 * `sendNotification()` never resolved, never rejected, and the runtime
 * eventually killed the request as hung. That is decisively "does not
 * work", the same conclusion the documented `https.request`/
 * `crypto.createECDH` blockers predicted, just surfacing as a hang instead
 * of a clean throw. `@block65/webcrypto-web-push` builds the raw request
 * (headers + encrypted body) using only Web Crypto and the platform
 * `fetch`, so the network call itself is the runtime's own `fetch`
 * implementation rather than Node's `https` module.
 *
 * The outcome is always mapped explicitly: any thrown value, or a
 * non-2xx/network response, becomes `{ ok: false, error, statusCode? }`,
 * never a bare `false` (AC-A3 / PRD AC-4).
 */
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapid: { subject: string; publicKey: string; privateKey: string },
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  try {
    const data = JSON.parse(payload) as Parameters<typeof buildPushPayload>[0]["data"];
    const request = await buildPushPayload(
      { data },
      { endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys },
      vapid,
    );
    const response = await fetch(subscription.endpoint, {
      method: request.method,
      headers: request.headers as HeadersInit,
      body: request.body,
    });
    if (response.ok) {
      return { ok: true, statusCode: response.status };
    }
    const bodyText = await response.text();
    return {
      ok: false,
      statusCode: response.status,
      error: bodyText.length > 0 ? bodyText : `push service responded ${response.status}`,
    };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    return typeof statusCode === "number"
      ? { ok: false, statusCode, error: String(err) }
      : { ok: false, error: String(err) };
  }
}
