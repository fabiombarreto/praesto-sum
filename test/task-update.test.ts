// PRPs/prds/task-detail-and-dates.prd.md AC-1 edit-persists
// PRPs/prds/task-detail-and-dates.prd.md AC-2 partial-update-is-explicit
// PRPs/prds/task-detail-and-dates.prd.md AC-3 dates-stay-exclusive
// PRPs/prds/task-detail-and-dates.prd.md AC-5 occurrence-edit-detaches
// PRPs/prds/task-detail-and-dates.prd.md AC-9 unknown-field-is-rejected
//
// Phase 2 adds PATCH /api/tasks/:id. Its whole difficulty is semantic: a
// partial update must distinguish "I did not mention this field" from "I am
// clearing this field", and it owns three rules the client must never own —
// omitted is not null, setting one date clears the other, and editing an
// occurrence detaches it.
//
// `detached` is deliberately absent from the wire contract (PRD Decisions
// Log), so AC-5 is asserted by reading the stored row rather than the DTO.

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

async function create(body: unknown): Promise<TaskDto> {
  const res = await exports.default.fetch(
    BASE,
    auth({ method: "POST", body: JSON.stringify(body) }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { task: TaskDto }).task;
}

async function patch(id: string, body: unknown): Promise<Response> {
  return exports.default.fetch(
    `${BASE}/${id}`,
    auth({ method: "PATCH", body: JSON.stringify(body) }),
  );
}

async function patchOk(id: string, body: unknown): Promise<TaskDto> {
  const res = await patch(id, body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { task: TaskDto }).task;
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

describe("Task update — the edit persists (FR-002, PRD AC-1)", () => {
  it("changes one field and leaves every other field untouched", async () => {
    const before = await create({
      title: "Buy milk",
      description: "semi-skimmed",
      deadline: "2026-09-01",
      priority: "low",
    });

    const after = await patchOk(before.id, { title: "Buy oat milk" });

    expect(after.title).toBe("Buy oat milk");
    expect(after.description).toBe("semi-skimmed");
    expect(after.deadline).toBe("2026-09-01");
    expect(after.scheduledDate).toBeNull();
    expect(after.priority).toBe("low");
    expect(after.status).toBe(before.status);
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it("persists the change rather than only echoing it", async () => {
    const task = await create({ title: "Rough capture" });
    await patchOk(task.id, { title: "Corrected title", priority: "high" });

    const res = await exports.default.fetch(`${BASE}?status=open`, auth());
    const { tasks: listed } = (await res.json()) as { tasks: TaskDto[] };
    const found = listed.find((t) => t.id === task.id);

    expect(found?.title).toBe("Corrected title");
    expect(found?.priority).toBe("high");
  });

  it("changes description, date and priority together", async () => {
    const task = await create({ title: "Multi" });
    const after = await patchOk(task.id, {
      description: "now with detail",
      scheduledDate: "2026-09-10",
      priority: "normal",
    });

    expect(after.description).toBe("now with detail");
    expect(after.scheduledDate).toBe("2026-09-10");
    expect(after.priority).toBe("normal");
  });

  it("answers 404 for a Task that does not exist", async () => {
    expect((await patch("no-such-id", { title: "Ghost" })).status).toBe(404);
  });

  it("requires the token", async () => {
    const task = await create({ title: "Gated" });
    const res = await exports.default.fetch(`${BASE}/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("Task update — omission and clearing are distinguishable (PRD AC-2)", () => {
  it.each([
    ["description", "a description", null],
    ["deadline", "2026-09-01", null],
    ["priority", "high", null],
  ])("leaves %s unchanged when the key is omitted", async (field, value) => {
    const task = await create({ title: "Keeper", [field]: value });

    // A patch that mentions only the title must not disturb `field`.
    const after = await patchOk(task.id, { title: "Keeper renamed" });

    expect(after[field as keyof TaskDto]).toBe(value);
  });

  it.each([
    ["description", "a description"],
    ["deadline", "2026-09-01"],
    ["priority", "high"],
  ])("clears %s when the key is sent as null", async (field, value) => {
    const task = await create({ title: "Clearable", [field]: value });
    expect(task[field as keyof TaskDto]).toBe(value);

    const after = await patchOk(task.id, { [field]: null });

    expect(after[field as keyof TaskDto]).toBeNull();
  });

  it("clears scheduledDate when sent as null", async () => {
    const task = await create({ title: "Scheduled", scheduledDate: "2026-09-02" });
    const after = await patchOk(task.id, { scheduledDate: null });
    expect(after.scheduledDate).toBeNull();
  });

  it("distinguishes the two in a single body: one field cleared, one untouched", async () => {
    const task = await create({
      title: "Both",
      description: "keep me",
      priority: "high",
    });

    const after = await patchOk(task.id, { priority: null });

    expect(after.priority).toBeNull();
    expect(after.description).toBe("keep me");
  });

  it("rejects a body with no editable field at all", async () => {
    const task = await create({ title: "Untouched" });
    expect((await patch(task.id, {})).status).toBe(400);

    const after = await patchOk(task.id, { title: "Untouched" });
    expect(after.title).toBe("Untouched");
  });

  it("rejects a non-object body", async () => {
    const task = await create({ title: "Body check" });
    const res = await exports.default.fetch(
      `${BASE}/${task.id}`,
      auth({ method: "PATCH", body: JSON.stringify(["not", "an", "object"]) }),
    );
    expect(res.status).toBe(400);
  });

  it.each([
    ["a null title", { title: null }],
    ["a whitespace-only title", { title: "   " }],
    ["a non-string title", { title: 42 }],
    ["an impossible deadline", { deadline: "2026-02-31" }],
    ["a malformed scheduledDate", { scheduledDate: "01/09/2026" }],
    ["an out-of-enum priority", { priority: "urgent" }],
  ])("rejects %s with 400 and writes nothing", async (_label, body) => {
    const task = await create({ title: "Original", description: "original" });

    expect((await patch(task.id, body)).status).toBe(400);

    const db = createDb(env);
    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row?.title).toBe("Original");
    expect(row?.description).toBe("original");
  });
});

describe("Task update — the two dates stay exclusive (FR-005, PRD AC-3)", () => {
  it("clears the deadline when a scheduled date is set", async () => {
    const task = await create({ title: "Was a deadline", deadline: "2026-09-01" });

    const after = await patchOk(task.id, { scheduledDate: "2026-09-05" });

    expect(after.scheduledDate).toBe("2026-09-05");
    expect(after.deadline).toBeNull();
  });

  it("clears the scheduled date when a deadline is set", async () => {
    const task = await create({ title: "Was scheduled", scheduledDate: "2026-09-05" });

    const after = await patchOk(task.id, { deadline: "2026-09-01" });

    expect(after.deadline).toBe("2026-09-01");
    expect(after.scheduledDate).toBeNull();
  });

  it("never leaves both dates set in the stored row", async () => {
    const task = await create({ title: "Flip flop", deadline: "2026-09-01" });
    await patchOk(task.id, { scheduledDate: "2026-09-05" });
    await patchOk(task.id, { deadline: "2026-09-09" });

    const db = createDb(env);
    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row?.deadline).toBe("2026-09-09");
    expect(row?.scheduledDate).toBeNull();
  });

  it("rejects a body carrying both dates at once", async () => {
    const task = await create({ title: "Greedy" });

    const res = await patch(task.id, { deadline: "2026-09-01", scheduledDate: "2026-09-05" });
    expect(res.status).toBe(400);

    const after = await patchOk(task.id, { title: "Greedy" });
    expect(after.deadline).toBeNull();
    expect(after.scheduledDate).toBeNull();
  });
});

describe("Task update — editing an occurrence detaches it (ADR-0006, PRD AC-5)", () => {
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

  async function insertOccurrence(seriesId: string): Promise<string> {
    const db = createDb(env);
    const id = crypto.randomUUID();
    await db.insert(tasks).values({
      id,
      title: "Drink water",
      seriesId,
      occurrenceDate: "2026-08-03",
    });
    return id;
  }

  it("sets detached when any attribute of an occurrence is edited", async () => {
    await insertSeries("series-detach");
    const id = await insertOccurrence("series-detach");

    const db = createDb(env);
    const [before] = await db.select().from(tasks).where(eq(tasks.id, id));
    expect(before?.detached).toBe(false);

    await patchOk(id, { title: "Drink more water" });

    const [after] = await db.select().from(tasks).where(eq(tasks.id, id));
    expect(after?.detached).toBe(true);
    expect(after?.title).toBe("Drink more water");
    // The occurrence stays bound to its series — detaching is not unlinking.
    expect(after?.seriesId).toBe("series-detach");
    expect(after?.occurrenceDate).toBe("2026-08-03");
  });

  it("detaches on a non-title edit too", async () => {
    await insertSeries("series-priority");
    const id = await insertOccurrence("series-priority");

    await patchOk(id, { priority: "high" });

    const db = createDb(env);
    const [after] = await db.select().from(tasks).where(eq(tasks.id, id));
    expect(after?.detached).toBe(true);
  });

  it("leaves a one-off Task undetached", async () => {
    const task = await create({ title: "One-off" });
    await patchOk(task.id, { title: "One-off, corrected" });

    const db = createDb(env);
    const [after] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(after?.detached).toBe(false);
    expect(after?.seriesId).toBeNull();
  });
});

describe("Task update — non-editable fields are rejected, not ignored (PRD AC-9)", () => {
  it.each([
    ["id", { id: "hijacked" }],
    ["status", { status: "done" }],
    ["createdAt", { createdAt: 0 }],
    ["completedAt", { completedAt: 1 }],
    ["seriesId", { seriesId: "series-x" }],
    ["occurrenceDate", { occurrenceDate: "2026-08-03" }],
    ["detached", { detached: true }],
    ["lifeAreaId", { lifeAreaId: "area-x" }],
    ["an unknown key", { nonsense: "value" }],
  ])("rejects %s with 400 and writes nothing", async (_label, body) => {
    const task = await create({ title: "Protected" });

    expect((await patch(task.id, body)).status).toBe(400);

    const db = createDb(env);
    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row?.id).toBe(task.id);
    expect(row?.status).toBe("open");
    expect(row?.completedAt).toBeNull();
    expect(row?.seriesId).toBeNull();
    expect(row?.occurrenceDate).toBeNull();
    expect(row?.detached).toBe(false);
    expect(row?.lifeAreaId).toBeNull();
  });

  it("rejects the whole body when one key is non-editable, even alongside a valid key", async () => {
    const task = await create({ title: "Mixed" });

    expect((await patch(task.id, { title: "Changed", status: "done" })).status).toBe(400);

    const db = createDb(env);
    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row?.title).toBe("Mixed");
    expect(row?.status).toBe("open");
  });

  it("leaves a done Task done when it is edited (PRD Open Question 2)", async () => {
    const task = await create({ title: "Finished" });
    await exports.default.fetch(`${BASE}/${task.id}/complete`, auth({ method: "POST" }));

    const after = await patchOk(task.id, { description: "a late note" });

    expect(after.status).toBe("done");
    expect(after.completedAt).not.toBeNull();
    expect(after.description).toBe("a late note");
  });
});
