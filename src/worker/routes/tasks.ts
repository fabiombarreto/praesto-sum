import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  EDITABLE_TASK_FIELDS,
  isCalendarDate,
  isTaskPriority,
  isTaskStatus,
  MAX_TASK_LIMIT,
  type CreateTaskInput,
} from "../../shared/api";
import { todayIn } from "../../shared/dates";
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

/**
 * FR-007 — list, optionally filtered by status, a date range and priority, in
 * urgency order.
 *
 * The order is the frozen read contract's most load-bearing guarantee, and it
 * is produced HERE rather than in any client: unit 3's today view, the export
 * and the recurrence views all need the same answer, and only the API can give
 * it to all of them (`docs/api-reference.md`, "Task read contract").
 *
 * Overdue first, then today, then future by date ascending, then undated last.
 * The ordering key is `coalesce(deadline, scheduled_date)` — unambiguous
 * because `tasks_single_date_chk` guarantees at most one of the two is set.
 *
 * The ordering is applied IN the query, before `limit`, so `?limit=N` returns
 * the first N *of the ordered set*. Sorting after the limit would return the
 * first N of an arbitrary set, which is exactly what AC-10 forbids.
 *
 * `from`/`to` compare against the same `coalesce(deadline, scheduled_date)`
 * expression the ordering already uses, so a Task with neither date is never
 * inside a range: a `NULL` comparison is never true, and that is the wanted
 * behaviour, not an accident. An inverted range (`from` after `to`) needs no
 * special case — the two clauses simply select nothing, the right answer to a
 * well-formed request describing an empty interval.
 *
 * `priority=normal` also matches a `NULL` priority, because an unset priority
 * means "not set" and sorts as normal (`docs/domain/areas/tasks.md`) — a plain
 * equality would hide most of the real table.
 */
taskRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  if (status !== undefined && !isTaskStatus(status)) {
    return c.json({ error: `Unknown status: ${status}` }, 400);
  }

  const rawLimit = c.req.query("limit");
  let limit = MAX_TASK_LIMIT;
  if (rawLimit !== undefined) {
    // Reject rather than clamp: a caller handed 501 and given 500 has no way to
    // know its request was altered.
    const parsed = /^\d+$/.test(rawLimit) ? Number(rawLimit) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TASK_LIMIT) {
      return c.json({ error: `Invalid limit: ${rawLimit}` }, 400);
    }
    limit = parsed;
  }

  const from = c.req.query("from");
  if (from !== undefined && !isCalendarDate(from)) {
    return c.json({ error: "from must be a calendar date (YYYY-MM-DD)" }, 400);
  }

  const to = c.req.query("to");
  if (to !== undefined && !isCalendarDate(to)) {
    return c.json({ error: "to must be a calendar date (YYYY-MM-DD)" }, 400);
  }

  const priority = c.req.query("priority");
  if (priority !== undefined && !isTaskPriority(priority)) {
    return c.json({ error: `Unknown priority: ${priority}` }, 400);
  }

  const today = todayIn(new Date());
  const dueDate = sql`coalesce(${tasks.deadline}, ${tasks.scheduledDate})`;
  const urgencyBucket = sql`case
      when ${dueDate} is null then 3
      when ${dueDate} < ${today} then 0
      when ${dueDate} = ${today} then 1
      else 2
    end`;

  // The clauses that apply, composed beside the ordering rather than after
  // it: an empty array preserves today's no-filter query byte-for-byte, and
  // `and(...)` composes whichever subset is present.
  const clauses = [
    status === undefined ? undefined : eq(tasks.status, status),
    from === undefined ? undefined : sql`${dueDate} >= ${from}`,
    to === undefined ? undefined : sql`${dueDate} <= ${to}`,
    priority === undefined
      ? undefined
      : priority === "normal"
        ? sql`(${tasks.priority} = 'normal' or ${tasks.priority} is null)`
        : eq(tasks.priority, priority),
  ].filter((clause) => clause !== undefined);

  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(tasks)
    .where(clauses.length === 0 ? undefined : and(...clauses))
    .orderBy(urgencyBucket, dueDate, desc(tasks.createdAt))
    .limit(limit);

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

  // Priority is a domain enum (FR-006). Reject at the boundary so the owner
  // meets a 400, not the CHECK constraint's 500. NULL stays "not set".
  const priority = input.priority ?? null;
  if (priority !== null && !isTaskPriority(priority)) {
    return c.json({ error: `Unknown priority: ${String(priority)}` }, 400);
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
      priority,
      lifeAreaId: input.lifeAreaId ?? null,
    })
    .returning();

  if (row === undefined) return c.json({ error: "Insert returned no row" }, 500);
  return c.json({ task: toTaskDto(row) }, 201);
});

