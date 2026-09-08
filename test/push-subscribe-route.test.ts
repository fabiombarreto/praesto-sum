// PRPs/prds/push-channel-proven.prd.md AC-2 subscription-identity-is-the-endpoint
//
// Route suite for `POST /api/push/subscriptions` (`src/worker/routes/push.ts`,
// phase 2 subscription-lifecycle, plan Task 5 / plan AC-A2). Mirrors
// `test/push-send-spike-route.test.ts`'s shape: `exports.default.fetch`,
// `env.API_BEARER_TOKEN`, a `beforeEach` D1 cleanup.
//
// This route never calls `sendPush()`, so — unlike the test-push route suite
// — it needs no cryptographically real P-256 keys; plain strings exercise
// the storage/upsert contract exactly as well.
//
// Written BEFORE the Implementer (test-first): `src/worker/routes/push.ts`
// does not exist yet, so this file is RED for the right reason (route not
// mounted, 404) until plan Tasks 3, 4, 5 and 6 land.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../src/worker/db/client";
import { pushSubscriptions } from "../src/worker/db/schema";

const SUBSCRIBE = "https://example.com/api/push/subscriptions";
const ENDPOINT = "https://push.invalid/subscribe-upsert";

function auth(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.API_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

async function rowsForEndpoint(endpoint: string) {
  const rows = await createDb(env).select().from(pushSubscriptions);
  return rows.filter((row) => row.endpoint === endpoint);
}

beforeEach(async () => {
  await createDb(env).delete(pushSubscriptions);
});

describe("POST /api/push/subscriptions — AC-A2 (PRD AC-2): first submission inserts", () => {
  it("stores a new row and answers 201 with the DTO, never the raw crypto keys", async () => {
    const res = await exports.default.fetch(
      SUBSCRIBE,
      auth({ endpoint: ENDPOINT, keys: { p256dh: "key-a", auth: "auth-a" } }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { subscription: Record<string, unknown> };
    expect(body.subscription.endpoint).toBe(ENDPOINT);
    // The wire DTO never carries the subscription's cryptographic keys.
    expect("p256dh" in body.subscription).toBe(false);
    expect("auth" in body.subscription).toBe(false);

    const rows = await rowsForEndpoint(ENDPOINT);
    expect(rows).toHaveLength(1);
  });
});

describe("POST /api/push/subscriptions — AC-A2 (PRD AC-2): resubmission upserts, never duplicates", () => {
  it("updates the existing row's keys in place and leaves the row count for that endpoint at 1", async () => {
    await exports.default.fetch(
      SUBSCRIBE,
      auth({ endpoint: ENDPOINT, keys: { p256dh: "key-a", auth: "auth-a" } }),
    );

    const res = await exports.default.fetch(
      SUBSCRIBE,
      auth({ endpoint: ENDPOINT, keys: { p256dh: "key-b", auth: "auth-b" } }),
    );

    expect(res.status).toBe(200);

    // The unique endpoint index is the invariant this pins: exactly one row
    // for the endpoint, not two, and its keys are the resubmitted ones.
    const rows = await rowsForEndpoint(ENDPOINT);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.p256dh).toBe("key-b");
    expect(rows[0]?.auth).toBe("auth-b");
  });

  it("keeps the same row id across resubmission — updates the existing row, never creates a fresh one", async () => {
    const first = await exports.default.fetch(
      SUBSCRIBE,
      auth({ endpoint: ENDPOINT, keys: { p256dh: "key-a", auth: "auth-a" } }),
    );
    const firstBody = (await first.json()) as { subscription: { id: string } };

    const second = await exports.default.fetch(
      SUBSCRIBE,
      auth({ endpoint: ENDPOINT, keys: { p256dh: "key-b", auth: "auth-b" } }),
    );
    const secondBody = (await second.json()) as { subscription: { id: string } };

    expect(secondBody.subscription.id).toBe(firstBody.subscription.id);
  });
});

describe("POST /api/push/subscriptions — request validation", () => {
  it("rejects a missing endpoint with 400", async () => {
    const res = await exports.default.fetch(
      SUBSCRIBE,
      auth({ keys: { p256dh: "key-a", auth: "auth-a" } }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing keys.p256dh with 400", async () => {
    const res = await exports.default.fetch(
      SUBSCRIBE,
      auth({ endpoint: ENDPOINT, keys: { auth: "auth-a" } }),
    );
    expect(res.status).toBe(400);
  });
});
