// PRPs/prds/recurring-tasks.prd.md AC-11 Create materializes the first occurrence
// PRPs/prds/recurring-tasks.prd.md AC-12 Reminder offsets follow the occurrence's own date field (D9)
// PRPs/prds/recurring-tasks.prd.md AC-13 Validation writes nothing
// PRPs/prds/recurring-tasks.prd.md AC-14 Priority is an enum twice (migration 0005)
// PRPs/prds/recurring-tasks.prd.md AC-15 Token gate
// PRPs/prds/recurring-tasks.prd.md AC-16 Read
// PRPs/prds/recurring-tasks.prd.md AC-17 Template edit propagates only to the open, non-detached occurrence (D7)
// PRPs/prds/recurring-tasks.prd.md AC-18 Ending a series
//
// Source plan: PRPs/plans/recurring-tasks-phase-2-series-api.plan.md
// (Tasks 1-2 — migration 0005; Task 3 — src/shared/api.ts series wire types;
// Task 4 — toSeriesDto; Task 5 — POST/GET/GET :id; Task 6 — PATCH :id;
// Task 7 — mount /api/series.)
//
// Scope: PRD AC-11..AC-18 (plan AC-A1..AC-A8) ONLY. AC-1..AC-10 (Phase 1, the
// pure expansion module) are already covered by test/recurrence.test.ts and
// are neither duplicated nor modified here. AC-19..AC-28 (Phases 3-4) are out
// of this phase's scope and produce no test here.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`):
// `src/worker/routes/series.ts` does not exist yet and is not mounted at
// `/api/series`, and migration 0005 has not been generated, so this file is
// expected to be RED for the right reasons: every `/api/series` request 404s
// (Hono's `app.notFound`, no route registered) until Tasks 5-7 land, and the
// direct-insert CHECK-constraint proof in the AC-14 block fails to throw
// until Tasks 1-2 land (`recurrence_series.priority` is still a bare
// `integer` column with no enum CHECK). No other RED reason is expected.
//
// Mirrors test/tasks.test.ts's and test/reminders.test.ts's shape:
// `exports.default.fetch`, the bearer token from `env.API_BEARER_TOKEN`, and
// the shared drain-barrier `beforeEach` cleanup from test/isolation.ts, with
// `reminders` additionally wiped the same way test/reminders.test.ts does
// (the barrier itself only knows about `tasks`/`recurrenceSeries`).

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect } from "vitest";
import type { SeriesDto, TaskDto } from "../src/shared/api";
import { offsetToInstant, PRAESTO_TIMEZONE } from "../src/shared/dates";
import { createDb } from "../src/worker/db/client";
import { recurrenceSeries, reminders, tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/series";
const TASKS_BASE = "https://example.com/api/tasks";

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

async function get(path: string): Promise<Response> {
  return exports.default.fetch(path, auth());
}

async function patch(path: string, body: unknown): Promise<Response> {
  return exports.default.fetch(path, auth({ method: "PATCH", body: JSON.stringify(body) }));
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

// Reuses the shared drain barrier (see test/isolation.ts) so an abandoned
// test body from THIS file cannot leak a row into the test after it, then
// additionally wipes `reminders` — the barrier itself only knows about
// `tasks`/`recurrenceSeries` (same pattern as test/reminders.test.ts).
beforeEach(async () => {
  await resetTaskTables();
  await createDb(env).delete(reminders);
}, DRAIN_BUDGET_MS);

const VALID_SERIES_BODY = {
  title: "Pagar aluguel",
  freq: "monthly",
  byMonthday: 5,
  dtstart: "2026-10-05",
  dateMode: "deadline",
  reminderOffsets: [1440],
};

describe("AC-11 / AC-A1 Create materializes the first occurrence (deadline)", () => {
  it("creates a series and materializes a deadline-carrying open occurrence with its armed reminder", async () => {
    const created = await post(BASE, VALID_SERIES_BODY);
    expect(created.status).toBe(201);
    const body = (await created.json()) as { series: SeriesDto; occurrence: TaskDto };

    expect(body.occurrence.seriesId).toBe(body.series.id);
    expect(body.occurrence.occurrenceDate).toBe("2026-10-05");
    expect(body.occurrence.deadline).toBe("2026-10-05");
    expect(body.occurrence.scheduledDate).toBeNull();
    expect(body.occurrence.status).toBe("open");

    const reminderRows = await createDb(env)
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, body.occurrence.id));
    expect(reminderRows).toHaveLength(1);
    expect(reminderRows[0]?.originOffsetMinutes).toBe(1440);
    expect(reminderRows[0]?.sentAt).toBeNull();
    const expectedFireAt = offsetToInstant("2026-10-05", 1440, PRAESTO_TIMEZONE);
    expect(Math.floor((reminderRows[0]?.fireAt.getTime() ?? 0) / 1000)).toBe(expectedFireAt);
  });
});

