// PRPs/prds/life-areas.prd.md AC-17 export-carries-it
//
// Source plan: PRPs/plans/life-areas-phase-1-areas-api-and-the-filter.plan.md
// (AC-A13 — delivered by composition: `/api/life-areas`, `POST /api/tasks` and
// `POST /api/series` make assigned areas exist, and the unchanged FR-042 export
// already dumps `life_areas` and the `lifeAreaId` columns).
//
// What test/export.test.ts:64-97 (data-export AC-2) already covers: every one of
// the five tables is present and carries a seeded row. What it cannot see, and
// what this file adds: it seeds NO assigned item and asserts only that one row id
// is present, never that a row is dumped field for field or that a Task and a
// series carry the area's id. The completeness guard
// (test/export-completeness.test.ts:44-101) stays the evidence that the manifest
// did not change; it is not repeated here.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`). The area, the
// assigned Task and the assigned series are created through the public routes, so
// the RED reason is the one this phase removes: `POST /api/life-areas` answers 404
// until plan Tasks 5 and 6 land. The export code itself needs no change.

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect } from "vitest";
import type { LifeAreaDto, SeriesDto, TaskDto } from "../src/shared/api";
import { createDb } from "../src/worker/db/client";
import { lifeAreas, reminders } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const EXPORT = "https://example.com/api/export";
const AREAS = "https://example.com/api/life-areas";
const TASKS = "https://example.com/api/tasks";
const SERIES = "https://example.com/api/series";

interface ExportBody {
  formatVersion: number;
  tables: Record<string, Array<Record<string, unknown>>>;
}

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

async function post(path: string, body: unknown): Promise<Response> {
  return exports.default.fetch(path, auth({ method: "POST", body: JSON.stringify(body) }));
}

async function exportDocument(): Promise<ExportBody> {
  const res = await exports.default.fetch(EXPORT, auth());
  expect(res.status).toBe(200);
  return (await res.json()) as ExportBody;
}

interface Assigned {
  area: LifeAreaDto;
  taskId: string;
  seriesId: string;
  occurrenceId: string;
}

/** One area, a one-off Task assigned to it, and a series (with its occurrence) assigned to it. */
async function seedAssigned(): Promise<Assigned> {
  const areaRes = await post(AREAS, { name: "Casa" });
  expect(areaRes.status).toBe(201);
  const { lifeArea: area } = (await areaRes.json()) as { lifeArea: LifeAreaDto };

  // `description` is not reachable through the API (only the export carries it),
  // so it is set directly: "field for field" then covers a non-null value too.
  await createDb(env)
    .update(lifeAreas)
    .set({ description: "Onde a gente mora" })
    .where(eq(lifeAreas.id, area.id));

  const taskRes = await post(TASKS, { title: "Lavar a louça", lifeAreaId: area.id });
  expect(taskRes.status).toBe(201);
  const { task } = (await taskRes.json()) as { task: TaskDto };

  const seriesRes = await post(SERIES, {
    title: "Regar as plantas",
    freq: "daily",
    dtstart: "2026-10-05",
    dateMode: "scheduled",
    lifeAreaId: area.id,
  });
  expect(seriesRes.status).toBe(201);
  const { series, occurrence } = (await seriesRes.json()) as {
    series: SeriesDto;
    occurrence: TaskDto;
  };

  return { area, taskId: task.id, seriesId: series.id, occurrenceId: occurrence.id };
}

// `resetTaskTables()` (test/isolation.ts) drains abandoned work from a timed-out
// test before wiping `tasks`/`recurrence_series`. `reminders` and `life_areas` are
// not its tables, so they are wiped here, after the drain, in the same hook.
beforeEach(async () => {
  await resetTaskTables();
  const db = createDb(env);
  await db.delete(reminders);
  await db.delete(lifeAreas);
}, DRAIN_BUDGET_MS);

describe("GET /api/export — an assigned area travels with its items (PRD AC-17)", () => {
  it("dumps the area field for field", async () => {
    const { area } = await seedAssigned();
    const [stored] = await createDb(env).select().from(lifeAreas).where(eq(lifeAreas.id, area.id));

    const dump = await exportDocument();

    expect(dump.tables.life_areas).toEqual([
      {
        id: area.id,
        name: "Casa",
        description: "Onde a gente mora",
        createdAt: Math.floor((stored?.createdAt.getTime() ?? 0) / 1000),
        updatedAt: Math.floor((stored?.updatedAt.getTime() ?? 0) / 1000),
      },
    ]);
  });

  it("carries the area's id on the Task and on the series assigned to it", async () => {
    const { area, taskId, seriesId, occurrenceId } = await seedAssigned();

    const dump = await exportDocument();

    expect(dump.tables.tasks?.find((row) => row.id === taskId)?.lifeAreaId).toBe(area.id);
    expect(dump.tables.tasks?.find((row) => row.id === occurrenceId)?.lifeAreaId).toBe(area.id);
    expect(dump.tables.recurrence_series?.find((row) => row.id === seriesId)?.lifeAreaId).toBe(
      area.id,
    );
  });

  it("keeps formatVersion at 1, the area needing no format change", async () => {
    await seedAssigned();

    const dump = await exportDocument();

    expect(dump.formatVersion).toBe(1);
  });
});
