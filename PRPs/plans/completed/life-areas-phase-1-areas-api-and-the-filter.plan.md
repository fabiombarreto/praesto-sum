# Feature: Areas API and the filter (Phase 1 of life-areas)

```
**Decision Gate**
- Active context: none
- Activated criteria: architectural decisions and cross-cutting patterns (one existence check shared by four write paths); domain rules for life areas and tasks (ADR-0015: at most one area per Task and per series, closed rows are a permanent record); a new API surface (`/api/life-areas`) and a change to frozen wire contracts (`GET /api/tasks`, `PATCH /api/tasks/:id`, `POST /api/series`, `PATCH /api/series/:id`); impact on a shared service (the FR-042 export, read-only here)
- Decisions found:
  - ADR-0015 / [2026-10-11] Life Areas are owner-named, single-membership groupings; deleting one unassigns its items — name 1-40 characters, unique ignoring case and diacritics, at most 12, alphabetical pt-BR, no migration
  - ADR-0006 / [2026-08-03] Recurrence: the series template carries the area; a detached occurrence stops following it; `done` and `missed` rows are a permanent record
  - [2026-08-03] MVP scope frozen — FR-008 is unit 13; `docs/domain/areas/life-areas.md`: an item MAY exist without an area, no default area is stored, nothing is pre-created
  - ADR-0003 — one Worker, canonical D1, bearer token on every route, export is a binding safeguard
  - ADR-0007 — closed mirror inventory: Life Areas never leave Praesto
  - ADR-0009 — visible copy pt-BR, code, identifiers and tests English
  - ADR-0014 — a Task without a date can repeat (its not-yet-due occurrence is hidden from the list)
  - ADR-0008 — test-first; the test pair owns every test file
- Applicable anti-patterns:
  - Hand-duplicated entity types (the new wire shapes live once in `src/shared/api.ts`, mapped once in `src/worker/dto.ts`)
  - Glossary synonym drift (Life Area in code and docs, never category/module/domain/section)
  - Portuguese in artifacts (code, identifiers, comments English; only the string values the owner may read are pt-BR, ADR-0009 carve-out)
  - Mirroring Tasks, Reminders or Life Areas to Google
  - Editing accepted ADRs (append-only)
  - Weakening tests to force green (the pinned 400 for `lifeAreaId` is replaced by the intended behaviour, by the test pair)
  - Version ranges in dependencies (none added)
- Applicable architectural rules:
  - One Worker serves everything; no second service
  - Types flow `src/worker/db/schema.ts` -> `src/worker/dto.ts` -> `src/shared/api.ts`
  - Every `/api/*` route sits behind the bearer gate (`src/worker/index.ts`)
  - `src/shared/` carries no DOM or Worker globals and compiles into every target
  - `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay byte-unchanged
  - Migrations only by drizzle-kit + wrangler; this unit adds none
  - The export completeness guard fails if a table is not dumped (five tables, unchanged)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/life-areas.prd.md` — Implementation Phases row 1: "Areas API and the filter" — Goal: the owner's areas exist as data, and the API refuses a bad area before it reaches the database — Success signal: AC-1..AC-12 and AC-17 green; `GET /api/tasks` without the parameter byte-identical.

## Summary

This phase makes Life Areas exist as data and makes the API refuse a bad area before it reaches the foreign key. It adds a pure module `src/shared/life-areas.ts` (name limits, the case- and diacritic-insensitive key, the name validator and the pt-BR comparator), the wire types in `src/shared/api.ts`, a new bearer-gated `/api/life-areas` route (create, list with counts, rename, delete that unassigns), one shared existence check called from `POST` and `PATCH /api/tasks` and `POST` and `PATCH /api/series`, `lifeAreaId` as an editable Task field, and the `lifeAreaId=<id>|none` filter on `GET /api/tasks` composed into the existing AND. `docs/api-reference.md` is amended. No migration, no schema change, no export-manifest change and no UI: the table, the foreign keys, the index and the export already exist.

## User Story

As the owner of Praesto Sum
I want to create areas of my own and have the API accept, validate and filter by them
So that the screens of the next phases can group Tasks and recurring series by the domain of my life I chose, without a bad area id ever reaching the database.

## Problem Statement

The data model carries a `life_areas` table and a `life_area_id` on Tasks and on Recurrence Series since migration `0000`, but nothing writes or reads it: there is no `/api/life-areas`, `PATCH /api/tasks/:id` rejects `lifeAreaId` on purpose ("unit 13 owns it"), and `POST /api/tasks` and the series routes accept any id without checking it exists, so an unknown id would reach the foreign key and answer 500. The owner cannot name an area, assign an item or filter by one.

## Solution Statement

A pure shared module and a small route file mirroring the existing Reminder CRUD, one existence helper reused by the four write paths (400 naming `lifeAreaId`), `lifeAreaId` added to `EDITABLE_TASK_FIELDS`, and one more clause in the list query's AND (`eq` or `isNull`, served by `tasks_life_area_idx`). Deleting an area nulls its Tasks and series explicitly in the same `db.batch` as the delete, so the outcome does not depend on foreign-key enforcement where the tests run. The area UI, capture inheritance, row text and filter sheet are phases 2-4.

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY (new API surface + additive wire-contract changes; no schema change) |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/life-areas.ts` (new), `src/shared/api.ts`, `src/worker/dto.ts`, `src/worker/life-area-check.ts` (new), `src/worker/routes/life-areas.ts` (new), `src/worker/index.ts`, `src/worker/routes/tasks.ts`, `src/worker/routes/series.ts`, `docs/api-reference.md` |
| Dependencies | No new package; no migration; ADR-0015; `normalizeSearchText` from `src/shared/search.ts`; `count` from `drizzle-orm` (already used by `src/worker/routes/diagnostics.ts`) |
| Estimated Tasks | 10 |
| Source PRD line ref | `PRPs/prds/life-areas.prd.md` Implementation Phases row 1 (line 354), Phase Details (361-365); AC-1..AC-12 (102-150), AC-17 (169-171); D-H, D-I, D-J, D-K, D-L (399-403) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/life-areas.prd.md` | 102-150, 169-171, 297-333, 399-403 | AC-1..AC-12 and AC-17 text, the architecture notes (pure core, wire, routes, uniqueness, delete, list filter, series) and decisions D-H..D-L |
| P0 | `src/worker/routes/tasks.ts` | 56-138, 141-187, 189-318 | The list's pre-DB validation block and AND-of-clauses, the unvalidated create at :181, and the PATCH (allowlist, `Object.hasOwn` blocks, `db` created late at :270, the stale doc comment at :206-208) |
| P0 | `src/worker/routes/series.ts` | 35-37, 140-216, 306-373, 501-520 | `badRequest`, the unvalidated `lifeAreaId` at :149, the batch, and the PATCH block at :365-373 that sets series and open-occurrence together |
| P0 | `src/worker/db/schema.ts` | 27-45, 102-105, 171-174, 209 | `life_areas` (bytewise unique name, non-blank CHECK), both nullable foreign keys with `onDelete: "set null"`, `tasks_life_area_idx` |
| P0 | `src/shared/api.ts` | 77-86, 211-253, 338-355, 374-375, 410-428 | `LifeAreaDto`, `CreateTaskInput`, `UpdateTaskInput`, `EDITABLE_TASK_FIELDS` and its stale comment, series inputs, the `SeriesDto` intersection precedent |
| P0 | `src/worker/dto.ts` | 68-80, 123-132 | `toLifeAreaDto` (export-only today) and the compose-by-spread precedent `toSeriesDto` |
| P0 | `src/shared/search.ts` | 15-63 | `normalizeSearchText` (does not trim, does not collapse whitespace) and the `drizzle-orm` import the new module inherits |
| P0 | `src/worker/routes/reminders.ts` | 17-24, 89-99, 174-191 | The CRUD file shape: router, list, closed-allowlist PATCH, delete 404/204, private `readJson` |
| P1 | `src/worker/index.ts` | 22-36 | The bearer gate at `/api/*` and where routes are mounted |
| P1 | `src/worker/series-closed-rows.ts` | 1-40 | A non-route worker helper that takes a `Db` — the shape of the new existence helper |
| P1 | `src/worker/successor.ts` | 74, 112, 118-121 | The successor already copies `series.lifeAreaId` (read-only — do not change); `isUniqueConflict` to reuse |
| P1 | `src/worker/routes/diagnostics.ts` | 1, 32-33 | The one `count()` precedent in the Worker |
| P1 | `src/worker/db/export-manifest.ts` | 14-21 | `life_areas` is already first in `EXPORTED_TABLE_NAMES` — read-only, no change |
| P1 | `docs/api-reference.md` | 12-65, 83 | The Implemented table, the frozen Task read contract (filter vocabulary) and the unit-13 "Not built yet" row |
| P2 | `documentation/60-decisions/ADR-0015-life-areas-owner-named-single-membership.md` | 19-26 | The five decisions this phase implements |
| P2 | `test/task-update.test.ts` | 354-379 | Read-only: the pinned `lifeAreaId` 400 the test pair replaces; the Implementer never edits it |

## Patterns to Mirror

```ts
# SOURCE: src/worker/routes/reminders.ts:17-24
export const reminderRoutes = new Hono<{ Bindings: Env }>();

/** List every Reminder, mapped through the existing `toReminderDto`. */
reminderRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const rows = await db.select().from(reminders);
  return c.json({ reminders: rows.map(toReminderDto) });
});
```
Copied by Task 5 (router creation and the list handler's `db` / `select` / `c.json` shape).

```ts
# SOURCE: src/worker/routes/reminders.ts:93-99
  const unknownKey = Object.keys(body).find((key) => !EDITABLE_REMINDER_FIELDS.includes(key));
  if (unknownKey !== undefined) {
    return c.json({ error: `Field is not editable: ${unknownKey}` }, 400);
  }
  if (Object.keys(body).length === 0) {
    return c.json({ error: "At least one editable field is required" }, 400);
  }
