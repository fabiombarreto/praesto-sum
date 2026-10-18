import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { EDITABLE_LIFE_AREA_FIELDS, type LifeAreasResponse } from "../../shared/api";
import {
  compareLifeAreaNames,
  LIFE_AREA_LIMIT,
  LIFE_AREA_NAME_MAX,
  lifeAreaNameKey,
  validateLifeAreaName,
} from "../../shared/life-areas";
import { createDb } from "../db/client";
import { lifeAreas, recurrenceSeries, tasks } from "../db/schema";
import { toLifeAreaDto, toLifeAreaSummaryDto } from "../dto";
import { isUniqueConflict } from "../successor";

/**
 * Life Area routes — Phase 1 of the life-areas unit (ADR-0015, PRD AC-1..AC-7).
 *
 * Mirrors `src/worker/routes/reminders.ts`'s hand-rolled shape: a local
 * `readJson` guard, validation by hand ahead of the database, a closed
 * `EDITABLE_LIFE_AREA_FIELDS` allowlist on `PATCH`, DTO mapping only at the
 * response boundary. Mounted below the bearer gate in `src/worker/index.ts`, so
 * every route here answers 401 before a handler runs (AC-7).
 *
 * Error copy is pt-BR with the field in parentheses (ADR-0009), as in
 * `src/worker/routes/series.ts`.
 */
export const lifeAreaRoutes = new Hono<{ Bindings: Env }>();

const DUPLICATE_NAME_MESSAGE = "Já existe uma área com esse nome (name)";
const AREA_NOT_FOUND_MESSAGE = "Área não encontrada";

type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/**
 * Judges a raw `name` the way the screen will (`validateLifeAreaName`): the
 * trimmed name is the one stored, and the error names the field.
 */
function checkName(raw: unknown): NameCheck {
  if (typeof raw !== "string") return { ok: false, error: "Informe o nome da área (name)" };

  const problem = validateLifeAreaName(raw);
  if (problem === "blank") {
    return { ok: false, error: "O nome da área não pode ficar em branco (name)" };
  }
  if (problem === "too_long") {
    return {
      ok: false,
      error: `O nome da área deve ter no máximo ${LIFE_AREA_NAME_MAX} caracteres (name)`,
    };
  }
  return { ok: true, name: raw.trim() };
}

/**
 * List every area in pt-BR alphabetical order (never bytewise: `Ética` sorts
 * between `Casa` and `Trabalho`), each with the counts the screen and the
 * delete confirmation need, plus the count of open Tasks with no area (AC-6).
 *
 * `openTaskCount` is open Tasks only, `taskCount` every status, `seriesCount`
 * every Recurrence Series of the area whatever its status. The counts come from
 * two grouped reads rather than one query per area.
 */
lifeAreaRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const [areaRows, taskGroups, seriesGroups] = await Promise.all([
    db.select().from(lifeAreas),
    db
      .select({ lifeAreaId: tasks.lifeAreaId, status: tasks.status, n: count() })
      .from(tasks)
      .groupBy(tasks.lifeAreaId, tasks.status),
    db
      .select({ lifeAreaId: recurrenceSeries.lifeAreaId, n: count() })
      .from(recurrenceSeries)
      .groupBy(recurrenceSeries.lifeAreaId),
  ]);

  const openByArea = new Map<string, number>();
  const tasksByArea = new Map<string, number>();
  const seriesByArea = new Map<string, number>();
  let noAreaOpenTaskCount = 0;

  for (const group of taskGroups) {
    if (group.lifeAreaId === null) {
      if (group.status === "open") noAreaOpenTaskCount += group.n;
      continue;
    }
    tasksByArea.set(group.lifeAreaId, (tasksByArea.get(group.lifeAreaId) ?? 0) + group.n);
    if (group.status === "open") {
      openByArea.set(group.lifeAreaId, (openByArea.get(group.lifeAreaId) ?? 0) + group.n);
    }
  }
  for (const group of seriesGroups) {
    if (group.lifeAreaId === null) continue;
    seriesByArea.set(group.lifeAreaId, (seriesByArea.get(group.lifeAreaId) ?? 0) + group.n);
  }

  const sorted = [...areaRows].sort((a, b) => compareLifeAreaNames(a.name, b.name));
  const body: LifeAreasResponse = {
    lifeAreas: sorted.map((row) =>
      toLifeAreaSummaryDto(row, {
        openTaskCount: openByArea.get(row.id) ?? 0,
        taskCount: tasksByArea.get(row.id) ?? 0,
        seriesCount: seriesByArea.get(row.id) ?? 0,
      }),
    ),
    noArea: { openTaskCount: noAreaOpenTaskCount },
  };
  return c.json(body);
});

