# Feature: Events API, export and search (Phase 2 of events-and-day-view)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test, implement and review stages consume); domain rules for events (a new entity's API, its provenance, its time model and its search); impact on shared contracts (new exports and types in `src/shared/api.ts`, a widened export envelope, a new optional parameter pair on a shipped route); reusable services (the single repository writer, the shared range module); export and restore (FR-042, ADR-0003's binding safeguard, chore C6); documentation of a public contract (`docs/api-reference.md`)
- Decisions found:
  - ADR-0016 / [2026-10-19] The Event is stored as instants plus a zone, with its content hash on the row and its sync link in a table that outlives it (`EventDto` in epoch seconds; the hash written by ONE repository function, no route computes it; `source` guard; the link table dumped by the export and written by no route)
  - ADR-0007 / [2026-08-04] The Event is born sync-aware; dirty is `content_hash <> synced_content_hash`; limits L1-L3 (no change-log, no tombstone table, no queue of our own)
  - ADR-0003 / [2026-08-03] One Worker, D1, no sync engine; export of 100% of the data is a binding safeguard and every `/api/*` route needs the token
  - ADR-0006 / [2026-08-03] Recurrence is unit 17; `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay unchanged
  - ADR-0008 / [2026-08-04] Test-first: the test pair derives the suite from the ACs before the Implementer runs
  - ADR-0009 / [2026-08-18] Visible copy and API error text in pt-BR with the field in parentheses; code, identifiers, comments and tests in English; ADR-0001 for every other artifact
  - [2026-09-10] The due-Reminder sweep claims before it sends (the cron is untouched by this phase)
  - PRD events-and-day-view D-E (time storage), D-F (wire in seconds, Google DTO untouched), D-G (content hash), D-H (link table), D-I (provenance), D-M (search), D-N (export), D-O (Google window), D-R (fixture drill in phase 2)
- Applicable anti-patterns:
  - Using `updated_at` as the sync dirty flag (the repository writes `content_hash`; `updated_at` is bookkeeping only)
  - CRDT or custom sync engines / field-level merge of Events / treating absence as deletion (the link table is provider identity only: no route writes it, nothing here syncs)
  - Mirroring Tasks, Reminders or Life Areas to Google (the `.ics` is an export file, not a sync; no `google` row can be created)
  - Hand-duplicated entity types (`EventDto` lives once in `src/shared/api.ts`, mapped once in `src/worker/dto.ts`)
  - Glossary synonym drift (Event in code, API and docs; *Compromisso* only as pt-BR copy)
  - Portuguese in artifacts (the ADR-0009 carve-out covers only the string VALUES of API error text; identifiers, comments and tests stay English)
  - Editing accepted ADRs; Weakening tests to force green (the export tests are updated by the test pair, never loosened)
- Applicable architectural rules:
  - One Worker serves everything; the new router is mounted below `app.use("/api/*", requireToken)`
  - Types flow `src/worker/db/schema.ts` -> `src/worker/dto.ts` -> `src/shared/api.ts`; `src/shared/` carries no DOM or Worker globals and reads no clock
  - The export completeness guard fails if a table is in neither list; both event tables are already classified, and the dump, envelope and `.ics` now emit them
  - No migration in this phase; `0000`-`0007` untouched; `scheduled()` untouched
  - `src/shared/dates.ts`, `recurrence.ts` and `adherence.ts` stay byte-identical; the shipped `CalendarEventDto` (milliseconds) is not touched
  - Unit 14 creates only `local` Events; `GET /api/tasks` and the default Google window are frozen contracts
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/events-and-day-view.prd.md` — Implementation Phases row 2: "Events API, export and search" — Goal: the owner's commitments can be created, read, changed, deleted, searched and taken away — Success signal: AC-9..AC-21 green; `GET /api/tasks` and the default Google window unchanged.

## Summary

This phase puts a bearer-gated HTTP surface and an export on top of the phase-1 Event foundation. A single repository module, `src/worker/event-repository.ts`, becomes the ONLY writer of the `events` table (and the only place that computes `content_hash`, sets timestamps or reads `event_sync_links`); `src/worker/routes/events.ts` calls it for `POST`, `GET` (a bounded `from`/`to` range of at most 62 days, or `q` search), `PATCH` and `DELETE /api/events`, validating by hand in the style of `life-areas.ts` and delegating every Event rule to the phase-1 `validateEventInput`. The wire types (`EventDto` in epoch seconds, `EventSyncLinkDto`, `CreateEventInput`, `UpdateEventInput`, `EDITABLE_EVENT_FIELDS`) are added to `src/shared/api.ts` and mapped once in `src/worker/dto.ts`. A new pure module `src/shared/event-range.ts` validates day ranges and turns them into owner-zone instants, and is shared by the events route (62 days) and by the Google read route, which gains optional `from`/`to` (31 days) while its 7-day default stays byte-identical. The export dump gains `events` and `event_sync_links` (`formatVersion` stays 1), `buildTasksIcs` gains an optional events input that emits timed UTC and all-day `VEVENT`s, `docs/api-reference.md` documents the contract, and the restore drill is run on a fixture built through the real routes and recorded. Seventeen tasks across sixteen files (fourteen source or documentation files and two report files); no migration, no schema change, no UI, no cron change.

## User Story

As the owner of Praesto Sum
I want my commitments to be created, read by day, changed, deleted, searched and exported through the API
So that the day view and the sheet can be built on it, and I can always take 100% of my data away, commitments included.

## Problem Statement

Praesto cannot hold a commitment of its own. After phase 1 the Event exists as validated, hashable data in a schema that carries what unit 15 needs, but no code path creates an Event row, no route serves it, the export dump still hard-codes five tables (`src/shared/export.ts`, `src/worker/routes/export.ts`), the `.ics` holds only dated Tasks, and the Google read route fetches a fixed 7-day window that a day screen for another date cannot use. This phase supplies the API, the export and the search.

## Solution Statement