```
Copied by Task 5 (the closed-allowlist rejection of the rename PATCH, driven by `EDITABLE_LIFE_AREA_FIELDS`).

```ts
# SOURCE: src/worker/routes/reminders.ts:174-181
reminderRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [row] = await db.delete(reminders).where(eq(reminders.id, id)).returning();
  if (row === undefined) return c.json({ error: "Lembrete não encontrado" }, 404);
  return c.body(null, 204);
});
```
Copied by Task 5 (404 JSON and `c.body(null, 204)`; the delete here also unassigns, see the batch below).

```ts
# SOURCE: src/worker/routes/series.ts:168-169
  const db = createDb(c.env);
  const [[seriesRow], [taskRow]] = await db.batch([
```
Copied by Task 5 (a literal `db.batch([...])` array destructured by statement position; the delete route batches two updates and a `delete(...).returning()`).

```ts
# SOURCE: src/worker/routes/diagnostics.ts:32-33
  const [subscriptionCountRow] = await db.select({ count: count() }).from(pushSubscriptions);
  const subscriptionCount = subscriptionCountRow?.count ?? 0;
```
Copied by Task 5 (`count()` from `drizzle-orm`; here with `groupBy` for the per-area counts).

```ts
# SOURCE: src/worker/successor.ts:118-121
/** True for a D1/SQLite unique-index violation (e.g. a lost race on a series' open or occurrence row). */
export function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
```
Copied by Task 5 (the bytewise `life_areas_name_unq` index is the backstop; a race it catches is answered 409, not 500).

```ts
# SOURCE: src/worker/routes/tasks.ts:84-97
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
```
Copied by Task 8 (the `lifeAreaId` parameter is read and rejected here, before `createDb`, after the `q` block so no existing error precedence moves).

```ts
# SOURCE: src/worker/routes/tasks.ts:111-127
  const clauses = [
    // A dateless series' next occurrence exists the moment the last one closes,
    // but it is not due until its own day (ADR-0014): it has no date to sort or
    // hide it by, so the day it keeps internally decides when it first appears.
    sql`not (${tasks.status} = 'open' and ${tasks.seriesId} is not null
      and ${tasks.deadline} is null and ${tasks.scheduledDate} is null
      and ${tasks.occurrenceDate} > ${today})`,
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
```
Copied by Task 8 (one more `undefined`-when-absent entry, so the no-parameter query is unchanged).

```ts
# SOURCE: src/worker/routes/tasks.ts:171-183
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
```
Copied by Task 7 (the check goes between `createDb` and the insert; `lifeAreaId` takes the checked value).

```ts
# SOURCE: src/worker/routes/tasks.ts:254-260
  if (Object.hasOwn(body, "priority")) {
    const priority = body.priority;
    if (priority !== null && !isTaskPriority(priority)) {
      return c.json({ error: `Unknown priority: ${String(priority)}` }, 400);
    }
    patch.priority = priority;
  }
```
Copied by Task 7 (one `Object.hasOwn` block per field: `null` clears, a non-null value is validated, then assigned into `patch`).

```ts
# SOURCE: src/worker/routes/series.ts:148-149
  const description = input.description ?? null;
  const lifeAreaId = input.lifeAreaId ?? null;
```
Copied by Task 9 (the unvalidated read that becomes a checked read).

```ts
# SOURCE: src/worker/routes/series.ts:365-373
  if (Object.hasOwn(body, "lifeAreaId")) {
    const lifeAreaId = body.lifeAreaId;
    if (lifeAreaId !== null && typeof lifeAreaId !== "string") {
      return badRequest(c, "A área da vida deve ser texto ou nula (lifeAreaId)");
    }
    seriesPatch.lifeAreaId = lifeAreaId;
    taskPatch.lifeAreaId = lifeAreaId;
    touchesTemplate = true;
  }
```
Copied by Task 9 (the block keeps setting both patches and `touchesTemplate`; only the validation moves to the helper).

```ts
# SOURCE: src/worker/dto.ts:72-80
export function toLifeAreaDto(row: LifeArea): LifeAreaDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
    updatedAt: toEpochSeconds(row.updatedAt) ?? 0,
  };
}
```
Copied by Task 3 (the field-by-field mapping the list item composes with its counts, never re-declared).

```ts
# SOURCE: src/worker/dto.ts:130-132
export function toSeriesDto(row: RecurrenceSeries, openOccurrenceId: string | null): SeriesDto {
  return { ...seriesWireFields(row), openOccurrenceId };
}
```
Copied by Task 3 (compose a row mapper with extra computed fields by spread).

```ts
# SOURCE: src/shared/api.ts:374-375
/** A Recurrence Series plus its current open occurrence's Task id, or `null`. */
export type SeriesDto = Omit<RecurrenceSeriesDto, "nudgedAt"> & { openOccurrenceId: string | null };
```
Copied by Task 2 (`LifeAreaSummaryDto` is `LifeAreaDto` intersected with the three counts).

```ts
# SOURCE: src/shared/api.ts:241-253
/**
 * The closed set of keys `PATCH /api/tasks/:id` accepts. Anything else — the
 * server-owned fields (`id`, `status`, `createdAt`, `completedAt`, `seriesId`,
 * `occurrenceDate`, `detached`), `lifeAreaId` (unit 13 owns it), or a typo — is
 * rejected with 400 rather than silently ignored.
 */
export const EDITABLE_TASK_FIELDS: readonly string[] = [
  "title",
  "description",
  "deadline",
  "scheduledDate",
  "priority",
];
```
Copied by Task 2 (the allowlist is closed and extended by name; the comment is amended in place).

```ts
# SOURCE: src/shared/search.ts:56-63
export function normalizeSearchText(text: string): string {
  const lowered = text.toLowerCase();
  let result = "";
  for (const char of lowered) {
    result += DIACRITIC_MAP[char] ?? char;
  }
  return result;
}
```
Copied by Task 1 (`lifeAreaNameKey` is built on it; it does not trim, so the key function trims first).

```ts
# SOURCE: src/shared/series-edit.ts:71-75
export function recurrenceDraftError(
  taskDraft: TaskDraft,
  recurrence: RecurrenceDraft,
): string | null {
  if (recurrence.freq === "none") return null;
```
Copied by Task 1 (the project's validator convention: `null` means valid).

```ts
# SOURCE: src/worker/series-closed-rows.ts:34-40
export async function findOpenOccurrenceId(db: Db, seriesId: string): Promise<string | null> {
  const [open] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.seriesId, seriesId), eq(tasks.status, "open")));
  return open?.id ?? null;
}
```
Copied by Task 4 (a single-purpose worker helper over a `Db`, narrow `select({ id })`).

```ts
# SOURCE: src/worker/index.ts:24-30
// Every /api/* route is token-gated — including health, per ADR-0003.
app.use("/api/*", requireToken);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/reminders", reminderRoutes);
app.route("/api/series", seriesRoutes);
```
Copied by Task 6 (the new route is mounted below the gate line, so it is token-gated by construction).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/life-areas.ts` | CREATE | The pure core: `LIFE_AREA_NAME_MAX`, `LIFE_AREA_LIMIT`, `validateLifeAreaName`, `lifeAreaNameKey`, `compareLifeAreaNames` (AC-12); used by the route now and by the screen in phase 2 so the two cannot drift |
| `src/shared/api.ts` | UPDATE | New wire types for the life-areas route; `lifeAreaId` in `UpdateTaskInput` and `EDITABLE_TASK_FIELDS` (D-L); stale "unit 13 owns it" comment amended |
| `src/worker/dto.ts` | UPDATE | `toLifeAreaSummaryDto` — the single mapping point for the list item with its counts |
| `src/worker/life-area-check.ts` | CREATE | The one shared existence check (400 naming `lifeAreaId`) called from Task and series create and patch |
| `src/worker/routes/life-areas.ts` | CREATE | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` with name rules, limit, ordering, counts and unassigning delete (AC-1..AC-6) |
| `src/worker/index.ts` | UPDATE | Mount `/api/life-areas` below the bearer gate (AC-7) |
| `src/worker/routes/tasks.ts` | UPDATE | Validate `lifeAreaId` on `POST`; accept and validate it on `PATCH`; add the `lifeAreaId` list filter; fix the stale doc comments (AC-8, AC-9, AC-11) |
| `src/worker/routes/series.ts` | UPDATE | Validate `lifeAreaId` on `POST` and `PATCH` through the shared check (AC-10) |
| `docs/api-reference.md` | UPDATE | Document `/api/life-areas`, `lifeAreaId` on `GET`/`POST`/`PATCH /api/tasks` and on the series routes, and amend the frozen read contract's filter vocabulary (AC-11) |

## NOT Building (Scope Limits)

- The *Áreas* screen, the `life-areas` `AppRoute`, the *Configurações* entry card, client wrappers and the list reducer (phase 2: AC-19).
- The *Área* group in the Task sheet, `planSeriesOccurrenceSave` routing, capture inheritance, the area name on the row and the zero-areas and failure states (phase 3: AC-14, AC-15, AC-16, AC-20, AC-22).
- `TaskFilter.lifeAreaId`, the *Área* group in the filter sheet and the applied chip (phase 4: AC-13, AC-21).
- Documentation sync beyond `docs/api-reference.md`: `ui-layout-standard.md` §2.6/§6, the glossary, `domain-model.md`, FR-008, the area docs, `docs/context/architecture.md` and the roadmap are phase 4 (AC-25) or the post-merge docs update.
- The restore drill on a snapshot with areas, the UI/UX checklist and the device proof (phase 4: AC-18, AC-23, AC-24).
- Any migration, schema change or export-manifest change (AC-23, D-R); `src/shared/recurrence.ts`, `src/shared/adherence.ts` and `src/worker/successor.ts` (it already copies `series.lifeAreaId`).
- Colour, icon or description in the API surface (`description` stays in the schema and the export), archiving, tags, sub-areas, manual ordering.
- A single-area read route (`GET /api/life-areas/:id`) — the PRD names four operations.
- Rewriting closed `done` / `missed` rows when a series' area changes (ADR-0006, D-K).
- An area filter in search, an area on the *Aderência* route, an area on Events or Reminders, mirroring areas to Google.
- Authoring or editing any test file (including `test/task-update.test.ts:363`, `test/task-list-contract.test.ts`, `test/export.test.ts`): the test pair owns them.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/life-areas.ts

**ACTION**: Create the pure module with exactly these exports. `export const LIFE_AREA_NAME_MAX = 40;` and `export const LIFE_AREA_LIMIT = 12;`. `export type LifeAreaNameError = "blank" | "too_long";` and `export function validateLifeAreaName(raw: string): LifeAreaNameError | null` — trims `raw`, returns `"blank"` when the trimmed length is 0, `"too_long"` when it is greater than `LIFE_AREA_NAME_MAX`, and `null` for a valid name (the codebase convention: `null` means valid). `export function lifeAreaNameKey(name: string): string` — returns `normalizeSearchText(name.trim().normalize("NFC"))` (import `normalizeSearchText` from `./search`; the trim is needed because `normalizeSearchText` does not trim, and NFC keeps a decomposed `u` + combining accent equal to the precomposed `ú` that `DIACRITIC_MAP` maps). `export function compareLifeAreaNames(a: string, b: string): number` — one module-level `new Intl.Collator("pt-BR")` and `return collator.compare(a, b)`. No DOM, no Worker globals, no other import. Every export carries a short English doc comment naming the AC it serves. Delivers AC-A12 (PRD AC-12).
**MIRROR**: `src/shared/search.ts:56-63` and `src/shared/series-edit.ts:71-75` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/life-areas.ts; npx prettier --check src/shared/life-areas.ts` — `tsc -b` compiles the module into every target project, so a DOM or Worker global in `src/shared/` is a compile error; the behavioural proof of AC-A12 is the test pair's suite at Level 2.

