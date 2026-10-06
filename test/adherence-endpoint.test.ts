// PRPs/prds/adherence-mirror.prd.md AC-11 Shape and auth
// PRPs/prds/adherence-mirror.prd.md AC-12 `today` per series time zone
// PRPs/prds/adherence-mirror.prd.md AC-13 Route ordering
// PRPs/prds/adherence-mirror.prd.md AC-14 Read-only
//
// Source plan: PRPs/plans/adherence-mirror-phase-2-adherence-endpoint.plan.md
// (plan AC-A1..AC-A4). Plan AC-A5 (full suite green, recurrence.ts and
// adherence.ts unchanged) is the plan's Level 2/3 validation, not a test here.
// PRD AC-1..AC-10 (the pure function) live in test/adherence.test.ts and
// AC-15..AC-20 (the screen) are phase 3; neither is duplicated here.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): today
// `GET /api/series/adherence` is answered by `GET /api/series/:id` as an id
// lookup (404 "not found") and `loadSeriesAdherence` is not exported from
// `src/worker/routes/series.ts`, so the authenticated cases are RED for that
// reason only. The 401 case already passes (the bearer gate covers every
// /api/* path) and is kept as a regression pin.
//
// Clock discipline: the HTTP cases pin the system clock with
// `vi.setSystemTime` (Date only; no timers) because the handler reads
// `new Date()` once. The time-zone case does not rely on it: it passes `now`
// as data to `loadSeriesAdherence(db, now)`, the way
// `sweepMissedOccurrences(db, now)` is tested.
//
// Nothing is mocked: the Worker, Hono and D1 are real. Rows are seeded by
// direct D1 insert, because the suite needs closed (`done`/`missed`) rows the
// routes cannot create.

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import type { AdherenceResponse } from "../src/shared/api";
import { createDb } from "../src/worker/db/client";
import { recurrenceSeries, tasks, type RecurrenceSeries, type Task } from "../src/worker/db/schema";
import * as seriesModule from "../src/worker/routes/series";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const URL_ADHERENCE = "https://example.com/api/series/adherence";

/** Pinned wall clock for the HTTP cases: local day 2026-10-15 in both UTC and America/Sao_Paulo. */
const HTTP_NOW = new Date("2026-10-15T12:00:00Z");

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

async function getAdherence(): Promise<Response> {
  return exports.default.fetch(URL_ADHERENCE, auth());
}

beforeEach(async () => {
  vi.setSystemTime(HTTP_NOW);
  await resetTaskTables();
}, DRAIN_BUDGET_MS);

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------- seeding

async function insertSeries(
  overrides: Partial<typeof recurrenceSeries.$inferInsert> = {},
): Promise<RecurrenceSeries> {
  const [row] = await createDb(env)
    .insert(recurrenceSeries)
    .values({
      id: crypto.randomUUID(),
      kind: "task",
      freq: "daily",
      interval: 1,
      dtstart: "2026-09-01",
      timezone: "UTC",
      title: "Tomar remedio",
      dateMode: "deadline",
      reminderOffsets: null,
      ...overrides,
    })
    .returning();
  return row as RecurrenceSeries;
}

async function insertOccurrence(
  series: RecurrenceSeries,
  date: string,
  status: "open" | "done" | "missed",
): Promise<Task> {
  const [row] = await createDb(env)
    .insert(tasks)
    .values({
      id: crypto.randomUUID(),
      title: series.title ?? "occurrence",
      status,
      completedAt: status === "done" ? new Date("2026-10-01T12:00:00Z") : null,
      deadline: date,
      scheduledDate: null,
      seriesId: series.id,
      occurrenceDate: date,
      detached: false,
    })
    .returning();
  return row as Task;
}

async function snapshotTables() {
  const db = createDb(env);
  const [seriesRows, taskRows] = await Promise.all([
    db.select().from(recurrenceSeries),
    db.select().from(tasks),
  ]);
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
  return {
    series: seriesRows.sort(byId),
    tasks: taskRows.sort(byId),
  };
}

