import { Hono } from "hono";
import { createDb } from "../db/client";
import { pushSubscriptions } from "../db/schema";
import { sendPush } from "../push/send";

/**
 * `POST /api/push-spike` — phase 1 (push-send-spike) of push-channel-proven.
 *
 * Mounted under `/api/*`, so `requireToken` already gates it — no auth code
 * of its own. Reads the sole manually-stored `push_subscriptions` row and
 * attempts one dispatch through `sendPush`, returning the per-attempt
 * outcome explicitly — never a bare/vacuous success (AC-A1/AC-A2, PRD AC-8).
 *
 * This is a throwaway minimal payload to prove dispatch is possible at all;
 * the full AC-1 payload shape is phase 2's job, not this one's.
 */
export const pushSpikeRoutes = new Hono<{ Bindings: Env }>();

pushSpikeRoutes.post("/", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(pushSubscriptions).limit(1);
  const subscription = rows[0];

  if (!subscription) {
    return c.json({ ok: false, error: "no stored subscription" }, 200);
  }

  const payload = JSON.stringify({ title: "Praesto — spike", body: "push-send-spike phase 1" });
  const result = await sendPush(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    payload,
    {
      subject: c.env.VAPID_SUBJECT,
      publicKey: c.env.VAPID_PUBLIC_KEY,
      privateKey: c.env.VAPID_PRIVATE_KEY,
    },
  );

  return c.json(result, result.ok ? 200 : 502);
});