/**
 * FR-002 — edit any editable attribute of a Task.
 *
 * This route owns three rules the client must never own:
 *
 * 1. An omitted key is NOT a `null`. Keys are read with `Object.hasOwn` off the
 *    raw parsed body, because `body.key ?? null` would collapse "not mentioned"
 *    and "clear it" into the same write — which is the one thing a partial
 *    update must never do.
 * 2. Setting one date clears the other in the same statement, so a Task never
 *    holds both and `tasks_single_date_chk` never has to be the thing that
 *    reports the conflict to the owner.
 * 3. Editing a Task that belongs to a recurrence series marks it `detached`
 *    (ADR-0006), so a later series edit cannot silently overwrite the
 *    correction. Unit 9 gives that flag its consumer; honouring it here costs
 *    one line and saves a retrofit over real data.
 *
 * `status`, `completedAt`, `seriesId`, `occurrenceDate`, `createdAt` and
 * `lifeAreaId` are never written here. `updatedAt` is written by the schema's
 * own `$onUpdate`.
 */
taskRoutes.patch("/:id", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const unknownKey = Object.keys(body).find((key) => !EDITABLE_TASK_FIELDS.includes(key));
  if (unknownKey !== undefined) {
    return c.json({ error: `Field is not editable: ${unknownKey}` }, 400);
  }
  if (Object.keys(body).length === 0) {
    return c.json({ error: "At least one editable field is required" }, 400);
  }

  const patch: Partial<typeof tasks.$inferInsert> = {};

  if (Object.hasOwn(body, "title")) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title must be a non-empty string" }, 400);
    patch.title = title;
  }

  if (Object.hasOwn(body, "description")) {
    const description = body.description;
    if (description !== null && typeof description !== "string") {
      return c.json({ error: "description must be a string or null" }, 400);
    }
    patch.description = description;
  }

  if (Object.hasOwn(body, "deadline")) {
    const deadline = body.deadline;
    if (deadline !== null && !isCalendarDate(deadline)) {
      return c.json({ error: "deadline must be a calendar date (YYYY-MM-DD)" }, 400);
    }
    patch.deadline = deadline;
  }

  if (Object.hasOwn(body, "scheduledDate")) {
    const scheduledDate = body.scheduledDate;
    if (scheduledDate !== null && !isCalendarDate(scheduledDate)) {
      return c.json({ error: "scheduledDate must be a calendar date (YYYY-MM-DD)" }, 400);
    }
    patch.scheduledDate = scheduledDate;
  }

  if (Object.hasOwn(body, "priority")) {
    const priority = body.priority;
    if (priority !== null && !isTaskPriority(priority)) {
      return c.json({ error: `Unknown priority: ${String(priority)}` }, 400);
    }
    patch.priority = priority;
  }

  // Same rule, same wording as the create route: never both at once.
  if (patch.deadline != null && patch.scheduledDate != null) {
    return c.json({ error: "A Task carries either a deadline or a scheduled date" }, 400);
  }
  // Rule 2 — setting one date clears the other in the same write.
  if (patch.deadline != null) patch.scheduledDate = null;
  if (patch.scheduledDate != null) patch.deadline = null;

  const db = createDb(c.env);
  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, c.req.param("id")));
  if (existing === undefined) return c.json({ error: "No Task with that id" }, 404);

  // Rule 3 — an edited occurrence detaches from its series.
  if (existing.seriesId !== null) patch.detached = true;

  const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, existing.id)).returning();

  if (row === undefined) return c.json({ error: "Update returned no row" }, 500);
  return c.json({ task: toTaskDto(row) });
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