### Task 2: UPDATE src/shared/api.ts

**ACTION**: (a) Add, after `LifeAreaDto`, `export interface CreateLifeAreaInput { name: string }` and `export interface UpdateLifeAreaInput { name?: string }`, `export const EDITABLE_LIFE_AREA_FIELDS: readonly string[] = ["name"];` (closed allowlist: `description` stays unexposed), `export type LifeAreaSummaryDto = LifeAreaDto & { openTaskCount: number; taskCount: number; seriesCount: number };` and `export interface LifeAreasResponse { lifeAreas: LifeAreaSummaryDto[]; noArea: { openTaskCount: number } }`, each with a doc comment (`openTaskCount` counts open Tasks only; `taskCount` Tasks of every status; `seriesCount` Recurrence Series; `noArea.openTaskCount` open Tasks with no area). Do NOT change the `LifeAreaDto` fields; update only its comment so it says it is also the `/api/life-areas` item shape. (b) Add `lifeAreaId?: string | null;` to `UpdateTaskInput`. (c) Add `"lifeAreaId"` to `EDITABLE_TASK_FIELDS` and rewrite its doc comment: the server-owned fields (`id`, `status`, `createdAt`, `completedAt`, `seriesId`, `occurrenceDate`, `detached`) or a typo are rejected with 400, and `lifeAreaId` is editable since unit 13. Delivers no criterion alone — wire-contract infrastructure for AC-A1, AC-A4 and AC-A6 (consumed by Tasks 3 and 5) and the editable-key half of AC-A9 (consumed by Task 7).
**MIRROR**: `src/shared/api.ts:374-375` and `src/shared/api.ts:241-253` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/shared/api.ts; npx prettier --check src/shared/api.ts`

### Task 3: UPDATE src/worker/dto.ts

**ACTION**: Import `LifeAreaSummaryDto` from `../shared/api` and add `export function toLifeAreaSummaryDto(row: LifeArea, counts: { openTaskCount: number; taskCount: number; seriesCount: number }): LifeAreaSummaryDto` returning `{ ...toLifeAreaDto(row), openTaskCount: counts.openTaskCount, taskCount: counts.taskCount, seriesCount: counts.seriesCount }` — the three count fields written out explicitly, the area fields composed from the existing mapper, nothing re-declared by hand. Leave `toLifeAreaDto` untouched (the export keeps its field-for-field shape). Delivers AC-A6 (PRD AC-6: each list item carries `openTaskCount`, `taskCount`, `seriesCount`).
**MIRROR**: `src/worker/dto.ts:72-80` and `src/worker/dto.ts:130-132` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/worker/dto.ts; npx prettier --check src/worker/dto.ts; npx vitest run --project worker test/export.test.ts test/export-completeness.test.ts` — the export suites prove `toLifeAreaDto` is unchanged for the FR-042 dump.

