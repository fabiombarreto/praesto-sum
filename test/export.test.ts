// PRPs/prds/data-export.prd.md AC-1 the-route-is-authenticated-by-construction
// PRPs/prds/data-export.prd.md AC-2 every-data-bearing-table-is-present
// PRPs/prds/data-export.prd.md AC-3 no-credential-material-leaves-the-worker
// PRPs/prds/data-export.prd.md AC-5 the-document-describes-itself
// PRPs/prds/data-export.prd.md AC-6 the-download-names-itself-by-date
//
// Route-level suite for `GET /api/export` (plan Tasks 4-5). AC-4 (the schema
// completeness guard) lives in test/export-completeness.test.ts and AC-5's
// pure-builder half lives in test/export-envelope.test.ts — this file covers
// only what requires the real Worker, the auth gate, and a real D1 database:
// the route wiring itself, the five-table dump, and the credential-leak guard.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import { createDb } from "../src/worker/db/client";
import {
  googleCalendarSelections,
  googleConnections,
  lifeAreas,
  pushSubscriptions,
  recurrenceSeries,
  reminders,
  tasks,
} from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const EXPORT = "https://example.com/api/export";

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  return { ...init, headers };
}

// `resetTaskTables()` (test/isolation.ts) drains any abandoned work from a
// previous timed-out test before wiping `tasks`/`recurrence_series` — the
// happens-before barrier every suite sharing this D1 relies on. This suite
// also seeds three tables `resetTaskTables()` does not own, so they are wiped
// here, after the drain, in the same hook.
beforeEach(async () => {
  await resetTaskTables();
  const db = createDb(env);
  await db.delete(reminders);
  await db.delete(lifeAreas);
  await db.delete(googleCalendarSelections);
  await db.delete(googleConnections);
  await db.delete(pushSubscriptions);
}, DRAIN_BUDGET_MS);

describe("GET /api/export — AC-1 authenticated by construction", () => {
  it("answers 401 without a bearer token, and carries no database content", async () => {
    await createDb(env)
      .insert(lifeAreas)
      .values({ id: "la-secret", name: "Should never appear unauthenticated" });

    const res = await exports.default.fetch(EXPORT);
    const text = await res.text();

    expect(res.status).toBe(401);
    expect(text).not.toContain("Should never appear unauthenticated");
  });
});

describe("GET /api/export — AC-2 every data-bearing table is present", () => {
  it("contains a key for each of the five tables, each carrying the seeded row", async () => {
    const db = createDb(env);
    await db.insert(lifeAreas).values({ id: "la-1", name: "Saude" });
    await db.insert(recurrenceSeries).values({
      id: "series-1",
      kind: "task",
      freq: "daily",
      dtstart: "2026-09-01",
      title: "Beber agua",
    });
    const taskId = crypto.randomUUID();
    await db.insert(tasks).values({ id: taskId, title: "Comprar leite", deadline: "2026-09-10" });
    const reminderId = crypto.randomUUID();
    await db
      .insert(reminders)
      .values({ id: reminderId, taskId, fireAt: new Date("2026-09-09T12:00:00Z") });
    await db.insert(googleCalendarSelections).values({ calendarId: "primary" });

    const res = await exports.default.fetch(EXPORT, auth());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tables: Record<string, Array<Record<string, unknown>>>;
    };

    expect(body.tables.life_areas?.some((row) => row.id === "la-1")).toBe(true);
    expect(body.tables.recurrence_series?.some((row) => row.id === "series-1")).toBe(true);
    expect(body.tables.tasks?.some((row) => row.id === taskId)).toBe(true);
    expect(body.tables.reminders?.some((row) => row.id === reminderId)).toBe(true);
    expect(
      body.tables.google_calendar_selections?.some((row) => row.calendarId === "primary"),
    ).toBe(true);
  });
});

describe("GET /api/export — AC-3 no credential material leaves the Worker", () => {
  it("never carries the stored refresh token, the push keys, or any of the three excluded table keys", async () => {
    const db = createDb(env);
    await db.insert(googleConnections).values({
      id: "default",
      refreshToken: "sentinel-refresh-token-must-never-leak",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
    });
    await db.insert(pushSubscriptions).values({
      id: "sub-1",
      endpoint: "https://push.example.com/abc",
      p256dh: "sentinel-p256dh-must-never-leak",
      auth: "sentinel-auth-must-never-leak",
    });

    const res = await exports.default.fetch(EXPORT, auth());
    const raw = await res.text();

    // Searched as raw text, not just "no key for the table" — a leak through
    // some OTHER field (a stray debug property, a nested object) would still
    // pass a keys-only check but not this one.
    expect(raw).not.toContain("sentinel-refresh-token-must-never-leak");
    expect(raw).not.toContain("sentinel-p256dh-must-never-leak");
    expect(raw).not.toContain("sentinel-auth-must-never-leak");

    const body = JSON.parse(raw) as { tables: Record<string, unknown> };
    expect(Object.keys(body.tables)).not.toContain("google_connections");
    expect(Object.keys(body.tables)).not.toContain("push_subscriptions");
    expect(Object.keys(body.tables)).not.toContain("oauth_states");
  });
});

describe("GET /api/export — AC-5 the document describes itself", () => {
  it("carries formatVersion, generatedAt, timezone, and reasoned exclusions", async () => {
    const res = await exports.default.fetch(EXPORT, auth());
    const body = (await res.json()) as {
      formatVersion: number;
      generatedAt: number;
      timezone: string;
      excludedTables: Array<{ name: string; reason: string }>;
    };

    expect(body.formatVersion).toBe(1);
    expect(typeof body.generatedAt).toBe("number");
    expect(body.timezone).toBe("America/Sao_Paulo");

    expect(body.excludedTables.map((entry) => entry.name).sort()).toEqual(
      ["google_connections", "oauth_states", "push_subscriptions"].sort(),
    );
    for (const entry of body.excludedTables) {
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("GET /api/export — AC-6 the download names itself by date", () => {
  it("carries Content-Disposition: attachment with a dated filename, and application/json", async () => {
    const res = await exports.default.fetch(EXPORT, auth());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");

    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toMatch(/filename="praesto-\d{4}-\d{2}-\d{2}\.json"/);
  });
});