describe("AC-12 / AC-A2 Reminder offsets follow the occurrence's own date field (D9)", () => {
  it("creates a scheduled occurrence with no deadline, its reminder computed against the scheduled date", async () => {
    const created = await post(BASE, { ...VALID_SERIES_BODY, dateMode: "scheduled" });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { series: SeriesDto; occurrence: TaskDto };

    expect(body.occurrence.scheduledDate).toBe("2026-10-05");
    expect(body.occurrence.deadline).toBeNull();

    const reminderRows = await createDb(env)
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, body.occurrence.id));
    expect(reminderRows).toHaveLength(1);
    const expectedFireAt = offsetToInstant("2026-10-05", 1440, PRAESTO_TIMEZONE);
    expect(Math.floor((reminderRows[0]?.fireAt.getTime() ?? 0) / 1000)).toBe(expectedFireAt);
  });
});

describe("AC-13 / AC-A3 create validation writes nothing", () => {
  const cases: { name: string; overrides: Record<string, unknown>; expectField: string[] }[] = [
    { name: "empty title", overrides: { title: "" }, expectField: ["title"] },
    { name: "unknown freq", overrides: { freq: "hourly" }, expectField: ["freq"] },
    { name: "interval 0", overrides: { interval: 0 }, expectField: ["interval"] },
    { name: "byMonthday 32", overrides: { byMonthday: 32 }, expectField: ["bymonthday"] },
    { name: "byWeekday outside 1..7", overrides: { byWeekday: [8] }, expectField: ["byweekday"] },
    {
      name: "endKind until without untilDate",
      overrides: { endKind: "until" },
      expectField: ["untildate", "endkind"],
    },
    {
      name: "both untilDate and maxCount",
      overrides: { endKind: "until", untilDate: "2026-12-05", maxCount: 5 },
      expectField: ["untildate", "maxcount", "endkind"],
    },
    { name: "invalid date string", overrides: { dtstart: "2026-02-31" }, expectField: ["dtstart"] },
    { name: "priority outside enum", overrides: { priority: "urgent" }, expectField: ["priority"] },
  ];

  it.each(cases)(
    "rejects $name with 400 naming the field, writing no row to recurrence_series, tasks or reminders",
    async ({ overrides, expectField }) => {
      const before = await countAllRows();
      const res = await post(BASE, { ...VALID_SERIES_BODY, ...overrides });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      const message = body.error.toLowerCase();
      expect(expectField.some((field) => message.includes(field))).toBe(true);

      expect(await countAllRows()).toEqual(before);
    },
  );

  // ADR-0009 regression guard, added 2026-09-25 after a local QA run found every
  // validation message here in English while the same route's 404/409 and unit 7's
  // equivalent messages (`src/worker/routes/reminders.ts`) were pt-BR. The AC-13
  // cases above deliberately match on the FIELD NAME and never on the copy, so they
  // stayed green through the whole regression — which is exactly why this exists.
  it("answers validation errors in pt-BR, while still naming the field (ADR-0009)", async () => {
    const res = await post(BASE, { ...VALID_SERIES_BODY, byMonthday: 32 });
    expect(res.status).toBe(400);
    const { error } = (await res.json()) as { error: string };

    // The machine-readable field name survives, so a client can still highlight it.
    expect(error.toLowerCase()).toContain("bymonthday");
    // The prose the owner reads is Portuguese.
    expect(error).toContain("O dia do mês deve ser um inteiro entre 1 e 31");
    expect(error).not.toMatch(/\bmust be\b|\bis required\b|\bUnknown\b/);
  });
});

