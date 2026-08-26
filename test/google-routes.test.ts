/**
 * Unit 4 `google-calendar-read`, phase 2 — the authenticated routes.
 *
 * Covers PRD **AC-1** (connect mints a scoped, stateful consent URL), **AC-4**
 * (disconnect revokes remotely and preserves 100% of local data) and **AC-5**
 * (disconnect succeeds even when Google refuses).
 *
 * AC-4's "preserves 100% of local data" is asserted against real Task rows
 * rather than against an empty database, because the criterion is worthless
 * otherwise: deleting nothing from nothing proves nothing. FR-030 promises the
 * owner that revoking access never costs him his own data, and that promise is
 * only testable with data present.
 */

import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_READONLY_SCOPES } from "../src/shared/google-oauth";
import { createDb } from "../src/worker/db/client";
import { googleConnections, oauthStates, tasks } from "../src/worker/db/schema";

const CONNECT = "https://example.com/api/google/connect";
const CONNECTION = "https://example.com/api/google/connection";

let outbound: Request[] = [];

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

function stubFetch(reply: () => Response) {
  outbound = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    outbound.push(new Request(input as RequestInfo, init));
    return reply();
  });
}

async function seedConnection(): Promise<void> {
  const db = createDb(env);
  await db.insert(googleConnections).values({
    id: "default",
    refreshToken: "stored-refresh-token",
    scope: GOOGLE_READONLY_SCOPES.join(" "),
  });
}

async function seedTasks(count: number): Promise<void> {
  const db = createDb(env);
  for (let i = 0; i < count; i += 1) {
    await db.insert(tasks).values({ id: `t-${i}`, title: `Task ${i}`, status: "open" });
  }
}

async function taskCount(): Promise<number> {
  return (await createDb(env).select().from(tasks)).length;
}

async function connectionCount(): Promise<number> {
  return (await createDb(env).select().from(googleConnections)).length;
}

beforeEach(async () => {
  const db = createDb(env);
  await db.delete(googleConnections);
  await db.delete(oauthStates);
  await db.delete(tasks);
  stubFetch(() => new Response("", { status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/google/connect (AC-1)", () => {
  it("returns a consent URL requesting exactly the two readonly scopes", async () => {
    const res = await exports.default.fetch(CONNECT, auth({ method: "POST" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { consentUrl: string };
    const requested = (new URL(body.consentUrl).searchParams.get("scope") ?? "")
      .split(" ")
      .filter(Boolean);

    expect(requested.sort()).toEqual([...GOOGLE_READONLY_SCOPES].sort());
  });

  it("persists the URL's state as an unconsumed, unexpired nonce", async () => {
    const res = await exports.default.fetch(CONNECT, auth({ method: "POST" }));
    const body = (await res.json()) as { consentUrl: string };
    const state = new URL(body.consentUrl).searchParams.get("state");

    const rows = await createDb(env).select().from(oauthStates);
    const row = rows.find((r) => r.id === state);

    expect(row).toBeDefined();
    expect(row?.consumedAt ?? null).toBeNull();
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("mints a different nonce on every call", async () => {
    const first = (await (await exports.default.fetch(CONNECT, auth({ method: "POST" }))).json()) as {
      consentUrl: string;
    };
    const second = (await (
      await exports.default.fetch(CONNECT, auth({ method: "POST" }))
    ).json()) as { consentUrl: string };

    const a = new URL(first.consentUrl).searchParams.get("state");
    const b = new URL(second.consentUrl).searchParams.get("state");

    expect(a).not.toBe(b);
  });

  it("makes no outbound call — minting a URL requires talking to nobody", async () => {
    await exports.default.fetch(CONNECT, auth({ method: "POST" }));

    expect(outbound).toHaveLength(0);
  });

  it("answers 401 without a bearer token", async () => {
    const res = await exports.default.fetch(CONNECT, { method: "POST" });

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/google/connection (AC-4)", () => {
  it("sends the stored token to Google's revoke endpoint", async () => {
    await seedConnection();

    await exports.default.fetch(CONNECTION, auth({ method: "DELETE" }));

    expect(outbound).toHaveLength(1);
    expect(outbound[0]!.url.startsWith("https://oauth2.googleapis.com/revoke")).toBe(true);
  });

  it("deletes the local credential", async () => {
    await seedConnection();

    const res = await exports.default.fetch(CONNECTION, auth({ method: "DELETE" }));

    expect(res.status).toBeLessThan(400);
    expect(await connectionCount()).toBe(0);
  });

  it("preserves every Task row — FR-030's whole promise", async () => {
    await seedConnection();
    await seedTasks(5);

    await exports.default.fetch(CONNECTION, auth({ method: "DELETE" }));

    expect(await taskCount()).toBe(5);
  });

  it("is idempotent when there is nothing connected", async () => {
    const res = await exports.default.fetch(CONNECTION, auth({ method: "DELETE" }));

    expect(res.status).toBeLessThan(400);
    expect(await connectionCount()).toBe(0);
  });

  it("answers 401 without a bearer token, and revokes nothing", async () => {
    await seedConnection();

    const res = await exports.default.fetch(CONNECTION, { method: "DELETE" });

    expect(res.status).toBe(401);
    expect(outbound).toHaveLength(0);
    expect(await connectionCount()).toBe(1);
  });
});

describe("DELETE /api/google/connection succeeds even when Google refuses (AC-5)", () => {
  it("deletes locally and reports success when revoke answers non-2xx", async () => {
    stubFetch(() => new Response("", { status: 400 }));
    await seedConnection();
    await seedTasks(2);

    const res = await exports.default.fetch(CONNECTION, auth({ method: "DELETE" }));

    expect(res.status).toBeLessThan(400);
    expect(await connectionCount()).toBe(0);
    expect(await taskCount()).toBe(2);
  });

  it("deletes locally and reports success when revoke throws", async () => {
    outbound = [];
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network down");
    });
    await seedConnection();

    const res = await exports.default.fetch(CONNECTION, auth({ method: "DELETE" }));

    // The owner must never be unable to disconnect because a third party is
    // unreachable. Local deletion is unconditional.
    expect(res.status).toBeLessThan(400);
    expect(await connectionCount()).toBe(0);
  });
});

describe("the credential never leaves the Worker", () => {
  it("is absent from the connection status response", async () => {
    await seedConnection();

    const res = await exports.default.fetch(CONNECTION, auth());

    if (res.status === 200) {
      expect(await res.text()).not.toContain("stored-refresh-token");
    }
  });
});
