// PRPs/prds/life-areas.prd.md AC-1 create-and-list
// PRPs/prds/life-areas.prd.md AC-2 name-rules
// PRPs/prds/life-areas.prd.md AC-3 limit
// PRPs/prds/life-areas.prd.md AC-4 rename
// PRPs/prds/life-areas.prd.md AC-5 delete-unassigns
// PRPs/prds/life-areas.prd.md AC-6 list-shape
// PRPs/prds/life-areas.prd.md AC-7 bearer-gate
//
// Source plan: PRPs/plans/life-areas-phase-1-areas-api-and-the-filter.plan.md
// (Task 5 — `/api/life-areas` create, list, rename, delete; Task 6 — mounted
// below the bearer gate).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`):
// `src/worker/routes/life-areas.ts` does not exist and nothing is mounted at
// `/api/life-areas`, so every request below is expected to answer 404 (Hono's
// `app.notFound`) until plan Tasks 5 and 6 land — that is the RED reason. The
// token checks in AC-7 also carry a positive control (the same request with the
// right token must reach the route), so the gate that already answers 401 for
// any `/api/*` path cannot make them pass on its own.
//
// Setup goes straight to D1 wherever the setup is not the thing under test, so
// a defect in one route does not hide behind a failure in another.
//
// Copy contract (ADR-0009): validation and conflict messages are pt-BR and carry
// the field name in parentheses. The cases below match on the FIELD NAME, and a
// single guard asserts the prose is not English — the same split
// `test/series.test.ts` uses, for the same reason.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import type { LifeAreaDto, LifeAreasResponse, TaskDto } from "../src/shared/api";
import { createDb } from "../src/worker/db/client";
import { lifeAreas, recurrenceSeries, tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/life-areas";
const TASKS_BASE = "https://example.com/api/tasks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Words that only an English message would carry (ADR-0009 regression guard). */
const ENGLISH_MARKERS = /\b(must|required|invalid|unknown|not found|already|blank|too long)\b/i;

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

function request(method: string, path: string, body?: unknown): Promise<Response> {
  return exports.default.fetch(
    path,
    auth(body === undefined ? { method } : { method, body: JSON.stringify(body) }),
  );
}

function createArea(body: unknown): Promise<Response> {
  return request("POST", BASE, body);
}

function renameArea(id: string, body: unknown): Promise<Response> {
  return request("PATCH", `${BASE}/${id}`, body);
}

function deleteArea(id: string): Promise<Response> {
  return request("DELETE", `${BASE}/${id}`);
}

async function listAreas(): Promise<LifeAreasResponse> {
  const res = await request("GET", BASE);
  expect(res.status).toBe(200);
  return (await res.json()) as LifeAreasResponse;
}

async function createOk(name: string): Promise<LifeAreaDto> {
  const res = await createArea({ name });
  expect(res.status).toBe(201);
  return ((await res.json()) as { lifeArea: LifeAreaDto }).lifeArea;
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

async function seedArea(id: string, name: string): Promise<void> {
  await createDb(env).insert(lifeAreas).values({ id, name });
}

async function storedAreaNames(): Promise<string[]> {
  const rows = await createDb(env).select().from(lifeAreas);
  return rows.map((row) => row.name).sort();
}

async function storedAreaIds(): Promise<string[]> {
  const rows = await createDb(env).select().from(lifeAreas);
  return rows.map((row) => row.id).sort();
}

async function taskIdsInArea(areaId: string): Promise<string[]> {
  const res = await request("GET", `${TASKS_BASE}?lifeAreaId=${areaId}`);
  expect(res.status).toBe(200);
  const { tasks: listed } = (await res.json()) as { tasks: TaskDto[] };
  return listed.map((task) => task.id).sort();
}

// Storage isolation is per test FILE, so wipe the tables between tests instead
// of reset() (which would also drop the schema). `resetTaskTables()` drains any
// abandoned work first (see test/isolation.ts) but only knows `tasks` and
// `recurrence_series`; `life_areas` is wiped here, after the drain, in the same
// hook — as test/export.test.ts does.
beforeEach(async () => {
  await resetTaskTables();
  await createDb(env).delete(lifeAreas);
}, DRAIN_BUDGET_MS);

describe("Life areas — create and list (PRD AC-1)", () => {
  it("creates an area with its name trimmed, a null description and a UUID id", async () => {
    const res = await createArea({ name: "  Casa " });
    expect(res.status).toBe(201);
    const { lifeArea } = (await res.json()) as { lifeArea: LifeAreaDto };

    expect(lifeArea.name).toBe("Casa");
    expect(lifeArea.description).toBeNull();
    expect(lifeArea.id).toMatch(UUID);
    expect(typeof lifeArea.createdAt).toBe("number");
    expect(typeof lifeArea.updatedAt).toBe("number");
  });

  it("lists exactly the area it created, under its trimmed name", async () => {
    const created = await createOk("  Casa ");

    const body = await listAreas();

    expect(body.lifeAreas).toHaveLength(1);
    expect(body.lifeAreas[0]?.id).toBe(created.id);
    expect(body.lifeAreas[0]?.name).toBe("Casa");
  });
});

describe("Life areas — name rules on create (PRD AC-2)", () => {
  beforeEach(async () => {
    await seedArea("area-saude", "Saúde");
  });

  it.each([
    ["a blank name", { name: "" }],
    ["a whitespace-only name", { name: "   " }],
    ["a name of 41 characters", { name: "a".repeat(41) }],
    ["a missing name", {}],
    ["a non-string name", { name: 42 }],
  ])("rejects %s with 400 naming name and writes nothing", async (_label, body) => {
    const res = await createArea(body);

    expect(res.status).toBe(400);
    expect((await errorOf(res)).toLowerCase()).toContain("name");
    expect(await storedAreaNames()).toEqual(["Saúde"]);
  });

  it("accepts a name of exactly 40 characters", async () => {
    const name = "a".repeat(40);

    const res = await createArea({ name });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { lifeArea: LifeAreaDto }).lifeArea.name).toBe(name);
  });

  it.each([
    ["case", "saude"],
    ["case and accent", "SAÚDE"],
    ["surrounding whitespace", " Saude "],
    // `u` plus a combining acute accent: different code points, same name to the owner.
    ["a decomposed accent", "Saúde".normalize("NFD")],
  ])("rejects a duplicate that differs only by %s with 409 naming name", async (_label, name) => {
    const res = await createArea({ name });

    expect(res.status).toBe(409);
    expect((await errorOf(res)).toLowerCase()).toContain("name");
    expect(await storedAreaNames()).toEqual(["Saúde"]);
  });

  it("does not mistake a longer name that merely starts the same for a duplicate", async () => {
    const res = await createArea({ name: "Saudável" });

    expect(res.status).toBe(201);
    expect(await storedAreaNames()).toEqual(["Saudável", "Saúde"]);
  });
});