describe("AC-14 / AC-A4 Priority is an enum twice (migration 0005)", () => {
  it("rejects a direct insert with priority = 'urgent' via the recurrence_series_priority_chk CHECK", async () => {
    const badRow = {
      id: crypto.randomUUID(),
      kind: "task",
      freq: "daily",
      dtstart: "2026-08-05",
      title: "Beber água",
      priority: "urgent",
    } as unknown as typeof recurrenceSeries.$inferInsert;

    await expect(createDb(env).insert(recurrenceSeries).values(badRow)).rejects.toThrow();
  });

  it("creates a series whose priority round-trips as the text enum", async () => {
    const created = await post(BASE, { ...VALID_SERIES_BODY, priority: "high" });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { series: SeriesDto };
    expect(body.series.priority).toBe("high");
  });
});

describe("AC-15 / AC-A5 Token gate", () => {
  it("GET / with no token returns 401", async () => {
    const res = await exports.default.fetch(BASE);
    expect(res.status).toBe(401);
  });

  it("POST / with no token returns 401 and writes nothing", async () => {
    const before = await countAllRows();
    const res = await exports.default.fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_SERIES_BODY),
    });
    expect(res.status).toBe(401);
    expect(await countAllRows()).toEqual(before);
  });

  it("GET /:id with no token returns 401", async () => {
    const res = await exports.default.fetch(`${BASE}/anything`);
    expect(res.status).toBe(401);
  });

  it("PATCH /:id with no token returns 401 and writes nothing", async () => {
    const before = await countAllRows();
    const res = await exports.default.fetch(`${BASE}/anything`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Novo título" }),
    });
    expect(res.status).toBe(401);
    expect(await countAllRows()).toEqual(before);
  });
});

describe("AC-16 / AC-A6 Read", () => {
  it("reads each series with its open occurrence id, or null once it closes; an unknown id is 404", async () => {
    const first = await post(BASE, VALID_SERIES_BODY);
    const firstBody = (await first.json()) as { series: SeriesDto; occurrence: TaskDto };

    const second = await post(BASE, {
      title: "Lavar o carro",
      freq: "weekly",
      byWeekday: [6],
      dtstart: "2026-10-03",
      dateMode: "scheduled",
    });
    const secondBody = (await second.json()) as { series: SeriesDto; occurrence: TaskDto };

    const list = await get(BASE);
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { series: SeriesDto[] };
    const listedFirst = listBody.series.find((s) => s.id === firstBody.series.id);
    const listedSecond = listBody.series.find((s) => s.id === secondBody.series.id);
    expect(listedFirst?.openOccurrenceId).toBe(firstBody.occurrence.id);
    expect(listedSecond?.openOccurrenceId).toBe(secondBody.occurrence.id);

    const readFirst = await get(`${BASE}/${firstBody.series.id}`);
    expect(readFirst.status).toBe(200);
    const readFirstBody = (await readFirst.json()) as { series: SeriesDto };
    expect(readFirstBody.series.openOccurrenceId).toBe(firstBody.occurrence.id);

    // Once the open occurrence closes, its series spawns the successor in the
    // same atomic write (PRD AC-19, Phase 3, shipped) — completing never
    // leaves an active, unended series without an open occurrence, so GET
    // reports the successor's id, not null.
    const completed = await post(`${TASKS_BASE}/${firstBody.occurrence.id}/complete`);
    expect(completed.status).toBe(200);
    const completedBody = (await completed.json()) as { task: TaskDto; successor?: TaskDto };
    const successorId = completedBody.successor?.id;
    expect(successorId).toBeDefined();
    const afterComplete = await get(`${BASE}/${firstBody.series.id}`);
    const afterCompleteBody = (await afterComplete.json()) as { series: SeriesDto };
    expect(afterCompleteBody.series.openOccurrenceId).toBe(successorId);

    const unknown = await get(`${BASE}/does-not-exist`);
    expect(unknown.status).toBe(404);
  });
});

