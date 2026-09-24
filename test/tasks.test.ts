import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect } from "vitest";
import type { SeriesDto, TaskDto } from "../src/shared/api";
import { offsetToInstant, PRAESTO_TIMEZONE } from "../src/shared/dates";
import { createDb } from "../src/worker/db/client";
import { recurrenceSeries, reminders, tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/tasks";

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

async function listOpen(): Promise<TaskDto[]> {
  const res = await exports.default.fetch(`${BASE}?status=open`, auth());
  expect(res.status).toBe(200);
  const body = (await res.json()) as { tasks: TaskDto[] };
  return body.tasks;
}

// Storage isolation is per test FILE, so wipe the tables between tests instead
// of reset() (which would also drop the schema). The wipe first waits for work
// an abandoned — timed-out — test left in flight, so a row it is still writing
// cannot land after the cleanup and be read by the test after it. Why that
// barrier and not a bigger timeout: test/isolation.ts.
//
// The explicit hook budget is the barrier's, not the wipe's: draining means
// waiting out the REST of an abandoned body — every request it had still to
// make — so on a machine already slow enough to blow a 5 s test budget the
// default 10 s hook budget is too tight. Blowing this one means the machine
// gave up, never that the contract moved.
beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

describe("Task lifecycle (FR-001..FR-004, FR-007)", () => {
  it("creates a Task and lists it", async () => {
    const created = await post(BASE, { title: "Buy milk" });
    expect(created.status).toBe(201);
    const { task } = (await created.json()) as { task: TaskDto };
    expect(task.title).toBe("Buy milk");
    expect(task.status).toBe("open");
    expect(task.completedAt).toBeNull();

    const open = await listOpen();
    expect(open.map((t) => t.id)).toContain(task.id);
  });

  it("completes a Task and reopens it", async () => {
    const created = await post(BASE, { title: "Pay rent" });
    const { task } = (await created.json()) as { task: TaskDto };

    const done = await post(`${BASE}/${task.id}/complete`);
    expect(done.status).toBe(200);
    const completed = ((await done.json()) as { task: TaskDto }).task;
    expect(completed.status).toBe("done");
    expect(completed.completedAt).not.toBeNull();

    // Completing twice is not possible — the row is no longer open.
    expect((await post(`${BASE}/${task.id}/complete`)).status).toBe(404);

    const reopened = await post(`${BASE}/${task.id}/reopen`);
    expect(reopened.status).toBe(200);
    const back = ((await reopened.json()) as { task: TaskDto }).task;
    expect(back.status).toBe("open");
    expect(back.completedAt).toBeNull();
  });

  it("deletes a Task", async () => {
    const created = await post(BASE, { title: "Temporary" });
    const { task } = (await created.json()) as { task: TaskDto };

    const deleted = await exports.default.fetch(`${BASE}/${task.id}`, auth({ method: "DELETE" }));
    expect(deleted.status).toBe(204);
    expect((await listOpen()).map((t) => t.id)).not.toContain(task.id);
  });

  it("accepts a deadline or a scheduled date, never both", async () => {
    expect((await post(BASE, { title: "With deadline", deadline: "2026-08-10" })).status).toBe(201);
    expect((await post(BASE, { title: "With schedule", scheduledDate: "2026-08-11" })).status).toBe(
      201,
    );

    const both = await post(BASE, {
      title: "Both dates",
      deadline: "2026-08-10",
      scheduledDate: "2026-08-11",
    });
    expect(both.status).toBe(400);
  });

  it("rejects invalid input", async () => {
    expect((await post(BASE, { title: "   " })).status).toBe(400);
    expect((await post(BASE, {})).status).toBe(400);
    expect((await post(BASE, { title: "Bad date", deadline: "2026-02-31" })).status).toBe(400);
    const badFilter = await exports.default.fetch(`${BASE}?status=nope`, auth());
    expect(badFilter.status).toBe(400);
  });

  it("requires the token", async () => {
    const res = await exports.default.fetch(BASE);
    expect(res.status).toBe(401);
  });
});

describe("Recurrence invariants (ADR-0006)", () => {
  async function insertSeries(id: string): Promise<void> {
    const db = createDb(env);
    await db.insert(recurrenceSeries).values({
      id,
      kind: "task",
      freq: "daily",
      dtstart: "2026-08-03",
      title: "Drink water",
    });
  }

  it("allows at most one OPEN occurrence per active series", async () => {
    await insertSeries("series-1");
    const db = createDb(env);

    await db.insert(tasks).values({
      id: crypto.randomUUID(),
      title: "Drink water",
      seriesId: "series-1",
      occurrenceDate: "2026-08-03",
    });

    // A second OPEN occurrence of the same series must be impossible — this is
    // the structural guard against a double-spawning sweep.
    await expect(
      db.insert(tasks).values({
        id: crypto.randomUUID(),
        title: "Drink water",
        seriesId: "series-1",
        occurrenceDate: "2026-08-04",
      }),
    ).rejects.toThrow();
  });

  it("allows a new open occurrence once the previous one is closed", async () => {
    await insertSeries("series-2");
    const db = createDb(env);
    const first = crypto.randomUUID();

    await db.insert(tasks).values({
      id: first,
      title: "Drink water",
      seriesId: "series-2",
      occurrenceDate: "2026-08-03",
    });
    // A superseded occurrence becomes `missed` (ADR-0006), which frees the slot.
    await db.update(tasks).set({ status: "missed" }).where(eq(tasks.id, first));

    await db.insert(tasks).values({
      id: crypto.randomUUID(),
      title: "Drink water",
      seriesId: "series-2",
      occurrenceDate: "2026-08-04",
    });

    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === "open")).toHaveLength(1);
  });

  it("refuses two rows for the same occurrence date", async () => {
    await insertSeries("series-3");
    const db = createDb(env);
    const id = crypto.randomUUID();

    await db.insert(tasks).values({
      id,
      title: "Drink water",
      seriesId: "series-3",
      occurrenceDate: "2026-08-03",
    });
    await db.update(tasks).set({ status: "missed" }).where(eq(tasks.id, id));

    await expect(
      db.insert(tasks).values({
        id: crypto.randomUUID(),
        title: "Drink water",
        seriesId: "series-3",
        occurrenceDate: "2026-08-03",
      }),
    ).rejects.toThrow();
  });
});