Repository first, routes second, export third. One module owns every write and every read of the link table, so AC-16 is checkable by inspecting two things: `src/worker/routes/` contains no hash computation and no link-table reference, and no `src/` file outside the repository writes `events`. The routes keep their validation by hand and let the shared pure core decide what a valid Event is, so the sheet in phase 4 cannot drift from the server. Range handling lives in a pure shared module so the events route and the Google route cannot disagree about what a span is. The export grows by adding keys only, which is why `formatVersion` stays 1, and the restore drill is run, not modified, because it is table-agnostic.

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | HIGH |
| Systems Affected | `src/shared/` (api.ts, new event-range.ts, export.ts, ics.ts), `src/worker/` (dto.ts, new event-repository.ts, new event-messages.ts, index.ts, routes/events.ts, routes/google.ts, routes/export.ts, routes/export-ics.ts, db/export-manifest.ts comment), `docs/api-reference.md`, `PRPs/reports/events-and-day-view/` |
| Dependencies | none new: Web Crypto, `Intl`, drizzle-orm@0.45.2 and hono@4.12.34 as already pinned |
| Estimated Tasks | 17 |
| Source PRD line ref | `PRPs/prds/events-and-day-view.prd.md` Implementation Phases row 2 (line 211); AC-9..AC-21 (lines 78-90), plus AC-33 and AC-34 in part; D-E, D-F, D-G, D-H, D-I, D-M, D-N, D-O, D-R |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/events-and-day-view.prd.md` | 78-90, 175-186, 223-226, 253-263 | AC-9..AC-21, the Architecture Notes (schema, time model, repository, wire, routes, Google route, export, restore), the Phase 2 details and decisions D-E..D-O |
| P0 | `documentation/60-decisions/ADR-0016-event-storage-model-sync-aware.md` | 19-26 | The six decisions this phase implements: hash written by one repository function, link outlives the Event, `source` guard, wire in seconds |
| P0 | `src/shared/events.ts` | 78-112, 218-222, 285-373 | The error vocabulary (`EventField`, `EventErrorCode`, `EventResult`), `EVENT_DEFAULT_TIMEZONE`, `resolveEventTimes` and `validateEventInput` (first failure in a fixed order; the route must typeof-check the JSON body before calling it) |
| P0 | `src/shared/event-hash.ts` | 42-76 | `EventHashInput` and `computeEventContentHash`; `ResolvedEvent` is structurally assignable to it |
| P0 | `src/worker/db/schema.ts` | 440-516 | The `events` and `event_sync_links` columns (timestamp-mode integers read as `Date`, no SQL default on `all_day`, `timezone`, `content_hash`), the named CHECKs and the row types |
| P0 | `src/worker/routes/life-areas.ts` | 1-240 | The route shape to copy: local `readJson`, allowlist, pt-BR `{ error }` bodies with the field in parentheses, `201`/`204`/`404` conventions |
| P0 | `src/worker/routes/tasks.ts` | 64-162 | Pre-database query parsing, `buildSearchClauses` use and clause composition for the list route |
| P0 | `src/shared/api.ts` | 91-126, 195-241, 260-296 | The Life Area wire types and `EDITABLE_*_FIELDS` idiom, the Google DTO (milliseconds, NOT touched), and the absent-versus-null contract of `UpdateTaskInput` |
| P0 | `src/worker/dto.ts` | 26-81 | The field-by-field mapping idiom and the private `toEpochSeconds` |
| P0 | `src/shared/export.ts` | 16-72 | `ExportTables`, `ExportEnvelope` and `buildExportEnvelope`, the five-table spots to widen |
| P0 | `src/worker/routes/export.ts` | 21-64 | The dump route: five selects, five mappers, the stale "five tables" comment |
| P0 | `src/shared/ics.ts` | 15-118 | `escapeIcsText`, `formatDtstamp`, `foldContentLine` and `buildTasksIcs`, the module that gains event `VEVENT`s |
| P0 | `src/worker/routes/google.ts` | 137-138, 262-289 | `WINDOW_DAYS`, the token-first `GET /events` and the response shape that must stay identical by default |
| P0 | `src/shared/google-events.ts` | 101-130 | `eventWindow(today, days)`: `timeMax` is the start of day `days + 1`, so `days = 7` covers eight local days |
| P1 | `src/shared/search.ts` | 125-180 | `shouldSearch`, `validateSearchQuery` (rejects only blank and over-100) and `buildSearchClauses` |
| P1 | `test/task-list-search.test.ts` | 238-283 | Shipped `q` behaviour: `?q=_` answers 200 with `[]`, only blank and over-100 are 400; the basis for the AC-17 decision in Notes |
| P1 | `src/shared/dates.ts` | 22-37, 55-94 | `PRAESTO_TIMEZONE`, `todayIn`, `offsetMinutesAt` (used for the owner-zone offset in the search order) |
| P1 | `src/worker/life-area-check.ts` | 1-41 | A flat `src/worker/` helper taking `db: Db`, the shape the repository follows |
| P1 | `src/worker/index.ts` | 23-38 | Where the router mounts, below the bearer gate |
| P1 | `src/worker/db/export-manifest.ts` | 14-29 | Already lists seven tables; its doc comment still says the dump starts emitting them in phase 2 |
| P1 | `scripts/restore-drill.mjs` | 63-142 | Table-agnostic rebuild and per-row comparison; the exact output lines the Task 16 checks match |
| P1 | `scripts/pull-export-snapshot.mjs` | 32-45 | The `PRAESTO_EXPORT_BASE_URL`, `PRAESTO_TOKEN_FILE` and `PRAESTO_SNAPSHOT_DIR` overrides the fixture run uses |
| P1 | `PRPs/reports/life-areas/c6-restore-drill.md` | 9-34 | The recipe and the record shape of a fixture drill through the real routes |
| P1 | `scripts/check-mirror-inventory.mjs` | 25-67 | The tripwire; its output format grounds Task 17's "no new violation" check |
| P1 | `test/export-envelope.test.ts` | 19-33, 77-102 | `emptyTables()` and the exact five-key assertion the test pair must update (never loosen) |
| P1 | `test/export.test.ts` | 29-48, 64-97 | The route-level harness and the five-table seed the pair extends |
| P1 | `test/isolation.ts` | 147-154 | `resetTaskTables` already wipes both event tables, children first; nothing to change |
| P1 | `docs/api-reference.md` | 5-33, 93 | The conventions and the Implemented table to extend, and the unit 14-18 row |

## Patterns to Mirror

```
# SOURCE: src/worker/routes/life-areas.ts:232-240
async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
```
Copied by Task 6 (the file-local body guard; a parse failure, a non-object and an array all answer 400 `Body must be a JSON object`).

```
# SOURCE: src/worker/routes/life-areas.ts:161-171
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
```
Copied by Tasks 6 and 8 (the closed-allowlist check and the empty-body check; Task 6 applies the same allowlist to `POST`, which is what rejects `id`, `source`, `contentHash` and `createdAt`).

```
# SOURCE: src/worker/routes/life-areas.ts:139-145
  try {
    const [row] = await db
      .insert(lifeAreas)
      .values({ id: crypto.randomUUID(), name: checked.name })
      .returning();
    if (row === undefined) return c.json({ error: "Insert returned no row" }, 500);
    return c.json({ lifeArea: toLifeAreaDto(row) }, 201);
```
Copied by Tasks 5 and 6 (an app-generated UUID, `.returning()`, and the `201 { <entity> }` response; the insert itself lives in the repository, the 500 guard in the route).

```
# SOURCE: src/worker/routes/life-areas.ts:209-217
lifeAreaRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb(c.env);

  const [existing] = await db
    .select({ id: lifeAreas.id })
    .from(lifeAreas)
    .where(eq(lifeAreas.id, id));
  if (existing === undefined) return c.json({ error: AREA_NOT_FOUND_MESSAGE }, 404);
```
Copied by Task 8 (look the row up first, `404` when absent, then `c.body(null, 204)` after the write).

```
# SOURCE: src/worker/routes/tasks.ts:97-105
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
Copied by Task 7 (the same `buildSearchClauses` call over `events.title` and `events.description`; Task 7 adds a `shouldSearch` guard in front of it, see Notes).

```
# SOURCE: src/worker/routes/tasks.ts:151-161
  ].filter((clause) => clause !== undefined);

  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(tasks)
    .where(clauses.length === 0 ? undefined : and(...clauses))
    .orderBy(urgencyBucket, dueDate, desc(tasks.createdAt))
    .limit(limit);

  return c.json({ tasks: rows.map(toTaskDto) });
```
Copied by Task 7 (compose the present clauses with `and(...)`, order in the query, map through the DTO at the boundary).

```
# SOURCE: src/worker/dto.ts:50-52
function toEpochSeconds(value: Date | null): number | null {
  return value === null ? null : Math.floor(value.getTime() / 1000);
}
```
Copied by Task 4 (the private seconds conversion the new mappers reuse in the same file).

```
# SOURCE: src/worker/dto.ts:73-81
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
Copied by Task 4 (every field written out explicitly so schema drift is a compile error).

```
# SOURCE: src/shared/api.ts:91-106
/** `POST /api/life-areas` body. The name is trimmed server-side and must be 1-40 characters. */
export interface CreateLifeAreaInput {
  name: string;
}

/** `PATCH /api/life-areas/:id` body. `name` is the only editable key (renaming keeps the id). */
export interface UpdateLifeAreaInput {
  name?: string;
}

/**
 * The closed set of keys `PATCH /api/life-areas/:id` accepts. `description` stays
 * in the schema and the export but is deliberately not exposed (ADR-0015), so it
 * and the server-owned fields are rejected with 400 rather than silently ignored.
 */
export const EDITABLE_LIFE_AREA_FIELDS: readonly string[] = ["name"];
```
Copied by Task 1 (the Create/Update input pair beside an `EDITABLE_*_FIELDS` constant).

```
# SOURCE: src/shared/api.ts:260-280
/**
 * Partial update of an existing Task.
 *
 * Declared separately from `CreateTaskInput` on purpose: the two mean opposite
 * things by an absent field. On create, absent and cleared are the same thing.
 * On update they are not — an ABSENT key leaves the field exactly as it was,
 * while an explicit `null` clears it. TypeScript cannot express that
 * difference (`{ deadline?: string | null }` is identical either way), so the
 * route enforces it by inspecting the parsed body's own keys; this type
 * describes the contract, it does not police it.
 *
 * `title` is the only field with no `| null`: a Task must always carry one.
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  deadline?: string | null;
  scheduledDate?: string | null;
  priority?: TaskPriority | null;
  lifeAreaId?: string | null;
}
```
Copied by Task 1 (`UpdateEventInput` carries the same absent-versus-null contract; Task 8 enforces it with `Object.hasOwn` on the raw body).

```
# SOURCE: src/worker/life-area-check.ts:24-34
export async function checkLifeAreaId(db: Db, value: unknown): Promise<LifeAreaIdCheck> {
  if (value === undefined || value === null) return { ok: true, lifeAreaId: null };

  if (typeof value !== "string") {
    return { ok: false, error: "A área da vida deve ser texto ou nula (lifeAreaId)" };
  }

  const [found] = await db
    .select({ id: lifeAreas.id })
    .from(lifeAreas)
    .where(eq(lifeAreas.id, value))
```
Copied by Task 5 (a flat `src/worker/` module whose functions take `db: Db`, imported as `import type { Db } from "./db/client"`).

```
# SOURCE: src/shared/events.ts:106-112
/** A validator's outcome: the value, or the first field it refused and why. */
export type EventResult<T> = { ok: true; value: T } | { ok: false; error: EventValidationError };

/** The refusal of `field` for `code`, in the shape every validator below returns. */
function fail(field: EventField, code: EventErrorCode): { ok: false; error: EventValidationError } {
  return { ok: false, error: { field, code } };
}
```
Copied by Task 2 (the `{ ok, ... } | { ok: false, error }` result shape of `validateDayRange`).

```
# SOURCE: src/shared/search.ts:125-134
export const SEARCH_MIN_QUERY_LENGTH = 2;

/**
 * Whether `raw`, after trimming, is long enough to search for (AC-A2). A
 * pure, single-argument, no-DOM predicate, exactly like `normalizeSearchText`
 * above.
 */
export function shouldSearch(raw: string): boolean {
  return raw.trim().length >= SEARCH_MIN_QUERY_LENGTH;
}
```
Read and imported by Task 7 (the existing predicate that makes a one-character `q` a 400 on the events route; `search.ts` is not edited).

```
# SOURCE: src/shared/google-events.ts:119-130
export function eventWindow(
  today: string,
  days: number,
  timeZone: string = PRAESTO_TIMEZONE,
): { timeMin: string; timeMax: string } {
  const last = shiftDay(today, days + 1);

  return {
    timeMin: `${today}T00:00:00${offsetFor(today, timeZone)}`,
    timeMax: `${last}T00:00:00${offsetFor(last, timeZone)}`,
  };
}
```
Reused by Task 10 (called with the validated `from` and `days = (inclusive day count) - 1`, so the window is exactly `from` through `to`; the function is not edited).

```
# SOURCE: src/worker/routes/google.ts:137-138
/** How many days beyond today the window reaches. Owner decision, 2026-08-28. */
const WINDOW_DAYS = 7;
```
and
```
# SOURCE: src/worker/routes/google.ts:262-268
/** FR-027 — the day's real commitments, mapped and narrowed. */
googleRoutes.get("/events", async (c) => {
  const token = await accessTokenFor(c);
  if (!token.ok) return c.json({ error: "unavailable", reason: token.reason }, token.status);

  const window = eventWindow(todayIn(new Date(), PRAESTO_TIMEZONE), WINDOW_DAYS);
  const calendarIds = await selectedCalendarIds(c.env);
```
Copied by Task 10 (the default branch stays exactly this expression; the new parameter parsing is inserted BEFORE the token call and only replaces `window` when `from` or `to` is present).

```
# SOURCE: src/shared/export.ts:16-23
/** The five data-bearing tables, already mapped through `dto.ts`. */
export interface ExportTables {
  lifeAreas: LifeAreaDto[];
  recurrenceSeries: RecurrenceSeriesDto[];
  tasks: TaskDto[];
  reminders: ReminderDto[];
  googleCalendarSelections: GoogleCalendarSelectionDto[];
}
```
and
```
# SOURCE: src/shared/export.ts:54-72
export function buildExportEnvelope(
  now: Date,
  tables: ExportTables,
  excluded: readonly ExcludedTableEntry[],
): ExportEnvelope {
  return {
    formatVersion: 1,
    generatedAt: Math.floor(now.getTime() / 1000),
    timezone: PRAESTO_TIMEZONE,
    excludedTables: excluded,
    tables: {
      life_areas: tables.lifeAreas,
      recurrence_series: tables.recurrenceSeries,
      tasks: tables.tasks,
      reminders: tables.reminders,
      google_calendar_selections: tables.googleCalendarSelections,
    },
  };
}
```
Copied by Task 11 (two more keys appended in the interface, in the `ExportEnvelope.tables` type and in this literal; `formatVersion` stays the literal `1`).

```
# SOURCE: src/worker/routes/export.ts:32-55
exportRoutes.get("/", async (c) => {
  const db = createDb(c.env);

  const [lifeAreaRows, recurrenceSeriesRows, taskRows, reminderRows, googleCalendarSelectionRows] =
    await Promise.all([
      db.select().from(lifeAreas),
      db.select().from(recurrenceSeries),
      db.select().from(tasks),
      db.select().from(reminders),
      db.select().from(googleCalendarSelections),
    ]);

  const now = new Date();
  const envelope = buildExportEnvelope(
    now,
    {
      lifeAreas: lifeAreaRows.map(toLifeAreaDto),
      recurrenceSeries: recurrenceSeriesRows.map(toRecurrenceSeriesDto),
      tasks: taskRows.map(toTaskDto),
      reminders: reminderRows.map(toReminderDto),
      googleCalendarSelections: googleCalendarSelectionRows.map(toGoogleCalendarSelectionDto),
    },
    EXCLUDED_TABLES,
  );
```
Copied by Task 11 (add two repository reads to the `Promise.all` and two mapped keys; the route imports neither `events` nor the link table).

```
# SOURCE: src/shared/ics.ts:24-30
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}
```
and
```
# SOURCE: src/shared/ics.ts:35-40
function formatDtstamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
```
Reused by Task 13 (SUMMARY, DESCRIPTION and LOCATION go through `escapeIcsText`; an instant becomes `YYYYMMDDTHHMMSSZ` through `formatDtstamp(new Date(seconds * 1000))`).

```
# SOURCE: src/shared/ics.ts:90-118
export function buildTasksIcs(now: Date, tasks: TaskDto[]): string {
  const dtstamp = formatDtstamp(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
  ];

  for (const task of tasks) {
    const date = task.deadline ?? task.scheduledDate;
    if (date === null) continue;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@praesto.local`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`,
      `SUMMARY:${escapeIcsText(task.title)}`,
      `COMMENT:${escapeIcsText(TODO_COMMENT)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldContentLine).join("\r\n") + "\r\n";
}
```
Copied by Task 13 (a third optional parameter and a second loop after the Task loop; the Task loop and its output stay byte-identical).

```
# SOURCE: src/worker/routes/export-ics.ts:19-34
icsRoutes.get("/", async (c) => {
  const db = createDb(c.env);

  const taskRows = await db.select().from(tasks);

  const now = new Date();
  const ics = buildTasksIcs(now, taskRows.map(toTaskDto));

  const filename = `praesto-${todayIn(now)}.ics`;
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
```
Copied by Task 14 (read the events through the repository and pass them as the third argument).

```
# SOURCE: src/worker/index.ts:28-38
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/reminders", reminderRoutes);
app.route("/api/series", seriesRoutes);
app.route("/api/life-areas", lifeAreaRoutes);
app.route("/api/google", googleRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/export.ics", icsRoutes);
app.route("/api/push-spike", pushSpikeRoutes);
app.route("/api/push", pushRoutes);
app.route("/api/diagnostics", diagnosticsRoutes);
```
Copied by Task 9 (one import beside the others and one `app.route` line, below the `app.use("/api/*", requireToken)` already in the file).

```
# SOURCE: src/worker/db/export-manifest.ts:14-29
/**
 * The seven data-bearing tables, dumped in full, every row. `events` and
 * `event_sync_links` were classified here in unit 14 (events-and-day-view) phase
 * 1 so the schema-enumerating completeness guard stays green; the dump route, the
 * envelope and the `.ics` start emitting them in phase 2, and no code path can
 * create an Event row before then.
 */
export const EXPORTED_TABLE_NAMES: readonly string[] = [
  "life_areas",
  "recurrence_series",
  "tasks",
  "reminders",
  "google_calendar_selections",
  "events",
  "event_sync_links",
] as const;
```
Copied by Task 12 (only the doc comment changes; the array is read, not edited).

```
# SOURCE: scripts/restore-drill.mjs:86-88
    console.log(
      `  ${table.padEnd(28)} ${String(rows.length).padStart(8)}  ${String(actual).padStart(8)}  ${ok ? "OK" : "MISMATCH"}`,
    );
```
and
```
# SOURCE: scripts/restore-drill.mjs:134-136
      console.log(
        `  ${table.padEnd(28)} ${String(checked).padStart(4)} rows, every field identical  OK`,
      );
```
Read by Task 16 and Level 3 (the verbatim output lines their patterns match; the script is run, not edited).

```
# SOURCE: scripts/pull-export-snapshot.mjs:37-40
const BASE_URL = process.env.PRAESTO_EXPORT_BASE_URL ?? "https://praesto.fabiobarreto.workers.dev";
const TOKEN_FILE =
  process.env.PRAESTO_TOKEN_FILE ?? join(homedir(), ".praesto", "export-token.txt");
const SNAPSHOT_DIR = process.env.PRAESTO_SNAPSHOT_DIR ?? join(homedir(), "praesto-snapshots");
```
Read by Task 16 and Level 3 (the three environment overrides that point the pull at the local worker and a scratch directory, away from production and from `~/praesto-snapshots`).

```
# SOURCE: scripts/check-mirror-inventory.mjs:62-65
if (violations.length > 0) {
  console.error("FAIL: mirror-inventory fields read outside the sanctioned presence test:");
  violations.forEach((v) => console.error("  " + v));
  process.exit(1);
```
Read by Task 17 (violation lines are printed indented by two spaces as `  src/<path>:<line>: <code>`; the check filters on that shape and tolerates the two known baseline lines).

```
# SOURCE: PRPs/reports/life-areas/c6-restore-drill.md:9-15
## SYNTHETIC FIXTURE RUN

**This is not the owner's data and it is not PRD AC-18.** Every row below was produced through the
real routes of a LOCAL worker (`vite dev`: real workerd, local D1, the dev bearer token from
`.dev.vars`), by a throwaway script kept outside the repository. There is no production token in
this session, production holds no Life Area (unit 13 is not deployed), and nothing here contacted
production or used `--remote`.
```
Copied by Task 16 (the honest framing of a fixture record: what it is, what it is not, counts and hashes only).

```
# SOURCE: docs/api-reference.md:22
| DELETE | `/api/tasks/:id` | 204, or 404 when absent |
```
Copied by Task 15 (the Implemented table's row shape: method, route, behavior).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/api.ts` | UPDATE | `EventDto`, `EventSyncLinkDto`, `CreateEventInput`, `UpdateEventInput`, `EDITABLE_EVENT_FIELDS`, `EventsResponse`, `EventResponse`, `MAX_EVENT_SEARCH_RESULTS` (AC-A1..AC-A5, AC-A9, AC-A11) |
| `src/shared/event-range.ts` | CREATE | Pure day-range validation and owner-zone instants, shared by the events route (62 days) and the Google route (31 days) (AC-A3, AC-A10) |
| `src/worker/event-messages.ts` | CREATE | pt-BR API error text for Event validation codes and range codes, each ending with the field in parentheses (AC-A2, AC-A3, AC-A10) |
| `src/worker/dto.ts` | UPDATE | `toEventDto` and `toEventSyncLinkDto`, the one mapping point to the wire in seconds (AC-A1, AC-A11) |
| `src/worker/event-repository.ts` | CREATE | The only writer of `events`; computes `content_hash`, sets timestamps; the only code that reads `event_sync_links` (AC-A8, AC-A1, AC-A4, AC-A5, AC-A11) |
| `src/worker/routes/events.ts` | CREATE | `POST`, `GET`, `PATCH`, `DELETE /api/events` with hand validation, the allowlist, range and `q` (AC-A1..AC-A9) |
| `src/worker/index.ts` | UPDATE | Mount the router below the bearer gate (AC-A7) |
| `src/worker/routes/google.ts` | UPDATE | Optional `from`/`to` on `GET /events`, 31-day cap, default window unchanged (AC-A10) |
| `src/shared/export.ts` | UPDATE | `ExportTables` and the envelope carry `events` and `event_sync_links`; `formatVersion` stays 1 (AC-A11) |
| `src/worker/routes/export.ts` | UPDATE | The dump reads and maps both tables through the repository; stale "five tables" comment fixed (AC-A11) |
| `src/worker/db/export-manifest.ts` | UPDATE | Doc comment only: the dump now emits both tables (AC-A11) |
| `src/shared/ics.ts` | UPDATE | Optional events input: timed UTC `VEVENT`s and all-day `VALUE=DATE` `VEVENT`s with exclusive `DTEND` (AC-A12) |
| `src/worker/routes/export-ics.ts` | UPDATE | Pass the stored events to the serializer (AC-A12) |
| `docs/api-reference.md` | UPDATE | Document `/api/events`, the Google `from`/`to` window and the widened export (AC-A15) |
| `PRPs/reports/events-and-day-view/c6-restore-drill.md` | CREATE | The recorded fixture restore drill (AC-A13) |
| `PRPs/reports/events-and-day-view/c6-drill-output.txt` | CREATE | The drill's own unedited output (AC-A13) |

## NOT Building (Scope Limits)

- Any change to the schema, the migrations (`0000`-`0007`), `src/shared/events.ts`, `src/shared/event-hash.ts` or `test/isolation.ts`: phase 1 owns them and this phase needs nothing from them beyond what they export today.
- `itemsInRange`, the `local` `DayItem` variant, the exhaustive `bucketOf` switch, the `/day` route, `DayScreen` and the Agenda change (phase 3).
- The draft/patch builders, `CompromissoSheet`, the *Compromissos* search group, client wrappers in `src/app/api.ts` and every UI string (phase 4). This phase has no UI, so the UI/UX checklist does not apply.
- Release `v0.14.0`, chore C6 on a real snapshot, the remote migration apply, the device proof, the glossary, the layout standard, `architecture-overview.md`, `docs/context/architecture.md` and the rest of AC-34 (phase 5). Only `docs/api-reference.md` is documented here, per the PRD phase table.
- Writing to Google or storing Google events in D1 (unit 15): no route writes `event_sync_links`, and `POST` can only create `local` rows.
- Guests, Meet links, colour, busy/free, visibility, attachments, reminders on Events, recurrence and exceptions, Task-Event links and a Life Area on Events (the PRD's "What We're NOT Building").
- Searching Google events or an Event's location, and any change to `src/shared/search.ts` (`buildSearchClauses` is reused unchanged).
- Any change to the shipped Google DTO (`CalendarEventDto`, milliseconds), to `GET /api/tasks` or to `src/worker/routes/tasks.ts`.
- "Fixing" `scripts/check-mirror-inventory.mjs`'s two pre-existing violations (`src/app/api.ts` `return body.reminders` and `src/shared/export.ts` `reminders: tables.reminders`): that is phase 5 (AC-33).
- Authoring or editing any `*.test.ts` file or `vitest.config.ts`: the test pair owns them (see Notes).

## Step-by-Step Tasks

### Task 1: UPDATE src/shared/api.ts — the Event wire types

- **ACTION**: Add, next to the other entity DTOs and without touching `EventMoment`, `CalendarEventDto` or `GoogleEventsDto`, these exports. `interface EventDto { id: string; title: string; description: string | null; location: string | null; allDay: boolean; startAt: number | null; endAt: number | null; startDate: string | null; endDate: string | null; timezone: string; source: "local" | "google"; contentHash: string; createdAt: number; updatedAt: number }` with a doc comment saying instants are epoch SECONDS (the Google DTO's milliseconds are a separate type), `startAt`/`endAt` are null for an all-day Event, `startDate`/`endDate` are local days with an EXCLUSIVE end for an all-day Event and null for a timed one, and that it mirrors `EventRow` field for field. `interface EventSyncLinkDto { id: string; eventId: string | null; calendarId: string; externalEventId: string; etag: string | null; syncedContentHash: string | null; syncedAt: number | null }` (export only; no route returns it). `interface CreateEventInput { title: string; description?: string | null; location?: string | null; allDay?: boolean; startAt?: number | null; endAt?: number | null; startDate?: string | null; endDate?: string | null; timezone?: string | null }` and `interface UpdateEventInput` with the same keys all optional (`title?: string` with no `| null`), documented with the absent-versus-null contract copied from `UpdateTaskInput` (an ABSENT key leaves the field, an explicit `null` clears it or lets the shared validator fill its default, enforced by the route with `Object.hasOwn`). `const EDITABLE_EVENT_FIELDS: readonly string[] = ["title", "description", "location", "allDay", "startAt", "endAt", "startDate", "endDate", "timezone"]` with a comment that it is the closed set of body keys BOTH `POST` and `PATCH` accept, so `id`, `source`, `contentHash`, `createdAt`, `updatedAt` and a typo are rejected with 400 rather than ignored. `interface EventsResponse { events: EventDto[] }` and `interface EventResponse { event: EventDto }`. `const MAX_EVENT_SEARCH_RESULTS = 100` with a comment that it caps a `q`-only search (no range). Do not import anything: `api.ts` stays free of runtime dependencies. Infrastructure task: delivers no criterion by itself; it supports AC-A1..AC-A5, AC-A9 and AC-A11 (the wire types every later task uses).
- **MIRROR**: `# SOURCE: src/shared/api.ts:91-106` and `# SOURCE: src/shared/api.ts:260-280` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json; node -e "import('./src/shared/api.ts').then((m) => { const want = ['title','description','location','allDay','startAt','endAt','startDate','endDate','timezone']; if (JSON.stringify(m.EDITABLE_EVENT_FIELDS) !== JSON.stringify(want) || m.MAX_EVENT_SEARCH_RESULTS !== 100) { console.error('event wire constants wrong', m.EDITABLE_EVENT_FIELDS, m.MAX_EVENT_SEARCH_RESULTS); process.exit(1); } })"` (type-checks both targets that compile `src/shared/`, then loads the real module through Node's built-in type stripping; `api.ts` has no runtime import, so Node can resolve it)

### Task 2: CREATE src/shared/event-range.ts — day-range validation and owner-zone instants

- **ACTION**: Create a pure, clock-free module whose only imports are `./events` and `./dates` (header comment: no DOM, no Worker, no Drizzle; used by the events route and the Google route). Export `EVENT_RANGE_MAX_DAYS = 62` and `GOOGLE_RANGE_MAX_DAYS = 31`; `type DayRangeParam = "from" | "to"`; `type DayRangeErrorCode = "required" | "invalid_date" | "to_before_from" | "too_long"`; `interface DayRangeError { param: DayRangeParam; code: DayRangeErrorCode }`; `type DayRangeResult = { ok: true; from: string; to: string; days: number } | { ok: false; error: DayRangeError }` (the same shape idiom as `EventResult`); `validateDayRange(from: string | undefined, to: string | undefined, maxDays: number): DayRangeResult` and `dayRangeInstants(from: string, to: string, timeZone?: string): { startAt: number; endAt: number }`. `validateDayRange` returns the FIRST failure in this fixed order: `from` undefined is `{ param: "from", code: "required" }`; `from` that fails `isValidLocalDay` is `{ param: "from", code: "invalid_date" }`; `to` undefined is `{ param: "to", code: "required" }`; `to` that fails `isValidLocalDay` is `{ param: "to", code: "invalid_date" }`; `to` before `from` (string comparison of valid days) is `{ param: "to", code: "to_before_from" }`; and `days > maxDays` is `{ param: "to", code: "too_long" }`, where `days` is the INCLUSIVE count of calendar days, `((Date.UTC(to) - Date.UTC(from)) / 86_400_000) + 1` computed from the parsed year, month and day (so `from = to` is 1 day, `2026-10-20` to `2026-12-20` is 62 days and is accepted, `2026-12-21` is 63 and is refused). On success it returns `{ ok: true, from, to, days }`. `dayRangeInstants` returns the half-open interval `[startAt, endAt)` in epoch seconds: `startAt = wallClockToInstant(from, "00:00", timeZone)` and `endAt = wallClockToInstant(shiftLocalDay(to, 1), "00:00", timeZone)`, with `timeZone` defaulting to `EVENT_DEFAULT_TIMEZONE`; both come from `./events`, so the RFC 5545 gap rule applies at a day boundary too. No function reads a clock. Delivers the range part of AC-A3 (PRD AC-11: `from`/`to` required together, `to` not before `from`, a non-date refused, a span over 62 days refused, each naming the parameter) and the window validation of AC-A10 (PRD AC-18: a span over 31 days or `to` before `from` refused).
- **MIRROR**: `# SOURCE: src/shared/events.ts:106-112` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json; if grep -vE '^[[:space:]]*(//|/\*|\*)' src/shared/event-range.ts | grep -nE 'Date\.now\(|new Date\(\)|performance\.now|from "hono|from "drizzle-orm|cloudflare:'; then echo "FAIL: impure or environment-bound construct in event-range.ts"; exit 1; else echo "PASS: event-range.ts is pure"; fi; test -z "$(grep -hE '^import ' src/shared/event-range.ts | grep -vE 'from "\./(events|dates)"' || true)"` (type-checks both compile targets, rejects a clock read or an environment import, and proves the only imports are the two same-directory siblings; the span and boundary behaviour is proved by the pair-authored suite in Level 2, because Node cannot resolve the module's extensionless imports)

### Task 3: CREATE src/worker/event-messages.ts — pt-BR API error text

- **ACTION**: Create the module with two pure exports and no other logic. `eventProblemMessage(error: EventValidationError): string` maps every `{ field, code }` the phase-1 validator can return (types imported from `../shared/events`) to a pt-BR sentence that ENDS with the field in parentheses, using the exact field key (`(title)`, `(startAt)`, `(endDate)`, `(timezone)` and so on): `blank` (`O título não pode ficar em branco (title)`), `too_long` (names the limit from `EVENT_TITLE_MAX`, `EVENT_DESCRIPTION_MAX` or `EVENT_LOCATION_MAX` for the field), `required` (the field must be informed), `not_allowed` (the field does not apply to this kind of Event; used when a timed Event carries days or an all-day Event carries instants), `invalid_date` (the value is not a valid instant or day), `unknown_zone` (`Fuso horário desconhecido (timezone)`), `end_before_start` (`O fim não pode ser antes do início (endAt)`) and `end_not_after_start` (`O fim deve ser depois do início (endDate)`). Export a second function `eventTypeMessage(field: EventField): string` for the route's own typeof failures (`Informe um texto válido (title)`-style, one sentence per field kind: text, boolean, whole number of seconds, local day). `dayRangeProblemMessage(error: DayRangeError): string` (type from `../shared/event-range`) covers `required` (`Informe a data inicial (from)` or `Informe a data final (to)`), `invalid_date` (`A data deve estar no formato AAAA-MM-DD (from)`-style), `to_before_from` (`A data final não pode ser anterior à inicial (to)`) and `too_long` (the span exceeds the maximum; the message must not hard-code 62 or 31, so it takes no limit and says the period is longer than allowed `(to)`). Wording beyond the field-in-parentheses ending is not pinned by any criterion; keep each code's sentence distinct. ADR-0009 applies: the string VALUES are pt-BR, every identifier and comment is English. Infrastructure task: delivers no criterion by itself; it supports AC-A2, AC-A3 and AC-A10 (the "400 naming the field or parameter" half).
- **MIRROR**: `# SOURCE: src/worker/life-area-check.ts:24-34` (Patterns to Mirror) for the flat `src/worker/` module style and the pt-BR-with-field-in-parentheses messages.
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; test -f src/worker/event-messages.ts; if grep -nE 'import .*(hono|drizzle-orm|\./db/)' src/worker/event-messages.ts; then echo "FAIL: event-messages.ts must stay pure text mapping"; exit 1; else echo "PASS: event-messages.ts imports no framework or database module"; fi` (the type check proves every `EventField` and `EventErrorCode` branch compiles against the real unions; the wording is exercised end to end by the route suites in Level 2)

### Task 4: UPDATE src/worker/dto.ts — the Event mappers

- **ACTION**: Extend the two existing import blocks with `EventDto` and `EventSyncLinkDto` (from `../shared/api`) and `EventRow` and `EventSyncLink` (from `./db/schema`). Add `toEventDto(row: EventRow): EventDto` writing all fourteen fields out explicitly in the same order as the interface, with `startAt` and `endAt` through `toEpochSeconds(row.startAt)` and `toEpochSeconds(row.endAt)` (they stay `null` for an all-day row), `createdAt` and `updatedAt` through `toEpochSeconds(...) ?? 0`, and `allDay`, `source` and `contentHash` copied as they are. Add `toEventSyncLinkDto(row: EventSyncLink): EventSyncLinkDto` the same way (`syncedAt` through `toEpochSeconds(row.syncedAt)`, `eventId` copied, `null` for an orphan). Both carry a doc comment in the style of `toLifeAreaDto`. Do not change any existing mapper and do not export `toEpochSeconds`. Delivers the response shape of AC-A1 (PRD AC-9: epoch-second `createdAt` and `updatedAt`, `startDate`, `endDate` and `description` null for a timed Event with no description) and the dump shape of AC-A11 (PRD AC-19: the event field for field including `contentHash` and `allDay`).
- **MIRROR**: `# SOURCE: src/worker/dto.ts:50-52` and `# SOURCE: src/worker/dto.ts:73-81` (Patterns to Mirror).
- **VALIDATE**: `` set -euo pipefail; npx tsc -p tsconfig.worker.json; node -e "import('./src/worker/dto.ts').then((m) => { const at = (s) => new Date(s * 1000); const row = { id: 'e1', title: 'Dentista', description: null, location: 'L', allDay: false, startAt: at(1792499400), endAt: at(1792503000), startDate: null, endDate: null, timezone: 'America/Sao_Paulo', source: 'local', contentHash: 'h', createdAt: at(1000), updatedAt: at(2000) }; const dto = m.toEventDto(row); const keys = Object.keys(dto).sort().join(','); const want = ['allDay','contentHash','createdAt','description','endAt','endDate','id','location','source','startAt','startDate','timezone','title','updatedAt'].join(','); const link = m.toEventSyncLinkDto({ id: 'l1', eventId: null, calendarId: 'c1', externalEventId: 'x1', etag: null, syncedContentHash: null, syncedAt: at(3000) }); if (keys !== want || dto.startAt !== 1792499400 || dto.endAt !== 1792503000 || dto.createdAt !== 1000 || dto.updatedAt !== 2000 || dto.startDate !== null || dto.allDay !== false || link.syncedAt !== 3000 || link.eventId !== null || link.externalEventId !== 'x1') { console.error('event dto mapping wrong', dto, link); process.exit(1); } })" `` (type-checks the worker target, then runs the real mappers on a hand-built row: epoch seconds on the way out, fourteen exact keys, an orphan link; `dto.ts` has only type imports, so Node can load it)

### Task 5: CREATE src/worker/event-repository.ts — the only writer of `events`

- **ACTION**: Create the module (`import type { Db } from "./db/client"`, `eq` from `drizzle-orm`, `events` and `eventSyncLinks` plus the `EventRow` and `EventSyncLink` types from `./db/schema`, `computeEventContentHash` from `../shared/event-hash`, `type ResolvedEvent` from `../shared/events`). Header comment: this module is the ONLY place in `src/` that inserts, updates or deletes `events`, the ONLY place that computes `content_hash` (ADR-0016 decision 2), and the ONLY place that reads `event_sync_links`; routes call it and never the other way round; no function here writes the link table. Export, with these exact names and signatures: `findEventById(db: Db, id: string): Promise<EventRow | undefined>`; `createEvent(db: Db, event: ResolvedEvent): Promise<EventRow>`, which takes only an already-validated event, generates `crypto.randomUUID()`, computes `contentHash = await computeEventContentHash(event)`, sets `createdAt` and `updatedAt` to one `new Date()`, ALWAYS writes `source: "local"` (the function has no `source` parameter, so no caller can create a `google` row), converts `startAt` and `endAt` from epoch seconds to `Date` (`new Date(seconds * 1000)`, `null` stays `null`), writes every column explicitly (`allDay`, `timezone` and `contentHash` have no SQL default) and returns the inserted row from `.returning()`, throwing when it returns none; `updateEvent(db: Db, id: string, event: ResolvedEvent): Promise<EventRow | undefined>`, which recomputes the hash from the NEW resolved fields, sets every authored column (so a timed-to-all-day conversion writes the instants as `null` and the days as values) plus `contentHash` and `updatedAt: new Date()`, never writes `source`, `id` or `createdAt`, and returns the row or `undefined` when the id matches nothing; `deleteEvent(db: Db, id: string): Promise<boolean>` (true when a row was deleted, via `.returning({ id: events.id })`); `listAllEvents(db: Db): Promise<EventRow[]>` and `listAllEventSyncLinks(db: Db): Promise<EventSyncLink[]>`, plain reads for the export dump and the `.ics` (the export and `.ics` routes call these so no file under `src/worker/routes/` references the link table). Do not add a function that writes `event_sync_links`: deleting an Event relies on the table's `ON DELETE SET NULL` foreign key, which phase 1's schema suite already proved in the test database. Delivers AC-A8 (PRD AC-16: one writer; the hash equals the recomputed hash after the create and after each edit) and supplies the stored-row half of AC-A1, AC-A4 and AC-A5.
- **MIRROR**: `# SOURCE: src/worker/life-area-check.ts:24-34` and `# SOURCE: src/worker/routes/life-areas.ts:139-145` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; test -f src/worker/event-repository.ts; grep -qF 'computeEventContentHash(' src/worker/event-repository.ts; if grep -rnE '(insert|update|delete)\(\s*events\s*\)' src | grep -v '^src/worker/event-repository.ts:'; then echo "FAIL: an events write outside the repository"; exit 1; else echo "PASS: only the repository writes events"; fi; if grep -nE '(insert|update|delete)\(\s*eventSyncLinks\s*\)' src/worker/event-repository.ts; then echo "FAIL: the repository must not write the link table"; exit 1; else echo "PASS: the repository never writes event_sync_links"; fi` (type-checks the worker target against the real schema and shared core, proves the hash is computed in this file, and runs the "only writer" inspection over all of `src/` plus the "no link-table write" inspection; the write behaviour is exercised through the routes by the Level 2 suites)

### Task 6: CREATE src/worker/routes/events.ts — scaffold, shared body checks and POST

- **ACTION**: Create `eventRoutes = new Hono<{ Bindings: Env }>()` with a header comment in the style of `life-areas.ts` (mounted below the bearer gate so every route answers 401 before a handler runs; hand validation ahead of the database; closed allowlist; DTO mapping only at the response boundary; pt-BR error text with the field in parentheses, ADR-0009). In this and the two following route tasks DO NOT write any of the tokens `computeEventContentHash`, `eventSyncLinks` or `event_sync_links` anywhere in the file, comments included: the AC-16 inspection greps raw source. Copy `readJson` verbatim (file-local). Add a file-local `checkBody(body)` helper used by `POST` and `PATCH` that (1) rejects the first key not in `EDITABLE_EVENT_FIELDS` with `400 { error: "Campo não editável: <key>" }` (this is what refuses `id`, `source`, `contentHash`, `createdAt`, `updatedAt` and typos on `POST` too), then (2) type-checks each PRESENT key and answers `400` with `eventTypeMessage(field)` on a mismatch: `title` a string, `description` and `location` a string or `null`, `allDay` a boolean, `startAt` and `endAt` a number or `null`, `startDate`, `endDate` and `timezone` a string or `null`. Implement `eventRoutes.post("/")`: `readJson` (null is `400 { error: "Body must be a JSON object" }`), `checkBody`, then `validateEventInput({ title, description, location, allDay: body.allDay ?? false, startAt, endAt, startDate, endDate, timezone })` from `../../shared/events` (absent keys are `undefined`; a missing `title` is `400` naming `title` via `eventProblemMessage`), answering `400 { error: eventProblemMessage(error) }` on the first failure and writing nothing; on success `createEvent(createDb(c.env), resolved)` from `../event-repository`, then `201 { event: toEventDto(row) }` with the `Insert returned no row` 500 guard only if the repository can return none. A `POST` carries no `source`: the repository fixes it to `local`. Delivers AC-A1 (PRD AC-9: `"  Dentista "` is stored `Dentista`, defaults `America/Sao_Paulo`, `source` `local`, an all-day `startDate` alone gets `endDate` the next day, a `startAt` alone gets `endAt` one hour later) and AC-A2 (PRD AC-10: a missing or blank title, an over-long title, `allDay: true` with `startAt`, `allDay: false` without `startAt`, `endAt` before `startAt`, `startDate` `2026-02-30`, an unknown `timezone`, a `source` or `contentHash` key and a body that is not a JSON object are each `400` naming the field, nothing written).
- **MIRROR**: `# SOURCE: src/worker/routes/life-areas.ts:232-240`, `# SOURCE: src/worker/routes/life-areas.ts:161-171` and `# SOURCE: src/worker/routes/life-areas.ts:139-145` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; test -f src/worker/routes/events.ts; if grep -rnE 'computeEventContentHash|eventSyncLinks|event_sync_links' src/worker/routes/; then echo "FAIL: a route computes the hash or references the link table"; exit 1; else echo "PASS: no route computes the hash or references the link table"; fi; if grep -rnE '(insert|update|delete)\(\s*events\s*\)' src/worker/routes/; then echo "FAIL: a route writes events directly"; exit 1; else echo "PASS: routes never write events directly"; fi` (type-checks against the real shared core, repository and mapper, and runs the AC-16 route-inspection half; the route is not yet mounted, so its behaviour is proved by the Level 2 suites after Task 9)

### Task 7: UPDATE src/worker/routes/events.ts — GET by bounded range or q

- **ACTION**: Add `eventRoutes.get("/")`. Parse everything before the database, in this order. (1) `q`: when present, first `if (!shouldSearch(q))` (import `shouldSearch` from `../../shared/search`) answers `400` with a pt-BR sentence ending `(q)` (a blank, whitespace-only or one-character query), then `buildSearchClauses(q, sql\`${events.title}\`, sql\`${events.description}\`)` and, when not ok, `400 { error: result.error }` unchanged (an over-100-character query; the shared helper names `q`). (2) The range: when `from` or `to` is present, `validateDayRange(c.req.query("from"), c.req.query("to"), EVENT_RANGE_MAX_DAYS)` and a failure is `400 { error: dayRangeProblemMessage(error) }` naming the parameter; when neither is present and `q` is absent the answer is `400` with a sentence naming `from`, `to` and `q` (`Informe um período (from e to) ou uma busca (q)`): the API never lists without a bound. With a valid range compute `{ startAt, endAt } = dayRangeInstants(from, to)` and add ONE clause using these exact predicates, written with the `sql` template and plain numbers and strings (raw `sql` compares the stored integer seconds, not `Date`s): timed Events overlap when `events.all_day = 0 and events.start_at < ${endAt} and (events.start_at >= ${startAt} or events.end_at > ${startAt})`, and all-day Events overlap when `events.all_day = 1 and events.start_date <= ${to} and events.end_date > ${from}`, joined with `or` inside one parenthesis. These give the PRD semantics: an Event that ends exactly at the start of the range is outside it, a zero-duration Event inside the range is inside it, a midnight-crossing Event is returned for BOTH days it touches, and an all-day Event with exclusive end `2026-10-28` is returned for `2026-10-27` but not for `2026-10-28`. The `q` clauses and the range clause are ANDed with `and(...)` exactly as the Task list composes its clauses, and an absent parameter leaves its clause out. Ordering: with a range, `.orderBy(desc(events.allDay), asc(events.startDate), asc(events.startAt), asc(events.id))` (all-day first, then by start, then id; the other kind's column is uniformly NULL within each group, so one expression orders both); with `q` and NO range, order by `coalesce(events.start_at, cast(strftime('%s', events.start_date) as integer) - ${ownerOffsetSeconds}) desc, events.id desc` and `.limit(MAX_EVENT_SEARCH_RESULTS)`, where `ownerOffsetSeconds = offsetMinutesAt(new Date(), PRAESTO_TIMEZONE) * 60` (from `../../shared/dates`; this puts an all-day Event at its local midnight so it sorts correctly against timed Events). Answer `200 { events: rows.map(toEventDto) }` typed as `EventsResponse`. Reads go through `createDb(c.env).select().from(events)` here; every WRITE stays in the repository. Same rule as Task 6: none of the tokens `computeEventContentHash`, `eventSyncLinks` or `event_sync_links` may appear in the file. Delivers AC-A3 (PRD AC-11: the five-event fixture returns the first, third and fourth for `2026-10-20` to `2026-10-21`, `2026-10-27` to `2026-10-27` returns the all-day one, a missing `to`, `to` before `from`, a non-date or a span over 62 days is `400` naming the parameter, and neither range nor `q` is `400`) and AC-A9 (PRD AC-17: `q=consulta` returns the two matching Events, `q=CONSULTA dentista` one, `q=reuniao` matches `Reunião`, a one-character `q` is `400`, `q` composes with `from` and `to`, and without a range the match spans all dates, most recent start first, at most 100).
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:97-105`, `# SOURCE: src/worker/routes/tasks.ts:151-161` and `# SOURCE: src/shared/search.ts:125-134` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; if grep -rnE 'computeEventContentHash|eventSyncLinks|event_sync_links' src/worker/routes/; then echo "FAIL: a route computes the hash or references the link table"; exit 1; else echo "PASS: no route computes the hash or references the link table"; fi; grep -qF 'dayRangeInstants(' src/worker/routes/events.ts; grep -qF 'MAX_EVENT_SEARCH_RESULTS' src/worker/routes/events.ts` (type-checks, keeps the AC-16 inspection green, and proves the route uses the shared range helper and the search cap instead of local copies; the overlap and ordering behaviour is proved by the pair-authored route suite in Level 2 and live in Level 3)

### Task 8: UPDATE src/worker/routes/events.ts — PATCH and DELETE with the source guard

- **ACTION**: Add `eventRoutes.patch("/:id")`: `readJson`, then `checkBody`, then `400 { error: "Informe ao menos um campo editável" }` for an empty object (this order puts allowlist and empty-body failures before the lookup, as `life-areas.ts` does), then `findEventById(db, id)` from `../event-repository`, `404 { error: "Compromisso não encontrado" }` when absent, then the source guard: `if (!eventCapabilities(row.source).editable)` answers `409 { error: "Este compromisso vem do Google e não pode ser alterado aqui (source)" }` and writes nothing. Then merge, reading each key with `Object.hasOwn(body, key)` so an ABSENT key keeps the stored value and an explicit `null` clears it (`title`, `allDay` and `timezone` may not be `null`: `400` via `eventTypeMessage`). Take the stored values from `toEventDto(row)` (seconds). `allDay` is the body's value or the stored one, and `kindChanged = allDay !== stored.allDay`. For a TIMED result, `startAt` and `endAt` come from the body when present, else from the stored row when the kind did NOT change, else `null`; `startDate` and `endDate` come from the body when present, else `null`. For an ALL-DAY result, `startDate` and `endDate` come from the body when present, else from the stored row when the kind did not change, else `null`; `startAt` and `endAt` come from the body when present, else `null`. Pass the merged candidate to `validateEventInput` from `../../shared/events` (so a toggle carries only the target shape's fields, a missing end is defaulted by the shared helper, an `endAt` before the start is `end_before_start`, and a field of the other kind is `not_allowed`); a failure is `400 { error: eventProblemMessage(error) }` and the row is unchanged. Do not auto-shift the end when only the start moves. On success `updateEvent(db, row.id, resolved)` and `200 { event: toEventDto(updated) }` (a `404` if it returns `undefined`). A PATCH that carries the stored values still calls `updateEvent`, which recomputes the same hash. Add `eventRoutes.delete("/:id")`: `findEventById`, `404 { error: "Compromisso não encontrado" }` when absent, then `if (!eventCapabilities(row.source).deletable)` answers `409 { error: "Este compromisso vem do Google e não pode ser excluído aqui (source)" }`, then `deleteEvent(db, row.id)` and `return c.body(null, 204)`. Import `eventCapabilities` and `validateEventInput` from `../../shared/events`, `toEventDto` from `../dto`. Same token rule as Task 6. Delivers AC-A4 (PRD AC-12: a title edit moves `updatedAt` and changes the hash, a no-op PATCH keeps the hash, `{ allDay: true, startDate: "2026-10-20" }` converts a timed Event with `startAt` and `endAt` null and `endDate` `2026-10-21`, an `endAt` before the start is `400` with the row unchanged, `id`, `source`, `contentHash`, `createdAt` or a typo is `400`, an unknown id is `404`), AC-A5 (PRD AC-13: `204` and the row gone, an unknown id `404`, a directly inserted link row survives with `event_id` null) and AC-A6 (PRD AC-14: a directly inserted `google` row answers `409` naming `source` to `PATCH` and `DELETE`, unchanged).
- **MIRROR**: `# SOURCE: src/worker/routes/life-areas.ts:161-171`, `# SOURCE: src/worker/routes/life-areas.ts:209-217` and `# SOURCE: src/shared/api.ts:260-280` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; if grep -rnE 'computeEventContentHash|eventSyncLinks|event_sync_links' src/worker/routes/; then echo "FAIL: a route computes the hash or references the link table"; exit 1; else echo "PASS: no route computes the hash or references the link table"; fi; if grep -rnE '(insert|update|delete)\(\s*events\s*\)' src | grep -v '^src/worker/event-repository.ts:'; then echo "FAIL: an events write outside the repository"; exit 1; else echo "PASS: only the repository writes events"; fi; grep -qF 'eventCapabilities(' src/worker/routes/events.ts` (type-checks, keeps both AC-16 inspections green and proves the guard goes through the shared capability function; the merge, conversion and 409 behaviour is proved by the Level 2 suites and live in Level 3)

### Task 9: UPDATE src/worker/index.ts — mount the router behind the bearer gate

- **ACTION**: Add `import { eventRoutes } from "./routes/events";` among the route imports (alphabetical placement beside `exportRoutes` is fine) and the single line `app.route("/api/events", eventRoutes);` directly after `app.route("/api/life-areas", lifeAreaRoutes);`. Do not move or edit `app.use("/api/*", requireToken)` and do not add any auth code of its own: the prefix IS the authorization, so every `/api/events` route answers 401 without a header or with a wrong token before any handler runs and before any read or write. Delivers AC-A7 (PRD AC-15: no `Authorization` header or a wrong token is 401 and nothing is read or written).
- **MIRROR**: `# SOURCE: src/worker/index.ts:28-38` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; grep -qF 'app.route("/api/events", eventRoutes);' src/worker/index.ts; grep -qF 'import { eventRoutes } from "./routes/events";' src/worker/index.ts; line_use="$(grep -nF 'app.use("/api/*", requireToken)' src/worker/index.ts | head -n 1 | cut -d: -f1)"; line_route="$(grep -nF 'app.route("/api/events", eventRoutes);' src/worker/index.ts | head -n 1 | cut -d: -f1)"; test -n "$line_use"; test -n "$line_route"; test "$line_use" -lt "$line_route"` (type-checks the wired app, then proves the mount line exists and sits BELOW the token middleware, which is what makes the gate apply; the 401 behaviour itself is exercised by the Level 2 suite)

### Task 10: UPDATE src/worker/routes/google.ts — optional from and to on GET /events

- **ACTION**: Import `validateDayRange` and `GOOGLE_RANGE_MAX_DAYS` from `../../shared/event-range` and `dayRangeProblemMessage` from `../event-messages`. At the top of the `googleRoutes.get("/events")` handler, BEFORE `accessTokenFor` (so a bad parameter is a `400` that needs no Google connection and never causes a token refresh), read `from` and `to` with `c.req.query`. When BOTH are absent the window is still computed by the existing expression, byte for byte: `eventWindow(todayIn(new Date(), PRAESTO_TIMEZONE), WINDOW_DAYS)` (the 7-day default, unchanged; it may become one branch of a conditional or an `else`, but that expression must survive untouched). When either is present, `validateDayRange(from, to, GOOGLE_RANGE_MAX_DAYS)`; a failure is `400 { error: dayRangeProblemMessage(error) }` naming the parameter (a lone `from` or a lone `to` is therefore `400` naming the missing one, `to` before `from` and a span over 31 days are `400` naming `to`); a success sets `window = eventWindow(range.from, range.days - 1)`, which makes the window exactly `from` through `to` inclusive (`timeMax` is the start of the day after `to`). `days` counts inclusive calendar days, so `2026-10-01` to `2026-10-31` is 31 and accepted and `2026-11-01` is 32 and refused. Everything else in the handler (the token call, `selectedCalendarIds`, the per-calendar loop, `failedCalendars`, the `{ events, failedCalendars, window }` response) is untouched, and `WINDOW_DAYS` stays a module-private constant. Delivers AC-A10 (PRD AC-18: no parameters answers the same 7-day window as today; `from=2026-10-20&to=2026-10-21` answers `timeMin` `2026-10-20T00:00:00-03:00` and `timeMax` `2026-10-22T00:00:00-03:00`; a span over 31 days or `to` before `from` is `400`).
- **MIRROR**: `# SOURCE: src/worker/routes/google.ts:137-138`, `# SOURCE: src/worker/routes/google.ts:262-268` and `# SOURCE: src/shared/google-events.ts:119-130` (Patterns to Mirror).
- **VALIDATE**: `` set -euo pipefail; npx tsc -p tsconfig.worker.json; grep -qF 'eventWindow(todayIn(new Date(), PRAESTO_TIMEZONE), WINDOW_DAYS)' src/worker/routes/google.ts; CI=1 NO_COLOR=1 npx vitest run --project worker google || CI=1 NO_COLOR=1 npx vitest run --project worker google `` (type-checks, proves the default-window expression survives byte for byte, then runs every existing Google suite, which are unmodified and must stay green: the retry covers only the known Windows exit-127 runner flake, a real failure fails both attempts)

### Task 11: UPDATE src/shared/export.ts and src/worker/routes/export.ts — the dump carries both tables

- **ACTION**: In `src/shared/export.ts` import `EventDto` and `EventSyncLinkDto` from `./api`, append `events: EventDto[]` and `eventLinks: EventSyncLinkDto[]` to `ExportTables` (both REQUIRED, so a caller that forgets them stops compiling), change the doc comments from "five" to "seven", append `events: EventDto[]` and `event_sync_links: EventSyncLinkDto[]` to the `ExportEnvelope.tables` type AFTER `google_calendar_selections`, and add `events: tables.events` and `event_sync_links: tables.eventLinks` to the `buildExportEnvelope` literal in that same order. The order matters: `scripts/restore-drill.mjs` inserts tables in snapshot key order and `event_sync_links` references `events`, so `events` must precede `event_sync_links`. `formatVersion` stays the literal type `1` and the literal value `1`; only keys are added. The property is deliberately named `eventLinks` (not `eventSyncLinks`) in `ExportTables` so that no file under `src/worker/routes/` needs the link-table token. In `src/worker/routes/export.ts` import `listAllEvents` and `listAllEventSyncLinks` from `../event-repository` and `toEventDto` and `toEventSyncLinkDto` from `../dto`, add the two reads to the `Promise.all` (destructure `eventRows` and `linkRows`) and the two mapped keys `events: eventRows.map(toEventDto)` and `eventLinks: linkRows.map(toEventSyncLinkDto)` to the first argument of `buildExportEnvelope`. The route imports neither the `events` table nor the link table. Rewrite the "five data-bearing tables" comments in both files (the route header says it queries the tables named in `EXPORTED_TABLE_NAMES`, now seven, without mentioning the link-table tokens). Do not touch the existing `reminders: tables.reminders` line (a known baseline entry of the mirror-inventory script). Delivers AC-A11 (PRD AC-19: one Event and no links dumps `tables.events` field for field including `contentHash` and `allDay`, `tables.event_sync_links` is an empty array, and `formatVersion` is still 1).
- **MIRROR**: `# SOURCE: src/shared/export.ts:16-23`, `# SOURCE: src/shared/export.ts:54-72` and `# SOURCE: src/worker/routes/export.ts:32-55` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json; if grep -rnE 'computeEventContentHash|eventSyncLinks|event_sync_links' src/worker/routes/; then echo "FAIL: a route computes the hash or references the link table"; exit 1; else echo "PASS: no route computes the hash or references the link table"; fi; CI=1 NO_COLOR=1 npx vitest run --project worker test/export-envelope test/export.test test/life-areas-export test/export-completeness || CI=1 NO_COLOR=1 npx vitest run --project worker test/export-envelope test/export.test test/life-areas-export test/export-completeness` (type-checks both targets, keeps the AC-16 route inspection green, then runs the four existing export suites as the test pair updated them; the retry covers only the known runner flake)

### Task 12: UPDATE src/worker/db/export-manifest.ts — the doc comment is no longer stale

- **ACTION**: Rewrite ONLY the doc comment above `EXPORTED_TABLE_NAMES`: it must say the list holds seven tables, that `events` and `event_sync_links` were classified in unit 14 phase 1 so the completeness guard stayed green, and that the dump route, the envelope and the `.ics` emit them from phase 2 (this phase). Do not change the array, `EXCLUDED_TABLES` or any other line: the test pair already updated the completeness guard in phase 1 and the lists are what it reads. Infrastructure task: delivers no criterion by itself; it keeps the comment true after AC-A11 lands.
- **MIRROR**: `# SOURCE: src/worker/db/export-manifest.ts:14-29` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; node -e "import('./src/worker/db/export-manifest.ts').then((m) => { const want = ['life_areas','recurrence_series','tasks','reminders','google_calendar_selections','events','event_sync_links']; if (JSON.stringify([...m.EXPORTED_TABLE_NAMES]) !== JSON.stringify(want)) { console.error('exported table list changed', m.EXPORTED_TABLE_NAMES); process.exit(1); } })"; if grep -qF 'start emitting them in phase 2' src/worker/db/export-manifest.ts; then echo "FAIL: the stale phase-1 wording is still there"; exit 1; else echo "PASS: the comment no longer promises a future phase"; fi` (type-checks, loads the real manifest to prove the list is exactly the seven names in the same order, and proves the stale sentence is gone; `export-manifest.ts` has no import, so Node can load it)

### Task 13: UPDATE src/shared/ics.ts — timed and all-day VEVENTs for Events

- **ACTION**: Import `type EventDto` beside `TaskDto`. Change the signature to `buildTasksIcs(now: Date, tasks: TaskDto[], events: readonly EventDto[] = []): string` (the name stays: renaming would break the shipped Task suite, and the default keeps every existing call byte-identical) and update the module header comment to say it now also emits Event `VEVENT`s. Keep the Task loop exactly as it is. AFTER the Task loop and before `END:VCALENDAR`, loop over `events` and push, for a TIMED Event (`allDay` false): `BEGIN:VEVENT`, `UID:<id>@praesto.local`, `DTSTAMP:<dtstamp>`, `DTSTART:<UTC instant>`, `DTEND:<UTC instant>`, `SUMMARY:<escaped title>`, then `DESCRIPTION:<escaped>` only when the description is not null, then `LOCATION:<escaped>` only when the location is not null, then `END:VEVENT`; where an instant is `formatDtstamp(new Date(seconds * 1000))` (so 2026-10-20 12:30Z is `20261020T123000Z`, UTC with the `Z` suffix and NO `TZID`, so no `VTIMEZONE` is needed) and `DTEND` is OMITTED when `endAt === startAt` (RFC 5545 requires `DTEND` to be later than `DTSTART`; a `DATE-TIME` start with no end is a zero-duration event). For an ALL-DAY Event: the same property order with `DTSTART;VALUE=DATE:<startDate without hyphens>` and `DTEND;VALUE=DATE:<endDate without hyphens>` (the stored exclusive end, so `2026-10-26` to `2026-10-28` is `20261026` and `20261028`). Neither Event shape carries the "originally a to-do" `COMMENT`. Task `VEVENT`s are emitted first, Event `VEVENT`s after, in the order given; `foldContentLine` at 75 octets, CRLF and the trailing CRLF are applied by the existing last line. Do not export the private helpers. Delivers AC-A12 (PRD AC-20: the timed Event 2026-10-20 09:30-10:30 `America/Sao_Paulo` is `DTSTART:20261020T123000Z` and `DTEND:20261020T133000Z` with a UTC `DTSTAMP`, `UID` `<id>@praesto.local` and an escaped `SUMMARY`, `DESCRIPTION` and `LOCATION` when present; the all-day Event is `DTSTART;VALUE=DATE:20261026` and `DTEND;VALUE=DATE:20261028`; neither carries the comment; lines are CRLF and folded; the dated Tasks still produce exactly the `VEVENT`s they produce today).
- **MIRROR**: `# SOURCE: src/shared/ics.ts:90-118`, `# SOURCE: src/shared/ics.ts:24-30` and `# SOURCE: src/shared/ics.ts:35-40` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json; CI=1 NO_COLOR=1 npx vitest run --project worker test/export-ics.test || CI=1 NO_COLOR=1 npx vitest run --project worker test/export-ics.test` (type-checks both targets, then runs the pure serializer suite: the shipped Task cases must stay green unmodified and the pair-added event cases go green here; the retry covers only the known runner flake)

### Task 14: UPDATE src/worker/routes/export-ics.ts — pass the stored events

- **ACTION**: Import `listAllEvents` from `../event-repository` and `toEventDto` from `../dto`; after `const taskRows = await db.select().from(tasks);` add `const eventRows = await listAllEvents(db);` and call `buildTasksIcs(now, taskRows.map(toTaskDto), eventRows.map(toEventDto))`. Update the header comment (the route now exports Events too, and `buildTasksIcs` decides which Tasks produce a `VEVENT`). Headers, filename and the Task query are unchanged; the route imports neither the `events` table nor the link table. Delivers AC-A12 at the route level (PRD AC-20: a stored timed Event and a stored all-day Event reach the produced file).
- **MIRROR**: `# SOURCE: src/worker/routes/export-ics.ts:19-34` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; if grep -rnE 'computeEventContentHash|eventSyncLinks|event_sync_links' src/worker/routes/; then echo "FAIL: a route computes the hash or references the link table"; exit 1; else echo "PASS: no route computes the hash or references the link table"; fi; CI=1 NO_COLOR=1 npx vitest run --project worker test/export-ics-route || CI=1 NO_COLOR=1 npx vitest run --project worker test/export-ics-route` (type-checks, keeps the AC-16 inspection green, then runs the route suite against a real D1: the shipped Task cases stay green and the pair-added stored-Event cases go green here)

### Task 15: UPDATE docs/api-reference.md — the contract documentation

- **ACTION**: Add to the Implemented table, in the row shape of the `DELETE /api/tasks/:id` row, one row each for `POST /api/events`, `GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD&q=<text>`, `PATCH /api/events/:id`, `DELETE /api/events/:id`, `GET /api/google/events?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /api/export` and `GET /api/export.ics`. State in them: the `EventDto` fields in epoch SECONDS (a timed Event carries `startAt`/`endAt`, an all-day Event `startDate`/`endDate` with an EXCLUSIVE end, `timezone` always present, `source` `local`, `contentHash`); `POST` and `PATCH` accept exactly `EDITABLE_EVENT_FIELDS` (`title`, `description`, `location`, `allDay`, `startAt`, `endAt`, `startDate`, `endDate`, `timezone`) and refuse any other key with 400, a missing end is filled (start + 1 h, or the next day), and `PATCH` merges (an omitted key keeps the value, an explicit `null` clears it, toggling `allDay` carries only the target shape's fields); `GET` requires `from` and `to` together (inclusive local days in `America/Sao_Paulo`, at most 62 days, overlap semantics: a midnight-crossing Event is listed on both days, a zero-duration Event inside the range is listed, all-day first then by start then id) or `q` (every word must match over title and description, case- and diacritic-insensitive, at least 2 characters, at most 100, without a range most recent start first and at most 100 results, composes with `from`/`to`), and a request with neither is 400; a `google`-source row answers 409 naming `source` to `PATCH` and `DELETE`; the Google route's optional `from`/`to` (both or neither, at most 31 days inclusive, default 7 days after today unchanged, still milliseconds on `CalendarEventDto`); the dump now lists `events` and `event_sync_links` (`formatVersion` 1); the `.ics` emits timed Events in UTC `Z`, all-day Events as `VALUE=DATE` with an exclusive `DTEND`, `UID` `<id>@praesto.local`, and no to-do `COMMENT`. Add one Conventions bullet that the Event DTO is in seconds while `CalendarEventDto` stays in milliseconds. In the "Not built yet" table change the `14–18 (Phase 2)` row so it says unit 14's API, export and search surface exists (phase 2) and the day range function, route and sheet (phases 3-4) are still to come. Cite only `.md` paths that exist and add no line that calls a resolved decision "pending" or "not decided" (the docs-consistency suite scans these files). Delivers AC-A15 (PRD AC-34, the `docs/api-reference.md` part: `/api/events` and the `from`/`to` window of the Google route are documented).
- **MIRROR**: `# SOURCE: docs/api-reference.md:22` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; for token in '/api/events' 'PATCH' 'EDITABLE_EVENT_FIELDS' 'event_sync_links' 'from=YYYY-MM-DD' 'EXCLUSIVE'; do grep -qF -- "$token" docs/api-reference.md; done; CI=1 NO_COLOR=1 npx vitest run --project docs docs-consistency || CI=1 NO_COLOR=1 npx vitest run --project docs docs-consistency` (the deliverable here IS prose, so the presence checks are legitimate; the docs-consistency suite additionally proves every cited path exists and no resolved decision is described as open)

### Task 16: CREATE the fixture restore-drill record under PRPs/reports/events-and-day-view/

- **ACTION**: Run the Level 3 block below (it is the whole fixture recipe, re-runnable) with `DRILL_OUTPUT=PRPs/reports/events-and-day-view/c6-drill-output.txt` exported, so the drill's own stdout is kept unedited in that file (the block runs `restore-drill.mjs` through `tee` under `pipefail`, so a failing drill fails the run). It builds a LOCAL worker (`vite dev` on port 5179, real workerd, local D1, the dev bearer token read from `.dev.vars` into a git-ignored scratch file and never printed), creates one timed Event and one all-day Event through the real `POST /api/events` route, pulls a snapshot with `scripts/pull-export-snapshot.mjs` pointed at the local worker with `PRAESTO_EXPORT_BASE_URL`, `PRAESTO_TOKEN_FILE` and `PRAESTO_SNAPSHOT_DIR` (never `~/praesto-snapshots`, never production, never `--remote`), runs `node scripts/restore-drill.mjs` on it, checks the snapshot and the `.ics`, deletes the two fixture Events through the real `DELETE` route, and stops the server. `scripts/restore-drill.mjs` is run, not edited. Then write `PRPs/reports/events-and-day-view/c6-restore-drill.md` in the framing of the life-areas record: the heading `SYNTHETIC FIXTURE RUN`, the statement that it is not the owner's data and not PRD AC-32, how the fixture was made (routes only, local worker, token never printed), the snapshot's size and SHA-256 and `formatVersion` 1 (counts and hashes only, never titles or row content), a per-table result table (`events` 2 and 2 with every field identical including `contentHash` and the 0/1 `all_day`; `event_sync_links` 0 and 0, restore path NOT exercised; the other tables as the snapshot found them), what it proves, what it does not prove (nothing about the owner's real rows, D1 over the network, a production snapshot, a populated link table), and a final `*Status:*` line. Delivers AC-A13 (PRD AC-21: a snapshot from a local worker holding one timed and one all-day Event created through the real routes rebuilds with equal counts, every field identical, `content_hash` and `all_day` included, and exit code 0, recorded under `PRPs/reports/events-and-day-view/`).
- **MIRROR**: `# SOURCE: PRPs/reports/life-areas/c6-restore-drill.md:9-15`, `# SOURCE: scripts/restore-drill.mjs:86-88` and `# SOURCE: scripts/pull-export-snapshot.mjs:37-40` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; f=PRPs/reports/events-and-day-view/c6-restore-drill.md; o=PRPs/reports/events-and-day-view/c6-drill-output.txt; test -s "$f"; test -s "$o"; grep -qF 'restore-drill: PASS' "$o"; grep -qE '^  events +2 +2 +OK$' "$o"; grep -qE '^  events +2 rows, every field identical  OK$' "$o"; grep -qE '^  event_sync_links +0 +0 +OK$' "$o"; grep -qF 'SYNTHETIC FIXTURE' "$f"; grep -qiE 'sha-?256' "$f"` (the output file is the drill's own unedited stdout, so these patterns are the verbatim lines `restore-drill.mjs` prints for two restored `events` rows with every field identical and an empty link table; the record must exist, frame itself as a fixture and carry the snapshot hash)

### Task 17: VERIFY the frozen files, the one-writer inspection and the mirror inventory

- **ACTION**: Verification only, no source edit; target files are every file this phase touched. Confirm `src/shared/dates.ts`, `recurrence.ts`, `adherence.ts`, `src/worker/routes/tasks.ts`, `series.ts`, `src/worker/cron.ts` and `scripts/restore-drill.mjs` are byte-identical to the fork point from `main`; that the phase-1 files (`src/shared/events.ts`, `src/shared/event-hash.ts`, `src/worker/db/schema.ts`, `test/isolation.ts` and `migrations/`) are unchanged against the index (phase 1 is staged or committed, so a working-tree diff against the index must be empty); that no file under `src/` outside `src/worker/event-repository.ts` inserts, updates or deletes `events`; that no file under `src/worker/routes/` contains `computeEventContentHash`, `eventSyncLinks` or `event_sync_links`; and that `scripts/check-mirror-inventory.mjs` reports no violation beyond its two known baseline lines (it is not part of `npm run check` and fails on `main` today; this phase must not add a third). Infrastructure/verification task: it delivers AC-A8 (the AC-16 inspection half) and AC-A14 (PRD AC-33, the frozen-file part) by checking, and adds no behaviour.
- **MIRROR**: `# SOURCE: scripts/check-mirror-inventory.mjs:62-65` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; base="$(git merge-base HEAD main)"; for f in src/shared/dates.ts src/shared/recurrence.ts src/shared/adherence.ts src/worker/routes/tasks.ts src/worker/routes/series.ts src/worker/cron.ts scripts/restore-drill.mjs; do test -f "$f"; git diff --exit-code "$base" -- "$f"; done; for f in src/shared/events.ts src/shared/event-hash.ts src/worker/db/schema.ts test/isolation.ts migrations; do test -e "$f"; git diff --exit-code -- "$f"; done; if grep -rnE '(insert|update|delete)\(\s*events\s*\)' src | grep -v '^src/worker/event-repository.ts:'; then echo "FAIL: an events write outside the repository"; exit 1; else echo "PASS: only the repository writes events"; fi; if grep -rnE 'computeEventContentHash|eventSyncLinks|event_sync_links' src/worker/routes/; then echo "FAIL: a route computes the hash or references the link table"; exit 1; else echo "PASS: no route computes the hash or references the link table"; fi; out="$(node scripts/check-mirror-inventory.mjs 2>&1 || true)"; if printf '%s\n' "$out" | grep -E '^  src/' | grep -vE 'return body\.reminders|reminders: tables\.reminders'; then echo "FAIL: a new mirror-inventory violation"; exit 1; else echo "PASS: no new mirror-inventory violation (the two known baseline lines are tolerated)"; fi` (each frozen path is checked individually after confirming it exists, so a missing file cannot pass vacuously; the diff against the index proves phase 1 was not edited; the mirror-inventory filter keeps only the `  src/<path>:<line>: <code>` lines the script prints and subtracts the two known baseline lines)

## Validation Commands

### Level 1 STATIC_ANALYSIS

```bash
set -euo pipefail
# Format the touched source and docs files first; the test files are formatted by the test pair.
npx prettier --write \
  src/shared/api.ts src/shared/event-range.ts src/shared/export.ts src/shared/ics.ts \
  src/worker/dto.ts src/worker/event-repository.ts src/worker/event-messages.ts src/worker/index.ts \
  src/worker/routes/events.ts src/worker/routes/google.ts src/worker/routes/export.ts \
  src/worker/routes/export-ics.ts src/worker/db/export-manifest.ts docs/api-reference.md
# wrangler types --check + tsc -b (includes test/) + eslint + prettier --check.
npm run check
```

### Level 2 UNIT_TESTS

```bash
set -euo pipefail
export CI=1 NO_COLOR=1
# The whole suite, both vitest projects: the pair-authored AC-9..AC-21 suites run here.
# A local runner flake (exit 127 with no failing test) gets exactly one retry; a real
# failing test fails both attempts and fails this gate.
if ! npx vitest run; then
  echo "first vitest run failed - retrying once"
  npx vitest run
fi
# The frozen contracts: GET /api/tasks and the shipped Google route tests are byte-identical to the fork point.
base="$(git merge-base HEAD main)"
for f in \
  test/task-list-contract.test.ts test/google-calendar-routes.test.ts \
  test/google-routes.test.ts test/google-events.test.ts; do
  test -f "$f"
  git diff --exit-code "$base" -- "$f"
done
```

### Level 3 INTEGRATION

```bash
set -euo pipefail
# The whole fixture recipe for AC-A13 (PRD AC-21), through the real routes of a LOCAL worker.
# Re-runnable: it migrates the local D1 (idempotent), creates two fixture Events, deletes them again,
# and removes its scratch directory. It never contacts production and never uses --remote.
# If port 5179 is still bound afterwards (a Windows child process can outlive `kill`), stop the
# process listening on it before re-running.
PORT=5179
BASE="http://127.0.0.1:${PORT}"
scratch=".wrangler/events-drill-scratch"
dev_pid=""
cleanup() {
  if [ -n "$dev_pid" ]; then kill "$dev_pid" 2>/dev/null || true; fi
  rm -rf "$scratch"
}
trap cleanup EXIT
mkdir -p "$scratch/snapshots"
# The scratch directory holds the bearer token, so it must be git-ignored before anything is written.
git check-ignore -q "$scratch/token.txt"
npm run db:migrate
sed -n 's/^API_BEARER_TOKEN=//p' .dev.vars | tr -d '\r"' > "$scratch/token.txt"
test -s "$scratch/token.txt"
npx vite dev --host 127.0.0.1 --port "$PORT" --strictPort > "$scratch/dev.log" 2>&1 &
dev_pid=$!
code=""
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health" || true)"
  [ "$code" = "401" ] && break
  sleep 2
done
test "$code" = "401"   # the gate answers 401 without a token: the server is up and the router is gated
auth="Authorization: Bearer $(cat "$scratch/token.txt")"
timed="$(curl -sf -X POST "$BASE/api/events" -H "$auth" -H 'Content-Type: application/json' \
  -d '{"title":"Dentista (fixture)","startAt":1792499400,"endAt":1792503000,"location":"Clínica Sorriso","description":"levar exames"}')"
allday="$(curl -sf -X POST "$BASE/api/events" -H "$auth" -H 'Content-Type: application/json' \
  -d '{"title":"Feriado (fixture)","allDay":true,"startDate":"2026-10-26","endDate":"2026-10-28"}')"
PRAESTO_EXPORT_BASE_URL="$BASE" PRAESTO_TOKEN_FILE="$scratch/token.txt" \
  PRAESTO_SNAPSHOT_DIR="$scratch/snapshots" node scripts/pull-export-snapshot.mjs
snap="$(ls "$scratch"/snapshots/praesto-*.json)"
ics="$(ls "$scratch"/snapshots/praesto-*.ics)"
# The snapshot holds one timed and one all-day Event and an empty link table, and the .ics carries both VEVENT shapes.
node -e "const s = JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')); const e = s.tables.events; if (s.formatVersion !== 1 || e.length !== 2 || e.filter((x) => x.allDay === true).length !== 1 || e.filter((x) => x.allDay === false).length !== 1 || !Array.isArray(s.tables.event_sync_links) || s.tables.event_sync_links.length !== 0) { console.error('fixture snapshot wrong'); process.exit(1); }" "$snap"
grep -qF 'DTSTART:20261020T123000Z' "$ics"
grep -qF 'DTEND;VALUE=DATE:20261028' "$ics"
# The drill's own stdout is kept when DRILL_OUTPUT names a file (Task 16 sets it); pipefail carries a failing exit code through tee.
drill_out="${DRILL_OUTPUT:-$scratch/drill-output.txt}"
node scripts/restore-drill.mjs "$snap" | tee "$drill_out"
# Clean the fixture back out through the real DELETE route.
for id in "$(node -e "console.log(JSON.parse(process.argv[1]).event.id)" "$timed")" \
          "$(node -e "console.log(JSON.parse(process.argv[1]).event.id)" "$allday")"; do
  test "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/events/$id" -H "$auth")" = "204"
done
```

## Acceptance Criteria

- **AC-A1 (PRD AC-9):** `POST /api/events` with `{ "title": "  Dentista ", "startAt": 1792499400, "endAt": 1792503000, "location": "Clínica Sorriso" }` answers 201 with an `event` whose `title` is `Dentista`, `allDay` false, `timezone` `America/Sao_Paulo`, `source` `local`, `startDate`, `endDate` and `description` null, a UUID `id`, epoch-second `createdAt` and `updatedAt`, and a `contentHash` equal to `computeEventContentHash` of the stored fields; `{ "title": "Feriado", "allDay": true, "startDate": "2026-10-26" }` is 201 with `endDate` `2026-10-27` and `startAt` null; a `startAt` alone yields an `endAt` one hour later.
- **AC-A2 (PRD AC-10):** Each of a missing or blank title, an over-long title, `allDay: true` with `startAt`, `allDay: false` without `startAt`, `endAt` before `startAt`, `startDate` `2026-02-30`, an unknown `timezone`, a `source` or `contentHash` key, and a body that is not a JSON object makes `POST /api/events` answer 400 with an `error` naming the field (its key in parentheses) and writes no row.
- **AC-A3 (PRD AC-11):** With a timed Event 2026-10-20 09:30-10:30, an all-day Event covering 2026-10-26 and 2026-10-27, a timed Event 2026-10-20 23:00 to 2026-10-21 01:00, a zero-duration Event at 2026-10-21 08:00 and one on 2026-11-30 (all `America/Sao_Paulo`), `GET /api/events?from=2026-10-20&to=2026-10-21` returns the first, third and fourth (all-day first, then by start, then id); `from=2026-10-27&to=2026-10-27` returns the all-day one; a missing `to`, `to` before `from`, a non-date, or a span over 62 inclusive days (`2026-10-20` to `2026-12-20` is accepted, `2026-12-21` is not) is 400 naming the parameter; and a request with neither a range nor `q` is 400.
- **AC-A4 (PRD AC-12):** `PATCH /api/events/:id` with `{ "title": "Dentista (retorno)" }` answers 200 with the title changed, `updatedAt` moved and `contentHash` different; a PATCH carrying the stored values leaves the hash equal; `{ "allDay": true, "startDate": "2026-10-20" }` converts a timed Event (`startAt` and `endAt` null, `endDate` `2026-10-21`); an `endAt` before the start is 400 and the row is unchanged; `id`, `source`, `contentHash`, `createdAt` or a typo is 400; an unknown id is 404.
- **AC-A5 (PRD AC-13):** `DELETE /api/events/:id` answers 204 and the row is gone; an unknown id is 404; a link row pointing at the deleted Event, inserted directly, survives with `event_id` null.
- **AC-A6 (PRD AC-14):** For a row inserted directly with `source = 'google'`, `PATCH` and `DELETE /api/events/:id` answer 409 naming `source` and leave the row unchanged, and no `POST` can create a `google` row.
- **AC-A7 (PRD AC-15):** With no `Authorization` header or a wrong token, every `/api/events` route answers 401 and nothing is read or written.
- **AC-A8 (PRD AC-16):** After a create followed by three edits, the stored `content_hash` equals the recomputed hash every time; every `/api/events` call leaves the count of `event_sync_links` unchanged; and inspection of `src/worker/routes/` finds no hash computation and no reference to the link table, and inspection of `src/` finds no write to `events` outside `src/worker/event-repository.ts`.
- **AC-A9 (PRD AC-17):** With Events titled `Consulta dentista` and `Reunião` and one whose description reads `levar exames da consulta`, `GET /api/events?q=consulta` returns two; `q=CONSULTA dentista` returns one (every word must match); `q=reuniao` matches `Reunião`; a one-character `q` is 400 naming `q`; `q` composes with `from` and `to`; and without a range the match spans all dates, most recent start first, at most 100.
- **AC-A10 (PRD AC-18):** `GET /api/google/events` with no parameters answers the same 7-day window as before; with `from=2026-10-20&to=2026-10-21` its `window` is `timeMin` `2026-10-20T00:00:00-03:00` and `timeMax` `2026-10-22T00:00:00-03:00`; a span over 31 inclusive days, `to` before `from`, or only one of the two is 400 naming the parameter; `GET /api/tasks` without new parameters is byte-identical, and `test/task-list-contract.test.ts` and the Google route tests are unmodified and green.
- **AC-A11 (PRD AC-19):** With one Event and no links, `GET /api/export` returns `tables.events` holding the Event field for field including `contentHash` and `allDay`, `tables.event_sync_links` as an empty array, `formatVersion` still 1, with `events` listed before `event_sync_links`; the completeness guard passes with both tables listed (its expected lists were updated in phase 1, never loosened).
- **AC-A12 (PRD AC-20):** `GET /api/export.ics` emits the timed Event 2026-10-20 09:30-10:30 `America/Sao_Paulo` as a `VEVENT` with `DTSTART:20261020T123000Z`, `DTEND:20261020T133000Z`, a UTC `DTSTAMP`, `UID` `<id>@praesto.local`, an escaped `SUMMARY` and, when present, `DESCRIPTION` and `LOCATION`; the all-day Event 2026-10-26 to 2026-10-28 (exclusive) with `DTSTART;VALUE=DATE:20261026` and `DTEND;VALUE=DATE:20261028`; neither carries the "originally a to-do" comment; lines are CRLF and folded at 75 octets; and the dated Tasks still produce exactly the `VEVENT`s they produce today.
- **AC-A13 (PRD AC-21):** `scripts/restore-drill.mjs`, run on a snapshot taken from a local worker holding one timed and one all-day Event created through the real routes, reports equal row counts, every field of every row identical (`content_hash` and the 0/1 `all_day` included) and exit code 0, and the result is recorded under `PRPs/reports/events-and-day-view/`.
- **AC-A14 (PRD AC-33, the part this phase can meet):** `src/shared/recurrence.ts` and `src/shared/adherence.ts` (and `dates.ts`) are byte-identical to the fork point from `main`; no new migration exists in this phase; no test was removed, skipped or loosened; `npm run check` and `npm test` pass; and `scripts/check-mirror-inventory.mjs` reports no violation beyond its two pre-existing baseline lines.
- **AC-A15 (PRD AC-34, the `docs/api-reference.md` part):** `docs/api-reference.md` documents `/api/events` (create, range read, search, edit, delete, the source guard) and the `from`/`to` window of the Google route.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PRD AC-17 says a one-character `q` is 400 "exactly as on `GET /api/tasks`", but the shipped Tasks route does NOT reject one character (`validateSearchQuery` rejects only blank and over-100; `test/task-list-search.test.ts` shows `?q=_` answering 200 with `[]`; the 2-character floor is only the client's `shouldSearch`) | H | M | The plan follows the PRD's observable requirement, a 400 naming `q`, by guarding with the existing `shouldSearch` on the events route only (Task 7); `GET /api/tasks` is untouched (AC-A10). The wording discrepancy is recorded in Notes for the owner or phase 5 to amend in the PRD |
| A range edge is off by one: a midnight-crossing, zero-duration or exactly-at-boundary Event is wrongly in or out, or an all-day exclusive end leaks into the next day | M | H | One pure range helper (Task 2) and one stated predicate per kind (Task 7), with the PRD fixture of AC-11 as the test oracle; the RFC 4791 overlap table (research) agrees on the zero-duration inclusion |
| "Span" is ambiguous (days between versus days covered) and the pair and the Implementer read it differently at the 62 and 31 boundaries | M | M | The plan fixes the meaning: the INCLUSIVE count of calendar days, with worked boundaries in Task 2, Task 10 and AC-A3/AC-A10; the pair is told in Notes |
| The hash goes stale because a second code path writes `events` | L | H | Task 5 makes the repository the only writer; Tasks 5, 6, 8 and 17 grep `src/` for any other `insert|update|delete(events)`; the Level 2 suite recomputes the hash after a create and three edits (AC-A8) |
| AC-A8 forbids a route from importing the link table, but the export dump legitimately needs to read it | M | M | The dump and `.ics` read it through `listAllEventSyncLinks`/`listAllEvents` in the repository, and the `ExportTables` key is named `eventLinks`, so `src/worker/routes/` never contains the link-table token |
| Widening `ExportTables` breaks the shipped export tests until the pair updates them | H | L | Expected and listed in Notes; the pair updates them test-first, never loosening, so they are RED for the right reason before the Implementer runs |
| `updated_at` is epoch-second precision, so a "moved" assertion in a test that creates and patches within one second cannot see it move | M | L | Noted for the pair: seed the stored `updated_at` in the past or assert it is not earlier; the repository always sets it on every update |
| The overlap clauses compare raw integers in a `sql` template while the columns are timestamp-mode in Drizzle | M | M | The clauses use the `sql` tag with plain numbers (not `Date` objects), so the stored integer seconds are compared directly; the AC-A3 fixture catches a unit mistake immediately |
| A search order that mixes all-day and timed Events cannot be exact in SQL for historical dates, because the owner's UTC offset is taken at "now" | L | L | Exact for the owner's zone since 2019 (fixed -03:00); documented in Task 7 as an accepted approximation; the PRD only asks for "most recent start first" |
| The Google route validates parameters before the token call, so a malformed request is a 400 even when Google is not connected | L | L | Deliberate and stated in Task 10: validation errors must not depend on a connection or cost a token refresh; the default path is unchanged and its shipped suites run in Task 10 |
| The fixture drill needs a running dev server, and a Windows child process can outlive `kill` | M | L | The Level 3 block uses a trap, a readiness poll that expects the gate's 401, a dedicated port and a note to stop a leftover listener; the bearer token only ever sits in a git-ignored scratch file that is checked with `git check-ignore` before it is written |
| `scripts/check-mirror-inventory.mjs` already FAILS on `main` for `src/app/api.ts` (`return body.reminders`) and `src/shared/export.ts` (`reminders: tables.reminders`) | H | L | It is not part of `npm run check` and this phase must not depend on it passing; Task 17 only proves no THIRD violation is added; phase 5 (AC-33) resolves the baseline |
| API error text is partly English (the `q` over-length message comes from the shared search helper, `Body must be a JSON object` from the route convention) and partly pt-BR | L | L | Both already name the field and match the shipped convention of their source; wording is not pinned by any criterion |
| The unit's estimate outgrows its ceiling (PRD risk): this is the largest phase, 17 tasks | M | M | The tasks are small and ordered so each compiles on its own; the PRD's split rule (roadmap rule 7) stays available if phase 3 pushes the unit past ~10 days |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test glob (`*.test.ts`, `__tests__/`, `tests/`, `spec/`), so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework as the proof of a task (some run existing suites as a regression net; Level 2 runs the pair-authored suites as a gate over the finished phase).
- **Implementer files versus pair files.** Implementer: `src/shared/api.ts`, `src/shared/event-range.ts`, `src/shared/export.ts`, `src/shared/ics.ts`, `src/worker/dto.ts`, `src/worker/event-repository.ts`, `src/worker/event-messages.ts`, `src/worker/index.ts`, `src/worker/routes/events.ts`, `src/worker/routes/google.ts`, `src/worker/routes/export.ts`, `src/worker/routes/export-ics.ts`, `src/worker/db/export-manifest.ts`, `docs/api-reference.md` and the two report files. Test pair: every `test/*.test.ts` and `vitest.config.ts`. `test/isolation.ts` already wipes both event tables (phase 1) and needs no change.
- **Existing tests this phase legitimately changes (the pair updates them, never loosens).** `test/export-envelope.test.ts`: `emptyTables()` (lines 25-33) must return the two new keys (`events`, `eventLinks`), the "five data-bearing tables" test (lines 77-93) becomes seven exact sorted keys (`event_sync_links`, `events`, `google_calendar_selections`, `life_areas`, `recurrence_series`, `reminders`, `tasks`) and the empties test (lines 95-102) covers the new ones. `test/export.test.ts`: the header and the AC-2 title say five; extend the seed with an Event and assert `tables.events` field for field and `tables.event_sync_links` empty (AC-A11). `test/life-areas-export.test.ts`: only its stale "five" comment (line 9); its `formatVersion` assertion stays and must still pass. `test/export-ics.test.ts` and `test/export-ics-route.test.ts`: add the Event cases of AC-A12; every existing Task case stays unmodified and green. `test/export-completeness.test.ts` was already updated to seven names in phase 1. Must stay UNMODIFIED: `test/task-list-contract.test.ts` and the Google route suites (`test/google-calendar-routes.test.ts`, `test/google-routes.test.ts`, `test/google-events.test.ts`); the new `from`/`to` Google tests therefore go in a NEW file.
- **Suites the pair is expected to author** (names are suggestions; Level 2 does not depend on them): `src/shared/event-range.ts` as a pure worker-project file (AC-A3 and AC-A10 boundaries: 62 and 31 inclusive days, `from = to`, each error's `param` and `code`, the half-open instants for `2026-10-20` to `2026-10-21` in `America/Sao_Paulo`); `/api/events` route suites with the harness of `test/life-areas-export.test.ts` and `test/export.test.ts` (`env`, `exports.default.fetch`, `Authorization: Bearer ${env.API_BEARER_TOKEN}`, `isolatedIt`, `resetTaskTables`, `DRAIN_BUDGET_MS`) for AC-A1..AC-A9, including direct `google`-row and link-row inserts through `createDb(env)`; a Google-window file for AC-A10 using the stubbed-`fetch` pattern of `test/google-routes.test.ts`.
- **How AC-A8 is made verifiable.** Behaviour: read `content_hash` from the database after a create and after each of three edits and compare it with `computeEventContentHash` of the stored fields, and compare the `event_sync_links` count before and after every call. Source inspection (a Node-side test, because workerd has no `node:fs`): (a) no file under `src/worker/routes/` contains `computeEventContentHash`, `eventSyncLinks` or `event_sync_links` (the plan keeps the tokens out of route comments so the check can read raw source), and (b) no `src/` file other than `src/worker/event-repository.ts` contains `insert(events)`, `update(events)` or `delete(events)`. A Node-side file must be registered in BOTH the `docs` project `include` and the `worker` project `exclude` of `vitest.config.ts` (the pair's file, as in phase 1 and its `event-migration-additive` suite), or added as a `describe` to the already-registered `test/source-invariants.test.ts`. As that file's own docstring warns, verify the inspection by planting a violation and watching it fail. Tasks 5-8 and 17 run the same greps from the shell as an independent check.
- **Decisions the plan makes where the PRD is silent or inconsistent** (flagged so the reviewer and the owner can overrule them):
  - **One-character `q`.** AC-17 says 400 "exactly as on `GET /api/tasks`", but the Tasks route answers 200 for `?q=_` (`test/task-list-search.test.ts`, lines 238-246). The two clauses cannot both hold, so the plan keeps the explicit behaviour (400 naming `q`) via `shouldSearch`, and leaves `GET /api/tasks` untouched (AC-18). Suggested follow-up for phase 5: reword AC-17 in the PRD.
  - **"Span" means the inclusive number of calendar days** (62 for events, 31 for the Google window), so a full 31-day month fits a Google window and two such months fit an events range.
  - **`POST` has a closed key set** (`EDITABLE_EVENT_FIELDS`), unlike `POST /api/life-areas` and `POST /api/tasks`, which ignore unknown keys; AC-10 requires `source` and `contentHash` to be refused, and one rule for both verbs is simpler than a second list.
  - **`PATCH` merge.** An omitted key keeps the stored value, an explicit `null` clears it (`title`, `allDay`, `timezone` may not be `null`), a kind change drops the other kind's stored fields, and the end is never auto-shifted when only the start moves (the phase-4 patch builder sends both when the owner moves an Event).
  - **Order of checks on `PATCH`/`DELETE`:** body shape and allowlist (400), then lookup (404), then the `source` guard (409), then merged validation (400).
  - **`.ics`:** Task `VEVENT`s first (so their output is a byte-identical prefix), Event `VEVENT`s after; a zero-duration timed Event omits `DTEND` (RFC 5545 requires `DTEND` later than `DTSTART`).
  - **Google route:** `from`/`to` are validated before the token is resolved.
- **phase_type is `feature`.** Every criterion is observable behaviour specified by request and response (routes, window, dump, `.ics`) or by a recorded run (the drill), so it can be exercised test-first: the tests import the module paths and route paths this plan names and fail RED until the Implementer creates them. `foundation` would make the TDD track skip test-first for the phase, which would be wrong here.
- **Research grounding.** research-codebase confirmed the route, mapper, wire-type, export, `.ics`, Google-window, drill and harness anchors above (and that no repository module, `EventDto` or message map existed). research-web (RFC 5545 and RFC 4791) confirmed: `DTEND` is non-inclusive and must be later than `DTSTART`, a `DATE-TIME` start with no end is zero-duration, a `DATE` start needs a `DATE` end, UTC date-times carry a `Z` and no `TZID`, `DTSTAMP` must be UTC, TEXT escaping of backslash, comma and semicolon with `\n` for newlines, 75-octet folding with CRLF; and the RFC 4791 overlap table (`start < DTEND AND end > DTSTART`, and `start <= DTSTART AND end > DTSTART` for a zero-duration `DATE-TIME` event), which the Task 7 predicates follow. Gaps recorded by research, not resolved here: no source on midnight-crossing as such (the formulas compare instants, so no special case is implied; the AC-11 fixture covers it), Google's `events.list` excludes a zero-duration Event sitting exactly at the range start where RFC 4791 includes it (the project follows AC-11 and the RFC), and no evidence on how every client imports a UTC-only or zero-duration `VEVENT`.
- **Documentation sync is bounded.** Only `docs/api-reference.md` is updated here, as the PRD phase table says; the glossary, `domain-model.md`, `docs/domain/areas/events.md`, `ui-layout-standard.md`, `architecture-overview.md`, `docs/context/architecture.md` and the roadmap row are phase 5 (PRD D-T, AC-34). `docs/context/architecture.md` still says "no route, DTO, screen, dump or `.ics` code uses them yet"; that known, bounded staleness closes in phase 5.
- **Local command notes.** A foreground `vitest run` that exits 127 with no failing test is a local runner flake on this Windows machine; the Level 2 block and the per-task suite runs retry exactly once and a real failure fails both attempts. `tsc -b` includes `test/`, so per-task type checks use `tsc -p tsconfig.worker.json` and `tsc -p tsconfig.app.json` while pair-authored tests are still RED; Level 1 runs the whole `npm run check` at the end.

*Generated: 2026-10-19*
*Approved: 2026-10-19*
*Implemented: 2026-10-19*
*Status: IMPLEMENTED*
