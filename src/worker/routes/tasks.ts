import { and, desc, eq, gt, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import {
  EDITABLE_TASK_FIELDS,
  isCalendarDate,
  isTaskPriority,
  isTaskStatus,
  MAX_TASK_LIMIT,
  type CreateTaskInput,
} from "../../shared/api";
import { offsetToInstant, todayIn } from "../../shared/dates";
import {
  occurrenceReminderInstants,
  nextOccurrence,
  type RecurrenceRule,
} from "../../shared/recurrence";
import { buildSearchClauses } from "../../shared/search";
import { createDb } from "../db/client";
import { recurrenceSeries, reminders, tasks, type RecurrenceSeries, type Task } from "../db/schema";
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
 * Maps a `recurrenceSeries` row to `src/shared/recurrence.ts`'s
 * `RecurrenceRule`. `byWeekday` is decoded here — the route boundary
 * `src/shared/recurrence.ts:34-36`'s own doc comment anticipates — since
 * Phase 2's `POST /api/series` only ever encoded it for storage and never
 * needed to read it back (`firstOccurrence` never consults it).
 */
function buildRecurrenceRule(series: RecurrenceSeries): RecurrenceRule {
  return {
    freq: series.freq,
    interval: series.interval,
    byWeekday: series.byWeekday === null ? null : (JSON.parse(series.byWeekday) as number[]),
    byMonthday: series.byMonthday,
    dtstart: series.dtstart,
    timezone: series.timezone,
    anchorMode: series.anchorMode,
    endKind: series.endKind,
    untilDate: series.untilDate,
    maxCount: series.maxCount,
  };
}

/**
 * Builds (never executes) the Task-insert-plus-Reminders statements for a new
 * occurrence of `series` on `occurrenceDate`, generalizing
 * `src/worker/routes/series.ts:169-220`'s first-occurrence materialization
 * shape to read the template from an existing `RecurrenceSeries` row instead
 * of a validated POST body. The caller splices `statements` into its own
 * `db.batch([...])` array alongside the Task-status-changing statement, so
 * the whole write — closing/skipping the current occurrence AND spawning the
 * next one — stays one atomic operation.
 */
async function buildSuccessorStatements(
  db: ReturnType<typeof createDb>,
  series: RecurrenceSeries,
  occurrenceDate: string,
): Promise<{ successorId: string; statements: unknown[] }> {
  const reminderOffsets =
    series.reminderOffsets === null ? [] : (JSON.parse(series.reminderOffsets) as number[]);
  const reminderInstants = occurrenceReminderInstants(
    occurrenceDate,
    reminderOffsets,
    series.timezone,
  );

  const successorId = crypto.randomUUID();

  return {
    successorId,
    statements: [
      db
        .insert(tasks)
        .values({
          id: successorId,
          // Non-null: recurrence_series_template_chk guarantees title is set for kind='task'.
          title: series.title!,
          description: series.description,
          deadline: series.dateMode === "deadline" ? occurrenceDate : null,
          scheduledDate: series.dateMode === "scheduled" ? occurrenceDate : null,
          priority: series.priority,
          lifeAreaId: series.lifeAreaId,
          seriesId: series.id,
          occurrenceDate,
        })
        .returning(),
      ...reminderInstants.map((instant, index) =>
        db.insert(reminders).values({
          id: crypto.randomUUID(),
          taskId: successorId,
          fireAt: new Date(instant * 1000),
          originOffsetMinutes: reminderOffsets[index] ?? null,
        }),
      ),
    ],
  };
}

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

  // `q` search (PRD AC-1..AC-9): validated here, in the same pre-DB block as
  // every other filter, so an invalid query never reaches the database.
  const q = c.req.query("q");
  let qClauses: SQL[] = [];
  if (q !== undefined) {
    const result = buildSearchClauses(q, sql`${tasks.title}`, sql`${tasks.description}`);
    if (!result.ok) return c.json({ error: result.error }, 400);
    qClauses = result.clauses;
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
    ...qClauses,
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

  // Reminders phase 4, AC-11/AC-12 — a deadline that actually moved to a new
  // non-null value recomputes every relative (originOffsetMinutes non-null),
  // unsent (sentAt IS NULL) Reminder linked to this Task, reusing the exact
  // `offsetToInstant` formula `src/worker/routes/reminders.ts` already uses
  // for the same computation. The `isNull(reminders.sentAt)` clause means an
  // already-sent Reminder is never selected here, so AC-12 (never resurrect
  // a delivered notification) holds structurally, not via a runtime check.
  if (
    Object.hasOwn(body, "deadline") &&
    row.deadline !== null &&
    row.deadline !== existing.deadline
  ) {
    const relativeReminders = await db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.taskId, row.id),
          isNotNull(reminders.originOffsetMinutes),
          isNull(reminders.sentAt),
        ),
      );
    for (const reminder of relativeReminders) {
      if (reminder.originOffsetMinutes === null) continue;
      await db
        .update(reminders)
        .set({
          fireAt: new Date(offsetToInstant(row.deadline, reminder.originOffsetMinutes) * 1000),
        })
        .where(eq(reminders.id, reminder.id));
    }
  }

  return c.json({ task: toTaskDto(row) });
});