describe("Life areas — name rules on rename (PRD AC-2)", () => {
  beforeEach(async () => {
    await seedArea("area-saude", "Saúde");
    await seedArea("area-casa", "Casa");
  });

  it.each([
    ["a blank name", { name: "" }],
    ["a whitespace-only name", { name: "   " }],
    ["a name of 41 characters", { name: "a".repeat(41) }],
    ["a null name", { name: null }],
  ])("rejects renaming to %s with 400 naming name and changes nothing", async (_label, body) => {
    const res = await renameArea("area-casa", body);

    expect(res.status).toBe(400);
    expect((await errorOf(res)).toLowerCase()).toContain("name");
    expect(await storedAreaNames()).toEqual(["Casa", "Saúde"]);
  });

  it.each([
    ["case", "saude"],
    ["case and accent", "SAÚDE"],
    ["surrounding whitespace", " Saude "],
  ])("rejects renaming to a duplicate differing only by %s with 409", async (_label, next) => {
    const res = await renameArea("area-casa", { name: next });

    expect(res.status).toBe(409);
    expect((await errorOf(res)).toLowerCase()).toContain("name");
    expect(await storedAreaNames()).toEqual(["Casa", "Saúde"]);
  });
});

describe("Life areas — at most twelve (PRD AC-3)", () => {
  async function seedAreas(count: number): Promise<void> {
    for (let n = 1; n <= count; n++) {
      await seedArea(`area-${n}`, `Area ${String(n).padStart(2, "0")}`);
    }
  }

  it("accepts the twelfth area", async () => {
    await seedAreas(11);

    const res = await createArea({ name: "Doze" });

    expect(res.status).toBe(201);
    expect((await listAreas()).lifeAreas).toHaveLength(12);
  });

  it("refuses a thirteenth area with 409 and leaves twelve", async () => {
    await seedAreas(12);

    const res = await createArea({ name: "Treze" });

    expect(res.status).toBe(409);
    expect((await listAreas()).lifeAreas).toHaveLength(12);
    expect(await storedAreaNames()).not.toContain("Treze");
  });

  it("accepts the same create once one area has been deleted", async () => {
    await seedAreas(12);
    expect((await createArea({ name: "Treze" })).status).toBe(409);

    expect((await deleteArea("area-1")).status).toBe(204);
    const retried = await createArea({ name: "Treze" });

    expect(retried.status).toBe(201);
    expect((await listAreas()).lifeAreas).toHaveLength(12);
  });

  it("still lets the owner rename an area while he holds twelve", async () => {
    await seedAreas(12);

    const res = await renameArea("area-1", { name: "Renomeada" });

    expect(res.status).toBe(200);
    expect(await storedAreaNames()).toContain("Renomeada");
  });
});

