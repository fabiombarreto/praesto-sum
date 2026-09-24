# Feature: Series API (Phase 2 of recurring-tasks)

```
**Decision Gate**
- Active context: none
- Activated criteria: new route family under src/worker/routes/ (/api/series); a D1 schema migration (recurrence_series.priority); an additive wire-contract change in src/shared/api.ts; domain rules for tasks and reminders (this phase composes unit 7's reminder arithmetic and Phase 1's pure expansion, it does not modify either)
- Decisions found:
  - ADR-0006 recurrence model — one shared rule table (`recurrence_series`), Tasks materialize ONLY the current occurrence, template edits propagate only to the open non-detached occurrence, at most one open occurrence per active series enforced by a unique index (`docs/decisions.md`, 2026-08-03 entry)
  - ADR-0003 canonical D1, thin client, no offline writes, token on every route
  - ADR-0005 types flow from `src/worker/db/schema.ts` through `src/worker/dto.ts` to `src/shared/api.ts`; hand-duplicated entity types forbidden
  - ADR-0008 test-first methodology — `tdd: true`; the test pair derives the suite from the PRD's Acceptance Criteria before the Implementer runs
  - ADR-0009 visible copy pt-BR, everything else English — this phase's error messages are user-facing (surfaced by the eventual Task sheet), so they follow `reminders.ts`'s pt-BR precedent
  - [2026-09-10] A relative Task Reminder resolves against end-of-day local (23:59) via `offsetToInstant`, recomputed on a deadline change — the same helper this phase composes for a series' first occurrence (PRD Decision D9 widens it to resolve against EITHER date field)
  - Unit 2 froze the Task wire contract — this PRD only ADDS fields and routes (`EDITABLE_TASK_FIELDS` is unchanged)
- Applicable anti-patterns:
  - Hand-duplicated entity types — `RecurrenceSeriesDto`'s `priority` type must flow from the schema change, never be re-declared independently
  - Portuguese in artifacts, with the ADR-0009 carve-out for the new route's visible error strings
  - Version ranges in dependencies — this phase adds no new dependency
  - Weakening tests to force green — not applicable to this phase's own diff (Implementer writes no test file — see `## Notes`), binding on how the Implementer must react if a test looks wrong