// -----------------------------------------------------------------------------
// PRPs/prds/recurring-tasks.prd.md AC-19 Completing spawns the successor in the same write
// PRPs/prds/recurring-tasks.prd.md AC-20 No duplicate successor
// PRPs/prds/recurring-tasks.prd.md AC-21 End conditions stop the series
// PRPs/prds/recurring-tasks.prd.md AC-22 An edited occurrence does not leak into the successor (D2)
// PRPs/prds/recurring-tasks.prd.md AC-23 Deleting the open occurrence skips the cycle (D3)
// PRPs/prds/recurring-tasks.prd.md AC-24 Reopen undoes the spawn, or refuses honestly (D10)
// PRPs/prds/recurring-tasks.prd.md AC-25 One-off Tasks are unaffected
//
// Source plan: PRPs/plans/recurring-tasks-phase-3-materialization-on-close.plan.md
// (Task 1 — the additive `successor` wire field; Task 2 — the private
// `buildRecurrenceRule`/`buildSuccessorStatements` helpers; Tasks 3-5 — the
// series-aware `complete`/`delete`/`reopen` branches.)
//
// Scope: PRD AC-19..AC-25 (plan AC-A1..AC-A7) ONLY. AC-1..AC-10 (Phase 1) are
// covered by test/recurrence.test.ts; AC-11..AC-18 (Phase 2) by
// test/series.test.ts — both APPROVED and untouched here. AC-26..AC-28
// (Phase 4) are manual/device criteria and produce no test file.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `complete`,
// `delete` and `reopen` in src/worker/routes/tasks.ts carry ZERO series
// awareness as of this write (see the plan's Problem Statement — the current
// handlers are `:313-349` verbatim). Every test below that needs a spawned
// successor goes through `completeAndGetSuccessor`, whose own
// `expect(body.successor).toBeDefined()` is the single expected RED point
// today: the current `complete` handler's response is always exactly
// `{ task }`, so that one assertion fails first, before any test reaches code
// that would otherwise dereference an absent field. Tests that do not route
// through a spawned successor (AC-20's double-complete row count, AC-21's
// end-condition/`doneCount`/`status` checks, AC-23's `doneCount`/`missedCount`
// and successor-row checks, both AC-24 branches) are expected RED for the
// identical underlying reason — the series row is never read or written by
// any of the three handlers yet — surfacing through their own direct
// assertions instead (a series `status` that never becomes `"ended"`, a
// `tasks` row count that never grows past one, a `reopen` that always
// succeeds because it never learns to refuse). No other RED reason is
// expected; a failure anywhere else in this block (a `500`, or an error
// thrown by route code rather than by a missing feature) would be a genuine
// defect, not this suite's design.
//
// Mirrors this file's own `auth()`/`post()` helpers and test/series.test.ts's
// `patch()`/`get()` shape; adds `del()` and `getSeries()` the same way. The
// existing `beforeEach(resetTaskTables, ...)` above is untouched — a second,
// purely additive `beforeEach` below wipes `reminders` the same way
// test/series.test.ts already does, since the shared barrier itself
// (test/isolation.ts) only knows about `tasks`/`recurrenceSeries`.
// -----------------------------------------------------------------------------