describe("Life areas — rename (PRD AC-4)", () => {
  async function seedCasaWithTasks(): Promise<void> {
    const db = createDb(env);
    await seedArea("area-casa", "Casa");
    await db.insert(tasks).values({
      id: "task-open",
      title: "Lavar a louça",
      lifeAreaId: "area-casa",
    });
    await db.insert(tasks).values({
      id: "task-done",
      title: "Trocar a lâmpada",
      status: "done",
      completedAt: new Date(1_700_000_000_000),
      lifeAreaId: "area-casa",
    });
  }

  it("renames in place, keeps the id, and keeps the same Tasks under it", async () => {
    await seedCasaWithTasks();
    const before = await taskIdsInArea("area-casa");
    expect(before).toEqual(["task-done", "task-open"]);

    const res = await renameArea("area-casa", { name: "  Lar " });

    expect(res.status).toBe(200);
    const { lifeArea } = (await res.json()) as { lifeArea: LifeAreaDto };
    expect(lifeArea.id).toBe("area-casa");
    expect(lifeArea.name).toBe("Lar");
    expect(await storedAreaNames()).toEqual(["Lar"]);
    expect(await taskIdsInArea("area-casa")).toEqual(before);
  });

  it.each([
    ["Casa", "casa"],
    ["Saude", "Saúde"],
  ])("accepts renaming %s to its own name as %s", async (current, next) => {
    await seedArea("area-own", current);

    const res = await renameArea("area-own", { name: next });

    expect(res.status).toBe(200);
    expect(await storedAreaNames()).toEqual([next]);
  });

  it("answers 404 for an area that does not exist, and creates nothing", async () => {
    const res = await renameArea("no-such-area", { name: "Lar" });

    expect(res.status).toBe(404);
    expect(await storedAreaIds()).toEqual([]);
  });

  it.each([
    ["the id", "id", { id: "hijacked" }],
    ["a description", "description", { description: "A description" }],
    ["a description beside a valid name", "description", { name: "Lar", description: "A" }],
    ["a typo", "nonsense", { nonsense: "value" }],
  ])("rejects a body carrying %s with 400 and changes nothing", async (_label, key, body) => {
    await seedArea("area-casa", "Casa");

    const res = await renameArea("area-casa", body);

    expect(res.status).toBe(400);
    expect((await errorOf(res)).toLowerCase()).toContain(String(key));
    const [row] = await createDb(env).select().from(lifeAreas);
    expect(row?.id).toBe("area-casa");
    expect(row?.name).toBe("Casa");
    expect(row?.description).toBeNull();
  });

  it("rejects an empty body with 400", async () => {
    await seedArea("area-casa", "Casa");

    expect((await renameArea("area-casa", {})).status).toBe(400);
    expect(await storedAreaNames()).toEqual(["Casa"]);
  });
});

