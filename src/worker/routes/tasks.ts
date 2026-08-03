import { and, desc, eq, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { isCalendarDate, isTaskStatus, type CreateTaskInput } from "../../shared/api";
import { createDb } from "../db/client";
import { tasks } from "../db/schema";
import { toTaskDto } from "../dto";

/**
 * Task routes — the Phase 1 core (FR-001..FR-004, FR-007, FR-045).
 *
 * Recurrence (FR-009) is deliberately absent: this slice covers one-off Tasks
 * only. The occurrence machinery of ADR-0006 lands with its own plan, and the
 * schema already carries the columns and the invariant indexes it will need.
 */
export const taskRoutes = new Hono<{ Bindings: Env }>();

/** FR-007 — list, optionally filtered by status. Newest first. */
taskRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  if (status !== undefined && !isTaskStatus(status)) {
    return c.json({ error: `Unknown status: ${status}` }, 400);
  }

  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        status === undefined ? undefined : eq(tasks.status, status),
        // One-off Tasks and materialized occurrences only — never a template.
        or(isNull(tasks.seriesId), eq(tasks.detached, false)),
      ),
    )
    .orderBy(desc(tasks.createdAt))
    .limit(500);

  return c.json({ tasks: rows.map(toTaskDto) });
});

/** FR-001 / FR-045 — create a Task. Title is the only required field. */
taskRoutes.post("/", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const input = body as Partial<CreateTaskInput>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return c.json({ error: "title is required" }, 400);

  const deadline = input.deadline ?? null;
  const scheduledDate = input.scheduledDate ?? null;
  if (deadline !== null && !isCalendarDate(deadline)) {
    return c.json({ error: "deadline must be a calendar date (YYYY-MM-DD)" }, 400);
  }
  if (scheduledDate !== null && !isCalendarDate(scheduledDate)) {
    return c.json({ error: "scheduledDate must be a calendar date (YYYY-MM-DD)" }, 400);
  }
  // Domain rule (glossary, 2026-08-03): a Task carries a deadline OR a
  // scheduled date — never both. The DB enforces it too; this is the
  // human-readable half.
  if (deadline !== null && scheduledDate !== null) {
    return c.json({ error: "A Task carries either a deadline or a scheduled date" }, 400);
  }

  const db = createDb(c.env);
  const [row] = await db
    .insert(tasks)
    .values({
      id: crypto.randomUUID(),
      title,
      description: input.description ?? null,
      deadline,
      scheduledDate,
      priority: input.priority ?? null,
      lifeAreaId: input.lifeAreaId ?? null,
    })
    .returning();

  if (row === undefined) return c.json({ error: "Insert returned no row" }, 500);
  return c.json({ task: toTaskDto(row) }, 201);
});

/** FR-003 — complete a Task, and undo it. */
taskRoutes.post("/:id/complete", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [row] = await db
    .update(tasks)
    .set({ status: "done", completedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.status, "open")))
    .returning();

  if (row === undefined) return c.json({ error: "No open Task with that id" }, 404);
  return c.json({ task: toTaskDto(row) });
});

taskRoutes.post("/:id/reopen", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [row] = await db
    .update(tasks)
    .set({ status: "open", completedAt: null })
    .where(and(eq(tasks.id, id), eq(tasks.status, "done")))
    .returning();

  if (row === undefined) return c.json({ error: "No completed Task with that id" }, 404);
  return c.json({ task: toTaskDto(row) });
});

/** FR-004 — delete a Task. */
taskRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (row === undefined) return c.json({ error: "No Task with that id" }, 404);
  return c.body(null, 204);
});

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