const SERIES_BASE = "https://example.com/api/series";

beforeEach(async () => {
  await createDb(env).delete(reminders);
}, DRAIN_BUDGET_MS);

async function patch(path: string, body: unknown): Promise<Response> {
  return exports.default.fetch(path, auth({ method: "PATCH", body: JSON.stringify(body) }));
}

async function del(path: string): Promise<Response> {
  return exports.default.fetch(path, auth({ method: "DELETE" }));
}

async function getSeries(id: string): Promise<SeriesDto> {
  const res = await exports.default.fetch(`${SERIES_BASE}/${id}`, auth());
  expect(res.status).toBe(200);
  const body = (await res.json()) as { series: SeriesDto };
  return body.series;
}

async function createSeries(
  body: Record<string, unknown>,
): Promise<{ series: SeriesDto; occurrence: TaskDto }> {
  const created = await post(SERIES_BASE, body);
  expect(created.status).toBe(201);
  return (await created.json()) as { series: SeriesDto; occurrence: TaskDto };
}

/**
 * Completes `occurrenceId` and asserts the response's `successor` key is
 * present, returning both so a test can go on to inspect the spawned row.
 * Every test below that needs a successor goes through this single choke
 * point so their pre-implementation RED is one clean, readable assertion —
 * see the block header above.
 */
async function completeAndGetSuccessor(
  occurrenceId: string,
): Promise<{ task: TaskDto; successor: TaskDto }> {
  const done = await post(`${BASE}/${occurrenceId}/complete`);
  expect(done.status).toBe(200);
  const body = (await done.json()) as { task: TaskDto; successor?: TaskDto };
  expect(body.successor).toBeDefined();
  return { task: body.task, successor: body.successor as TaskDto };
}

const SERIES_TEMPLATE = {
  title: "Pagar aluguel",
  description: "Aluguel mensal do apê",
  freq: "monthly",
  byMonthday: 5,
  dtstart: "2026-10-05",
  dateMode: "deadline",
  priority: "high",
  reminderOffsets: [1440],
};

