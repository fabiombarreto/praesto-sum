import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import {
  EDITABLE_SERIES_FIELDS,
  isCalendarDate,
  isTaskPriority,
  type CreateSeriesInput,
} from "../../shared/api";
import { PRAESTO_TIMEZONE } from "../../shared/dates";
import { firstOccurrence, occurrenceReminderInstants } from "../../shared/recurrence";
import { createDb } from "../db/client";
import { recurrenceSeries, reminders, tasks, type Task } from "../db/schema";
import { toSeriesDto, toTaskDto } from "../dto";

/**
 * Series routes — Phase 2 of the recurring-tasks unit (PRD AC-11..AC-18).
 *
 * Mirrors `src/worker/routes/reminders.ts`'s hand-rolled shape exactly: a
 * local `readJson` guard, validation by hand ahead of the database CHECKs, a
 * closed `EDITABLE_SERIES_FIELDS` allowlist read with `Object.hasOwn` on
 * `PATCH`. `POST /` composes `src/shared/recurrence.ts`'s pure functions
 * (never reimplements them) and writes the series, its first Task and its
 * Reminders in one `db.batch` — the same cross-statement atomicity primitive
 * `src/worker/routes/oauth-callback.ts` already uses.
 */
export const seriesRoutes = new Hono<{ Bindings: Env }>();

const FREQ_VALUES = ["daily", "weekly", "monthly", "yearly"] as const;
const END_KIND_VALUES = ["never", "until", "count"] as const;
const DATE_MODE_VALUES = ["deadline", "scheduled"] as const;

function badRequest(c: Context<{ Bindings: Env }>, message: string) {
  return c.json({ error: message }, 400);
}

/**
 * Looks up the Task id of a series' current open occurrence, or `null` when
 * none exists (Phase 3 spawns successors; this phase only ever produces at
 * most one open occurrence per series).
 */
async function findOpenOccurrenceId(
  db: ReturnType<typeof createDb>,
  seriesId: string,
): Promise<string | null> {
  const [open] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.seriesId, seriesId), eq(tasks.status, "open")));
  return open?.id ?? null;
}

/**
 * Create a series and materialize its first occurrence (AC-11, AC-12, AC-13).
 *
 * Validates one field at a time, in the order AC-13 names them, and writes
 * NOTHING on any failure — the checks below all happen before the single
 * `db.batch` at the bottom.
 */