### Task 4: CREATE src/worker/life-area-check.ts

**ACTION**: Create the shared existence check. `import type { Db } from "./db/client"`, `eq` from `drizzle-orm` and `lifeAreas` from `./db/schema`. Export `type LifeAreaIdCheck = { ok: true; lifeAreaId: string | null } | { ok: false; error: string }` and `export async function checkLifeAreaId(db: Db, value: unknown): Promise<LifeAreaIdCheck>`: `undefined` or `null` returns `{ ok: true, lifeAreaId: null }`; a non-string returns `{ ok: false, error: "A área da vida deve ser texto ou nula (lifeAreaId)" }` (the exact string `series.ts:368` already uses); a string is looked up with `db.select({ id: lifeAreas.id }).from(lifeAreas).where(eq(lifeAreas.id, value)).limit(1)` and, when no row is found, returns `{ ok: false, error: "A área da vida informada não existe (lifeAreaId)" }`; otherwise `{ ok: true, lifeAreaId: value }`. Both messages are pt-BR and carry the literal `lifeAreaId` in parentheses, so the four call sites answer 400 naming the field with one wording (ADR-0009). The helper never writes. Delivers no criterion alone — infrastructure for AC-A8, AC-A9 and AC-A10 (consumed by Tasks 7 and 9).
**MIRROR**: `src/worker/series-closed-rows.ts:34-40` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/worker/life-area-check.ts; npx prettier --check src/worker/life-area-check.ts`

### Task 5: CREATE src/worker/routes/life-areas.ts

**ACTION**: Create `export const lifeAreaRoutes = new Hono<{ Bindings: Env }>();` with a private `readJson` identical to the one in `reminders.ts:183-191`, and four handlers. Error strings are pt-BR with the field in parentheses (ADR-0009; `test/series.test.ts` already guards that route family against English), except the shared `Body must be a JSON object` line the sibling routes use.
`GET /`: read, in one `Promise.all`, `db.select().from(lifeAreas)`, `db.select({ lifeAreaId: tasks.lifeAreaId, status: tasks.status, n: count() }).from(tasks).groupBy(tasks.lifeAreaId, tasks.status)` and `db.select({ lifeAreaId: recurrenceSeries.lifeAreaId, n: count() }).from(recurrenceSeries).groupBy(recurrenceSeries.lifeAreaId)`. Per area: `taskCount` is the sum of its status groups, `openTaskCount` the `open` group, `seriesCount` its series group (every status and kind). `noArea.openTaskCount` is the `open` group whose `lifeAreaId` is `null`. Sort a copy of the rows with `compareLifeAreaNames(a.name, b.name)` (not bytewise) and respond `{ lifeAreas: rows.map((row) => toLifeAreaSummaryDto(row, counts)), noArea: { openTaskCount } }`.
`POST /`: `readJson` (null -> 400 `Body must be a JSON object`); a non-string or absent `name` -> 400 `Informe o nome da área (name)`; `validateLifeAreaName` returns `"blank"` -> 400 `O nome da área não pode ficar em branco (name)`, `"too_long"` -> 400 ``O nome da área deve ter no máximo ${LIFE_AREA_NAME_MAX} caracteres (name)``; then read all areas (at most 12): an existing `lifeAreaNameKey` equal to the new one -> 409 `Já existe uma área com esse nome (name)`; `rows.length >= LIFE_AREA_LIMIT` -> 409 ``Você já tem ${LIFE_AREA_LIMIT} áreas; apague uma antes de criar outra``; otherwise insert `{ id: crypto.randomUUID(), name: <trimmed> }` with `.returning()` and answer 201 `{ lifeArea: toLifeAreaDto(row) }` (`description` is `null`). Wrap the insert so `isUniqueConflict(error)` answers the same 409 duplicate response and any other error propagates. Unknown body keys on create are ignored, as `POST /api/tasks` ignores them.
`PATCH /:id`: `readJson`; reject any key not in `EDITABLE_LIFE_AREA_FIELDS` with 400 `Campo não editável: <key>` and an empty body with 400 `Informe ao menos um campo editável`; validate `name` exactly as on create (400 naming `name`); then load the area by id (absent -> 404 `Área não encontrada`); compare `lifeAreaNameKey` against every OTHER area only (renaming `Casa` to `casa` is accepted; another area's key -> 409 naming `name`); `db.update(lifeAreas).set({ name: <trimmed> }).where(eq(lifeAreas.id, existing.id)).returning()` -> 200 `{ lifeArea: toLifeAreaDto(row) }`; same `isUniqueConflict` backstop. The `id` never changes.
`DELETE /:id`: load the area (absent -> 404 `Área não encontrada`); then one `db.batch([...])` of exactly three statements in this order — `db.update(tasks).set({ lifeAreaId: null }).where(eq(tasks.lifeAreaId, id))`, `db.update(recurrenceSeries).set({ lifeAreaId: null }).where(eq(recurrenceSeries.lifeAreaId, id))`, `db.delete(lifeAreas).where(eq(lifeAreas.id, id)).returning()` — and answer `c.body(null, 204)`. The nulling is explicit rather than left to `ON DELETE SET NULL` (the plan's choice per PRD Architecture Notes; see Notes). No Task or series row is deleted and no title, status or date is written. Delivers AC-A1 (create and list), AC-A2 (name rules), AC-A3 (limit), AC-A4 (rename), AC-A5 (delete unassigns) and AC-A6 (list shape, order and counts); AC-A13 (export carries it) is delivered by composition — this route and Tasks 7 and 9 make assigned areas exist, and the unchanged export code already dumps `life_areas` and the `lifeAreaId` columns.
**MIRROR**: `src/worker/routes/reminders.ts:17-24`, `src/worker/routes/reminders.ts:93-99`, `src/worker/routes/reminders.ts:174-181`, `src/worker/routes/series.ts:168-169`, `src/worker/routes/diagnostics.ts:32-33` and `src/worker/successor.ts:118-121` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/worker/routes/life-areas.ts; npx prettier --check src/worker/routes/life-areas.ts` — the route is not reachable until Task 6 mounts it; its behaviour is exercised end to end by the test pair's suite at Level 2.