- Applicable architectural rules:
  - One Worker serves everything — the new router mounts into the existing `src/worker/index.ts` Hono app, no second service
  - Domain enums enforced twice (TypeScript union + SQL CHECK) — migration 0005's whole purpose
  - Migrations only via `drizzle-kit generate` + `wrangler d1 migrations apply` — never `drizzle-kit migrate/push`
  - API-first internally — routes and tests green before any UI (Phase 4)
  - `src/shared/` stays DOM-free, clock-free, dependency-free — this phase CONSUMES `src/shared/recurrence.ts` and `src/shared/dates.ts`, it does not modify either
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/recurring-tasks.prd.md` — Implementation Phases row 2: "Series API" —
  Goal: A series can be registered once and its first occurrence appears with its
  reminders. — Success signal: AC-11..AC-18 green; `curl` against local dev creates
  a series and `GET /api/tasks` shows its first occurrence.

## Summary

This phase gives the owner a way to register a recurring commitment once: `POST
/api/series` validates a rule + Task template, writes the `recurrence_series` row
and materializes its first occurrence as a real `tasks` row with reminders armed —
all in one atomic `db.batch`. `GET /api/series` and `GET /api/series/:id` read the
rule back with its current open occurrence id. `PATCH /api/series/:id` edits only
the template fields (title, description, priority, life area, reminder offsets) or
ends the series, propagating template edits to the open, non-detached occurrence and
rejecting any rule field (`freq`, `interval`, `dtstart`, …) by name. A one-line
migration (`0005`) fixes `recurrence_series.priority`, left behind as `integer` when
unit 2 turned `tasks.priority` into the `high|normal|low` text enum. Every date
computation composes Phase 1's `src/shared/recurrence.ts` and unit 7's
`offsetToInstant` — this phase writes no date arithmetic of its own.

## User Story

As the owner registering a recurring commitment (rent, a bill, a weekly chore),
I want to create it once — the rule, the template, the reminders — and see its
first occurrence appear as a real Task,
So that I never have to re-type it, and completing it later can spawn the next
cycle without me doing anything else.

## Problem Statement

The storage model for recurrence is already in production (`migrations/0000`), and
Phase 1 proved the pure date arithmetic, but there is still no way to actually
register a series: `src/worker/routes/` has no series route, `recurrence_series`
carries a `priority` column that cannot express the enum a Task's template needs,
and nothing composes Phase 1's expansion with unit 7's reminder arithmetic to arm
the very first occurrence.

## Solution Statement

Add `src/worker/routes/series.ts`, mirroring `src/worker/routes/reminders.ts`'s
hand-rolled shape exactly: a local `readJson` guard, validation by hand ahead of the
database CHECKs, a closed `EDITABLE_SERIES_FIELDS` allowlist read with
`Object.hasOwn` on `PATCH` so an absent key never collapses to `null` and an
unlisted (rule) field is rejected by name. `POST /api/series` computes the first
occurrence date via `firstOccurrence(rule)` and its reminder instants via
`occurrenceReminderInstants(day, offsets, tz)` (both Phase 1), writing the series,
its first Task and its Reminders in one `db.batch` — the same cross-statement
atomicity primitive `src/worker/routes/oauth-callback.ts` already uses, since D1 has
no multi-statement transaction. Migration `0005` mirrors `migrations/0001`'s exact
table-recreation pattern for the same kind of column conversion unit 2 already did
for `tasks.priority`.

## Metadata

| Field | Value |
|---|---|
| Type | Feature (new route family + migration) |
| Complexity | Medium-High — four endpoints composing Phase 1's pure functions and unit 7's reminder arithmetic, a schema migration mirroring an existing precedent, and closed-allowlist `PATCH` semantics that must structurally reject rule-field edits |
| Systems Affected | Worker API (`src/worker/routes/series.ts`, `src/worker/index.ts`), D1 schema + migration (`src/worker/db/schema.ts`, `migrations/0005_*.sql`), wire contract (`src/shared/api.ts`), DTO mapping (`src/worker/dto.ts`) |
| Dependencies | Phase 1 (`src/shared/recurrence.ts`) — complete; unit 7's `offsetToInstant` / reminder machinery — shipped |
| Estimated Tasks | 8 |
| Source PRD line ref | `PRPs/prds/recurring-tasks.prd.md:406,417-420` (Implementation Phases row 2 + Phase 2 Phase Details); `:172-209` (AC-11..AC-18) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/recurring-tasks.prd.md` | 172-209 | AC-11..AC-18 — the exact request/response/validation contract this phase must satisfy |
| P0 | `src/worker/routes/reminders.ts` | 1-191 | The route shape to mirror byte-for-byte: `readJson`, hand-validation before insert, `EDITABLE_REMINDER_FIELDS` + `Object.hasOwn`, pt-BR error strings |
| P0 | `src/worker/routes/tasks.ts` | 181-310 | `PATCH /api/tasks/:id`'s allowlist-rejection pattern and the `detached = true` precedent (line 270) this phase's PATCH must generalize to occurrence propagation |
| P0 | `src/worker/db/schema.ts` | 55-224 | `recurrenceSeries` and `tasks` column definitions, both partial unique indexes, and the CHECK-constraint style (`tasks_priority_chk`, lines 205-208) migration 0005 must mirror |
| P0 | `src/shared/recurrence.ts` | 282-369 | `firstOccurrence`, `nextOccurrence`, `occurrenceReminderInstants` — the exact signatures this phase composes and must not reimplement |
| P1 | `src/shared/dates.ts` | 22,96-139 | `PRAESTO_TIMEZONE` and `offsetToInstant` — already composed by `occurrenceReminderInstants`; cited so the Implementer never re-derives DST handling by hand |
| P1 | `migrations/0001_violet_pretty_boy.sql` | 1-33 | The exact drizzle-kit table-recreation pattern (`PRAGMA defer_foreign_keys=ON`, `__new_tasks`, `INSERT...SELECT`, `DROP`, `RENAME`) migration 0005 will generate an equivalent of for `recurrence_series` |
| P1 | `src/worker/routes/oauth-callback.ts` | 103-119 | The only existing `db.batch([...])` precedent for atomic multi-statement writes — the pattern `POST /api/series` (insert series + task + reminders) must reuse |
| P1 | `src/worker/index.ts` | 21-34 | Router-mounting pattern (`app.use("/api/*", requireToken)` then `app.route(...)`) — confirms `/api/series` inherits the token gate for free (AC-15) |
| P1 | `src/shared/api.ts` | 72-102,223-291 | `RecurrenceSeriesDto` (to be updated), and the `EDITABLE_TASK_FIELDS`/`EDITABLE_REMINDER_FIELDS` + `UpdateReminderInput` convention `EDITABLE_SERIES_FIELDS` must follow |
| P1 | `src/worker/dto.ts` | 83-109 | `toRecurrenceSeriesDto` — the existing field-by-field mapping this phase composes into a new `toSeriesDto` rather than duplicating |
| P2 | `test/tasks.test.ts` | 1-43,115-198 | Test-helper pattern (`auth()`/`post()`) and the existing recurrence-adjacent tests (DB-level unique-index proofs only, no route coverage yet) |
| P2 | `test/isolation.ts` | 147-152 | `resetTaskTables()` already wipes `recurrence_series` between tests — confirms no new isolation plumbing is needed for a `test/series.test.ts` file |
| P2 | `docs/context/methodology.md` | 1-22 | `tdd: true`, `test_frameworks: ["vitest"]` — governs the TDD routing note in `## Notes` |