/**
 * Create an area (AC-1..AC-3). The name is trimmed, 1-40 characters, unique
 * ignoring case and diacritics (409, enforced here by `lifeAreaNameKey` because
 * the `life_areas_name_unq` index is bytewise), and at most 12 areas may exist
 * (409). Unknown body keys are ignored, as `POST /api/tasks` ignores them.
 */
lifeAreaRoutes.post("/", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const checked = checkName(body.name);
  if (!checked.ok) return c.json({ error: checked.error }, 400);

  const db = createDb(c.env);
  const existing = await db.select().from(lifeAreas);

  const key = lifeAreaNameKey(checked.name);
  if (existing.some((row) => lifeAreaNameKey(row.name) === key)) {
    return c.json({ error: DUPLICATE_NAME_MESSAGE }, 409);
  }
  if (existing.length >= LIFE_AREA_LIMIT) {
    return c.json(
      { error: `Você já tem ${LIFE_AREA_LIMIT} áreas; apague uma antes de criar outra` },
      409,
    );
  }

  try {
    const [row] = await db
      .insert(lifeAreas)
      .values({ id: crypto.randomUUID(), name: checked.name })
      .returning();
    if (row === undefined) return c.json({ error: "Insert returned no row" }, 500);
    return c.json({ lifeArea: toLifeAreaDto(row) }, 201);
  } catch (error) {
    // Two concurrent creates of the same name can both pass the check above;
    // the bytewise unique index catches the race and it is answered like any
    // other duplicate. Anything else propagates.
    if (isUniqueConflict(error)) return c.json({ error: DUPLICATE_NAME_MESSAGE }, 409);
    throw error;
  }
});

/**
 * Rename an area (AC-2, AC-4). `name` is the only editable key; the id never
 * changes, so every Task and series keeps pointing at it. Uniqueness is checked
 * against every OTHER area only, so `Casa` -> `casa` (its own name, other case)
 * is accepted. Renaming is allowed at the 12-area limit.
 */
lifeAreaRoutes.patch("/:id", async (c) => {
  const body = await readJson(c.req.raw);
  if (body === null) return c.json({ error: "Body must be a JSON object" }, 400);

  const unknownKey = Object.keys(body).find((key) => !EDITABLE_LIFE_AREA_FIELDS.includes(key));
  if (unknownKey !== undefined) {
    return c.json({ error: `Campo não editável: ${unknownKey}` }, 400);
  }
  if (Object.keys(body).length === 0) {
    return c.json({ error: "Informe ao menos um campo editável" }, 400);
  }

  const checked = checkName(body.name);
  if (!checked.ok) return c.json({ error: checked.error }, 400);

  const db = createDb(c.env);
  const rows = await db.select().from(lifeAreas);
  const existing = rows.find((row) => row.id === c.req.param("id"));
  if (existing === undefined) return c.json({ error: AREA_NOT_FOUND_MESSAGE }, 404);

  const key = lifeAreaNameKey(checked.name);
  if (rows.some((row) => row.id !== existing.id && lifeAreaNameKey(row.name) === key)) {
    return c.json({ error: DUPLICATE_NAME_MESSAGE }, 409);
  }

  try {
    const [row] = await db
      .update(lifeAreas)
      .set({ name: checked.name })
      .where(eq(lifeAreas.id, existing.id))
      .returning();
    if (row === undefined) return c.json({ error: AREA_NOT_FOUND_MESSAGE }, 404);
    return c.json({ lifeArea: toLifeAreaDto(row) });
  } catch (error) {
    if (isUniqueConflict(error)) return c.json({ error: DUPLICATE_NAME_MESSAGE }, 409);
    throw error;
  }
});

/**
 * Delete an area (AC-5, ADR-0015). Its Tasks and Recurrence Series are
 * unassigned, never deleted and never otherwise changed: no title, status or
 * date is written, and `done` and `missed` rows lose the area like any other.
 *
 * The nulling is explicit, in the same `db.batch` as the delete (one D1
 * transaction), rather than left to `ON DELETE SET NULL`, so the outcome does
 * not depend on foreign-key enforcement where the suite runs.
 */
lifeAreaRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [existing] = await db
    .select({ id: lifeAreas.id })
    .from(lifeAreas)
    .where(eq(lifeAreas.id, id));
  if (existing === undefined) return c.json({ error: AREA_NOT_FOUND_MESSAGE }, 404);

  const [, , deleted] = await db.batch([
    db.update(tasks).set({ lifeAreaId: null }).where(eq(tasks.lifeAreaId, id)),
    db
      .update(recurrenceSeries)
      .set({ lifeAreaId: null })
      .where(eq(recurrenceSeries.lifeAreaId, id)),
    db.delete(lifeAreas).where(eq(lifeAreas.id, id)).returning(),
  ]);
  if (deleted[0] === undefined) return c.json({ error: AREA_NOT_FOUND_MESSAGE }, 404);

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