/**
 * The `error.message.includes("UNIQUE constraint failed")` check this helper
 * wraps is grounded in `test/tasks.test.ts:140-147`'s proof that a partial
 * unique-index violation surfaces in THIS harness (Vitest +
 * `@cloudflare/vitest-pool-workers` + Drizzle) as a rejected promise reaching
 * the caller. No prior route in this codebase catches a D1 constraint
 * violation and maps it to a non-`500` response — this is that pattern's
 * first use (plan `## Notes`, "No-precedent design decision"). Any error NOT
 * matching that message propagates unchanged, never silently swallowed,
 * consistent with `src/worker/routes/oauth-callback.ts`'s own
 * reason-preserving catch blocks.
 */
async function batchOrRace<T extends unknown[]>(
  db: ReturnType<typeof createDb>,
  statements: T,
): Promise<{ ok: true; results: unknown[] } | { ok: false; response: Response }> {
  try {
    // The batch is built dynamically (a variable number of successor
    // statements), so it cannot be typed as the literal tuple `db.batch`'s
    // signature demands; the runtime shape is exactly what `series.ts` and
    // `oauth-callback.ts` already pass it. See plan `## Notes`.
    const results = (await db.batch(statements as never)) as unknown[];
    return { ok: true, results };
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return {
        ok: false,
        response: Response.json(
          { error: "A próxima ocorrência já foi criada por outra requisição" },
          { status: 409 },
        ),
      };
    }
    throw error;
  }
}

/** FR-003 — complete a Task, and undo it. */
taskRoutes.post("/:id/complete", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (existing === undefined || existing.status !== "open") {
    return c.json({ error: "No open Task with that id" }, 404);
  }

  if (existing.seriesId === null) {
    const [row] = await db
      .update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.status, "open")))
      .returning();

    if (row === undefined) return c.json({ error: "No open Task with that id" }, 404);
    return c.json({ task: toTaskDto(row) });
  }

  // Series occurrence (PRD AC-19, AC-20, AC-21, AC-22).
  const [series] = await db
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, existing.seriesId));
  if (series === undefined) return c.json({ error: "Série não encontrada" }, 404);

  const rule = buildRecurrenceRule(series);
  const completedOn =
    rule.anchorMode === "completion" ? todayIn(new Date(), rule.timezone) : undefined;
  const closedCount = series.doneCount + 1 + series.missedCount; // D6 — this completion counts.
  const occurrenceDate = existing.occurrenceDate as string; // tasks_occurrence_chk guarantees it for a series row.
  const next =
    series.status === "ended"
      ? null
      : nextOccurrence(rule, {
          after: occurrenceDate,
          closedCount,
          ...(completedOn === undefined ? {} : { completedOn }),
        });

  const seriesUpdate: Partial<typeof recurrenceSeries.$inferInsert> = {
    doneCount: series.doneCount + 1,
  };
  // Avoid a no-op `status: "ended"` write when the series was ended already
  // (e.g. via `PATCH /api/series/:id`) while this, its last open occurrence,
  // is only now being completed.
  if (next === null && series.status !== "ended") seriesUpdate.status = "ended";

  const statements: unknown[] = [
    db
      .update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.status, "open")))
      .returning(),
    db.update(recurrenceSeries).set(seriesUpdate).where(eq(recurrenceSeries.id, series.id)),
  ];
  let successorId: string | undefined;
  if (next !== null) {
    const successor = await buildSuccessorStatements(db, series, next);
    successorId = successor.successorId;
    statements.push(...successor.statements);
  }

  const outcome = await batchOrRace(db, statements);
  if (!outcome.ok) return outcome.response;

  const [updatedRow] = outcome.results[0] as Task[];
  if (updatedRow === undefined) return c.json({ error: "No open Task with that id" }, 404);

  if (successorId === undefined) return c.json({ task: toTaskDto(updatedRow) });
  const [successorRow] = outcome.results[2] as Task[];
  return c.json({ task: toTaskDto(updatedRow), successor: toTaskDto(successorRow as Task) });
});