## Patterns to Mirror

```
# SOURCE: src/worker/routes/reminders.ts:89-106
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
```
Copied by Task 6 — `PATCH /api/series/:id` uses the identical closed-allowlist
rejection shape, which is exactly what makes AC-17's "a rule field is rejected with
400 naming it" true for free once `EDITABLE_SERIES_FIELDS` excludes every rule
column.

```
# SOURCE: src/worker/routes/reminders.ts:183-191
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
Copied by Task 5 — `series.ts` gets its own byte-identical copy of this helper,
matching the existing per-file duplication convention (no shared module exists for
it).

```
# SOURCE: src/worker/routes/tasks.ts:269-270
  // Rule 3 — an edited occurrence detaches from its series.
  if (existing.seriesId !== null) patch.detached = true;
```
Referenced by Task 6 — the inverse check this phase's `PATCH /api/series/:id` needs:
before propagating a template edit to the open occurrence, read that occurrence's
own `detached` flag and skip the propagation (leave it untouched) when it is `true`
(AC-17, second clause).

```
# SOURCE: src/worker/db/schema.ts:162,205-208
    priority: text("priority", { enum: ["high", "normal", "low"] }),
    ...
    check(
      "tasks_priority_chk",
      sql`${t.priority} is null or ${t.priority} in ('high','normal','low')`,
    ),
```
Copied by Task 1 — `recurrenceSeries.priority` becomes `text("priority", { enum:
["high","normal","low"] })` with an identically-shaped
`check("recurrence_series_priority_chk", sql`${t.priority} is null or ${t.priority}
in ('high','normal','low')`)`, mirroring this exact precedent (AC-14).

```
# SOURCE: src/shared/api.ts:274-291
export interface UpdateReminderInput {
  taskId?: string | null;
  label?: string | null;
  fireAt?: number;
  originOffsetMinutes?: number | null;
}

/**
 * The closed set of keys `PATCH /api/reminders/:id` accepts. Anything else —
 * the server-owned fields (`id`, `sentAt`, `createdAt`, `updatedAt`), or a
 * typo — is rejected with 400 rather than silently ignored.
 */