seriesRoutes.post("/", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return badRequest(c, "Body must be a JSON object");

  const input = body as Partial<CreateSeriesInput>;

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return badRequest(c, "title is required");

  const freq = input.freq;
  if (typeof freq !== "string" || !(FREQ_VALUES as readonly string[]).includes(freq)) {
    return badRequest(c, `Unknown freq: ${String(freq)}`);
  }

  const interval = input.interval ?? 1;
  if (typeof interval !== "number" || !Number.isInteger(interval) || interval < 1) {
    return badRequest(c, "interval must be an integer >= 1");
  }

  const byMonthday = input.byMonthday ?? null;
  if (byMonthday !== null && (!Number.isInteger(byMonthday) || byMonthday < 1 || byMonthday > 31)) {
    return badRequest(c, "byMonthday must be an integer between 1 and 31");
  }

  const byWeekday = input.byWeekday ?? null;
  if (byWeekday !== null) {
    if (
      !Array.isArray(byWeekday) ||
      byWeekday.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
    ) {
      return badRequest(c, "byWeekday entries must be integers between 1 and 7");
    }
  }

  const dtstart = input.dtstart;
  if (!isCalendarDate(dtstart)) {
    return badRequest(c, "dtstart must be a calendar date (YYYY-MM-DD)");
  }

  const timezone =
    typeof input.timezone === "string" && input.timezone ? input.timezone : PRAESTO_TIMEZONE;

  const anchorMode = input.anchorMode ?? "calendar";
  if (anchorMode !== "calendar" && anchorMode !== "completion") {
    return badRequest(c, "anchorMode must be 'calendar' or 'completion'");
  }

  const endKind = input.endKind ?? "never";
  if (!(END_KIND_VALUES as readonly string[]).includes(endKind)) {
    return badRequest(c, `Unknown endKind: ${String(endKind)}`);
  }
  const untilDate = input.untilDate ?? null;
  const maxCount = input.maxCount ?? null;
  if (untilDate !== null && !isCalendarDate(untilDate)) {
    return badRequest(c, "untilDate must be a calendar date (YYYY-MM-DD)");
  }
  if (maxCount !== null && (!Number.isInteger(maxCount) || maxCount < 1)) {
    return badRequest(c, "maxCount must be a positive integer");
  }
  if (endKind === "until" && untilDate === null) {
    return badRequest(c, "untilDate is required when endKind is 'until'");
  }
  if (endKind === "count" && maxCount === null) {
    return badRequest(c, "maxCount is required when endKind is 'count'");
  }
  if (endKind !== "until" && untilDate !== null) {
    return badRequest(c, "untilDate is only valid when endKind is 'until'");
  }
  if (endKind !== "count" && maxCount !== null) {
    return badRequest(c, "maxCount is only valid when endKind is 'count'");
  }
  if (untilDate !== null && maxCount !== null) {
    return badRequest(c, "endKind cannot carry both untilDate and maxCount");
  }

  const dateMode = input.dateMode;
  if (typeof dateMode !== "string" || !(DATE_MODE_VALUES as readonly string[]).includes(dateMode)) {
    return badRequest(c, `Unknown dateMode: ${String(dateMode)}`);
  }

  const priority = input.priority ?? null;
  if (priority !== null && !isTaskPriority(priority)) {
    return badRequest(c, `Unknown priority: ${String(priority)}`);
  }

  const reminderOffsets = input.reminderOffsets ?? [];
  if (
    !Array.isArray(reminderOffsets) ||
    reminderOffsets.some((offset) => typeof offset !== "number" || !Number.isFinite(offset))
  ) {
    return badRequest(c, "reminderOffsets must be an array of numbers");
  }

  const description = input.description ?? null;
  const lifeAreaId = input.lifeAreaId ?? null;

  const seriesId = crypto.randomUUID();
  const occurrenceDate = firstOccurrence({
    freq,
    interval,
    byWeekday,
    byMonthday,
    dtstart,
    timezone,
    anchorMode,
    endKind,
    untilDate,
    maxCount,
  });

  const taskId = crypto.randomUUID();
  const reminderInstants = occurrenceReminderInstants(occurrenceDate, reminderOffsets, timezone);

  const db = createDb(c.env);
  const [[seriesRow], [taskRow]] = await db.batch([
    db
      .insert(recurrenceSeries)
      .values({
        id: seriesId,
        kind: "task",
        freq,
        interval,
        byWeekday: byWeekday === null ? null : JSON.stringify(byWeekday),
        byMonthday,
        dtstart,
        timezone,
        anchorMode,
        endKind,
        untilDate,
        maxCount,
        status: "active",
        title,
        description,
        priority,
        lifeAreaId,
        dateMode,
        reminderOffsets: reminderOffsets.length === 0 ? null : JSON.stringify(reminderOffsets),
      })
      .returning(),
    db
      .insert(tasks)
      .values({
        id: taskId,
        title,
        description,
        deadline: dateMode === "deadline" ? occurrenceDate : null,
        scheduledDate: dateMode === "scheduled" ? occurrenceDate : null,
        priority,
        lifeAreaId,
        seriesId,
        occurrenceDate,
      })
      .returning(),
    ...reminderInstants.map((instant, index) =>
      db.insert(reminders).values({
        id: crypto.randomUUID(),
        taskId,
        fireAt: new Date(instant * 1000),
        originOffsetMinutes: reminderOffsets[index] ?? null,
      }),
    ),
  ]);

  if (seriesRow === undefined || taskRow === undefined) {
    return c.json({ error: "Insert returned no row" }, 500);
  }

  return c.json(
    { series: toSeriesDto(seriesRow, taskRow.id), occurrence: toTaskDto(taskRow) },
    201,
  );
});

/** List every series with its current open occurrence id (AC-16). */
seriesRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(recurrenceSeries);
  const series = await Promise.all(
    rows.map(async (row) => toSeriesDto(row, await findOpenOccurrenceId(db, row.id))),
  );
  return c.json({ series });
});