describe("AC-17 / AC-A7 Template edit propagates only to the open, non-detached occurrence (D7)", () => {
  it("PATCH template edit propagates to the open occurrence, leaves a closed row untouched, and rejects a rule field naming it", async () => {
    const created = await post(BASE, VALID_SERIES_BODY);
    const { series, occurrence } = (await created.json()) as {
      series: SeriesDto;
      occurrence: TaskDto;
    };

    // A closed occurrence from a previous cycle, inserted directly the same
    // way test/tasks.test.ts:115-198 proves recurrence invariants — Phase 3's
    // successor-spawning route does not exist yet, so there is no route path
    // to produce one.
    const closedId = crypto.randomUUID();
    await createDb(env)
      .insert(tasks)
      .values({
        id: closedId,
        title: series.title ?? "Pagar aluguel",
        priority: series.priority,
        status: "done",
        completedAt: new Date(),
        seriesId: series.id,
        occurrenceDate: "2026-09-05",
        deadline: "2026-09-05",
      });

    const patched = await patch(`${BASE}/${series.id}`, {
      title: "Aluguel do apê",
      priority: "high",
    });
    expect(patched.status).toBe(200);

    const occurrenceRows = await createDb(env)
      .select()
      .from(tasks)
      .where(eq(tasks.id, occurrence.id));
    expect(occurrenceRows[0]?.title).toBe("Aluguel do apê");
    expect(occurrenceRows[0]?.priority).toBe("high");

    const closedRows = await createDb(env).select().from(tasks).where(eq(tasks.id, closedId));
    expect(closedRows[0]?.title).toBe("Pagar aluguel");
    expect(closedRows[0]?.priority).toBeNull();

    const ruleEdit = await patch(`${BASE}/${series.id}`, { freq: "weekly" });
    expect(ruleEdit.status).toBe(400);
    const ruleEditBody = (await ruleEdit.json()) as { error: string };
    expect(ruleEditBody.error.toLowerCase()).toContain("freq");
  });

  it("PATCH template edit leaves a detached open occurrence's template untouched", async () => {
    const created = await post(BASE, VALID_SERIES_BODY);
    const { series, occurrence } = (await created.json()) as {
      series: SeriesDto;
      occurrence: TaskDto;
    };

    await createDb(env).update(tasks).set({ detached: true }).where(eq(tasks.id, occurrence.id));

    const patched = await patch(`${BASE}/${series.id}`, { title: "Aluguel do apê" });
    expect(patched.status).toBe(200);

    const occurrenceRows = await createDb(env)
      .select()
      .from(tasks)
      .where(eq(tasks.id, occurrence.id));
    expect(occurrenceRows[0]?.title).toBe("Pagar aluguel");
  });
});

describe("AC-18 / AC-A8 Ending a series", () => {
  it("PATCH status 'ended' ends the series while the open occurrence stays open", async () => {
    const created = await post(BASE, VALID_SERIES_BODY);
    const { series, occurrence } = (await created.json()) as {
      series: SeriesDto;
      occurrence: TaskDto;
    };

    const patched = await patch(`${BASE}/${series.id}`, { status: "ended" });
    expect(patched.status).toBe(200);
    const patchedBody = (await patched.json()) as { series: SeriesDto };
    expect(patchedBody.series.status).toBe("ended");

    const occurrenceRows = await createDb(env)
      .select()
      .from(tasks)
      .where(eq(tasks.id, occurrence.id));
    expect(occurrenceRows[0]?.status).toBe("open");
  });

  it("PATCH rejects a status other than 'ended'", async () => {
    const created = await post(BASE, VALID_SERIES_BODY);
    const { series } = (await created.json()) as { series: SeriesDto };

    const patched = await patch(`${BASE}/${series.id}`, { status: "paused" });
    expect(patched.status).toBe(400);
  });
});