describe("Life areas — delete unassigns, it never deletes an item (PRD AC-5)", () => {
  /**
   * Area A holds a one-off open Task, a one-off done Task, and a series with its
   * open occurrence. Area B and an area-less Task exist to prove the delete does
   * not reach past A: nulling every `life_area_id` would pass a looser fixture.
   */
  async function seedFixture(): Promise<void> {
    const db = createDb(env);
    await seedArea("area-a", "Casa");
    await seedArea("area-b", "Trabalho");
    await db.insert(recurrenceSeries).values({
      id: "series-a",
      kind: "task",
      freq: "daily",
      dtstart: "2026-08-03",
      title: "Regar as plantas",
      lifeAreaId: "area-a",
    });
    await db.insert(recurrenceSeries).values({
      id: "series-b",
      kind: "task",
      freq: "weekly",
      dtstart: "2026-08-03",
      title: "Relatório semanal",
      lifeAreaId: "area-b",
    });
    await db.insert(tasks).values({
      id: "a-open",
      title: "Lavar a louça",
      deadline: "2026-09-10",
      priority: "high",
      lifeAreaId: "area-a",
    });
    await db.insert(tasks).values({
      id: "a-done",
      title: "Trocar a lâmpada",
      status: "done",
      completedAt: new Date(1_700_000_000_000),
      lifeAreaId: "area-a",
    });
    await db.insert(tasks).values({
      id: "a-occurrence",
      title: "Regar as plantas",
      scheduledDate: "2026-08-03",
      seriesId: "series-a",
      occurrenceDate: "2026-08-03",
      lifeAreaId: "area-a",
    });
    await db.insert(tasks).values({
      id: "b-open",
      title: "Enviar relatório",
      lifeAreaId: "area-b",
    });
    await db.insert(tasks).values({
      id: "b-occurrence",
      title: "Relatório semanal",
      seriesId: "series-b",
      occurrenceDate: "2026-08-03",
      lifeAreaId: "area-b",
    });
    await db.insert(tasks).values({ id: "loose-open", title: "Sem área" });
  }

  async function snapshotTasks() {
    const rows = await createDb(env).select().from(tasks);
    return rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        deadline: row.deadline,
        scheduledDate: row.scheduledDate,
        priority: row.priority,
        seriesId: row.seriesId,
        occurrenceDate: row.occurrenceDate,
        completedAt: row.completedAt?.getTime() ?? null,
        lifeAreaId: row.lifeAreaId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async function snapshotSeries() {
    const rows = await createDb(env).select().from(recurrenceSeries);
    return rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        freq: row.freq,
        dtstart: row.dtstart,
        doneCount: row.doneCount,
        missedCount: row.missedCount,
        lifeAreaId: row.lifeAreaId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  it("answers 204 and removes the area", async () => {
    await seedFixture();

    const res = await deleteArea("area-a");

    expect(res.status).toBe(204);
    expect(await storedAreaIds()).toEqual(["area-b"]);
    expect((await listAreas()).lifeAreas.map((area) => area.id)).toEqual(["area-b"]);
  });

  it("leaves its Tasks, its occurrence and its series with no area, and changes nothing else", async () => {
    await seedFixture();
    const tasksBefore = await snapshotTasks();
    const seriesBefore = await snapshotSeries();
    // The fixture really holds what the assertion below depends on.
    expect(tasksBefore.filter((row) => row.lifeAreaId === "area-a")).toHaveLength(3);
    expect(seriesBefore.filter((row) => row.lifeAreaId === "area-a")).toHaveLength(1);

    expect((await deleteArea("area-a")).status).toBe(204);

    // Nothing is deleted, no title, status or date moves, B and the area-less
    // Task are untouched — and exactly A's items lost the area.
    const expectedTasks = tasksBefore.map((row) =>
      row.lifeAreaId === "area-a" ? { ...row, lifeAreaId: null } : row,
    );
    const expectedSeries = seriesBefore.map((row) =>
      row.lifeAreaId === "area-a" ? { ...row, lifeAreaId: null } : row,
    );
    expect(await snapshotTasks()).toEqual(expectedTasks);
    expect(await snapshotSeries()).toEqual(expectedSeries);
  });

  it("answers 404 for an area that does not exist, and removes nothing", async () => {
    await seedFixture();
    const tasksBefore = await snapshotTasks();

    const res = await deleteArea("no-such-area");

    expect(res.status).toBe(404);
    expect(await storedAreaIds()).toEqual(["area-a", "area-b"]);
    expect(await snapshotTasks()).toEqual(tasksBefore);
  });
});

describe("Life areas — list shape, order and counts (PRD AC-6)", () => {
  /**
   * Inserted deliberately out of alphabetical order, so neither insertion order
   * nor a bytewise sort (`Casa`, `Trabalho`, `Ética`) can produce the expected
   * `Casa`, `Ética`, `Trabalho`.
   *
   *   Casa     2 open + 1 done one-off Tasks, one ENDED series with no rows
   *   Ética    1 open one-off Task + one series with a done, a missed and an
   *            open occurrence
   *   Trabalho nothing at all — must still be listed, with zero counts
   *   no area  2 open one-offs + 1 done one-off + 1 series' open occurrence
   */
  async function seedFixture(): Promise<void> {
    const db = createDb(env);
    await seedArea("area-trabalho", "Trabalho");
    await seedArea("area-etica", "Ética");
    await seedArea("area-casa", "Casa");

    await db.insert(recurrenceSeries).values({
      id: "series-casa-ended",
      kind: "task",
      freq: "daily",
      dtstart: "2026-07-01",
      title: "Regar as plantas",
      status: "ended",
      lifeAreaId: "area-casa",
    });
    await db.insert(recurrenceSeries).values({
      id: "series-etica",
      kind: "task",
      freq: "daily",
      dtstart: "2026-08-01",
      title: "Meditar",
      lifeAreaId: "area-etica",
    });
    await db.insert(recurrenceSeries).values({
      id: "series-loose",
      kind: "task",
      freq: "daily",
      dtstart: "2026-08-01",
      title: "Beber água",
    });

    const closed = new Date(1_700_000_000_000);
    const rows: (typeof tasks.$inferInsert)[] = [
      { id: "casa-1", title: "Lavar a louça", lifeAreaId: "area-casa" },
      { id: "casa-2", title: "Trocar a lâmpada", lifeAreaId: "area-casa" },
      {
        id: "casa-done",
        title: "Pagar a luz",
        status: "done",
        completedAt: closed,
        lifeAreaId: "area-casa",
      },
      { id: "etica-1", title: "Ler sobre ética", lifeAreaId: "area-etica" },
      {
        id: "etica-done",
        title: "Meditar",
        status: "done",
        completedAt: closed,
        seriesId: "series-etica",
        occurrenceDate: "2026-08-01",
        lifeAreaId: "area-etica",
      },
      {
        id: "etica-missed",
        title: "Meditar",
        status: "missed",
        seriesId: "series-etica",
        occurrenceDate: "2026-08-02",
        lifeAreaId: "area-etica",
      },
      {
        id: "etica-open",
        title: "Meditar",
        seriesId: "series-etica",
        occurrenceDate: "2026-08-03",
        lifeAreaId: "area-etica",
      },
      { id: "loose-1", title: "Comprar pão" },
      { id: "loose-2", title: "Marcar o dentista" },
      { id: "loose-done", title: "Ligar para o banco", status: "done", completedAt: closed },
      {
        id: "loose-occurrence",
        title: "Beber água",
        seriesId: "series-loose",
        occurrenceDate: "2026-08-03",
      },
    ];
    for (const row of rows) {
      await db.insert(tasks).values(row);
    }
  }

  it("answers 200 with the areas in pt-BR alphabetical order, not bytewise", async () => {
    await seedFixture();

    const body = await listAreas();

    expect(body.lifeAreas.map((area) => area.name)).toEqual(["Casa", "Ética", "Trabalho"]);
    expect(body.lifeAreas.map((area) => area.id)).toEqual([
      "area-casa",
      "area-etica",
      "area-trabalho",
    ]);
  });

  it("carries openTaskCount, taskCount and seriesCount on each area", async () => {
    await seedFixture();

    const body = await listAreas();

    expect(
      body.lifeAreas.map(({ name, openTaskCount, taskCount, seriesCount }) => ({
        name,
        openTaskCount,
        taskCount,
        seriesCount,
      })),
    ).toEqual([
      // open Tasks only / Tasks of every status / the area's Recurrence Series
      { name: "Casa", openTaskCount: 2, taskCount: 3, seriesCount: 1 },
      { name: "Ética", openTaskCount: 2, taskCount: 4, seriesCount: 1 },
      { name: "Trabalho", openTaskCount: 0, taskCount: 0, seriesCount: 0 },
    ]);
  });

  it("counts the open Tasks that have no area under noArea", async () => {
    await seedFixture();

    const body = await listAreas();

    expect(body.noArea).toEqual({ openTaskCount: 3 });
  });

  it("answers with no areas and the open area-less count when none exist", async () => {
    const db = createDb(env);
    await db.insert(tasks).values({ id: "loose-1", title: "Comprar pão" });
    await db.insert(tasks).values({ id: "loose-2", title: "Marcar o dentista" });
    await db.insert(tasks).values({
      id: "loose-done",
      title: "Ligar para o banco",
      status: "done",
      completedAt: new Date(1_700_000_000_000),
    });

    const res = await request("GET", BASE);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lifeAreas: [], noArea: { openTaskCount: 2 } });
  });
});