export const EDITABLE_REMINDER_FIELDS: readonly string[] = [
  "taskId",
  "label",
  "fireAt",
  "originOffsetMinutes",
];
```
Copied by Task 3 — `UpdateSeriesInput` and `EDITABLE_SERIES_FIELDS` follow this
exact shape: a separately-declared partial-update interface plus a closed
`readonly string[]` allowlist, the same absent-vs-null-vs-present convention.

```
# SOURCE: src/worker/dto.ts:83-109
export function toRecurrenceSeriesDto(row: RecurrenceSeries): RecurrenceSeriesDto {
  return {
    id: row.id,
    kind: row.kind,
    freq: row.freq,
    interval: row.interval,
    byWeekday: row.byWeekday,
    byMonthday: row.byMonthday,
    dtstart: row.dtstart,
    timezone: row.timezone,
    anchorMode: row.anchorMode,
    endKind: row.endKind,
    untilDate: row.untilDate,
    maxCount: row.maxCount,
    doneCount: row.doneCount,
    missedCount: row.missedCount,
    status: row.status,
    title: row.title,
    description: row.description,
    priority: row.priority,
    lifeAreaId: row.lifeAreaId,
    dateMode: row.dateMode,
    reminderOffsets: row.reminderOffsets,
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
    updatedAt: toEpochSeconds(row.updatedAt) ?? 0,
  };
}
```
Composed by Task 4 — `toSeriesDto(row, openOccurrenceId)` calls this function and
spreads `openOccurrenceId` onto its result, never re-declaring any of these fields
by hand (the hand-duplicated-entity-types anti-pattern).

```
# SOURCE: src/shared/recurrence.ts:282-284,367-369
export function firstOccurrence(rule: RecurrenceRule): string {
  return rule.dtstart;
}
...
export function occurrenceReminderInstants(day: string, offsets: number[], tz: string): number[] {
  return offsets.map((offset) => offsetToInstant(day, offset, tz));
}
```
Composed by Task 5 — `POST /api/series` calls `firstOccurrence(rule)` for the first
occurrence's `occurrenceDate`, then `occurrenceReminderInstants(occurrenceDate,
reminderOffsets, timezone)` to arm its Reminders — the date field's identity
(deadline vs. scheduled, PRD Decision D9) never changes this call, only which Task
column stores the resulting day string.

```
# SOURCE: src/worker/routes/oauth-callback.ts:103-119
  // ONE operation, not two. Storing the credential and consuming the nonce
  // must not be separable: a termination between two independent awaits would
  // leave the token stored with the nonce still spendable, and the callback
  // URL replayable. `batch()` is D1's only cross-statement atomicity primitive
  // — there is no multi-statement transaction to reach for here.
  await db.batch([
    db
      .insert(googleConnections)
      .values({ ... })
      .onConflictDoUpdate({ ... }),
```
Copied by Task 5 — `POST /api/series` builds its series/task/reminders inserts as
un-awaited Drizzle query builders and passes them as an array into one `db.batch(
[...])`, the same atomicity primitive, so a crash mid-write can never leave a series
row with no occurrence.

```
# SOURCE: src/worker/index.ts:24-28
app.use("/api/*", requireToken);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/reminders", reminderRoutes);
```
Copied by Task 7 — `app.route("/api/series", seriesRoutes);` is added in the same
list, below the single `requireToken` middleware line, so `/api/series` inherits the
token gate structurally (AC-15) rather than needing its own check.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/worker/db/schema.ts` | UPDATE | `recurrenceSeries.priority`: `integer` → `text` enum + CHECK (AC-14) |
| `migrations/0005_*.sql` | CREATE | drizzle-kit-generated migration for the priority enum/CHECK conversion (AC-14); exact filename slug assigned by drizzle-kit at generate time |
| `src/shared/api.ts` | UPDATE | `RecurrenceSeriesDto.priority` type change; add `CreateSeriesInput`, `UpdateSeriesInput`, `SeriesDto`, `EDITABLE_SERIES_FIELDS` |
| `src/worker/dto.ts` | UPDATE | add `toSeriesDto(row, openOccurrenceId)` composing the existing `toRecurrenceSeriesDto` |
| `src/worker/routes/series.ts` | CREATE | `POST /api/series`, `GET /api/series`, `GET /api/series/:id`, `PATCH /api/series/:id` |
| `src/worker/index.ts` | UPDATE | mount `app.route("/api/series", seriesRoutes)` |

## NOT Building (Scope Limits)

- No `complete`/`reopen`/`delete` series awareness — Phase 3 (AC-19..AC-25).
- No *Repetir* UI control or series glyph — Phase 4 (AC-26..AC-28).
- No rule-edit support (`freq`, `interval`, `byWeekday`, `byMonthday`, `dtstart`,
  `anchorMode`, `timezone`, `endKind`, `untilDate`, `maxCount`) — `PATCH
  /api/series/:id` structurally rejects every one of these by name (PRD "What We're
  NOT Building"; D11).
- No series hard-delete — a series can only be ended (`status: "ended"`).
- No decoding/consuming of `byWeekday` for occurrence expansion beyond storage —
  this phase only materializes the FIRST occurrence via `firstOccurrence(rule)`,
  which reads `dtstart` directly; window expansion is unit 17's concern.
- No `missed` sweep, adherence tracking or repeated-miss nudge — units 10-12.
- No Google Calendar mirroring of series or occurrences (ADR-0007 closed inventory).

## Step-by-Step Tasks

### Task 1: UPDATE src/worker/db/schema.ts + src/shared/api.ts — the migration seam
**ACTION** (AC-14): In `src/worker/db/schema.ts`, change `recurrenceSeries.priority` from
`integer("priority")` to `text("priority", { enum: ["high", "normal", "low"] })`,
and add `check("recurrence_series_priority_chk", sql\`${t.priority} is null or
${t.priority} in ('high','normal','low')\`)` to the table's constraint array,
immediately after the existing `recurrence_series_template_chk`. In
`src/shared/api.ts`, change `RecurrenceSeriesDto.priority` from `priority: number |
null` to `priority: TaskPriority | null` (line 93). Make no other change in either
file — `src/worker/dto.ts`'s `toRecurrenceSeriesDto` already maps `priority:
row.priority` field-by-field, so once both sides of the type agree, it compiles
with zero edits.
**MIRROR**: `# SOURCE: src/worker/db/schema.ts:162,205-208` (the `tasks.priority`
enum + CHECK pattern to replicate exactly, with the table-appropriate name)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 2: Generate and apply migration 0005 locally
**ACTION** (AC-14): Run `npm run db:generate` to have drizzle-kit produce
`migrations/0005_*.sql` from Task 1's schema change — expect a table-recreation
migration for `recurrence_series` shaped like `migrations/0001_violet_pretty_boy.sql`
(defer-foreign-keys, `__new_recurrence_series`, `INSERT...SELECT`, `DROP`,
`RENAME`), carrying the `recurrence_series_priority_chk` CHECK. Read the generated
file before applying it. Apply it to the local dev D1 with `npm run db:migrate`.
**MIRROR**: `# SOURCE: migrations/0001_violet_pretty_boy.sql:1-33` (the exact
generation/apply shape to expect and verify)
**VALIDATE**:
```bash
set -euo pipefail
npm run db:generate
if grep -rl "recurrence_series_priority_chk" migrations/*.sql | grep -q "0005"; then
  echo "PASS: migration 0005 carries the recurrence_series_priority_chk CHECK"
else
  echo "FAIL: no migrations/0005_*.sql carries recurrence_series_priority_chk"
  exit 1
fi
npm run db:migrate
```

### Task 3: CREATE (additive) src/shared/api.ts — series wire types
**ACTION** (AC-11, AC-13, AC-16, AC-17): Add to `src/shared/api.ts`: `CreateSeriesInput` (all `RecurrenceRule`
fields required per PRD AC-11/AC-13 — `title`, `freq`, `interval?`, `byWeekday?`,
`byMonthday?`, `dtstart`, `timezone?`, `anchorMode?`, `endKind?`, `untilDate?`,
`maxCount?`, `dateMode`, `reminderOffsets?`, `description?`, `priority?`,
`lifeAreaId?`); `UpdateSeriesInput` (`title?`, `description?`, `priority?`,
`lifeAreaId?`, `reminderOffsets?`, `status?`) mirroring `UpdateReminderInput`'s
absent-vs-null-vs-present convention; `SeriesDto` (`RecurrenceSeriesDto &
{ openOccurrenceId: string | null }`, AC-16); and `EDITABLE_SERIES_FIELDS:
readonly string[] = ["title", "description", "priority", "lifeAreaId",
"reminderOffsets", "status"]` — deliberately excluding every rule field (`freq`,
`interval`, `byWeekday`, `byMonthday`, `dtstart`, `timezone`, `anchorMode`,
`endKind`, `untilDate`, `maxCount`), which is what makes AC-17's rejection
structural rather than a runtime special case.
**MIRROR**: `# SOURCE: src/shared/api.ts:274-291` (the `UpdateReminderInput` +
`EDITABLE_REMINDER_FIELDS` convention this phase's series equivalents follow)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 4: CREATE (additive) src/worker/dto.ts — toSeriesDto
**ACTION** (AC-16): Add `toSeriesDto(row: RecurrenceSeries, openOccurrenceId: string |
null): SeriesDto`, composing the existing `toRecurrenceSeriesDto(row)` and spreading
`openOccurrenceId` onto the result — never re-declaring any of
`toRecurrenceSeriesDto`'s fields by hand.
**MIRROR**: `# SOURCE: src/worker/dto.ts:83-109` (`toRecurrenceSeriesDto` — the
function this task composes, not duplicates)
**VALIDATE**: `npx tsc -b --noEmit`

### Task 5: CREATE src/worker/routes/series.ts — POST, GET, GET /:id
**ACTION** (AC-11, AC-12, AC-13, AC-16): Create `src/worker/routes/series.ts` exporting `seriesRoutes = new
Hono<{ Bindings: Env }>()`, with its own `readJson` helper (byte-identical copy per
the existing per-file convention).
`POST /` validates, one field at a time, exactly the set AC-13 names — non-empty
`title`; `freq` in the four literal values; `interval` (default 1) `>= 1`;
`byMonthday` in `1..31` when present; every `byWeekday` entry in `1..7` when
present; `dtstart` a valid calendar date (`isCalendarDate`); `endKind` in
`never|until|count` with `until` requiring `untilDate` XOR `count` requiring
`maxCount` (never both); `dateMode` in `deadline|scheduled`; `priority` (when
present) a valid `TaskPriority` — returning `400` naming the first offending field
and writing NOTHING on any failure. On success: generate a series id, compute
`occurrenceDate = firstOccurrence(rule)` (Phase 1), build the Task row (`deadline:
occurrenceDate, scheduledDate: null` when `dateMode === "deadline"`, the reverse
otherwise — never both, matching `tasks_single_date_chk`), compute reminder
instants via `occurrenceReminderInstants(occurrenceDate, reminderOffsets ?? [],
timezone ?? PRAESTO_TIMEZONE)` (AC-10/AC-12/D9), and write the series row, the Task
row and one Reminder row per offset in a single `db.batch([...])`. JSON-encode
`byWeekday`/`reminderOffsets` as text before storage (the schema's JSON-text
convention). Respond `201` with `{ series: SeriesDto, occurrence: TaskDto }`.
`GET /` lists every series, each with its `openOccurrenceId` (the `tasks.id` where
`seriesId = series.id AND status = 'open'`, else `null`), mapped through
`toSeriesDto` (AC-16). `GET /:id` returns one series the same way, or `404` when the
id is unknown (AC-16).
**MIRROR**: `# SOURCE: src/worker/routes/reminders.ts:183-191` (readJson);
`# SOURCE: src/shared/recurrence.ts:282-284,367-369` (firstOccurrence /
occurrenceReminderInstants composition); `# SOURCE: src/worker/routes/oauth-callback.ts:103-119`
(db.batch atomicity)
**VALIDATE**: `npx vitest run test/series.test.ts -t "create|read|token"`

### Task 6: UPDATE src/worker/routes/series.ts — PATCH /:id
**ACTION** (AC-17, AC-18): Add `PATCH /:id`: read the body, reject any key outside
`EDITABLE_SERIES_FIELDS` with `400 { error: "Field is not editable: <key>" }`
(structurally satisfies AC-17's "a rule field is rejected with 400 naming it").
When `status` is present, it must equal exactly `"ended"` — any other value is
`400`; setting it updates `recurrenceSeries.status` to `"ended"` and leaves the
currently open occurrence open and unchanged (AC-18: "completing it later spawns
nothing" is Phase 3's concern, out of this task). For the template fields (`title`,
`description`, `priority`, `lifeAreaId`, `reminderOffsets`) present in the body with
`Object.hasOwn`, update the `recurrenceSeries` row, THEN look up the series' current
open Task occurrence: if one exists AND its `detached` flag is `false`, propagate
`title`/`description`/`priority`/`lifeAreaId` (never `reminderOffsets` — armed
Reminders are D4's concern, not re-armed by a template edit) onto that Task row too;
if the occurrence is `detached` (or none exists), leave it untouched (AC-17, second
clause). `404` when the series id is unknown.
**MIRROR**: `# SOURCE: src/worker/routes/reminders.ts:89-106` (closed-allowlist
rejection shape); `# SOURCE: src/worker/routes/tasks.ts:269-270` (the `detached`
check this task reads, inverted: skip propagation when `true`)
**VALIDATE**: `npx vitest run test/series.test.ts -t "patch|template|end"`

### Task 7: UPDATE src/worker/index.ts — mount /api/series
**ACTION** (AC-15): Import `seriesRoutes` from `./routes/series` and add `app.route(
"/api/series", seriesRoutes);` in the same block as the other `app.route(...)`
calls, below `app.route("/api/reminders", reminderRoutes);` and above
`app.route("/api/google", googleRoutes);`.
**MIRROR**: `# SOURCE: src/worker/index.ts:24-28` (the mount-list pattern; the
single `requireToken` middleware line above it is what gives AC-15 for free)
**VALIDATE**: `npx tsc -b --noEmit && npx vitest run test/series.test.ts`

### Task 8: Confirm production holds zero recurrence_series rows (pre-deploy gate)
**ACTION**: Before migration `0005` is EVER applied to the remote/production D1
(never during this task, and never before Tasks 1-7 are code-reviewed) — following
the unit 6 deploy-runbook pattern (`documentation/40-engineering/dev-environment.md#deploy-runbook`)
— run `npx wrangler d1 execute praesto-db --remote --command "SELECT COUNT(*) as
cnt FROM recurrence_series;" --json` and confirm the reported count is `0`. This is
the safety precondition the PRD's Technical Approach names explicitly: the column
being converted has never been written to by any shipped code, but the check makes
that claim verified rather than assumed. If the count is ever non-zero, STOP — do
not apply the migration remotely — and open a new decision about what those rows
are before proceeding.
**MIRROR**: none — this is a data-safety gate, not a code pattern; documented
inline per the deploy runbook it extends
**VALIDATE**:
```bash
set -euo pipefail
RESULT=$(npx wrangler d1 execute praesto-db --remote --command "SELECT COUNT(*) as cnt FROM recurrence_series;" --json)
COUNT=$(node -e 'const r=JSON.parse(process.argv[1]); process.stdout.write(String(r[0].results[0].cnt))' "$RESULT")
if [ "$COUNT" != "0" ]; then
  echo "FAIL: production recurrence_series is not empty (cnt=$COUNT) — do not apply migration 0005 remotely"
  exit 1
else
  echo "PASS: production recurrence_series is empty (cnt=0) — safe to apply migration 0005 remotely"
fi
```
This command requires the deploy operator's own `wrangler` authentication; if it
cannot run in the current environment it fails loudly (per `set -euo pipefail`)
rather than silently reporting PASS — an honest "could not confirm" is the correct
outcome here, not a green check.

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
npx tsc -b --noEmit
npx eslint src/worker/routes/series.ts src/worker/db/schema.ts src/shared/api.ts src/worker/dto.ts src/worker/index.ts
```

### Level 2: UNIT_TESTS
```bash
npx vitest run test/series.test.ts
```
AC-11..AC-18 must all be green. This is the test-writer/test-reviewer's suite
(authored before this plan's tasks run, per `tdd: true`) — the Implementer's job is
to make it pass, not to write it.

### Level 3: INTEGRATION
```bash
set -euo pipefail
npm run db:migrate
npm test
npm run check
```
`npm run db:migrate` proves migration 0005 applies cleanly to the local D1 that
already carries every prior migration. `npm test` runs the full existing suite
(889+ tests) as a regression check — AC-15's token gate and every existing
`test/tasks.test.ts` case must stay green unmodified, since this phase only ADDS a
route and widens one column's type. `npm run check` is the project's combined
type/lint/format gate.

## Acceptance Criteria

- **AC-A1 (PRD AC-11):** `POST /api/series` with a valid monthly-on-the-5th body
  returns `201` with the series and its first occurrence: one `tasks` row with
  `series_id` set, `occurrence_date = "2026-10-05"`, `deadline = "2026-10-05"`,
  `scheduled_date = null`, `status = "open"`, and one unsent `reminders` row with
  `origin_offset_minutes = 1440` and `fire_at = offsetToInstant("2026-10-05",
  1440)`.
- **AC-A2 (PRD AC-12):** The same body with `dateMode: "scheduled"` produces an
  occurrence carrying `scheduled_date = "2026-10-05"`, `deadline = null`, with its
  reminder computed against that scheduled date.
- **AC-A3 (PRD AC-13):** Each of the named invalid-field cases (empty title,
  unknown `freq`, `interval: 0`, `byMonthday: 32`, `byWeekday` outside `1..7`,
  `endKind: "until"` without `untilDate`, both `untilDate` and `maxCount`, an
  invalid date string, an out-of-enum `priority`) returns `400` naming the field
  and writes no row to `recurrence_series`, `tasks` or `reminders`.
- **AC-A4 (PRD AC-14):** Migration `0005` applied; a direct insert with
  `priority = 'urgent'` is rejected by CHECK; `priority` round-trips as the text
  enum through `RecurrenceSeriesDto`.
- **AC-A5 (PRD AC-15):** No bearer token on any `/api/series` route returns `401`
  and writes nothing.
- **AC-A6 (PRD AC-16):** `GET /api/series` and `GET /api/series/:id` return the
  series with its current open occurrence id (or `null`); an unknown id returns
  `404`.
- **AC-A7 (PRD AC-17):** `PATCH /api/series/:id` changing `title`/`priority`
  propagates to the open, non-detached occurrence only, leaves closed rows
  untouched, rejects a rule field (e.g. `freq`) with `400` naming it, and leaves a
  `detached` open occurrence untouched too.
- **AC-A8 (PRD AC-18):** `PATCH /api/series/:id` with `status: "ended"` ends the
  series while the open occurrence stays open.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `EDITABLE_SERIES_FIELDS` accidentally admits a rule field, silently letting the owner break the frozen-rule invariant (D11) | L | High — would corrupt a series' track with no error | The allowlist is a closed, hand-enumerated array (Task 3) reviewed against every `recurrenceSeries` rule column by name; AC-17/AC-A7 tests the rejection directly |
| Migration 0005 is applied remotely while production actually holds `recurrence_series` rows unnoticed | L | High — a table-recreation migration on non-empty data with unverified assumptions | Task 8's explicit pre-deploy zero-rows confirmation gate, with a real fail-closed `VALIDATE`, per the PRD's own Technical Approach |
| Reminder arithmetic double-implemented instead of composed, drifting from unit 7's DST-safe `offsetToInstant` | L | Medium — a wrong `fire_at` on the very first occurrence | `POST /api/series` calls `occurrenceReminderInstants` (Phase 1), which itself only composes `offsetToInstant` — no new date arithmetic is written in this phase, verified by `# SOURCE` citations pinned to the exact composing lines |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in
`docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the Acceptance
Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed
through the `test-writer`/`test-reviewer` pair's lifecycle ledger
(`/relay-write-test` → `/relay-test-write-review`), not authored by the
Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's
diff. No task above and no `## Files to Change` row targets a test file, so this
plan's `**VALIDATE**` commands exercise the change directly (`tsc -b`, `eslint`, the
generated `test/series.test.ts` run, the migration apply, the full `npm test`
regression) rather than the Implementer authoring new coverage.

**`phase_type: feature`, not `foundation` — reasoning recorded per the
orchestrator's instruction to state it explicitly.** This phase does create a new
route family and a migration, which could look "foundation"-shaped. It is scored
`feature` instead because: (1) the seam it builds on — `recurrence_series`/`tasks`
schema, both partial unique indexes, `src/shared/recurrence.ts`'s pure functions,
and unit 7's `offsetToInstant` — already exists and is already tested, so this
phase is not introducing the types/methods its own Acceptance Criteria name, it is
composing existing ones behind new HTTP endpoints; (2) AC-11..AC-18 are precise,
test-first-authorable request/response examples (status codes, exact field values,
exact rejected fields) against that already-existing seam, which is exactly the
`feature` signal, not the `foundation` one; (3) the migration is a one-column type
fix mirroring an exact existing precedent (`migrations/0001`), not a new schema
being introduced. The only `foundation`-shaped artifact here — `EDITABLE_SERIES_FIELDS`
and `SeriesDto` — are additive wire-contract extensions of an established pattern
(`EDITABLE_REMINDER_FIELDS`), not a new seam.

**Why `EDITABLE_SERIES_FIELDS` never includes `dateMode`, `timezone`, `kind` or
`lifeAreaId`'s implicit unit-13 ownership:** `dateMode`/`timezone`/`kind` are rule-
adjacent (they change what the expansion or the reminder arithmetic means for future
occurrences) and are not named in AC-17's tested set, so they are treated the same
as a rule field for this phase — excluded, correctable only by ending the series.
`lifeAreaId` IS included per the Should-priority "template" wording in the PRD's
MoSCoW table, mirroring `EDITABLE_TASK_FIELDS`'s own current exclusion of it (unit
13's future concern) — included here for the series template specifically because
AC-17 exercises "template fields" generically and `lifeAreaId` is unambiguously
template, not rule, vocabulary.

*Generated: 2026-09-23*
*Approved: 2026-09-23*
*Implemented: 2026-09-24*
*Status: IMPLEMENTED*