### Task 6: UPDATE src/worker/index.ts

**ACTION**: Add `import { lifeAreaRoutes } from "./routes/life-areas";` beside the other route imports and `app.route("/api/life-areas", lifeAreaRoutes);` immediately after `app.route("/api/series", seriesRoutes);`. Do not touch the `app.use("/api/*", requireToken)` line: the route sits below it and is token-gated by construction — a missing or wrong token is 401 before any handler runs. Delivers AC-A7 (PRD AC-7: every `/api/life-areas` route answers 401 without the token and reads or writes nothing) and makes AC-A1..AC-A6 reachable.
**MIRROR**: `src/worker/index.ts:24-30` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/worker/index.ts; npx prettier --check src/worker/index.ts; npx vitest run --project worker test/health.test.ts test/tasks.test.ts; grep -qF 'app.route("/api/life-areas", lifeAreaRoutes);' src/worker/index.ts` — the health suite proves the gate and the entry point still boot with the new import; the final `grep` is the last-resort text check for the one-line registration (its reachability is exercised by the pair's route suite at Level 2).

### Task 7: UPDATE src/worker/routes/tasks.ts (create and edit)

**ACTION**: Import `checkLifeAreaId` from `../life-area-check`. `POST /`: immediately after the existing `const db = createDb(c.env);` and before the insert, add `const area = await checkLifeAreaId(db, input.lifeAreaId); if (!area.ok) return c.json({ error: area.error }, 400);` and replace `lifeAreaId: input.lifeAreaId ?? null` with `lifeAreaId: area.lifeAreaId` (absent or `null` stays `null` exactly as today). `PATCH /:id`: move `const db = createDb(c.env);` up to just after the empty-body check and delete the later declaration (`db` is needed by the check; the validation order is otherwise unchanged); after the `priority` block add an `Object.hasOwn(body, "lifeAreaId")` block that calls `checkLifeAreaId(db, body.lifeAreaId)`, answers 400 with `area.error` on failure and otherwise sets `patch.lifeAreaId = area.lifeAreaId` (`null` clears it). Leave the existing `if (existing.seriesId !== null) patch.detached = true;` untouched: editing the area of an occurrence detaches it (ADR-0006 unchanged) and never writes the series row. Rewrite the PATCH doc comment's final paragraph so `lifeAreaId` is no longer listed as "never written here". Delivers AC-A8 (PRD AC-8: create validates the area; unknown id -> 400 naming `lifeAreaId`, no Task created) and AC-A9 (PRD AC-9: edit sets, clears or rejects the area; every other non-editable key is still 400; an occurrence PATCH detaches and leaves the series' own `lifeAreaId` untouched).
**MIRROR**: `src/worker/routes/tasks.ts:171-183` and `src/worker/routes/tasks.ts:254-260` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/worker/routes/tasks.ts; npx prettier --check src/worker/routes/tasks.ts; npx vitest run --project worker test/tasks.test.ts test/task-update.test.ts`