describe("AC-19 / AC-A1 Completing spawns the successor in the same write", () => {
  it("closes the occurrence, increments doneCount, and spawns the template-shaped successor with its armed reminder", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);

    const done = await post(`${BASE}/${occurrence.id}/complete`);
    expect(done.status).toBe(200);
    const body = (await done.json()) as { task: TaskDto; successor?: TaskDto };

    expect(body.task.status).toBe("done");
    expect(body.task.completedAt).not.toBeNull();
    expect(body.successor).toBeDefined();

    const successor = body.successor as TaskDto;
    expect(successor.seriesId).toBe(series.id);
    expect(successor.occurrenceDate).toBe("2026-11-05");
    expect(successor.title).toBe(SERIES_TEMPLATE.title);
    expect(successor.description).toBe(SERIES_TEMPLATE.description);
    expect(successor.priority).toBe(SERIES_TEMPLATE.priority);
    expect(successor.deadline).toBe("2026-11-05");
    expect(successor.scheduledDate).toBeNull();
    expect(successor.status).toBe("open");

    const seriesAfter = await getSeries(series.id);
    expect(seriesAfter.doneCount).toBe(1);

    const reminderRows = await createDb(env)
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, successor.id));
    expect(reminderRows).toHaveLength(1);
    expect(reminderRows[0]?.sentAt).toBeNull();
    expect(reminderRows[0]?.originOffsetMinutes).toBe(1440);
    const expectedFireAt = offsetToInstant("2026-11-05", 1440, PRAESTO_TIMEZONE);
    expect(Math.floor((reminderRows[0]?.fireAt.getTime() ?? 0) / 1000)).toBe(expectedFireAt);
  });
});

describe("AC-20 / AC-A2 No duplicate successor", () => {
  it("completing an already-completed occurrence a second time creates no second successor", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);

    const first = await post(`${BASE}/${occurrence.id}/complete`);
    expect(first.status).toBe(200);

    const second = await post(`${BASE}/${occurrence.id}/complete`);
    expect(second.status).toBe(404);

    const seriesRows = await createDb(env)
      .select()
      .from(tasks)
      .where(eq(tasks.seriesId, series.id));
    // The closed occurrence plus exactly one successor — never two.
    expect(seriesRows).toHaveLength(2);
  });

  it("two concurrent completes on the same open occurrence leave exactly one successor, with no request surfacing a 500", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);

    const [r1, r2] = await Promise.all([
      post(`${BASE}/${occurrence.id}/complete`),
      post(`${BASE}/${occurrence.id}/complete`),
    ]);

    expect([r1.status, r2.status]).not.toContain(500);
    expect([r1.status, r2.status].includes(200)).toBe(true);

    const seriesRows = await createDb(env)
      .select()
      .from(tasks)
      .where(eq(tasks.seriesId, series.id));
    expect(seriesRows).toHaveLength(2);
    expect(seriesRows.filter((row) => row.status === "open")).toHaveLength(1);
  });
});

describe("AC-21 / AC-A3 End conditions stop the series", () => {
  it("count end condition: completing the last allowed occurrence spawns no successor and ends the series", async () => {
    const { series, occurrence } = await createSeries({
      ...SERIES_TEMPLATE,
      endKind: "count",
      maxCount: 1,
    });

    const done = await post(`${BASE}/${occurrence.id}/complete`);
    expect(done.status).toBe(200);
    const body = (await done.json()) as { task: TaskDto; successor?: TaskDto };
    expect(body.successor).toBeUndefined();

    const seriesAfter = await getSeries(series.id);
    expect(seriesAfter.status).toBe("ended");
    expect(seriesAfter.doneCount).toBe(1);

    const rows = await createDb(env).select().from(tasks).where(eq(tasks.seriesId, series.id));
    expect(rows).toHaveLength(1);
  });

  it("until end condition: completing past untilDate spawns no successor and ends the series", async () => {
    const { series, occurrence } = await createSeries({
      ...SERIES_TEMPLATE,
      endKind: "until",
      untilDate: "2026-10-06",
    });

    const done = await post(`${BASE}/${occurrence.id}/complete`);
    expect(done.status).toBe(200);
    const body = (await done.json()) as { task: TaskDto; successor?: TaskDto };
    expect(body.successor).toBeUndefined();

    const seriesAfter = await getSeries(series.id);
    expect(seriesAfter.status).toBe("ended");
  });
});

describe("AC-22 / AC-A4 An edited occurrence does not leak into the successor (D2)", () => {
  it("completing a detached occurrence spawns a successor carrying the series template's title, not the edited one", async () => {
    const { occurrence } = await createSeries(SERIES_TEMPLATE);

    const edited = await patch(`${BASE}/${occurrence.id}`, {
      title: "Aluguel — negociar desconto",
    });
    expect(edited.status).toBe(200);

    const done = await post(`${BASE}/${occurrence.id}/complete`);
    expect(done.status).toBe(200);
    const body = (await done.json()) as { task: TaskDto; successor?: TaskDto };

    expect(body.task.title).toBe("Aluguel — negociar desconto");
    expect(body.successor).toBeDefined();
    expect(body.successor?.title).toBe(SERIES_TEMPLATE.title);
  });
});

