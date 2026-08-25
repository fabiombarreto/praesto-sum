import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect } from "vitest";
import type { TaskDto } from "../src/shared/api";
import { createDb } from "../src/worker/db/client";
import { recurrenceSeries, tasks } from "../src/worker/db/schema";
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
