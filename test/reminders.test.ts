// PRPs/prds/reminders.prd.md AC-1 Standalone Reminder round-trip
// PRPs/prds/reminders.prd.md AC-2 Standalone Reminder must say what it is about
// PRPs/prds/reminders.prd.md AC-3 Reminder attached to a Task, relative to its deadline
// PRPs/prds/reminders.prd.md AC-4 A Reminder points at one target or none, never an unknown one
// PRPs/prds/reminders.prd.md AC-13 Every route stays behind the bearer gate
//
// Source plan: PRPs/plans/reminders-phase-1-reminder-api-and-the-time-contract.plan.md
// (Task 3 — POST/GET /api/reminders; Task 5 — mount under requireToken).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`):
// `src/worker/routes/reminders.ts` does not exist yet and is not mounted at
// `/api/reminders`, so this file is expected to be RED for the right reason
// (every request below either 404s — no route — or, for the unauthenticated
// checks, coincidentally already returns 401 from the global gate) until
// plan Tasks 3 and 5 land.
//
// Mirrors test/tasks.test.ts's shape: `exports.default.fetch`, the bearer
// token from `env.API_BEARER_TOKEN`, and a `beforeEach` D1 cleanup reusing
// the shared drain barrier from test/isolation.ts (storage isolation is per
// test FILE, so this file's `reminders`/`tasks` rows never interact with
// test/tasks.test.ts's).

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import type { ReminderDto, TaskDto } from "../src/shared/api";
import { createDb } from "../src/worker/db/client";
import { reminders } from "../src/worker/db/schema";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const BASE = "https://example.com/api/reminders";
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

async function listReminders(): Promise<ReminderDto[]> {
  const res = await exports.default.fetch(BASE, auth());
  expect(res.status).toBe(200);
  const body = (await res.json()) as { reminders: ReminderDto[] };
  return body.reminders;
}

async function createTask(body: unknown): Promise<TaskDto> {
  const res = await post(TASKS_BASE, body);
  expect(res.status).toBe(201);
  return ((await res.json()) as { task: TaskDto }).task;
}

// Reuses the shared drain barrier (see test/isolation.ts) so an abandoned
// test body from THIS file cannot leak a row into the test after it, then
// additionally wipes `reminders` — the barrier itself only knows about
// `tasks`/`recurrenceSeries`.
beforeEach(async () => {
  await resetTaskTables();
  await createDb(env).delete(reminders);
}, DRAIN_BUDGET_MS);

describe("Standalone Reminder round-trip (AC-1)", () => {
  it("creates a standalone Reminder with taskId null and sentAt null, and lists it", async () => {
    const fireAt = Math.floor(Date.UTC(2026, 8, 20, 18, 0, 0) / 1000);
    const created = await post(BASE, { label: "Beber água", fireAt });
    expect(created.status).toBe(201);
    const { reminder } = (await created.json()) as { reminder: ReminderDto };

    expect(reminder.label).toBe("Beber água");
    expect(reminder.fireAt).toBe(fireAt);
    expect(reminder.taskId).toBeNull();
    expect(reminder.sentAt).toBeNull();

    const list = await listReminders();
    expect(list.map((r) => r.id)).toContain(reminder.id);
  });
});

describe("A standalone Reminder must say what it is about (AC-2)", () => {
  it("rejects a body with no taskId and an absent, empty, or whitespace-only label with 400 and a pt-BR message", async () => {
    for (const badBody of [{ fireAt: 1 }, { label: "", fireAt: 1 }, { label: "   ", fireAt: 1 }]) {
      const res = await post(BASE, badBody);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Informe um label ou uma tarefa");
    }

    // Pre-empted before the database CHECK: no row was ever written.
    expect(await listReminders()).toHaveLength(0);
  });
});

describe("Reminder attached to a Task, relative to its deadline (AC-3)", () => {
  it("resolves originOffsetMinutes to a fireAt 60 minutes before 23:59 local America/Sao_Paulo, and persists the offset", async () => {
    const task = await createTask({ title: "Entregar relatório", deadline: "2026-09-20" });

    const created = await post(BASE, { taskId: task.id, originOffsetMinutes: 60 });
    expect(created.status).toBe(201);
    const { reminder } = (await created.json()) as { reminder: ReminderDto };

    // 2026-09-20T23:59 local (-03:00, no DST since 2019) minus 60 minutes
    // is 22:59 local the same day -> 2026-09-21T01:59:00Z.
    const expectedFireAt = Date.UTC(2026, 8, 21, 1, 59, 0) / 1000;
    expect(reminder.fireAt).toBe(expectedFireAt);
    expect(reminder.originOffsetMinutes).toBe(60);
    expect(reminder.taskId).toBe(task.id);
  });
});

describe("A Reminder points at one target or none, never an unknown one (AC-4)", () => {
  it("rejects a taskId that does not exist with 400 or 404, a pt-BR message, and writes no row", async () => {
    const res = await post(BASE, { taskId: "does-not-exist", fireAt: 1 });
    expect([400, 404]).toContain(res.status);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Tarefa não encontrada");

    expect(await listReminders()).toHaveLength(0);
  });

  it("deletes a Task's Reminders when the Task itself is deleted (the existing onDelete: cascade)", async () => {
    const task = await createTask({ title: "Tarefa descartável", deadline: "2026-09-20" });
    const created = await post(BASE, { taskId: task.id, originOffsetMinutes: 30 });
    expect(created.status).toBe(201);
    const { reminder } = (await created.json()) as { reminder: ReminderDto };

    const deleted = await exports.default.fetch(
      `${TASKS_BASE}/${task.id}`,
      auth({ method: "DELETE" }),
    );
    expect(deleted.status).toBe(204);

    expect((await listReminders()).map((r) => r.id)).not.toContain(reminder.id);
  });
});

describe("Every /api/reminders route stays behind the bearer gate (AC-13)", () => {
  it("returns 401 for GET with no token, and writes/reads no row", async () => {
    const res = await exports.default.fetch(BASE);
    expect(res.status).toBe(401);
  });

  it("returns 401 for POST with no token, and writes no row", async () => {
    const res = await exports.default.fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Sem token", fireAt: 1 }),
    });
    expect(res.status).toBe(401);

    const rows = await createDb(env).select().from(reminders);
    expect(rows).toHaveLength(0);
  });
});
