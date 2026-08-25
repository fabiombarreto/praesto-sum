// PRPs/prds/task-detail-and-dates.prd.md AC-6 urgency-ordering
// PRPs/prds/task-detail-and-dates.prd.md AC-10 limit-is-honoured
//
// Phase 3 freezes the Task READ contract that eleven downstream units inherit:
// a documented order, a documented filter vocabulary, and a `limit` that is
// real rather than merely declared.
//
// Every date in this file is derived from the server's own notion of "today"
// (`todayIn`, the same function the route uses) rather than hardcoded, so the
// suite asserts the overdue/today/future BOUNDARY rather than a calendar the
// test happens to have been written on.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import { MAX_TASK_LIMIT, type TaskDto } from "../src/shared/api";
import { PRAESTO_TIMEZONE, todayIn } from "../src/shared/dates";
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

/** A local calendar day `offset` days from the server's today, as YYYY-MM-DD. */
function dayOffset(offset: number): string {
  const today = todayIn(new Date(), PRAESTO_TIMEZONE);
  const shifted = new Date(`${today}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

async function create(body: unknown): Promise<TaskDto> {
  const res = await exports.default.fetch(
    BASE,
    auth({ method: "POST", body: JSON.stringify(body) }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { task: TaskDto }).task;
}

async function list(query = ""): Promise<TaskDto[]> {
  const res = await exports.default.fetch(`${BASE}${query}`, auth());
  expect(res.status).toBe(200);
  return ((await res.json()) as { tasks: TaskDto[] }).tasks;
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

describe("todayIn is a pure local-calendar-day function", () => {
  it("renders YYYY-MM-DD", () => {
    expect(todayIn(new Date("2026-08-15T12:00:00Z"), "UTC")).toBe("2026-08-15");
  });

  it("resolves the day in the requested zone, not in UTC", () => {
    // 02:30 UTC on the 16th is still the 15th in São Paulo (UTC-3).
    const instant = new Date("2026-08-16T02:30:00Z");
    expect(todayIn(instant, "UTC")).toBe("2026-08-16");
    expect(todayIn(instant, "America/Sao_Paulo")).toBe("2026-08-15");
  });

  it("defaults to the project timezone", () => {
    const instant = new Date("2026-08-16T02:30:00Z");
    expect(todayIn(instant)).toBe(todayIn(instant, PRAESTO_TIMEZONE));
  });

  it("names the same zone the recurrence schema defaults to", () => {
    expect(PRAESTO_TIMEZONE).toBe("America/Sao_Paulo");
  });
});

describe("Task list — urgency ordering (FR-007, PRD AC-6)", () => {
  it("returns overdue, then today, then future ascending, then undated", async () => {
    // Created in a deliberately unhelpful order so a createdAt sort cannot pass.
    const undated = await create({ title: "undated" });
    const future2 = await create({ title: "future2", deadline: dayOffset(9) });
    const today = await create({ title: "today", scheduledDate: dayOffset(0) });
    const overdue = await create({ title: "overdue", deadline: dayOffset(-3) });
    const future1 = await create({ title: "future1", scheduledDate: dayOffset(2) });

    const ids = (await list()).map((t) => t.id);

    expect(ids).toEqual([overdue.id, today.id, future1.id, future2.id, undated.id]);
  });

  it("orders a deadline and a scheduled date by the same key", async () => {
    // The ordering key is whichever of the two dates is set — never one
    // field preferred over the other.
    const scheduledEarly = await create({ title: "scheduled early", scheduledDate: dayOffset(1) });
    const deadlineLate = await create({ title: "deadline late", deadline: dayOffset(4) });
    const deadlineMid = await create({ title: "deadline mid", deadline: dayOffset(2) });

    const ids = (await list()).map((t) => t.id);

    expect(ids).toEqual([scheduledEarly.id, deadlineMid.id, deadlineLate.id]);
  });

  it("sorts several overdue Tasks oldest first", async () => {
    const lessOverdue = await create({ title: "yesterday", deadline: dayOffset(-1) });
    const mostOverdue = await create({ title: "last week", deadline: dayOffset(-7) });

    const ids = (await list()).map((t) => t.id);

    expect(ids).toEqual([mostOverdue.id, lessOverdue.id]);
  });

  it("puts every undated Task after every dated one", async () => {
    await create({ title: "undated a" });
    await create({ title: "undated b" });
    const dated = await create({ title: "dated", deadline: dayOffset(30) });

    const listed = await list();

    expect(listed[0]?.id).toBe(dated.id);
    expect(listed.slice(1).every((t) => t.deadline === null && t.scheduledDate === null)).toBe(
      true,
    );
  });

  it("keeps the ordering under the status filter", async () => {
    const overdue = await create({ title: "overdue", deadline: dayOffset(-2) });
    const future = await create({ title: "future", deadline: dayOffset(2) });
    await create({ title: "undated" });

    const ids = (await list("?status=open")).map((t) => t.id);

    expect(ids.slice(0, 2)).toEqual([overdue.id, future.id]);
  });

  it("still rejects an unknown status", async () => {
    const res = await exports.default.fetch(`${BASE}?status=nope`, auth());
    expect(res.status).toBe(400);
  });
});

describe("Task list — limit is honoured (PRD AC-10)", () => {
  it("returns at most N Tasks, and they are the first N in urgency order", async () => {
    const overdue = await create({ title: "overdue", deadline: dayOffset(-5) });
    const today = await create({ title: "today", deadline: dayOffset(0) });
    await create({ title: "future", deadline: dayOffset(5) });
    await create({ title: "undated" });

    const limited = await list("?limit=2");

    expect(limited).toHaveLength(2);
    expect(limited.map((t) => t.id)).toEqual([overdue.id, today.id]);
  });

  it("takes the first N of the ORDERED set, not of an arbitrary one", async () => {
    // The most urgent Task is created last, so a limit applied before ordering
    // would drop it.
    await create({ title: "undated" });
    await create({ title: "future", deadline: dayOffset(20) });
    const overdue = await create({ title: "overdue", deadline: dayOffset(-9) });

    const limited = await list("?limit=1");

    expect(limited.map((t) => t.id)).toEqual([overdue.id]);
  });

  it("combines with the status filter", async () => {
    const open = await create({ title: "open overdue", deadline: dayOffset(-1) });
    const toClose = await create({ title: "to close", deadline: dayOffset(-2) });
    await exports.default.fetch(`${BASE}/${toClose.id}/complete`, auth({ method: "POST" }));

    const limited = await list("?status=open&limit=1");

    expect(limited.map((t) => t.id)).toEqual([open.id]);
  });

  it("returns everything when no limit is supplied", async () => {
    await create({ title: "a" });
    await create({ title: "b" });
    await create({ title: "c" });

    expect(await list()).toHaveLength(3);
  });

  it("accepts the ceiling itself", async () => {
    await create({ title: "only one" });
    expect(await list(`?limit=${MAX_TASK_LIMIT}`)).toHaveLength(1);
  });

  it.each([
    ["zero", "0"],
    ["a negative", "-1"],
    ["a non-numeric string", "many"],
    ["an empty value", ""],
    ["a decimal", "2.5"],
    ["above the ceiling", String(MAX_TASK_LIMIT + 1)],
  ])("rejects %s with 400 rather than clamping it", async (_label, raw) => {
    await create({ title: "present" });

    const res = await exports.default.fetch(`${BASE}?limit=${raw}`, auth());
    expect(res.status).toBe(400);
  });
});

describe("Task list — detaching does not hide (ADR-0006, PRD AC-6)", () => {
  it("still lists an occurrence the owner has corrected", async () => {
    const db = createDb(env);
    await db.insert(recurrenceSeries).values({
      id: "series-visible",
      kind: "task",
      freq: "daily",
      dtstart: "2026-08-03",
      title: "Drink water",
    });
    const id = crypto.randomUUID();
    await db.insert(tasks).values({
      id,
      title: "Drink water",
      seriesId: "series-visible",
      occurrenceDate: "2026-08-03",
    });

    expect((await list()).map((t) => t.id)).toContain(id);

    // Editing the occurrence detaches it (phase 2). Detaching severs
    // propagation from the series — it must never remove the Task from view.
    const patched = await exports.default.fetch(
      `${BASE}/${id}`,
      auth({ method: "PATCH", body: JSON.stringify({ title: "Drink more water" }) }),
    );
    expect(patched.status).toBe(200);

    const [row] = await db.select().from(tasks);
    expect(row?.detached).toBe(true);
    expect((await list()).map((t) => t.id)).toContain(id);
  });
});
