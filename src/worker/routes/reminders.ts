import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { EDITABLE_REMINDER_FIELDS, type CreateReminderInput } from "../../shared/api";
import { offsetToInstant } from "../../shared/dates";
import { createDb } from "../db/client";
import { reminders, tasks, type Task } from "../db/schema";
import { toReminderDto } from "../dto";

/**
 * Reminder routes — Phase 1 of the reminders unit (FR-025, FR-044).
 *
 * Mirrors `src/worker/routes/tasks.ts`'s hand-rolled style exactly: a local
 * `readJson` guard, validation by hand ahead of the database CHECK, DTO
 * mapping only at the response boundary. The cron sweep that actually fires
 * these (FR-041) is Phase 2 — this router only gives the domain a write path.
 */
export const reminderRoutes = new Hono<{ Bindings: Env }>();

/** List every Reminder, mapped through the existing `toReminderDto`. */
reminderRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(reminders);
  return c.json({ reminders: rows.map(toReminderDto) });
});

/**
 * Create a Reminder — standalone (FR-044: label + absolute instant) or
 * Task-linked (FR-025: absolute or offset-in-minutes before the deadline).
 */
reminderRoutes.post("/", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const input = body as Partial<CreateReminderInput>;

  const taskId = typeof input.taskId === "string" ? input.taskId : null;
  const hasLabel = typeof input.label === "string" && input.label.trim().length > 0;

  // Pre-empts `reminders_label_chk`: a Reminder must say what it is about.
  if (taskId === null && !hasLabel) {
    return c.json({ error: "Informe um label ou uma tarefa" }, 400);
  }

  const db = createDb(c.env);

  let task: Task | undefined;
  if (taskId !== null) {
    const [found] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (found === undefined) return c.json({ error: "Tarefa não encontrada" }, 404);
    task = found;
  }

  const originOffsetMinutes =
    typeof input.originOffsetMinutes === "number" && Number.isFinite(input.originOffsetMinutes)
      ? input.originOffsetMinutes
      : null;

  let fireAt: number;
  if (originOffsetMinutes !== null && task !== undefined && task.deadline !== null) {
    fireAt = offsetToInstant(task.deadline, originOffsetMinutes);
  } else if (typeof input.fireAt === "number" && Number.isFinite(input.fireAt)) {
    fireAt = input.fireAt;
  } else {
    return c.json({ error: "Informe fireAt ou originOffsetMinutes com uma tarefa com prazo" }, 400);
  }

  const [row] = await db
    .insert(reminders)
    .values({
      id: crypto.randomUUID(),
      taskId,
      label: typeof input.label === "string" ? input.label.trim() || null : null,
      fireAt: new Date(fireAt * 1000),
      originOffsetMinutes,
    })
    .returning();

  if (row === undefined) return c.json({ error: "Insert returned no row" }, 500);
  return c.json({ reminder: toReminderDto(row) }, 201);
});

/**
 * Partial update of a Reminder. `Object.hasOwn` per editable field against
 * the closed `EDITABLE_REMINDER_FIELDS` allowlist, so an absent key never
 * collapses into a written `null`; the same target/label/instant rules as
 * `POST /` are re-validated (AC-A2, AC-A4 apply on update exactly as on
 * create).
 */
reminderRoutes.patch("/:id", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const unknownKey = Object.keys(body).find((key) => !EDITABLE_REMINDER_FIELDS.includes(key));
  if (unknownKey !== undefined) {
    return c.json({ error: `Field is not editable: ${unknownKey}` }, 400);
  }
  if (Object.keys(body).length === 0) {
    return c.json({ error: "At least one editable field is required" }, 400);
  }

  const db = createDb(c.env);
  const [existing] = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, c.req.param("id")));
  if (existing === undefined) return c.json({ error: "Lembrete não encontrado" }, 404);

  const nextTaskId = Object.hasOwn(body, "taskId")
    ? typeof body.taskId === "string"
      ? body.taskId
      : null
    : existing.taskId;

  const nextLabel = Object.hasOwn(body, "label")
    ? typeof body.label === "string"
      ? body.label.trim() || null
      : null
    : existing.label;

  const hasLabel = nextLabel !== null && nextLabel.length > 0;
  if (nextTaskId === null && !hasLabel) {
    return c.json({ error: "Informe um label ou uma tarefa" }, 400);
  }

  let task: Task | undefined;
  if (nextTaskId !== null) {
    const [found] = await db.select().from(tasks).where(eq(tasks.id, nextTaskId));
    if (found === undefined) return c.json({ error: "Tarefa não encontrada" }, 404);
    task = found;
  }

  const nextOriginOffsetMinutes = Object.hasOwn(body, "originOffsetMinutes")
    ? typeof body.originOffsetMinutes === "number" && Number.isFinite(body.originOffsetMinutes)
      ? body.originOffsetMinutes
      : null
    : existing.originOffsetMinutes;

  let nextFireAt: Date;
  if (nextOriginOffsetMinutes !== null && task !== undefined && task.deadline !== null) {
    nextFireAt = new Date(offsetToInstant(task.deadline, nextOriginOffsetMinutes) * 1000);
  } else if (Object.hasOwn(body, "fireAt")) {
    const fireAt = body.fireAt;
    if (typeof fireAt !== "number" || !Number.isFinite(fireAt)) {
      return c.json(
        { error: "Informe fireAt ou originOffsetMinutes com uma tarefa com prazo" },
        400,
      );
    }
    nextFireAt = new Date(fireAt * 1000);
  } else if (nextOriginOffsetMinutes !== null) {
    // An offset was requested but the target has no deadline to count back
    // from, and no absolute fireAt was supplied either.
    return c.json({ error: "Informe fireAt ou originOffsetMinutes com uma tarefa com prazo" }, 400);
  } else {
    nextFireAt = existing.fireAt;
  }

  const [row] = await db
    .update(reminders)
    .set({
      taskId: nextTaskId,
      label: nextLabel,
      fireAt: nextFireAt,
      originOffsetMinutes: nextOriginOffsetMinutes,
    })
    .where(eq(reminders.id, existing.id))
    .returning();

  if (row === undefined) return c.json({ error: "Update returned no row" }, 500);
  return c.json({ reminder: toReminderDto(row) });
});

/** Delete a Reminder. Scope-completion work for Phase 2/4 to build on. */
reminderRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [row] = await db.delete(reminders).where(eq(reminders.id, id)).returning();
  if (row === undefined) return c.json({ error: "Lembrete não encontrado" }, 404);
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