describe("AC-23 / AC-A5 Deleting the open occurrence skips the cycle (D3)", () => {
  it("deletes the row and its reminders, spawns the successor with reminders armed, and leaves doneCount/missedCount unchanged", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);

    const deleted = await del(`${BASE}/${occurrence.id}`);
    expect(deleted.status).toBe(204);

    const db = createDb(env);
    const occurrenceRows = await db.select().from(tasks).where(eq(tasks.id, occurrence.id));
    expect(occurrenceRows).toHaveLength(0);

    const occurrenceReminders = await db
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, occurrence.id));
    expect(occurrenceReminders).toHaveLength(0);

    const remainingRows = await db.select().from(tasks).where(eq(tasks.seriesId, series.id));
    expect(remainingRows).toHaveLength(1);
    expect(remainingRows[0]?.occurrenceDate).toBe("2026-11-05");
    expect(remainingRows[0]?.status).toBe("open");

    const successorId = remainingRows[0]?.id ?? "";
    const successorReminders = await db
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, successorId));
    expect(successorReminders).toHaveLength(1);
    expect(successorReminders[0]?.sentAt).toBeNull();

    const seriesAfter = await getSeries(series.id);
    expect(seriesAfter.doneCount).toBe(0);
    expect(seriesAfter.missedCount).toBe(0);
  });

  it("deleting an already-closed series row is a plain delete with no successor spawn", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);
    const { successor } = await completeAndGetSuccessor(occurrence.id);

    const db = createDb(env);
    const beforeDelete = await db.select().from(tasks).where(eq(tasks.seriesId, series.id));
    expect(beforeDelete).toHaveLength(2);

    const deleted = await del(`${BASE}/${occurrence.id}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await db.select().from(tasks).where(eq(tasks.seriesId, series.id));
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]?.id).toBe(successor.id);

    const seriesAfter = await getSeries(series.id);
    expect(seriesAfter.doneCount).toBe(1);
    expect(seriesAfter.missedCount).toBe(0);
  });
});

describe("AC-24 / AC-A6 Reopen undoes the spawn, or refuses honestly (D10)", () => {
  it("reopening the most recently completed occurrence with an untouched successor deletes the successor and its reminders, reopens the occurrence and decrements doneCount", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);
    const { successor } = await completeAndGetSuccessor(occurrence.id);

    const reopened = await post(`${BASE}/${occurrence.id}/reopen`);
    expect(reopened.status).toBe(200);
    const body = (await reopened.json()) as { task: TaskDto };
    expect(body.task.status).toBe("open");
    expect(body.task.completedAt).toBeNull();

    const db = createDb(env);
    const successorRows = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    expect(successorRows).toHaveLength(0);

    const successorReminders = await db
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, successor.id));
    expect(successorReminders).toHaveLength(0);

    const seriesAfter = await getSeries(series.id);
    expect(seriesAfter.doneCount).toBe(0);
  });

  it("refuses with 409 pt-BR and changes nothing when the successor has been detached", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);
    const { successor } = await completeAndGetSuccessor(occurrence.id);

    const detach = await patch(`${BASE}/${successor.id}`, { title: "Editado" });
    expect(detach.status).toBe(200);

    const db = createDb(env);
    const beforeOccurrence = await db.select().from(tasks).where(eq(tasks.id, occurrence.id));
    const beforeSuccessor = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    const seriesBefore = await getSeries(series.id);

    const reopened = await post(`${BASE}/${occurrence.id}/reopen`);
    expect(reopened.status).toBe(409);
    const errorBody = (await reopened.json()) as { error: string };
    expect(errorBody.error).toContain("já existe");

    const afterOccurrence = await db.select().from(tasks).where(eq(tasks.id, occurrence.id));
    const afterSuccessor = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    const seriesAfter = await getSeries(series.id);

    expect(afterOccurrence).toEqual(beforeOccurrence);
    expect(afterSuccessor).toEqual(beforeSuccessor);
    expect(seriesAfter.doneCount).toBe(seriesBefore.doneCount);
    expect(seriesAfter.missedCount).toBe(seriesBefore.missedCount);
  });

  it("refuses with 409 and changes nothing when the successor has already been closed", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);
    const { successor } = await completeAndGetSuccessor(occurrence.id);

    const closeSuccessor = await post(`${BASE}/${successor.id}/complete`);
    expect(closeSuccessor.status).toBe(200);

    const db = createDb(env);
    const beforeOccurrence = await db.select().from(tasks).where(eq(tasks.id, occurrence.id));
    const beforeSuccessor = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    const seriesBefore = await getSeries(series.id);

    const reopened = await post(`${BASE}/${occurrence.id}/reopen`);
    expect(reopened.status).toBe(409);

    const afterOccurrence = await db.select().from(tasks).where(eq(tasks.id, occurrence.id));
    const afterSuccessor = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    const seriesAfter = await getSeries(series.id);

    expect(afterOccurrence).toEqual(beforeOccurrence);
    expect(afterSuccessor).toEqual(beforeSuccessor);
    expect(seriesAfter.doneCount).toBe(seriesBefore.doneCount);
    expect(seriesAfter.missedCount).toBe(seriesBefore.missedCount);
  });

  it("refuses with 409 and changes nothing when the successor already had a reminder sent", async () => {
    const { series, occurrence } = await createSeries(SERIES_TEMPLATE);
    const { successor } = await completeAndGetSuccessor(occurrence.id);

    const db = createDb(env);
    const [reminderRow] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.taskId, successor.id));
    expect(reminderRow).toBeDefined();
    await db
      .update(reminders)
      .set({ sentAt: new Date() })
      .where(eq(reminders.id, reminderRow?.id ?? ""));

    const beforeOccurrence = await db.select().from(tasks).where(eq(tasks.id, occurrence.id));
    const beforeSuccessor = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    const seriesBefore = await getSeries(series.id);

    const reopened = await post(`${BASE}/${occurrence.id}/reopen`);
    expect(reopened.status).toBe(409);

    const afterOccurrence = await db.select().from(tasks).where(eq(tasks.id, occurrence.id));
    const afterSuccessor = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    const seriesAfter = await getSeries(series.id);

    expect(afterOccurrence).toEqual(beforeOccurrence);
    expect(afterSuccessor).toEqual(beforeSuccessor);
    expect(seriesAfter.doneCount).toBe(seriesBefore.doneCount);
    expect(seriesAfter.missedCount).toBe(seriesBefore.missedCount);
  });
});

describe("AC-25 / AC-A7 One-off Tasks are unaffected — response shape stays byte-identical", () => {
  it("a one-off Task's complete response has no successor key (delta over test/tasks.test.ts:58-76)", async () => {
    const created = await post(BASE, { title: "Standalone" });
    const { task } = (await created.json()) as { task: TaskDto };

    const done = await post(`${BASE}/${task.id}/complete`);
    expect(done.status).toBe(200);
    const body = (await done.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["task"]);
    expect(Object.hasOwn(body, "successor")).toBe(false);
  });

  it("a one-off Task's reopen response carries only task (delta over test/tasks.test.ts:58-76)", async () => {
    const created = await post(BASE, { title: "Standalone" });
    const { task } = (await created.json()) as { task: TaskDto };
    await post(`${BASE}/${task.id}/complete`);

    const reopened = await post(`${BASE}/${task.id}/reopen`);
    expect(reopened.status).toBe(200);
    const body = (await reopened.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["task"]);
  });

  it("a one-off Task's delete response is still 204 with an empty body (delta over test/tasks.test.ts:78-85)", async () => {
    const created = await post(BASE, { title: "Standalone" });
    const { task } = (await created.json()) as { task: TaskDto };

    const deleted = await del(`${BASE}/${task.id}`);
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
  });
});