describe("Life areas — every route stays behind the bearer gate (PRD AC-7)", () => {
  interface GatedRoute {
    label: string;
    method: string;
    path: string;
    body?: unknown;
    /** What the same request answers WITH the token — the positive control. */
    okStatus: number;
  }

  const routes: GatedRoute[] = [
    { label: "GET /api/life-areas", method: "GET", path: BASE, okStatus: 200 },
    {
      label: "POST /api/life-areas",
      method: "POST",
      path: BASE,
      body: { name: "Intrusa" },
      okStatus: 201,
    },
    {
      label: "PATCH /api/life-areas/:id",
      method: "PATCH",
      path: `${BASE}/area-casa`,
      body: { name: "Hackeada" },
      okStatus: 200,
    },
    {
      label: "DELETE /api/life-areas/:id",
      method: "DELETE",
      path: `${BASE}/area-casa`,
      okStatus: 204,
    },
  ];

  function withToken(token: string | null, route: GatedRoute): Promise<Response> {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (token !== null) headers.set("Authorization", `Bearer ${token}`);
    const init: RequestInit = { method: route.method, headers };
    if (route.body !== undefined) init.body = JSON.stringify(route.body);
    return exports.default.fetch(route.path, init);
  }

  it.each(routes)(
    "answers 401 for $label without a token or with a wrong one, and touches nothing",
    async (route) => {
      await seedArea("area-casa", "Segredo da Casa");

      for (const token of [null, "not-the-token"]) {
        const res = await withToken(token, route);
        expect(res.status).toBe(401);
        expect(await res.text()).not.toContain("Segredo da Casa");
      }
      // Neither refused call read or wrote anything.
      expect(await storedAreaNames()).toEqual(["Segredo da Casa"]);

      // Positive control: the route is mounted, and the token is what it asked for.
      const admitted = await withToken(env.API_BEARER_TOKEN, route);
      expect(admitted.status).toBe(route.okStatus);
    },
  );
});