### Task 8: UPDATE src/worker/routes/tasks.ts (list filter)

**ACTION**: In `GET /`, after the `q` block and before `createDb`, read `const lifeAreaId = c.req.query("lifeAreaId");` and, when it is defined and `lifeAreaId.trim() === ""`, answer 400 with `O filtro de área não pode ser vazio (lifeAreaId)`. In the `clauses` array, before `...qClauses`, add `lifeAreaId === undefined ? undefined : lifeAreaId === "none" ? isNull(tasks.lifeAreaId) : eq(tasks.lifeAreaId, lifeAreaId),` — `none` is the reserved literal (ids are `crypto.randomUUID()`), any other value is an id and an id matching no area is an ordinary empty result, not an error. Do not validate the id against `life_areas`. Extend the route's doc comment with one paragraph naming the parameter, its AND composition and that an absent parameter leaves the query byte-for-byte unchanged. Delivers AC-A11 (PRD AC-11: `<id>` returns that area's Tasks of every status, `none` the area-less ones, ANDed with `status`, `priority`, `from`/`to` and `q`; empty -> 400 naming `lifeAreaId`; no parameter -> response byte-identical).
**MIRROR**: `src/worker/routes/tasks.ts:84-97` and `src/worker/routes/tasks.ts:111-127` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/worker/routes/tasks.ts; npx prettier --check src/worker/routes/tasks.ts; npx vitest run --project worker test/task-list-contract.test.ts test/task-list-filters.test.ts test/task-list-search.test.ts` — the frozen-contract suite must pass; the pair extends it, never loosens it.

### Task 9: UPDATE src/worker/routes/series.ts

**ACTION**: Import `checkLifeAreaId` from `../life-area-check`. `POST /`: replace `const lifeAreaId = input.lifeAreaId ?? null;` with `const db = createDb(c.env);`, `const area = await checkLifeAreaId(db, input.lifeAreaId);`, `if (!area.ok) return badRequest(c, area.error);` and `const lifeAreaId = area.lifeAreaId;`, and delete the later `const db = createDb(c.env);` directly above the `db.batch` (a single declaration, created earlier). The check stays where the read was, after `description`, so every earlier field's error still wins and nothing is written on failure. `PATCH /:id`: inside the existing `Object.hasOwn(body, "lifeAreaId")` block replace the type check with `const area = await checkLifeAreaId(db, body.lifeAreaId); if (!area.ok) return badRequest(c, area.error);` and assign `area.lifeAreaId` to both `seriesPatch.lifeAreaId` and `taskPatch.lifeAreaId`, keeping `touchesTemplate = true` (`db` already exists at that point; every validation still runs before the single `db.update`, so an unknown id writes nothing). The open non-detached-occurrence propagation and the rule that `done` and `missed` rows keep their area are existing behaviour and are not touched. Delivers AC-A10 (PRD AC-10: the series and its first occurrence carry the area, the spawned successor copies it, a patch moves the series and its open non-detached occurrence only, an unknown id is 400 and changes nothing).
**MIRROR**: `src/worker/routes/series.ts:148-149` and `src/worker/routes/series.ts:365-373` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx eslint src/worker/routes/series.ts; npx prettier --check src/worker/routes/series.ts; npx vitest run --project worker test/series.test.ts test/tasks.test.ts`

### Task 10: UPDATE docs/api-reference.md

