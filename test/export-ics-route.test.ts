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
import { saoPaulo, seedAllDay, seedTimed } from "./event-fixtures";
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

// ---------------------------------------------------------------------------------------------
// Unit 14 events-and-day-view, phase 2 — PRD AC-20 (plan AC-A12, Task 14). Everything above is
// the shipped Task contract and is untouched; the block below is ADDED. It is RED until the
// route passes the stored Events to the serializer (today the file holds Tasks only). The
// Events are put straight into D1 (test/event-fixtures.ts), so the route is what is under test.
// ---------------------------------------------------------------------------------------------

/** The VEVENT block carrying `UID:<id>@praesto.local`, from its BEGIN to just before its END. */
function veventOf(body: string, id: string): string {
  const uidIndex = body.indexOf(`UID:${id}@praesto.local`);
  expect(uidIndex).toBeGreaterThan(-1);
  return body.slice(
    body.lastIndexOf("BEGIN:VEVENT", uidIndex),
    body.indexOf("END:VEVENT", uidIndex),
  );
}

describe("GET /api/export.ics — AC-20 stored Events reach the file", () => {
  it("writes a stored timed Event as a UTC VEVENT and a stored all-day Event as a date-only VEVENT", async () => {
    const timed = await seedTimed({
      id: "ev-timed",
      title: "Dentista",
      description: "levar exames",
      location: "Clínica Sorriso",
      startAt: saoPaulo(2026, 10, 20, 9, 30),
      endAt: saoPaulo(2026, 10, 20, 10, 30),
    });
    const allDay = await seedAllDay({
      id: "ev-allday",
      title: "Feriado",
      startDate: "2026-10-26",
      endDate: "2026-10-28",
    });

    const res = await exports.default.fetch(EXPORT_ICS, auth());
    const body = await res.text();

    expect(res.status).toBe(200);
    expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);

    const timedBlock = veventOf(body, timed.id);
    expect(timedBlock).toContain("DTSTART:20261020T123000Z\r\n");
    expect(timedBlock).toContain("DTEND:20261020T133000Z\r\n");
    expect(timedBlock).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
    expect(timedBlock).toContain("SUMMARY:Dentista\r\n");
    expect(timedBlock).toContain("DESCRIPTION:levar exames\r\n");
    expect(timedBlock).toContain("LOCATION:Clínica Sorriso\r\n");
    expect(timedBlock).not.toContain("COMMENT");

    const allDayBlock = veventOf(body, allDay.id);
    expect(allDayBlock).toContain("DTSTART;VALUE=DATE:20261026\r\n");
    expect(allDayBlock).toContain("DTEND;VALUE=DATE:20261028\r\n");
    expect(allDayBlock).toContain("SUMMARY:Feriado\r\n");
    expect(allDayBlock).not.toContain("COMMENT");
  });

  it("writes the stored Events beside the dated Tasks, which keep their to-do comment", async () => {
    const taskId = crypto.randomUUID();
    await createDb(env)
      .insert(tasks)
      .values({ id: taskId, title: "Comprar leite", deadline: dayOffset(2) });
    const event = await seedTimed({
      id: "ev-timed",
      title: "Dentista",
      startAt: saoPaulo(2026, 10, 20, 9, 30),
    });

    const res = await exports.default.fetch(EXPORT_ICS, auth());
    const body = await res.text();

    expect(res.status).toBe(200);
    expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(veventOf(body, taskId)).toContain("COMMENT:");
    expect(veventOf(body, event.id)).not.toContain("COMMENT");
  });

  it("writes every stored Event, not just the first", async () => {
    await seedTimed({ id: "ev-1", title: "Um", startAt: saoPaulo(2026, 10, 20, 9, 0) });
    await seedTimed({ id: "ev-2", title: "Dois", startAt: saoPaulo(2026, 10, 21, 9, 0) });
    await seedAllDay({ id: "ev-3", title: "Três", startDate: "2026-10-26" });

    const body = await (await exports.default.fetch(EXPORT_ICS, auth())).text();

    expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBe(3);
    for (const id of ["ev-1", "ev-2", "ev-3"]) {
      expect(body).toContain(`UID:${id}@praesto.local`);
    }
  });
});