describe("Life areas — the messages the owner may read are pt-BR (ADR-0009)", () => {
  it("answers validation, conflict and not-found errors in Portuguese", async () => {
    await seedArea("area-saude", "Saúde");

    const blank = await createArea({ name: "   " });
    const tooLong = await createArea({ name: "a".repeat(41) });
    const duplicate = await createArea({ name: "saude" });
    const missing = await renameArea("no-such-area", { name: "Lar" });
    const readOnlyKey = await renameArea("area-saude", { description: "x" });

    expect(blank.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(duplicate.status).toBe(409);
    expect(missing.status).toBe(404);
    expect(readOnlyKey.status).toBe(400);
    for (const res of [blank, tooLong, duplicate, missing, readOnlyKey]) {
      expect(await errorOf(res)).not.toMatch(ENGLISH_MARKERS);
    }
  });

  it("answers the area limit in Portuguese", async () => {
    for (let n = 1; n <= 12; n++) {
      await seedArea(`area-${n}`, `Area ${String(n).padStart(2, "0")}`);
    }

    const res = await createArea({ name: "Treze" });

    expect(res.status).toBe(409);
    expect(await errorOf(res)).not.toMatch(ENGLISH_MARKERS);
    expect(await storedAreaNames()).not.toContain("Treze");
  });
});