/** Read one series with its current open occurrence id, or 404 (AC-16). */
seriesRoutes.get("/:id", async (c) => {
  const db = createDb(c.env);
  const [row] = await db
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, c.req.param("id")));
  if (row === undefined) return c.json({ error: "Série não encontrada" }, 404);

  const openOccurrenceId = await findOpenOccurrenceId(db, row.id);
  return c.json({ series: toSeriesDto(row, openOccurrenceId) });
});

/**
 * Partial update of a series' template, or ending it (AC-17, AC-18).
 *
 * Closed-allowlist rejection identical to `reminderRoutes.patch("/:id")`:
 * every rule column is absent from `EDITABLE_SERIES_FIELDS`, so a rule-field
 * edit is rejected by name for free.
 */
seriesRoutes.patch("/:id", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return badRequest(c, "Body must be a JSON object");

  const unknownKey = Object.keys(body).find((key) => !EDITABLE_SERIES_FIELDS.includes(key));
  if (unknownKey !== undefined) {
    return badRequest(c, `Field is not editable: ${unknownKey}`);
  }
  if (Object.keys(body).length === 0) {
    return badRequest(c, "At least one editable field is required");
  }

  const db = createDb(c.env);
  const [existing] = await db
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, c.req.param("id")));
  if (existing === undefined) return c.json({ error: "Série não encontrada" }, 404);

  const seriesPatch: Partial<typeof recurrenceSeries.$inferInsert> = {};
  const taskPatch: Partial<Task> = {};
  let touchesTemplate = false;

  if (Object.hasOwn(body, "status")) {
    const status = body.status;
    if (status !== "ended") {
      return badRequest(c, "status must be 'ended'");
    }
    seriesPatch.status = "ended";
  }

  if (Object.hasOwn(body, "title")) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest(c, "title must be a non-empty string");
    seriesPatch.title = title;
    taskPatch.title = title;
    touchesTemplate = true;
  }

  if (Object.hasOwn(body, "description")) {
    const description = body.description;
    if (description !== null && typeof description !== "string") {
      return badRequest(c, "description must be a string or null");
    }
    seriesPatch.description = description;
    taskPatch.description = description;
    touchesTemplate = true;
  }

  if (Object.hasOwn(body, "priority")) {
    const priority = body.priority;
    if (priority !== null && !isTaskPriority(priority)) {
      return badRequest(c, `Unknown priority: ${String(priority)}`);
    }
    seriesPatch.priority = priority;
    taskPatch.priority = priority;
    touchesTemplate = true;
  }

  if (Object.hasOwn(body, "lifeAreaId")) {
    const lifeAreaId = body.lifeAreaId;
    if (lifeAreaId !== null && typeof lifeAreaId !== "string") {
      return badRequest(c, "lifeAreaId must be a string or null");
    }
    seriesPatch.lifeAreaId = lifeAreaId;
    taskPatch.lifeAreaId = lifeAreaId;
    touchesTemplate = true;
  }

  if (Object.hasOwn(body, "reminderOffsets")) {
    const reminderOffsets = body.reminderOffsets;
    if (
      reminderOffsets !== null &&
      (!Array.isArray(reminderOffsets) ||
        reminderOffsets.some((offset) => typeof offset !== "number" || !Number.isFinite(offset)))
    ) {
      return badRequest(c, "reminderOffsets must be an array of numbers or null");
    }
    // Never re-armed onto the Task here — armed Reminders are D4's concern
    // (Phase 3), not touched by a template edit (plan Task 6).
    seriesPatch.reminderOffsets =
      reminderOffsets === null || reminderOffsets.length === 0
        ? null
        : JSON.stringify(reminderOffsets);
  }

  const [seriesRow] = await db
    .update(recurrenceSeries)
    .set(seriesPatch)
    .where(eq(recurrenceSeries.id, existing.id))
    .returning();
  if (seriesRow === undefined) return c.json({ error: "Update returned no row" }, 500);

  if (touchesTemplate) {
    const [openOccurrence] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.seriesId, existing.id), eq(tasks.status, "open")));
    if (openOccurrence !== undefined && !openOccurrence.detached) {
      await db.update(tasks).set(taskPatch).where(eq(tasks.id, openOccurrence.id));
    }
  }

  const openOccurrenceId = await findOpenOccurrenceId(db, seriesRow.id);
  return c.json({ series: toSeriesDto(seriesRow, openOccurrenceId) });
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
