// PRPs/prds/life-areas.prd.md AC-10 series-carries-the-area
//
// Source plan: PRPs/plans/life-areas-phase-1-areas-api-and-the-filter.plan.md
// (Task 4 — the shared existence check; Task 9 — `POST` and `PATCH /api/series`
// validate the area through it).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`). Expected RED
// reasons, and only these: an id that matches no area is not checked today, so on
// create it reaches the foreign key and answers 500 (or is stored), and on patch an
// empty-string id is accepted as text. Both must answer 400 naming `lifeAreaId`.
//
// Expected GREEN before the Implementer, on purpose: the series template already
// carries the area, the first occurrence and the spawned successor already copy it
// (`src/worker/successor.ts:74`), and the patch already moves the series and its
// open non-detached occurrence only. That behaviour is pinned here because no test
// covers it and the new check sits on those same paths — a regression there is what
// PRD AC-10 exists to catch.
//
// Mirrors test/series.test.ts: `exports.default.fetch`, the bearer token from
// `env.API_BEARER_TOKEN`, the shared drain barrier from test/isolation.ts, and
// direct D1 inserts for the closed rows no route can produce on demand. `life_areas`
// is wiped in the same hook because the barrier only knows `tasks` and
// `recurrence_series`.

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect } from "vitest";
import type { SeriesDto, TaskDto } from "../src/shared/api";
import { createDb } from "../src/worker/db/client";
import { lifeAreas, recurrenceSeries, reminders, tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/series";
const TASKS_BASE = "https://example.com/api/tasks";

const AREA_A = "area-casa";
const AREA_B = "area-trabalho";

const SERIES_BODY = {
  title: "Pagar aluguel",
  freq: "monthly",
  byMonthday: 5,
  dtstart: "2026-10-05",
  dateMode: "deadline",
};

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

async function post(path: string, body?: unknown): Promise<Response> {
  return exports.default.fetch(
    path,
    auth(body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) }),
  );
}

async function patch(path: string, body: unknown): Promise<Response> {
  return exports.default.fetch(path, auth({ method: "PATCH", body: JSON.stringify(body) }));
}

async function createSeries(
  extra: Record<string, unknown> = {},
): Promise<{ series: SeriesDto; occurrence: TaskDto }> {
  const res = await post(BASE, { ...SERIES_BODY, ...extra });
  expect(res.status).toBe(201);
  return (await res.json()) as { series: SeriesDto; occurrence: TaskDto };
}

async function seedAreas(): Promise<void> {
  const db = createDb(env);
  await db.insert(lifeAreas).values({ id: AREA_A, name: "Casa" });
  await db.insert(lifeAreas).values({ id: AREA_B, name: "Trabalho" });
}

async function taskRow(id: string) {
  const [row] = await createDb(env).select().from(tasks).where(eq(tasks.id, id));
  return row;
}

async function seriesRow(id: string) {
  const [row] = await createDb(env)
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, id));
  return row;
}

