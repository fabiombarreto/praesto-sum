// PRPs/prds/life-areas.prd.md AC-8 task-create-validates-the-area
// PRPs/prds/life-areas.prd.md AC-11 list-filter
//
// Source plan: PRPs/plans/life-areas-phase-1-areas-api-and-the-filter.plan.md
// (Task 4 — the shared existence check; Task 7 — `POST /api/tasks` validates the
// area; Task 8 — the `lifeAreaId=<id>|none` list filter).
//
// AC-9 (`PATCH /api/tasks/:id`) lives in test/task-update.test.ts, next to the
// pinned case it replaces. AC-10 (series) is test/life-areas-series.test.ts.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`). Expected RED
// reasons, and only these:
//   - AC-8: an id that matches no area is not checked today, so it reaches the
//     foreign key and answers 500 (or is stored), never 400.
//   - AC-11: `lifeAreaId` is not a recognised query parameter, so it is ignored
//     and every Task comes back; an empty `lifeAreaId=` answers 200 instead of 400.
//
// Expected GREEN before the Implementer, on purpose: "the area is stored when the
// id exists" and "absent or null stays null" are behaviour `POST /api/tasks`
// already has. They are pinned here because no test covers them, and the new check
// sits on that very path.
//
// The frozen read contract's ordering and limit are covered by
// test/task-list-contract.test.ts:88-213 and stay untouched. That suite only ever
// holds area-less Tasks, so it cannot tell a missing filter from one that quietly
// defaults to "no area"; the last describe below asserts the delta it cannot see:
// area-bearing Tasks stay in the unfiltered list, and the wire shape is unchanged.
//
// Fixtures go straight to D1 and every date comes from the server's own `todayIn`
// (the discipline test/task-list-filters.test.ts established), so the suite
// asserts the overdue/today/future boundary rather than a calendar it was written on.

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect } from "vitest";
import type { TaskDto } from "../src/shared/api";
import { PRAESTO_TIMEZONE, todayIn } from "../src/shared/dates";
import { createDb } from "../src/worker/db/client";
import { lifeAreas, tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/tasks";

/** Words that only an English message would carry (ADR-0009 regression guard). */
const ENGLISH_MARKERS = /\b(must|required|invalid|unknown|not found|already|blank|too long)\b/i;

const AREA_A = "area-casa";
const AREA_B = "area-trabalho";

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

/** A local calendar day `offset` days from the server's today, as YYYY-MM-DD. */
function dayOffset(offset: number): string {
  const today = todayIn(new Date(), PRAESTO_TIMEZONE);
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

async function postTask(body: unknown): Promise<Response> {
  return exports.default.fetch(BASE, auth({ method: "POST", body: JSON.stringify(body) }));
}

async function listRaw(query = ""): Promise<Response> {
  return exports.default.fetch(`${BASE}${query}`, auth());
}

async function list(query = ""): Promise<TaskDto[]> {
  const res = await listRaw(query);
  expect(res.status).toBe(200);
  return ((await res.json()) as { tasks: TaskDto[] }).tasks;
}

/** Titles in response order — the assertion shape that pins ordering as well as membership. */
function titles(rows: TaskDto[]): string[] {
  return rows.map((row) => row.title);
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

async function storedTaskCount(): Promise<number> {
  return (await createDb(env).select().from(tasks)).length;
}

// Storage isolation is per test FILE, so wipe the tables between tests instead
// of reset() (which would also drop the schema). The wipe first waits for work
// an abandoned — timed-out — test left in flight (test/isolation.ts), but it
// only knows `tasks` and `recurrence_series`, so `life_areas` is wiped here,
// after the drain, in the same hook.
beforeEach(async () => {
  await resetTaskTables();
  await createDb(env).delete(lifeAreas);
}, DRAIN_BUDGET_MS);

describe("Task create — the area is validated (PRD AC-8)", () => {
  it("creates a Task carrying the area when the id matches an area", async () => {
    await createDb(env).insert(lifeAreas).values({ id: AREA_A, name: "Casa" });

    const res = await postTask({ title: "Lavar a louça", lifeAreaId: AREA_A });

    expect(res.status).toBe(201);
    const { task } = (await res.json()) as { task: TaskDto };
    expect(task.lifeAreaId).toBe(AREA_A);
    const [row] = await createDb(env).select().from(tasks).where(eq(tasks.id, task.id));
    expect(row?.lifeAreaId).toBe(AREA_A);
  });

  it.each([
    ["an id that matches no area", "no-such-area"],
    ["an empty id", ""],
    ["a non-string id", 42],
  ])("rejects %s with 400 naming lifeAreaId and creates no Task", async (_label, lifeAreaId) => {
    const res = await postTask({ title: "Orphan", lifeAreaId });

    expect(res.status).toBe(400);
    expect((await errorOf(res)).toLowerCase()).toContain("lifeareaid");
    expect(await storedTaskCount()).toBe(0);
  });

  it("answers the unknown-area error in Portuguese, still naming the field (ADR-0009)", async () => {
    const res = await postTask({ title: "Orphan", lifeAreaId: "no-such-area" });

    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(error.toLowerCase()).toContain("lifeareaid");
    expect(error).not.toMatch(ENGLISH_MARKERS);
  });

  it.each([
    ["absent", { title: "No area" }],
    ["null", { title: "No area", lifeAreaId: null }],
  ])("leaves lifeAreaId null when the key is %s", async (_label, body) => {
    const res = await postTask(body);

    expect(res.status).toBe(201);
    expect(((await res.json()) as { task: TaskDto }).task.lifeAreaId).toBeNull();
  });
});

/**
 * Eight Tasks across area A (`Casa`), area B (`Trabalho`) and no area, arranged
 * so that each filter dimension removes a DIFFERENT row and the globally most
 * urgent row (A4) is outside both `none` and `B`. A composition that ignores a
 * dimension, or applies `limit` before the filter, therefore returns a visibly
 * different list.
 *
 *   title                    area  status  priority  due     word in
 *   A4 pagar a luz           A     open    high      -4 d
 *   A2 consulta paga         A     done    high      -2 d    title
 *   N2 comprar pão           none  open    (unset)   -1 d
 *   N3 ligar para o banco    none  done    low        0 d
 *   A1 marcar consulta       A     open    high      +1 d    title
 *   B1 consulta do carro     B     open    high      +2 d    title
 *   A3 renovar contrato      A     open    low       +3 d    description
 *   N1 consulta de rotina    none  open    high      +4 d    title
 *
 * Urgency order (overdue, today, then future ascending): A4, A2, N2, N3, A1,
 * B1, A3, N1.
 */
async function seedFilterFixture(): Promise<void> {
  const db = createDb(env);
  await db.insert(lifeAreas).values({ id: AREA_A, name: "Casa" });
  await db.insert(lifeAreas).values({ id: AREA_B, name: "Trabalho" });

  const closed = new Date(1_700_000_000_000);
  const rows: (typeof tasks.$inferInsert)[] = [
    {
      id: "a1",
      title: "A1 marcar consulta",
      lifeAreaId: AREA_A,
      priority: "high",
      deadline: dayOffset(1),
    },
    {
      id: "a2",
      title: "A2 consulta paga",
      lifeAreaId: AREA_A,
      status: "done",
      completedAt: closed,
      priority: "high",
      deadline: dayOffset(-2),
    },
    {
      id: "a3",
      title: "A3 renovar contrato",
      description: "levar na consulta",
      lifeAreaId: AREA_A,
      priority: "low",
      scheduledDate: dayOffset(3),
    },
    {
      id: "a4",
      title: "A4 pagar a luz",
      lifeAreaId: AREA_A,
      priority: "high",
      deadline: dayOffset(-4),
    },
    {
      id: "b1",
      title: "B1 consulta do carro",
      lifeAreaId: AREA_B,
      priority: "high",
      deadline: dayOffset(2),
    },
    {
      id: "n1",
      title: "N1 consulta de rotina",
      priority: "high",
      deadline: dayOffset(4),
    },
    {
      id: "n2",
      title: "N2 comprar pão",
      deadline: dayOffset(-1),
    },
    {
      id: "n3",
      title: "N3 ligar para o banco",
      status: "done",
      completedAt: closed,
      priority: "low",
      deadline: dayOffset(0),
    },
  ];
  for (const row of rows) {
    await db.insert(tasks).values(row);
  }
}

describe("Task list — the lifeAreaId filter (PRD AC-11)", () => {
  it("returns only the area's Tasks, of every status, in urgency order", async () => {
    await seedFilterFixture();

    expect(titles(await list(`?lifeAreaId=${AREA_A}`))).toEqual([
      "A4 pagar a luz",
      "A2 consulta paga",
      "A1 marcar consulta",
      "A3 renovar contrato",
    ]);
  });

  it("returns only the Tasks of the other area when that one is asked for", async () => {
    await seedFilterFixture();

    expect(titles(await list(`?lifeAreaId=${AREA_B}`))).toEqual(["B1 consulta do carro"]);
  });

  it("returns only the area-less Tasks, of every status, for none", async () => {
    await seedFilterFixture();

    expect(titles(await list("?lifeAreaId=none"))).toEqual([
      "N2 comprar pão",
      "N3 ligar para o banco",
      "N1 consulta de rotina",
    ]);
  });

  it("answers 200 with an empty list for an id that matches no area", async () => {
    await seedFilterFixture();

    const res = await listRaw("?lifeAreaId=no-such-area");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tasks: [] });
  });

  it("rejects an empty value with 400 naming lifeAreaId, rather than dropping the filter", async () => {
    await seedFilterFixture();

    // A distinct defect mode from an unknown id: `?lifeAreaId=` yields the empty
    // string, not `undefined`. An implementation gating on truthiness silently
    // drops the parameter and answers 200 with every Task, while the caller
    // believes a filter was applied.
    const res = await listRaw("?lifeAreaId=");

    expect(res.status).toBe(400);
    expect((await errorOf(res)).toLowerCase()).toContain("lifeareaid");
  });

  it("answers the empty-value error in Portuguese, still naming the field (ADR-0009)", async () => {
    const res = await listRaw("?lifeAreaId=");

    expect(res.status).toBe(400);
    expect(await errorOf(res)).not.toMatch(ENGLISH_MARKERS);
  });
});

describe("Task list — lifeAreaId composes as an AND with the other filters (PRD AC-11)", () => {
  it("narrows an area by status", async () => {
    await seedFilterFixture();

    expect(titles(await list(`?lifeAreaId=${AREA_A}&status=open`))).toEqual([
      "A4 pagar a luz",
      "A1 marcar consulta",
      "A3 renovar contrato",
    ]);
  });

  it("narrows an area by status and text, finding the word in title or description", async () => {
    await seedFilterFixture();

    // The PRD's own example: only A's open Tasks holding the word, A1 in its
    // title and A3 in its description. A2 is done, B1 and N1 hold the word but
    // sit in another area or none.
    expect(titles(await list(`?lifeAreaId=${AREA_A}&status=open&q=consulta`))).toEqual([
      "A1 marcar consulta",
      "A3 renovar contrato",
    ]);
  });

  it("narrows an area by priority", async () => {
    await seedFilterFixture();

    expect(titles(await list(`?lifeAreaId=${AREA_A}&priority=high`))).toEqual([
      "A4 pagar a luz",
      "A2 consulta paga",
      "A1 marcar consulta",
    ]);
  });

  it("narrows an area by a date range", async () => {
    await seedFilterFixture();

    const query = `?lifeAreaId=${AREA_A}&from=${dayOffset(-2)}&to=${dayOffset(1)}`;
    expect(titles(await list(query))).toEqual(["A2 consulta paga", "A1 marcar consulta"]);
  });

  it("narrows the area-less Tasks by status", async () => {
    await seedFilterFixture();

    expect(titles(await list("?lifeAreaId=none&status=open"))).toEqual([
      "N2 comprar pão",
      "N1 consulta de rotina",
    ]);
  });

  it("narrows the area-less Tasks by text", async () => {
    await seedFilterFixture();

    expect(titles(await list("?lifeAreaId=none&q=consulta"))).toEqual(["N1 consulta de rotina"]);
  });

  it("counts an unset priority as normal inside the area-less Tasks too", async () => {
    await seedFilterFixture();

    expect(titles(await list("?lifeAreaId=none&priority=normal"))).toEqual(["N2 comprar pão"]);
  });

  it("takes the first N of the ORDERED FILTERED set, not of the whole table", async () => {
    await seedFilterFixture();

    // The most urgent Task overall is A4, which `none` excludes. A limit applied
    // before the filter would return nothing here; an unfiltered one, A4.
    expect(titles(await list("?lifeAreaId=none&limit=1"))).toEqual(["N2 comprar pão"]);
  });
});

describe("Task list — without lifeAreaId the response is the frozen one (PRD AC-11)", () => {
  const TASK_FIELDS = [
    "completedAt",
    "createdAt",
    "deadline",
    "description",
    "detached",
    "id",
    "lifeAreaId",
    "occurrenceDate",
    "priority",
    "scheduledDate",
    "seriesId",
    "status",
    "title",
  ];

  it("lists every Task, area or not, in the documented urgency order", async () => {
    await seedFilterFixture();

    expect(titles(await list())).toEqual([
      "A4 pagar a luz",
      "A2 consulta paga",
      "N2 comprar pão",
      "N3 ligar para o banco",
      "A1 marcar consulta",
      "B1 consulta do carro",
      "A3 renovar contrato",
      "N1 consulta de rotina",
    ]);
  });

  it("keeps the envelope and every Task's field set exactly as documented", async () => {
    await seedFilterFixture();

    const body = (await (await listRaw()).json()) as { tasks: Record<string, unknown>[] };

    expect(Object.keys(body)).toEqual(["tasks"]);
    expect(body.tasks).toHaveLength(8);
    for (const task of body.tasks) {
      expect(Object.keys(task).sort()).toEqual(TASK_FIELDS);
    }
  });

  it("serialises an area-bearing Task field for field", async () => {
    await seedFilterFixture();

    const found = (await list()).find((task) => task.id === "a1");

    expect(found).toEqual({
      id: "a1",
      title: "A1 marcar consulta",
      description: null,
      status: "open",
      deadline: dayOffset(1),
      scheduledDate: null,
      priority: "high",
      lifeAreaId: AREA_A,
      seriesId: null,
      occurrenceDate: null,
      detached: false,
      completedAt: null,
      createdAt: expect.any(Number),
    });
  });
});