function entryOf(body: AdherenceResponse, seriesId: string) {
  return body.series.find((s) => s.seriesId === seriesId);
}

// ---------------------------------------------------------------- AC-11

describe("AC-11 / AC-A1 Shape and auth", () => {
  it("answers 401 without a bearer token", async () => {
    const res = await exports.default.fetch(URL_ADHERENCE);
    expect(res.status).toBe(401);
  });

  it("answers 401 with a wrong bearer token", async () => {
    const res = await exports.default.fetch(URL_ADHERENCE, {
      headers: { Authorization: "Bearer not-the-token" },
    });
    expect(res.status).toBe(401);
  });

  it("answers 200 with one entry per series carrying the counts, streak and recent misses derived from rows", async () => {
    // Alfa (active): done 10-01, done 10-02, missed 10-10, missed 10-12, open 10-15.
    // Its stored counters are deliberately wrong: rows are the source of truth.
    const alfa = await insertSeries({ title: "Alfa", doneCount: 99, missedCount: 99 });
    await insertOccurrence(alfa, "2026-10-01", "done");
    await insertOccurrence(alfa, "2026-10-02", "done");
    await insertOccurrence(alfa, "2026-10-10", "missed");
    await insertOccurrence(alfa, "2026-10-12", "missed");
    await insertOccurrence(alfa, "2026-10-15", "open");

    // Beta (ended): missed 10-13, done 10-14.
    const beta = await insertSeries({ title: "Beta", status: "ended" });
    await insertOccurrence(beta, "2026-10-13", "missed");
    await insertOccurrence(beta, "2026-10-14", "done");

    const res = await getAdherence();
    expect(res.status).toBe(200);
    const body = (await res.json()) as AdherenceResponse;

    expect(body.series).toHaveLength(2);
    expect(entryOf(body, alfa.id)).toEqual({
      seriesId: alfa.id,
      title: "Alfa",
      status: "active",
      done: 2,
      closed: 4,
      currentStreak: 0,
      recentMisses: ["2026-10-12", "2026-10-10"],
    });
    expect(entryOf(body, beta.id)).toEqual({
      seriesId: beta.id,
      title: "Beta",
      status: "ended",
      done: 1,
      closed: 2,
      currentStreak: 1,
      recentMisses: ["2026-10-13"],
    });
    // Alfa has 2 misses in the window, Beta 1: ranked by misses descending.
    expect(body.ranking).toEqual([alfa.id, beta.id]);
  });

  it("omits a series with no recent miss from the ranking but still lists it", async () => {
    const clean = await insertSeries({ title: "Sem falhas" });
    await insertOccurrence(clean, "2026-10-13", "done");
    await insertOccurrence(clean, "2026-10-14", "done");
    const missing = await insertSeries({ title: "Com falha" });
    await insertOccurrence(missing, "2026-10-14", "missed");

    const body = (await (await getAdherence()).json()) as AdherenceResponse;

    expect(body.series).toHaveLength(2);
    expect(entryOf(body, clean.id)?.recentMisses).toEqual([]);
    expect(body.ranking).toEqual([missing.id]);
  });

  it("lists only task-kind series", async () => {
    const task = await insertSeries({ title: "Tarefa" });
    const event = await insertSeries({ kind: "event", title: null });

    const body = (await (await getAdherence()).json()) as AdherenceResponse;

    expect(entryOf(body, task.id)).toBeDefined();
    expect(entryOf(body, event.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------- AC-12

describe("AC-12 / AC-A2 `today` per series time zone", () => {
  it("counts a 2026-09-30 miss inside the Sao Paulo window and outside the UTC window at now = 2026-10-31T01:30Z", async () => {
    const saoPaulo = await insertSeries({ title: "Sao Paulo", timezone: "America/Sao_Paulo" });
    await insertOccurrence(saoPaulo, "2026-09-30", "missed");
    const utc = await insertSeries({ title: "UTC", timezone: "UTC" });
    await insertOccurrence(utc, "2026-09-30", "missed");

    const result = await seriesModule.loadSeriesAdherence(
      createDb(env),
      new Date("2026-10-31T01:30:00Z"),
    );

    // Sao Paulo local day is 2026-10-30: window starts 2026-09-30 (inclusive).
    expect(entryOf(result, saoPaulo.id)?.recentMisses).toEqual(["2026-09-30"]);
    // UTC local day is 2026-10-31: window starts 2026-10-01, the miss is outside.
    expect(entryOf(result, utc.id)?.recentMisses).toEqual([]);
    expect(result.ranking).toEqual([saoPaulo.id]);
  });

  it("moves the Sao Paulo window with the injected now: at 2026-10-31T12:00Z the same miss is outside it", async () => {
    const saoPaulo = await insertSeries({ title: "Sao Paulo", timezone: "America/Sao_Paulo" });
    await insertOccurrence(saoPaulo, "2026-09-30", "missed");

    const result = await seriesModule.loadSeriesAdherence(
      createDb(env),
      new Date("2026-10-31T12:00:00Z"),
    );

    expect(entryOf(result, saoPaulo.id)?.recentMisses).toEqual([]);
    expect(result.ranking).toEqual([]);
  });
});

// ---------------------------------------------------------------- AC-13

describe("AC-13 / AC-A3 Route ordering", () => {
  it("answers GET /api/series/adherence with the adherence payload, not an id lookup for 'adherence'", async () => {
    const res = await getAdherence();

    expect(res.status).toBe(200);
    const body = (await res.json()) as AdherenceResponse;
    expect(body).toEqual({ series: [], ranking: [] });
  });

  it("still answers GET /api/series/:id for a real series id", async () => {
    const series = await insertSeries({ title: "Real" });
    await insertOccurrence(series, "2026-10-15", "open");

    const res = await exports.default.fetch(`https://example.com/api/series/${series.id}`, auth());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { series: { id: string } };
    expect(body.series.id).toBe(series.id);
  });
});

// ---------------------------------------------------------------- AC-14

describe("AC-14 / AC-A4 Read-only", () => {
  it("leaves every recurrence_series and tasks row (including updated_at) identical after the endpoint is called", async () => {
    const alfa = await insertSeries({ title: "Alfa" });
    await insertOccurrence(alfa, "2026-10-10", "missed");
    await insertOccurrence(alfa, "2026-10-14", "done");
    await insertOccurrence(alfa, "2026-10-15", "open");
    const beta = await insertSeries({ title: "Beta", timezone: "America/Sao_Paulo" });
    await insertOccurrence(beta, "2026-10-13", "missed");

    const before = await snapshotTables();
    const res = await getAdherence();
    expect(res.status).toBe(200);
    const after = await snapshotTables();

    expect(after.series).toHaveLength(2);
    expect(after.tasks).toHaveLength(4);
    expect(after).toEqual(before);
  });

  it("leaves every row identical after loadSeriesAdherence runs directly", async () => {
    const alfa = await insertSeries({ title: "Alfa" });
    await insertOccurrence(alfa, "2026-10-10", "missed");
    await insertOccurrence(alfa, "2026-10-15", "open");

    const before = await snapshotTables();
    await seriesModule.loadSeriesAdherence(createDb(env), new Date("2026-10-15T12:00:00Z"));
    const after = await snapshotTables();

    expect(after).toEqual(before);
    const [row] = await createDb(env)
      .select()
      .from(recurrenceSeries)
      .where(eq(recurrenceSeries.id, alfa.id));
    expect(row?.doneCount).toBe(0);
    expect(row?.missedCount).toBe(0);
  });
});
