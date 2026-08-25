// PRPs/prds/task-detail-and-dates.prd.md AC-4 priority-is-an-enum
//
// Phase 1 of task-detail-and-dates turns `priority` from a meaningless integer
// into a real domain enum — `high | normal | low` — enforced twice, the way
// every other domain enum in this schema already is: a TypeScript union the
// route validates against, AND a SQL CHECK the database refuses to violate.
//
// Both halves are asserted here on purpose. A TypeScript-only union would let
// any direct writer (the recurrence sweep, a migration, a future route) put
// `'urgent'` in the column, which is exactly the drift the "enforced twice"
// rule in src/worker/db/schema.ts:17-18 exists to prevent.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import type { TaskDto } from "../src/shared/api";
import { createDb } from "../src/worker/db/client";
import { tasks } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/tasks";

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

async function create(body: unknown): Promise<Response> {
  return exports.default.fetch(BASE, auth({ method: "POST", body: JSON.stringify(body) }));
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

describe("Task priority is a domain enum (FR-006, PRD AC-4)", () => {
  it.each(["high", "normal", "low"] as const)("stores and returns priority %s", async (value) => {
    const res = await create({ title: `Priority ${value}`, priority: value });
    expect(res.status).toBe(201);

    const { task } = (await res.json()) as { task: TaskDto };
    expect(task.priority).toBe(value);

    // The stored row, not just the response echo, carries the value.
    const db = createDb(env);
    const [row] = await db.select().from(tasks);
    expect(row?.priority).toBe(value);
  });

  it("treats an omitted priority as not set", async () => {
    const res = await create({ title: "No priority given" });
    expect(res.status).toBe(201);

    const { task } = (await res.json()) as { task: TaskDto };
    expect(task.priority).toBeNull();
  });

  it("stores an explicit null priority as not set", async () => {
    const res = await create({ title: "Explicit null", priority: null });
    expect(res.status).toBe(201);

    const { task } = (await res.json()) as { task: TaskDto };
    expect(task.priority).toBeNull();
  });

  // The discriminative half of AC-4: "when it is anything else, then the
  // request is rejected with 400 and nothing is written".
  it.each([
    ["an out-of-enum string", "urgent"],
    ["the legacy integer scale", 3],
    ["a boolean", true],
    ["an empty string", ""],
    ["a differently-cased value", "High"],
  ])("rejects %s with 400 and writes nothing", async (_label, value) => {
    const res = await create({ title: "Bad priority", priority: value });
    expect(res.status).toBe(400);

    const db = createDb(env);
    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  // The second half of "enforced twice": the database refuses the value even
  // when the route is bypassed entirely.
  it("refuses an out-of-enum priority written directly to the database", async () => {
    const db = createDb(env);
    await expect(
      db.insert(tasks).values({
        id: crypto.randomUUID(),
        title: "Direct write",
        // Deliberately bypassing the TypeScript union to prove the SQL CHECK,
        // not the type system, is what rejects this row.
        priority: "urgent" as never,
      }),
    ).rejects.toThrow();

    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  it.each(["high", "normal", "low"] as const)(
    "accepts %s written directly to the database",
    async (value) => {
      const db = createDb(env);
      await db.insert(tasks).values({
        id: crypto.randomUUID(),
        title: "Direct write",
        priority: value,
      });

      const [row] = await db.select().from(tasks);
      expect(row?.priority).toBe(value);
    },
  );

  it("accepts a NULL priority written directly to the database", async () => {
    const db = createDb(env);
    await db.insert(tasks).values({ id: crypto.randomUUID(), title: "No priority" });

    const [row] = await db.select().from(tasks);
    expect(row?.priority).toBeNull();
  });
});