**ACTION**: (a) In the Implemented table, extend the `GET /api/tasks` row's route cell with `&lifeAreaId=<id>\|none` and its behaviour cell with the `lifeAreaId` rule: `<id>` returns only that area's Tasks of every status, `none` only Tasks with no area, it ANDs with every other filter, an id matching no area is `200` with an empty list, an empty value is 400 naming `lifeAreaId`, and without the parameter the response is byte-identical to before. (b) Amend the `POST /api/tasks` row: `lifeAreaId` is optional, absent or `null` stays `null`, an id matching no area is 400 naming `lifeAreaId` and creates nothing. (c) Amend the `PATCH /api/tasks/:id` row: the editable keys are exactly `title`, `description`, `deadline`, `scheduledDate`, `priority`, `lifeAreaId`; remove `lifeAreaId` from the list of rejected keys; an unknown id is 400 naming `lifeAreaId`; editing the area of an occurrence detaches it. (d) Add four rows for `GET`, `POST`, `PATCH /:id` and `DELETE /:id` of `/api/life-areas` (list shape with `openTaskCount`, `taskCount`, `seriesCount` and `noArea.openTaskCount`, pt-BR alphabetical order; name rules 1-40 characters, unique ignoring case and diacritics -> 409, limit 12 -> 409; rename keeps the id; delete -> 204 and unassigns its Tasks and series, 404 when absent) and one row for `POST /api/series` and `PATCH /api/series/:id` stating that `lifeAreaId` must match an existing area (400 naming `lifeAreaId`) and that a patch moves the series and its open non-detached occurrence only. (e) In the frozen read contract's "Filter vocabulary" paragraph, add that `lifeAreaId` (unit 13, 2026-10-11) extends the vocabulary additively and that `none` is reserved. (f) Replace the unit-13 "Not built yet" row's surface text so it no longer reads `Life Area CRUD and area filters`: the API shipped in phase 1 (see Implemented above) and the screens (phases 2-4) remain. Cite only paths that exist. Delivers AC-A11 (the frozen contract is amended and documented) and records AC-A1..AC-A10 for the screens that code against them.
**MIRROR**: `docs/api-reference.md` rows 14-28 (the Implemented table format and the adherence row's level of detail) — documentation prose, no code anchor applies.
**VALIDATE**: `set -euo pipefail; grep -qF '/api/life-areas' docs/api-reference.md; grep -qF 'lifeAreaId=<id>\|none' docs/api-reference.md; if grep -qF '`detached`, `lifeAreaId`, or a typo' docs/api-reference.md; then echo "FAIL: PATCH row still lists lifeAreaId as non-editable"; exit 1; else echo "PASS: PATCH row amended"; fi; if grep -qF 'Life Area CRUD and area filters' docs/api-reference.md; then echo "FAIL: unit 13 still listed as not built"; exit 1; else echo "PASS: unit 13 row amended"; fi; npx vitest run --project docs` — the text checks are acceptable here because the deliverable IS documentation prose; the `docs` project proves every cited path still resolves.

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
set -euo pipefail
# wrangler types --check && tsc -b && eslint . && prettier --check .
npm run check
```

### Level 2: UNIT_TESTS

```bash
set -euo pipefail
# both vitest projects: `worker` (inside workerd, against an ephemeral D1) and `docs`
npm test
# the pure modules ADR-0006 froze stay byte-identical to main (PRD AC-23)
git diff --quiet main -- src/shared/recurrence.ts src/shared/adherence.ts
# this unit adds no migration and changes none (PRD AC-23, D-R)
if [ -n "$(git status --porcelain -- migrations)" ] || ! git diff --quiet main -- migrations; then
  echo "FAIL: migrations/ changed — this unit adds none"; exit 1
else
  echo "PASS: migrations/ untouched"
fi
```

### Level 3: INTEGRATION

```bash
set -euo pipefail
# The phase through the real Worker in workerd: the frozen list contract still holds and the
# filter composes, the task and series write paths validate the area, and the export carries
# an assigned area with the completeness guard unchanged.
npx vitest run --project worker test/export.test.ts test/export-completeness.test.ts test/task-list-contract.test.ts test/task-list-filters.test.ts test/task-update.test.ts test/series.test.ts
```

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** `POST /api/life-areas` with `{ "name": "  Casa " }` answers 201 with a `lifeArea` whose `name` is `Casa` (trimmed), `description` is `null` and `id` is a UUID, and `GET /api/life-areas` then lists exactly that area.
- **AC-A2 (PRD AC-2):** A create or a rename whose name is blank or whitespace-only, or longer than 40 characters, is answered 400 naming `name`; a name equal to an existing one ignoring case and diacritics (`saude`, `SAÚDE`, ` Saude ` against `Saúde`) is answered 409 naming `name`; no row is written or changed in any of the three cases.
- **AC-A3 (PRD AC-3):** With 12 areas, creating a 13th is answered 409 and there are still 12; after one is deleted the same create succeeds.
- **AC-A4 (PRD AC-4):** `PATCH /api/life-areas/:id` with `{ "name": "Lar" }` answers 200, keeps the `id`, and `GET /api/tasks?lifeAreaId=<id>` returns the same Tasks as before; renaming `Casa` to `casa` (its own name, other case) is accepted; renaming to another area's name is 409; an unknown id is 404.
- **AC-A5 (PRD AC-5):** `DELETE /api/life-areas/:id` answers 204 and removes the area row; its Tasks (open and `done`), its series and the series' open occurrence all have `lifeAreaId` `null`; no Task or series row is deleted and no title, status or date changed; an unknown id is 404.
- **AC-A6 (PRD AC-6):** `GET /api/life-areas` answers 200 with `lifeAreas` ordered by pt-BR collation (`Casa`, `Ética`, `Trabalho`, not bytewise), each carrying `openTaskCount` (open Tasks only), `taskCount` (every status) and `seriesCount`, and a `noArea.openTaskCount` equal to the number of open Tasks with no area.
- **AC-A7 (PRD AC-7):** Any `/api/life-areas` route called with no `Authorization` header or a wrong token answers 401 and reads or writes nothing.
- **AC-A8 (PRD AC-8):** `POST /api/tasks` with the `lifeAreaId` of an existing area answers 201 and the Task carries it; an id matching no area answers 400 naming `lifeAreaId` and creates no Task; the key absent or `null` yields `lifeAreaId` `null` exactly as today.
- **AC-A9 (PRD AC-9):** `PATCH /api/tasks/:id` with `{ "lifeAreaId": A }` answers 200 and sets the area, `{ "lifeAreaId": null }` clears it, an unknown id is 400; `lifeAreaId` is in `EDITABLE_TASK_FIELDS` while `status`, `seriesId`, `detached` and a typo are still 400; on an occurrence of a series the same PATCH sets `detached` and leaves the series' own `lifeAreaId` untouched.
- **AC-A10 (PRD AC-10):** `POST /api/series` with `lifeAreaId` A gives the series and its first occurrence A, and the successor spawned on completion carries A; `PATCH /api/series/:id` with `{ "lifeAreaId": B }` moves the series and its open non-detached occurrence to B, a detached open occurrence keeps its own, and `done` and `missed` rows keep the area they had; an unknown id on create or patch is 400 and nothing changes.
- **AC-A11 (PRD AC-11):** `GET /api/tasks?lifeAreaId=A` returns only A's Tasks of every status, `lifeAreaId=none` only the area-less ones, composed as an AND with `status`, `priority`, `from`/`to` and `q`; an id matching no area is 200 with an empty list; an empty `lifeAreaId=` is 400 naming `lifeAreaId`; without the parameter the response is byte-identical to today's; `docs/api-reference.md` is amended and the frozen-contract suite is extended, not loosened.
- **AC-A12 (PRD AC-12):** `lifeAreaNameKey` returns equal keys for `Saúde`, `SAUDE` and ` saude ` and different keys for `Casa` and `Casas`; `compareLifeAreaNames` orders `Ética` before `Saúde` and `casa` before `Trabalho`; `LIFE_AREA_NAME_MAX` is 40 and `LIFE_AREA_LIMIT` is 12; `validateLifeAreaName` returns an error code (`"blank"`, `"too_long"`) for a blank and an over-length name and `null` for a valid one.
- **AC-A13 (PRD AC-17):** With an area and a Task and a series assigned to it, `GET /api/export` carries `tables.life_areas` field for field and the Task and series rows carry its id in `lifeAreaId`; `formatVersion` is still 1 and the completeness guard passes with no manifest change.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| An unknown area id reaches the foreign key and answers 500 on a write path | M | H | One helper, `checkLifeAreaId`, runs on all four write paths before any write; each path answers 400 naming `lifeAreaId` (AC-A8, AC-A9, AC-A10) |
| `ON DELETE SET NULL` is not enforced where the tests run, leaving a dangling id after a delete | L | H | The delete nulls both child tables explicitly in the same `db.batch` as the delete; Cloudflare documents a D1 batch as one transaction that rolls back whole, so the outcome does not depend on enforcement (AC-A5) |
| The frozen list contract regresses for callers that send no `lifeAreaId` | L | H | The new clause is `undefined` when the parameter is absent, so the `and(...)` is unchanged; `test/task-list-contract.test.ts` must pass unchanged and Level 3 runs it (AC-A11) |
| An existing test pins the old behaviour (`test/task-update.test.ts:363` expects 400 for `lifeAreaId`) | H | M | The test pair replaces it with the intended behaviour before the Implementer runs (ADR-0008); the Implementer never edits a test file, and the replacement is never a loosening |
| `Intl.Collator("pt-BR")` falls back to the runtime's default locale inside workerd (research found no authoritative statement that locale data ships) | L | M | Accent-folding order (`Casa`, `Ética`, `Trabalho`) holds under any ICU collation, and AC-A6/AC-A12 assert exactly the order a bytewise sort would get wrong, so a regression is caught by the suite |
| Two concurrent creates of the same name pass the route check together | L | L | The bytewise `life_areas_name_unq` index is the backstop; `isUniqueConflict` maps it to 409 instead of 500 |
| `openTaskCount` counts a dateless series' not-yet-due open occurrence that the list hides (ADR-0014), so a displayed count can exceed the filtered list for a day | L | L | Follows PRD AC-6 literally ("open Tasks only"); recorded in Notes for the owner to judge on first real use |
| A decomposed accent (`u` + combining mark) would otherwise bypass the duplicate check | L | L | `lifeAreaNameKey` NFC-normalizes before `normalizeSearchText` |
| `PATCH /api/tasks/:id` on an occurrence detaches it when only the area changes (ADR-0006) | M | M | Unchanged by design; phase 3 routes the choice through *Aplicar a* (default *Toda a série*); AC-A9 pins that the series' own area is untouched |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file; this plan's per-task `**VALIDATE**` commands exercise the change through the type checker, the linter and suites that already exist, and the whole suite — including the pair's new files — runs at Level 2.
- **For the test pair, names this plan pins** (PRD AC-12 leaves them open): `src/shared/life-areas.ts` exports `LIFE_AREA_NAME_MAX`, `LIFE_AREA_LIMIT`, `validateLifeAreaName(raw): "blank" | "too_long" | null`, `lifeAreaNameKey(name): string` and `compareLifeAreaNames(a, b): number`. The route is `lifeAreaRoutes`, mounted at `/api/life-areas`; the list body is `{ lifeAreas, noArea: { openTaskCount } }`; create and rename answer `{ lifeArea }`. Every 400/409 message carries the literal field name (`name`, `lifeAreaId`); copy is pt-BR and pinned only by field name, as the series suite does. `test/isolation.ts`'s `resetTaskTables` wipes only `tasks` and `recurrence_series`, so a life-areas suite must also `db.delete(lifeAreas)` after it (as `test/export.test.ts:40-48` does); the pinned case is `test/task-update.test.ts:363`.
- **Decision left to the plan by the PRD (delete):** the delete nulls `tasks.life_area_id` and `recurrence_series.life_area_id` explicitly in the same `db.batch` instead of relying on the foreign key alone. Cost: those rows' `updated_at` moves through `$onUpdate`; `updatedAt` is not on the Task wire (frozen contract) and AC-5 names title, status and dates. Benefit: AC-A5 holds whether or not the test harness enforces foreign keys.
- **Decision left to the plan (key function):** `lifeAreaNameKey` trims and NFC-normalizes before `normalizeSearchText`, which does neither. Internal whitespace runs are not collapsed — the PRD does not ask for it.
- **Research grounding:** Cloudflare's D1 documentation states foreign keys are enforced by default and a batch is a single transaction; SQLite's `NOCASE` folds ASCII only, which is why uniqueness is a route-level key and the existing bytewise index stays a backstop. Not established by an authoritative source and left to the suite: `Intl.Collator("pt-BR")` locale data inside workerd. `research-codebase` found no existing GROUP BY and no existing FK-existence helper in the Worker, and no existing error-code validator (so `validateLifeAreaName` returning a code is a new, narrow convention).
- **Copy language:** the new route's and helper's error strings are pt-BR with the field in parentheses, following `src/worker/routes/series.ts` and the regression guard in `test/series.test.ts` (ADR-0009); code, identifiers and comments stay English.
- **`lifeAreaId=none`** is a reserved filter value, safe because area ids are `crypto.randomUUID()`; a test that inserts a row directly with the id `none` would collide with it and should not.
- **Docs sync:** only `docs/api-reference.md` is amended here; `docs/context/architecture.md` ("Not built yet … Life Area endpoints"), the area docs, the glossary, `domain-model.md`, FR-008 and the layout standard are phase 4 per the PRD (AC-25) or the post-merge docs update.
- Chore C6 (the restore drill on a snapshot with real areas, AC-18) is a phase 4 deliverable and independent of this phase's code.

*Generated: 2026-10-11*
*Approved: 2026-10-12*
*Implemented: 2026-10-12*
*Status: IMPLEMENTED*
