// PRPs/prds/data-export.prd.md AC-7 the-ics-is-minimally-valid
// PRPs/prds/data-export.prd.md AC-8 dated-tasks-become-all-day-events-undated-ones-are-absent
//
// Route-level suite for `GET /api/export.ics` (plan Tasks 2-3 of data-export
// phase 2 — "The calendar file"). The pure serializer's own RFC 5545/folding
// assertions live in test/export-ics.test.ts; this file covers only what
// requires the real Worker, the auth gate (inherited from
// `app.use("/api/*", requireToken)` — no auth code of its own to test here),
// and a real D1 database: the route's wiring, headers, and that Tasks
// actually persisted through the DB reach the produced file.
//
// Neither `src/worker/routes/export-ics.ts` nor its mount in
// `src/worker/index.ts` exist yet — this suite is authored test-first
// (docs/context/methodology.md: tdd: true) and is expected to answer 404 (the
// route unmounted) until the Implementer completes Tasks 2-3 of the APPROVED
// plan (PRPs/plans/data-export-phase-2-the-calendar-file.plan.md).

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import { PRAESTO_TIMEZONE, todayIn } from "../src/shared/dates";
import { createDb } from "../src/worker/db/client";
import { tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const EXPORT_ICS = "https://example.com/api/export.ics";

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  return { ...init, headers };
}

/** A local calendar day `offset` days from the server's today, as YYYY-MM-DD. */
function dayOffset(offset: number): string {
  const today = todayIn(new Date(), PRAESTO_TIMEZONE);
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

// Storage isolation is per test FILE (see test/isolation.ts) — wipe `tasks`
// between tests. This suite only ever writes to `tasks`, so the base
// `resetTaskTables()` (no extra table deletes) is enough.
beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

describe("GET /api/export.ics — AC-7 the .ics is minimally valid, reachable only when authenticated", () => {
  it("answers 401 without a bearer token, and carries no Task content from the database", async () => {
    // The route carries no auth code of its own — `app.use("/api/*",
    // requireToken)` (src/worker/index.ts:18) is what must gate it once
    // mounted, exactly like every other `/api/*` route.
    await createDb(env)
      .insert(tasks)
      .values({
        id: crypto.randomUUID(),
        title: "Should never appear unauthenticated",
        deadline: dayOffset(1),
      });

    const res = await exports.default.fetch(EXPORT_ICS);
    const text = await res.text();

    expect(res.status).toBe(401);
    expect(text).not.toContain("Should never appear unauthenticated");
  });

  it("returns text/calendar with a dated attachment filename, and a minimally valid VCALENDAR body", async () => {
    const db = createDb(env);
    const taskId = crypto.randomUUID();
    await db.insert(tasks).values({ id: taskId, title: "Comprar leite", deadline: dayOffset(2) });

    const res = await exports.default.fetch(EXPORT_ICS, auth());
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");

    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toMatch(/filename="praesto-\d{4}-\d{2}-\d{2}\.ics"/);

    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain("VERSION:2.0\r\n");
    expect(body).toMatch(/PRODID:\S.*\r\n/);
    expect(body).toContain(`UID:${taskId}@praesto.local\r\n`);
    expect(body).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
  });
});

describe("GET /api/export.ics — AC-8 dated Tasks become all-day events; undated ones vanish", () => {
  it("contains exactly two VEVENTs — for the deadline Task and the scheduled Task — and omits the undated Task entirely", async () => {
    const db = createDb(env);
    const deadlineDate = dayOffset(3);
    const scheduledDate = dayOffset(10);
    const deadlineId = crypto.randomUUID();
    const scheduledId = crypto.randomUUID();
    const undatedId = crypto.randomUUID();

    await db.insert(tasks).values([
      { id: deadlineId, title: "Tarefa com prazo", deadline: deadlineDate },
      { id: scheduledId, title: "Tarefa agendada", scheduledDate },
      { id: undatedId, title: "Tarefa sem data" },
    ]);

    const res = await exports.default.fetch(EXPORT_ICS, auth());
    const body = await res.text();

    expect(res.status).toBe(200);
    const veventCount = (body.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(veventCount).toBe(2);

    expect(body).toContain(`UID:${deadlineId}@praesto.local`);
    expect(body).toContain(`DTSTART;VALUE=DATE:${deadlineDate.replace(/-/g, "")}`);
    expect(body).toContain(`UID:${scheduledId}@praesto.local`);
    expect(body).toContain(`DTSTART;VALUE=DATE:${scheduledDate.replace(/-/g, "")}`);

    expect(body).not.toContain(`UID:${undatedId}@praesto.local`);
    expect(body).not.toContain("Tarefa sem data");
  });
});