async function countAllRows(): Promise<{ series: number; tasks: number; reminders: number }> {
  const db = createDb(env);
  const [seriesRows, taskRows, reminderRows] = await Promise.all([
    db.select().from(recurrenceSeries),
    db.select().from(tasks),
    db.select().from(reminders),
  ]);
  return { series: seriesRows.length, tasks: taskRows.length, reminders: reminderRows.length };
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

// Reuses the shared drain barrier (test/isolation.ts) so an abandoned test body
// from THIS file cannot leak a row into the test after it, then additionally
// wipes `reminders` (as test/series.test.ts does) and `life_areas`.
beforeEach(async () => {
  await resetTaskTables();
  const db = createDb(env);
  await db.delete(reminders);
  await db.delete(lifeAreas);
}, DRAIN_BUDGET_MS);

describe("Series create — the area is carried (PRD AC-10)", () => {
  it("stamps the series and its first occurrence with the area", async () => {
    await seedAreas();

    const { series, occurrence } = await createSeries({ lifeAreaId: AREA_A });

    expect(series.lifeAreaId).toBe(AREA_A);
    expect(occurrence.lifeAreaId).toBe(AREA_A);
    expect((await seriesRow(series.id))?.lifeAreaId).toBe(AREA_A);
    expect((await taskRow(occurrence.id))?.lifeAreaId).toBe(AREA_A);
  });

  it("gives the successor spawned on completion the same area", async () => {
    await seedAreas();
    const { occurrence } = await createSeries({ lifeAreaId: AREA_A });

    const completed = await post(`${TASKS_BASE}/${occurrence.id}/complete`);

    expect(completed.status).toBe(200);
    const { successor } = (await completed.json()) as { successor?: TaskDto };
    expect(successor).toBeDefined();
    expect(successor?.lifeAreaId).toBe(AREA_A);
    expect((await taskRow(successor?.id ?? ""))?.lifeAreaId).toBe(AREA_A);
  });

  it("leaves the area null when the key is absent", async () => {
    const { series, occurrence } = await createSeries();

    expect(series.lifeAreaId).toBeNull();
    expect(occurrence.lifeAreaId).toBeNull();
  });
});

describe("Series create — an unknown area is refused before anything is written (PRD AC-10)", () => {
  it.each([
    ["an id that matches no area", "no-such-area"],
    ["an empty id", ""],
    ["a non-string id", 42],
  ])("rejects %s with 400 naming lifeAreaId and writes nothing", async (_label, lifeAreaId) => {
    const before = await countAllRows();

    const res = await post(BASE, { ...SERIES_BODY, lifeAreaId });

    expect(res.status).toBe(400);
    expect((await errorOf(res)).toLowerCase()).toContain("lifeareaid");
    expect(await countAllRows()).toEqual(before);
  });
});

describe("Series patch — the area moves the series and its open occurrence only (PRD AC-10)", () => {
  /**
   * A series in area A with a `done` and a `missed` occurrence behind its open
   * one. Inserted directly, as test/series.test.ts does for closed rows: the
   * closed rows are the permanent record (ADR-0006) the patch must not rewrite.
   */
  async function seedSeriesWithHistory(): Promise<{ series: SeriesDto; occurrence: TaskDto }> {
    await seedAreas();
    const created = await createSeries({ lifeAreaId: AREA_A });
    const db = createDb(env);
    await db.insert(tasks).values({
      id: "closed-done",
      title: "Pagar aluguel",
      status: "done",
      completedAt: new Date(1_700_000_000_000),
      deadline: "2026-08-05",
      seriesId: created.series.id,
      occurrenceDate: "2026-08-05",
      lifeAreaId: AREA_A,
    });
    await db.insert(tasks).values({
      id: "closed-missed",
      title: "Pagar aluguel",
      status: "missed",
      deadline: "2026-09-05",
      seriesId: created.series.id,
      occurrenceDate: "2026-09-05",
      lifeAreaId: AREA_A,
    });
    return created;
  }

  it("moves the series and its open, non-detached occurrence to the new area", async () => {
    const { series, occurrence } = await seedSeriesWithHistory();

    const res = await patch(`${BASE}/${series.id}`, { lifeAreaId: AREA_B });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { series: SeriesDto }).series.lifeAreaId).toBe(AREA_B);
    expect((await seriesRow(series.id))?.lifeAreaId).toBe(AREA_B);
    expect((await taskRow(occurrence.id))?.lifeAreaId).toBe(AREA_B);
  });

  it("leaves the closed done and missed rows with the area they had", async () => {
    const { series } = await seedSeriesWithHistory();

    expect((await patch(`${BASE}/${series.id}`, { lifeAreaId: AREA_B })).status).toBe(200);

    expect((await taskRow("closed-done"))?.lifeAreaId).toBe(AREA_A);
    expect((await taskRow("closed-missed"))?.lifeAreaId).toBe(AREA_A);
  });

  it("leaves a detached open occurrence with its own area", async () => {
    const { series, occurrence } = await seedSeriesWithHistory();
    await createDb(env).update(tasks).set({ detached: true }).where(eq(tasks.id, occurrence.id));

    const res = await patch(`${BASE}/${series.id}`, { lifeAreaId: AREA_B });

    expect(res.status).toBe(200);
    expect((await seriesRow(series.id))?.lifeAreaId).toBe(AREA_B);
    expect((await taskRow(occurrence.id))?.lifeAreaId).toBe(AREA_A);
  });

  it("clears the area on the series and its open occurrence when sent as null", async () => {
    const { series, occurrence } = await seedSeriesWithHistory();

    const res = await patch(`${BASE}/${series.id}`, { lifeAreaId: null });

    expect(res.status).toBe(200);
    expect((await seriesRow(series.id))?.lifeAreaId).toBeNull();
    expect((await taskRow(occurrence.id))?.lifeAreaId).toBeNull();
  });
});

describe("Series patch — an unknown area is refused and nothing changes (PRD AC-10)", () => {
  it.each([
    ["an id that matches no area", "no-such-area"],
    ["an empty id", ""],
    ["a non-string id", 42],
  ])("rejects %s with 400 naming lifeAreaId", async (_label, lifeAreaId) => {
    await seedAreas();
    const { series, occurrence } = await createSeries({ lifeAreaId: AREA_A });

    // A valid edit rides along: a check that runs after the write, or one that
    // lets the valid keys through before refusing the bad one, changes the title.
    const res = await patch(`${BASE}/${series.id}`, { title: "Aluguel do apê", lifeAreaId });

    expect(res.status).toBe(400);
    expect((await errorOf(res)).toLowerCase()).toContain("lifeareaid");
    const seriesAfter = await seriesRow(series.id);
    expect(seriesAfter?.title).toBe("Pagar aluguel");
    expect(seriesAfter?.lifeAreaId).toBe(AREA_A);
    const occurrenceAfter = await taskRow(occurrence.id);
    expect(occurrenceAfter?.title).toBe("Pagar aluguel");
    expect(occurrenceAfter?.lifeAreaId).toBe(AREA_A);
  });
});
