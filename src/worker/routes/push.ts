import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { buildNotificationPayload } from "../../shared/push-payload";
import { classifyPushOutcome } from "../../shared/push-outcome";
import { createDb } from "../db/client";
import { PUSH_DISPATCH_ATTEMPT_ID, pushDispatchAttempts, pushSubscriptions } from "../db/schema";
import { toPushSubscriptionDto } from "../dto";
import { sendPush } from "../push/send";

/**
 * Web Push subscription lifecycle + on-demand dispatch (FR-041, phase 2
 * subscription-lifecycle).
 *
 * Mounted under `/api/*`, so `requireToken` already gates it — no auth code
 * of its own. This router itself is mounted at `/api/push`
 * (`src/worker/index.ts`), so `POST /subscriptions` upserts by `endpoint`
 * (the natural key the unique `push_subscriptions_endpoint_unq` index
 * enforces); `DELETE /subscriptions` removes by `endpoint`; `POST /test`
 * dispatches to every stored subscription, pruning any that come back
 * `gone`.
 */
export const pushRoutes = new Hono<{ Bindings: Env }>();

pushRoutes.post("/subscriptions", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) return c.json({ error: "endpoint is required" }, 400);

  const keys =
    typeof body.keys === "object" && body.keys !== null
      ? (body.keys as { p256dh?: unknown; auth?: unknown })
      : {};

  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  if (!p256dh) return c.json({ error: "keys.p256dh is required" }, 400);

  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!auth) return c.json({ error: "keys.auth is required" }, 400);

  if (Object.hasOwn(body, "deviceLabel")) {
    const deviceLabel = body.deviceLabel;
    if (deviceLabel !== null && typeof deviceLabel !== "string") {
      return c.json({ error: "deviceLabel must be a string or null" }, 400);
    }
  }

  const db = createDb(c.env);
  const [existing] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));

  if (existing !== undefined) {
    const patch: Partial<typeof pushSubscriptions.$inferInsert> = {
      p256dh,
      auth,
      lastSeenAt: new Date(),
    };
    if (Object.hasOwn(body, "deviceLabel")) {
      patch.deviceLabel = body.deviceLabel as string | null;
    }
    const [row] = await db
      .update(pushSubscriptions)
      .set(patch)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .returning();
    if (row === undefined) return c.json({ error: "Update returned no row" }, 500);
    return c.json({ subscription: toPushSubscriptionDto(row) }, 200);
  }

  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      endpoint,
      p256dh,
      auth,
      deviceLabel: Object.hasOwn(body, "deviceLabel") ? (body.deviceLabel as string | null) : null,
    })
    .returning();
  if (row === undefined) return c.json({ error: "Insert returned no row" }, 500);
  return c.json({ subscription: toPushSubscriptionDto(row) }, 201);
});

pushRoutes.delete("/subscriptions", async (c) => {
  const body = await readJson(c.req.raw);
  const endpoint = body !== null && typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return c.json({ error: "endpoint is required" }, 400);

  const db = createDb(c.env);
  const [row] = await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .returning();

  if (row === undefined) return c.json({ error: "No subscription with that endpoint" }, 404);
  return c.body(null, 204);
});

pushRoutes.get("/vapid-key", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }));

pushRoutes.post("/test", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(pushSubscriptions);

  if (rows.length === 0) {
    return c.json({ ok: false, error: "no stored subscriptions", results: [] }, 200);
  }

  const payload = JSON.stringify(
    buildNotificationPayload({
      title: "Praesto",
      body: "Notificação de teste",
      route: "/",
      tag: "test-push",
    }),
  );

  const vapid = {
    subject: c.env.VAPID_SUBJECT,
    publicKey: c.env.VAPID_PUBLIC_KEY,
    privateKey: c.env.VAPID_PRIVATE_KEY,
  };

  const results = [];
  for (const subscription of rows) {
    const result = await sendPush(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
      vapid,
    );
    const outcome = classifyPushOutcome(result);
    if (outcome.kind === "gone") {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    }
    results.push({ endpoint: subscription.endpoint, outcome });
  }

  const [existingAttempt] = await db
    .select()
    .from(pushDispatchAttempts)
    .where(eq(pushDispatchAttempts.id, PUSH_DISPATCH_ATTEMPT_ID));
  if (existingAttempt !== undefined) {
    await db
      .update(pushDispatchAttempts)
      .set({ attemptedAt: new Date(), results: JSON.stringify(results) })
      .where(eq(pushDispatchAttempts.id, PUSH_DISPATCH_ATTEMPT_ID));
  } else {
    await db.insert(pushDispatchAttempts).values({
      id: PUSH_DISPATCH_ATTEMPT_ID,
      attemptedAt: new Date(),
      results: JSON.stringify(results),
    });
  }

  return c.json({ ok: true, results });
});

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