/** FR-003 — undo a completion. */
taskRoutes.post("/:id/reopen", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (existing === undefined || existing.status !== "done") {
    return c.json({ error: "No completed Task with that id" }, 404);
  }

  if (existing.seriesId === null) {
    const [row] = await db
      .update(tasks)
      .set({ status: "open", completedAt: null })
      .where(and(eq(tasks.id, id), eq(tasks.status, "done")))
      .returning();

    if (row === undefined) return c.json({ error: "No completed Task with that id" }, 404);
    return c.json({ task: toTaskDto(row) });
  }

  // Series occurrence (PRD AC-24, D10).
  const [series] = await db
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, existing.seriesId));
  if (series === undefined) return c.json({ error: "Série não encontrada" }, 404);

  // The chronologically NEXT row for this series — the one the original
  // completion spawned, whichever its current state — adapted (not reused
  // verbatim) from `series.ts`'s `findOpenOccurrenceId`, which finds
  // "whichever row is currently open" instead; the two differ once more than
  // one cycle has elapsed since the row being reopened.
  const reopenedOccurrenceDate = existing.occurrenceDate as string; // tasks_occurrence_chk guarantees it for a series row.
  const [successor] = await db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.seriesId, existing.seriesId), gt(tasks.occurrenceDate, reopenedOccurrenceDate)),
    )
    .orderBy(tasks.occurrenceDate)
    .limit(1);

  let untouched: boolean;
  if (successor === undefined) {
    // No successor row at all — e.g. the series had already reached its end
    // condition when this occurrence was completed. D10's own wording does
    // not name this edge explicitly; treated as vacuously untouched (plan
    // `## Risks and Mitigations`).
    untouched = true;
  } else {
    const [sentReminder] = await db
      .select({ id: reminders.id })
      .from(reminders)
      .where(and(eq(reminders.taskId, successor.id), isNotNull(reminders.sentAt)))
      .limit(1);
    untouched =
      successor.detached === false && successor.status === "open" && sentReminder === undefined;
  }

  if (!untouched) {
    return c.json({ error: "A próxima ocorrência já existe e não pode mais ser desfeita" }, 409);
  }

  // The successor's delete MUST run before the reopened row flips back to
  // "open" — both are the same series, and `tasks_series_single_open_unq`
  // checks immediately (SQLite does not defer unique-index enforcement to
  // the end of the batch), so reopening first would transiently collide
  // with the still-open successor even though the batch as a whole is
  // correct.
  const statements: unknown[] = [];
  if (successor !== undefined) {
    statements.push(db.delete(tasks).where(eq(tasks.id, successor.id)));
  }
  statements.push(
    db
      .update(tasks)
      .set({ status: "open", completedAt: null })
      .where(and(eq(tasks.id, id), eq(tasks.status, "done")))
      .returning(),
    db
      .update(recurrenceSeries)
      .set({ doneCount: series.doneCount - 1 })
      .where(eq(recurrenceSeries.id, existing.seriesId)),
  );
  const updatedRowIndex = successor === undefined ? 0 : 1;

  const results = (await db.batch(statements as never)) as unknown[];
  const [updatedRow] = results[updatedRowIndex] as Task[];
  if (updatedRow === undefined) return c.json({ error: "No completed Task with that id" }, 404);
  return c.json({ task: toTaskDto(updatedRow) });
});

/** FR-004 — delete a Task. */
taskRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (existing === undefined) return c.json({ error: "No Task with that id" }, 404);

  if (existing.seriesId === null || existing.status !== "open") {
    // A closed series row (already done/missed) is deleted the plain way —
    // only an OPEN series occurrence triggers skip-and-spawn below. Keeps
    // AC-25 structural and avoids re-spawning a successor for a row that
    // already has one.
    const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (row === undefined) return c.json({ error: "No Task with that id" }, 404);
    return c.body(null, 204);
  }

  // Open series occurrence (PRD AC-23, D3): skip the cycle, spawn the
  // successor immediately; doneCount/missedCount stay UNCHANGED.
  const [series] = await db
    .select()
    .from(recurrenceSeries)
    .where(eq(recurrenceSeries.id, existing.seriesId));
  if (series === undefined) return c.json({ error: "Série não encontrada" }, 404);

  const rule = buildRecurrenceRule(series);
  // `completedOn` here stands in for "the day this cycle ended" on a
  // completion-anchored series being SKIPPED rather than completed — D3/D5's
  // interaction for that combination is not named by any AC (plan `## Risks
  // and Mitigations`).
  const completedOn =
    rule.anchorMode === "completion" ? todayIn(new Date(), rule.timezone) : undefined;
  const occurrenceDate = existing.occurrenceDate as string; // tasks_occurrence_chk guarantees it for a series row.
  const next =
    series.status === "ended"
      ? null
      : nextOccurrence(rule, {
          after: occurrenceDate,
          closedCount: series.doneCount + series.missedCount, // D3 — unchanged, a skip counts as neither.
          ...(completedOn === undefined ? {} : { completedOn }),
        });

  const statements: unknown[] = [db.delete(tasks).where(eq(tasks.id, id)).returning()];
  if (next !== null) {
    const successor = await buildSuccessorStatements(db, series, next);
    statements.push(...successor.statements);
  } else if (series.status !== "ended") {
    statements.push(
      db
        .update(recurrenceSeries)
        .set({ status: "ended" })
        .where(eq(recurrenceSeries.id, series.id)),
    );
  }

  const outcome = await batchOrRace(db, statements);
  if (!outcome.ok) return outcome.response;

  const [deletedRow] = outcome.results[0] as Task[];
  if (deletedRow === undefined) return c.json({ error: "No Task with that id" }, 404);
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
