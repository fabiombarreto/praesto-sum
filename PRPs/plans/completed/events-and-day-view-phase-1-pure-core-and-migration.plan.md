# Feature: Pure core and migration (Phase 1 of events-and-day-view)

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a plan that downstream test, implement and review stages consume); domain rules for events (a new entity, its provenance and its time model); a new table and migration over the owner's real data; new pure modules compiled into every target (`src/shared/`); export classification (FR-042, ADR-0003's binding safeguard); test-isolation infrastructure (`test/isolation.ts`)
- Decisions found:
  - ADR-0016 / [2026-10-19] The Event is stored as instants plus a zone, with its content hash on the row and its sync link in a table that outlives it (time model, `computeEventContentHash`, `event_sync_links` with `ON DELETE SET NULL`, `events.source`, `eventCapabilities`)
  - ADR-0007 / [2026-08-04] The Event is born sync-aware (provenance, all-day, IANA zone, content hash, a separate `event_sync_links` table); dirty is `content_hash <> synced_content_hash`; limits L1-L3
  - ADR-0003 / [2026-08-03] One Worker, D1, no sync engine; export of 100% of the data is a binding safeguard, so a new table must be classified
  - ADR-0006 / [2026-08-03] Recurrence is unit 17; `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay unchanged
  - ADR-0008 / [2026-08-04] Test-first: the test pair derives the suite from the ACs before the Implementer runs
  - ADR-0001 / ADR-0009 Artifacts, identifiers and tests in English (no visible UI copy in this phase)
  - PRD events-and-day-view D-E (time storage), D-G (content hash), D-H (link table), D-I (provenance), D-P (DST rule), D-R (migration is CREATE-only)
- Applicable anti-patterns:
  - Using `updated_at` as the sync dirty flag (the hash is the dirty signal; `updated_at` is never read for it)
  - Field-level merge of Events; treating absence in a full re-sync as a deletion; CRDT or custom sync engines (the link table is provider identity, never a change-log or tombstone store)
  - Hand-duplicated entity types (the row types are inferred from `schema.ts`; the wire DTO is phase 2)
  - Editing accepted ADRs; Weakening tests to force green; Glossary synonym drift (Event in code, *Compromisso* only as pt-BR copy)
  - Portuguese in artifacts
- Applicable architectural rules:
  - Types flow `src/worker/db/schema.ts` -> `src/worker/dto.ts` -> `src/shared/api.ts` (phase 1 stops at the schema)
  - Migrations are generated only by drizzle-kit and applied by wrangler, then reviewed by hand; `PRAGMA defer_foreign_keys` only for a table rewrite (none here)
  - Domain enums are enforced twice: a TypeScript union and a named SQL CHECK; invariants that protect the owner's data are CHECKs and unique indexes, not conventions
  - `src/shared/` carries no DOM or Worker globals and compiles into every target
  - The export completeness guard fails if a schema table is in neither list; it is updated, never loosened
  - Unit 14 creates only `local` rows; no API route writes `event_sync_links`
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/events-and-day-view.prd.md` — Implementation Phases row 1: "Pure core and migration" — Goal: the Event exists as validated, hashable data in a schema that already carries what unit 15 needs — Success signal: AC-1..AC-8 green; every existing suite still green with the new migration applied.

## Summary

This phase gives the Event its foundation and nothing above it. Two pure, clock-free modules are added to `src/shared/`: `events.ts` (the limits, the `EventSource` union and the exhaustive `eventCapabilities` switch, the RFC 5545 wall-clock-to-instant helper, the all-day exclusive-end arithmetic, `resolveEventTimes` and `validateEventInput`) and `event-hash.ts` (the async SHA-256 `computeEventContentHash` with a `v1` prefix). Two tables, `events` and an empty `event_sync_links`, are added to `src/worker/db/schema.ts` with named CHECKs and unique indexes, and drizzle-kit generates the CREATE-only migration `0007` from them. Because the export completeness guard enumerates the real schema, both tables are classified in `EXPORTED_TABLE_NAMES` in the same phase (the guard's expected list is updated by the test pair, never loosened), and `test/isolation.ts`'s reset helper learns both tables, children first. AC-1 was checked against the shipped `localPartsToInstant`: it agrees on ordinary times and on an overlap but returns the wrong instant inside a DST gap, so the RFC rule lives in a NEW function in `events.ts` and `dates.ts` is not touched. Ten tasks, eight files; no route, DTO, UI or documentation change.

## User Story

As the owner of Praesto Sum
I want a commitment to exist as validated, hashable data in a schema that already carries what Google sync will need
So that the API, the day view and the sheet can be built on it, and unit 15 can write to Google without a migration over my real commitments.

## Problem Statement

Praesto cannot hold a commitment of its own, and unit 15 (writing to Google) cannot start: the Event entity does not exist, and retrofitting its sync-readiness later would be a migration over the owner's real commitments. Today there is no time model for a commitment (instants plus a zone, all-day days with an exclusive end), no validation, no content hash, no provenance column and no `event_sync_links` table anywhere in the repository (`src/worker/db/schema.ts:20-22` lists events as "deliberately absent"). Phase 1 supplies exactly that foundation.

## Solution Statement

Pure first, schema second, classification last. `src/shared/events.ts` and `src/shared/event-hash.ts` are added with the exact exports named in the tasks below, so the test pair can write the AC-1..AC-5 suite against known names before the Implementer runs. `schema.ts` gains `events` and `eventSyncLinks` (ADR-0016 and PRD Architecture Notes), `npm run db:generate` produces `0007`, which is hand-reviewed to contain only `CREATE TABLE` and `CREATE [UNIQUE] INDEX`. The two tables join `EXPORTED_TABLE_NAMES`, and `resetTaskTables()` wipes them children first. The wire types, the repository function, the routes, the dump and the `.ics` are phase 2.

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/` (two new modules), `src/worker/db/schema.ts`, `migrations/` (0007 + meta), `src/worker/db/export-manifest.ts`, `test/isolation.ts` |
| Dependencies | none new: `Intl` and Web Crypto are platform globals; `drizzle-kit@0.31.10` and `wrangler@4.118.0` as already pinned |
| Estimated Tasks | 10 |
| Source PRD line ref | `PRPs/prds/events-and-day-view.prd.md` Implementation Phases row 1; AC-1..AC-8 (lines 70-77), plus AC-19 and AC-33 in part; D-E, D-G, D-H, D-I, D-P, D-R |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/events-and-day-view.prd.md` | 70-77, 173-186, 218-221, 253-257, 264 | AC-1..AC-8, the Architecture Notes (schema, time model, pure core, export), the Phase 1 details and decisions D-E..D-I and D-P |
| P0 | `documentation/60-decisions/ADR-0016-event-storage-model-sync-aware.md` | 19-26 | The six decisions this phase implements: time, hash, link outlives the Event, provenance, wire, range function |
| P0 | `src/shared/dates.ts` | 55-94, 141-211 | `offsetMinutesAt` (composed by the new helper), `instantToLocalParts` (reused) and `localPartsToInstant` (verified, NOT modified) |
| P0 | `src/worker/db/schema.ts` | 1-45, 155-232, 392-445 | Conventions header (to update), the enum + named CHECK idiom, the multi-column shape CHECKs, the boolean and timestamp idioms, the FK and unique-index idioms, the inferred-types block |
| P0 | `src/shared/life-areas.ts` | 1-32 | The pure shared-module convention: header contract, exported limits, error-code union, trim-then-judge validator |
| P0 | `test/isolation.ts` | 36-39, 147-152 | The reset helper that must learn the new tables, children first |
| P0 | `src/worker/db/export-manifest.ts` | 14-57 | The classification lists the completeness guard reads |
| P1 | `src/shared/day-item.ts` | 80-89 | The `assertNever` exhaustiveness idiom `eventCapabilities` mirrors |
| P1 | `src/shared/missed-sweep.ts` | 50-54 | A `Date.UTC`-based local-day shift with no ambient clock |
| P1 | `test/export-completeness.test.ts` | 44-60, 92-102 | What the guard enumerates, and the literal five-name list the test pair must update |
| P1 | `migrations/0000_neat_the_fallen.sql` | 1-10, 46 | The shape drizzle-kit generates: named CHECKs, a unique index, a foreign key with `ON UPDATE cascade ON DELETE set null` |
| P1 | `drizzle.config.ts` | 1-37 | Migrations are generated here and applied by wrangler; never `drizzle-kit migrate` or `push` |
| P1 | `tsconfig.base.json` | 1-23 | `erasableSyntaxOnly`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` constrain how the new modules are written |
| P1 | `tsconfig.test.json` | 1-9 | `tsc -b` includes `test/`, which is why the per-task type checks use `-p tsconfig.worker.json` and `-p tsconfig.app.json` |
| P1 | `docs/context/testing.md` | 65-95 | The isolation rules (`resetTaskTables`, `isolatedIt`) the helper change must preserve |

## Patterns to Mirror

```
# SOURCE: src/shared/life-areas.ts:1-32
/**
 * The pure core of Life Areas (ADR-0015, life-areas PRD AC-12): the name limits,
 * the name validator, the duplicate key and the pt-BR comparator.
 *
 * The `/api/life-areas` route and, from phase 2, the *Áreas* screen both import
 * this module, so the two cannot drift on what a valid, a duplicate or an
 * ordered area name is. Like `search.ts` and `dates.ts` it is compiled into
 * every target, so it carries no DOM globals and no Worker globals.
 */

import { normalizeSearchText } from "./search";

/** The longest a Life Area name may be, counted after trimming (AC-12). */
export const LIFE_AREA_NAME_MAX = 40;

/** The most Life Areas the owner may hold at once (AC-12, ADR-0015). */
export const LIFE_AREA_LIMIT = 12;

/** Why a name is refused: nothing but whitespace, or longer than `LIFE_AREA_NAME_MAX`. */
export type LifeAreaNameError = "blank" | "too_long";

/**
 * Checks a raw name the way both the route and the screen must: it is trimmed
 * first, then judged. Returns an error code, or `null` when the name is valid
 * (the project's validator convention, as in `recurrenceDraftError`). AC-12.
 */
export function validateLifeAreaName(raw: string): LifeAreaNameError | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "blank";
  if (trimmed.length > LIFE_AREA_NAME_MAX) return "too_long";
  return null;
}
```
Copied by Tasks 1, 4 and 5 (module header contract, exported limit constants with a doc comment, an error-code string union, trim-then-judge validation).

```
# SOURCE: src/shared/day-item.ts:80-89
/**
 * The TypeScript handbook's `never`-assertion idiom. Its real work happens at
 * compile time: a `switch` whose default reaches this stops compiling the
 * moment `DaySource` gains a member the switch does not handle. The throw is
 * the runtime half — a branch that should be unreachable must be loud rather
 * than silently return `undefined`.
 */
export function assertNeverDaySource(value: never): never {
  throw new Error(`Unhandled day item source: ${String(value)}`);
}
```
Copied by Task 1 (`assertNeverEventSource` and the exhaustive `eventCapabilities` switch).

```
# SOURCE: src/shared/dates.ts:147-151
export function instantToLocalParts(
  epochSeconds: number,
  timeZone: string = PRAESTO_TIMEZONE,
): { day: string; time: string } {
```
Copied by Task 2 (`instantToWallClock` delegates to it; same `{ day, time }` return shape, `HH:mm`).

```
# SOURCE: src/shared/dates.ts:187-211
export function localPartsToInstant(
  day: string,
  time: string,
  timeZone: string = PRAESTO_TIMEZONE,
): number {
  const [yearText, monthText, dayText] = day.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const date = Number(dayText);
  const [hourText, minuteText] = time.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  const wallClockAsIfUtc = Date.UTC(year, month - 1, date, hours, minutes, 0);

  const firstPassOffset = offsetMinutesAt(new Date(wallClockAsIfUtc), timeZone);
  let instantMs = wallClockAsIfUtc - firstPassOffset * 60_000;

  const secondPassOffset = offsetMinutesAt(new Date(instantMs), timeZone);
  if (secondPassOffset !== firstPassOffset) {
    instantMs = wallClockAsIfUtc - secondPassOffset * 60_000;
  }

  return Math.floor(instantMs / 1000);
}
```
Read by Task 2 and NOT copied: the "wall clock as if UTC" idiom and `offsetMinutesAt` are reused, but this two-pass refinement is replaced because inside a DST gap it lands on the offset AFTER the gap (see Notes, "AC-A1 verification"). This export is not modified.

```
# SOURCE: src/shared/missed-sweep.ts:50-54
/** The calendar day before `day`, derived from an explicit instant only. */
function previousDay(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
```
Copied by Task 3 (`shiftLocalDay`: a local-day shift through `Date.UTC` on explicit components, never an ambient clock).

```
# SOURCE: src/worker/db/schema.ts:392-405
export const cronRuns = sqliteTable(
  "cron_runs",
  {
    id: text("id").primaryKey(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    outcome: text("outcome", { enum: ["success", "failure"] }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    errorMessage: text("error_message"),
  },
  (t) => [
    check("cron_runs_outcome_chk", sql`${t.outcome} in ('success', 'failure')`),
    index("cron_runs_started_at_idx").on(t.startedAt),
  ],
);
```
Copied by Task 6 (the table shape: app-generated text id, nullable and required timestamps, an inline enum literal paired with a named `<table>_<col>_chk`, a named `_idx` index).

```
# SOURCE: src/worker/db/schema.ts:184-193
    detached: integer("detached", { mode: "boolean" }).notNull().default(false),

    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
```
Copied by Task 6 (`all_day` boolean idiom; `start_at`/`end_at`/`synced_at` nullable-timestamp idiom; `created_at`/`updated_at` on `events`).

```
# SOURCE: src/worker/db/schema.ts:219-230
    // A closed Task records when it closed; an open one does not.
    check(
      "tasks_completed_at_chk",
      sql`(${t.status} = 'done' and ${t.completedAt} is not null)
       or (${t.status} <> 'done' and ${t.completedAt} is null)`,
    ),
    // Occurrence rows belong to a series and vice versa.
    check(
      "tasks_occurrence_chk",
      sql`(${t.seriesId} is null and ${t.occurrenceDate} is null)
       or (${t.seriesId} is not null and ${t.occurrenceDate} is not null)`,
    ),
```
Copied by Task 6 (the multi-branch shape CHECK written as an `or` of two fully-qualified branches; `events_shape_chk` follows it).

```
# SOURCE: src/worker/db/schema.ts:171-174
    lifeAreaId: text("life_area_id").references(() => lifeAreas.id, {
      onUpdate: "cascade",
      onDelete: "set null",
    }),
```
Copied by Task 6 (`event_sync_links.event_id` references `events.id` with exactly this option pair).

```
# SOURCE: src/worker/db/schema.ts:41-44
  (t) => [
    uniqueIndex("life_areas_name_unq").on(t.name),
    check("life_areas_name_not_empty", sql`length(trim(${t.name})) > 0`),
  ],
```
Copied by Task 6 (`_unq` unique-index naming and the `_not_empty` title CHECK).

```
# SOURCE: src/worker/db/schema.ts:442-445
export type CronRun = typeof cronRuns.$inferSelect;
export type NewCronRun = typeof cronRuns.$inferInsert;
export type PushDispatchAttempt = typeof pushDispatchAttempts.$inferSelect;
export type NewPushDispatchAttempt = typeof pushDispatchAttempts.$inferInsert;
```
Copied by Task 6 (append the new select/insert pairs after the last pair, in file order).

```
# SOURCE: migrations/0000_neat_the_fallen.sql:1-10
CREATE TABLE `life_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "life_areas_name_not_empty" CHECK(length(trim("life_areas"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `life_areas_name_unq` ON `life_areas` (`name`);--> statement-breakpoint
```
and
```
# SOURCE: migrations/0000_neat_the_fallen.sql:46
	FOREIGN KEY (`life_area_id`) REFERENCES `life_areas`(`id`) ON UPDATE cascade ON DELETE set null,
```
Read by Task 7 (the exact rendering the hand review and the VALIDATE greps expect; the migration itself is generated, never copied).

```
# SOURCE: src/worker/db/export-manifest.ts:14-21
/** The five data-bearing tables, dumped in full, every row. */
export const EXPORTED_TABLE_NAMES: readonly string[] = [
  "life_areas",
  "recurrence_series",
  "tasks",
  "reminders",
  "google_calendar_selections",
] as const;
```
Copied by Task 8 (append two names; the doc comment is updated).

```
# SOURCE: test/isolation.ts:147-152
export async function resetTaskTables(): Promise<void> {
  await settleRunningBodies();
  const db = createDb(env);
  await db.delete(tasks);
  await db.delete(recurrenceSeries);
}
```
Copied by Task 9 (two more deletes placed before the existing two, link table first; the import line at `test/isolation.ts:39` gains the two table names).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/events.ts` | CREATE | The pure Event core: limits, `EventSource`, `eventCapabilities`, wall-clock to instant, all-day arithmetic, `resolveEventTimes`, `validateEventInput` (AC-A1, AC-A2, AC-A3, AC-A5) |
| `src/shared/event-hash.ts` | CREATE | `computeEventContentHash`, the async SHA-256 over seven fields behind a `v1` prefix (AC-A4) |
| `src/worker/db/schema.ts` | UPDATE | The `events` and `eventSyncLinks` tables, named CHECKs, indexes, inferred types; the stale "deliberately absent" header comment (AC-A6, AC-A7) |
| `migrations/0007_<drizzle-generated-name>.sql` | CREATE | Generated by `npm run db:generate`; CREATE TABLE and CREATE [UNIQUE] INDEX only, never hand-written (AC-A8) |
| `migrations/meta/0007_snapshot.json` | CREATE | Written by drizzle-kit alongside the migration |
| `migrations/meta/_journal.json` | UPDATE | drizzle-kit appends the `0007` entry |
| `src/worker/db/export-manifest.ts` | UPDATE | Classify both new tables in `EXPORTED_TABLE_NAMES` so the completeness guard stays green without being loosened (AC-A10) |
| `test/isolation.ts` | UPDATE | `resetTaskTables()` wipes `event_sync_links` then `events` before the existing deletes (supports AC-A6, AC-A7) |

## NOT Building (Scope Limits)

- Any route (`/api/events`), the single repository function that writes events, `EventDto` / `CreateEventInput` / `UpdateEventInput` / `EDITABLE_EVENT_FIELDS`, or any `dto.ts` mapper (phase 2: AC-9..AC-17).
- The `from`/`to` window on the Google read route, event search, the dump rows for the new tables, `ExportTables`, the export envelope and route, the `.ics` events, and the fixture restore drill (phase 2: AC-18..AC-21). Phase 1 only classifies the tables in the manifest.
- `itemsInRange`, the `local` `DayItem` variant, the exhaustive `bucketOf` switch, the `/day` route, `DayScreen` and the Agenda change (phase 3).
- The draft/patch builders, `CompromissoSheet`, search results and every UI string (phase 4). This phase has no UI, so the UI/UX checklist does not apply.
- Release `v0.14.0`, chore C6, the remote migration apply, the device proof and the documentation sync (glossary, layout standard, `docs/api-reference.md`, `architecture-overview.md`, `docs/context/architecture.md`) — all phase 5 per PRD D-T and AC-34.
- Writing to Google, storing Google events in D1, recurrence and exceptions, reminders on Events, a Life Area on Events, Task links, guests, colour, busy/free, visibility, attachments (units 15, 17, 18, 13, 20 and the PRD's "What We're NOT Building").
- Any change to `src/shared/dates.ts`, `src/shared/recurrence.ts` or `src/shared/adherence.ts`, and to migrations `0000` to `0006`.
- Authoring or editing any `*.test.ts` file: the test pair (`test-writer`/`test-reviewer`) owns them (see Notes).

## Step-by-Step Tasks

### Task 1: CREATE src/shared/events.ts — header, limits, source union, capabilities, error types

- **ACTION**: Create the file with a header comment stating that it is pure, clock-free and database-free, compiled into every target, uses only `Intl`, `Date.UTC` and its same-directory sibling `./dates` (no DOM, no Worker, no Drizzle import), and implements ADR-0016 decisions 1 and 4. Export, with exactly these names: `EVENT_TITLE_MAX = 200`, `EVENT_DESCRIPTION_MAX = 5000`, `EVENT_LOCATION_MAX = 200`, `EVENT_DEFAULT_DURATION_SECONDS = 3600` (each with a doc comment saying the limit is arbitrary and one constant to change, per the PRD Open Questions); `EVENT_SOURCES = ["local", "google"] as const` and `type EventSource = (typeof EVENT_SOURCES)[number]`; `interface EventCapabilities { editable: boolean; deletable: boolean; opensInGoogle: boolean }`; `assertNeverEventSource(value: never): never` (throws, as `assertNeverDaySource` does); and `eventCapabilities(source: EventSource): EventCapabilities` as a `switch` with a `case "local"` returning `{ editable: true, deletable: true, opensInGoogle: false }`, a `case "google"` returning `{ editable: false, deletable: false, opensInGoogle: true }` and a `default` that returns `assertNeverEventSource(source)`, so adding a member to `EVENT_SOURCES` stops compiling. Also export the shared error vocabulary the later tasks use: `type EventField = "title" | "description" | "location" | "allDay" | "startAt" | "endAt" | "startDate" | "endDate" | "timezone"`, `type EventErrorCode = "blank" | "too_long" | "required" | "not_allowed" | "invalid_date" | "unknown_zone" | "end_before_start" | "end_not_after_start"`, `interface EventValidationError { field: EventField; code: EventErrorCode }` and `type EventResult<T> = { ok: true; value: T } | { ok: false; error: EventValidationError }`. Do not add the `./dates` import yet (Task 2 adds it). Delivers AC-A5 (PRD AC-5: `local` is editable and deletable and does not open in Google; `google` is neither editable nor deletable and opens in Google; exhaustive switch).
- **MIRROR**: `# SOURCE: src/shared/life-areas.ts:1-32` and `# SOURCE: src/shared/day-item.ts:80-89` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json; node -e "import('./src/shared/events.ts').then((m) => { const l = m.eventCapabilities('local'); const g = m.eventCapabilities('google'); if (!(l.editable === true && l.deletable === true && l.opensInGoogle === false && g.editable === false && g.deletable === false && g.opensInGoogle === true)) { console.error('eventCapabilities wrong', l, g); process.exit(1); } })"` (type-checks both targets that compile `src/shared/`, then runs the real function through Node's built-in type stripping, available at the `engines` floor of Node 24; the probe is meant to be run right after this task, because Task 2 adds the module's first extensionless relative import, which Node cannot resolve)

### Task 2: UPDATE src/shared/events.ts — wall-clock to instant under the RFC 5545 rule

- **ACTION**: Add `import { instantToLocalParts, offsetMinutesAt } from "./dates";` and export `wallClockToInstant(day: string, time: string, timeZone: string): number` (epoch seconds; `day` is `YYYY-MM-DD`, `time` is `HH:mm`; the zone is a required argument, no default) and `instantToWallClock(epochSeconds: number, timeZone: string): { day: string; time: string }`, which simply returns `instantToLocalParts(epochSeconds, timeZone)`. Implement `wallClockToInstant` as RFC 5545 section 3.3.5 requires, and do NOT delegate to `localPartsToInstant`: take `wall = Date.UTC(y, m - 1, d, hh, mm, 0)` (a number read as if it were UTC); probe the zone's offsets one day either side, `before = offsetMinutesAt(new Date(wall - 86_400_000), tz)` and `after = offsetMinutesAt(new Date(wall + 86_400_000), tz)`; for each distinct offset `o` of those two the candidate instant is `wall - o * 60_000`, and it is VALID only when `offsetMinutesAt(new Date(candidate), tz) === o`; return `Math.floor(Math.min(...validCandidates) / 1000)` (an overlap leaves two valid candidates and the earlier is the first occurrence); when no candidate is valid the local time falls in a gap, so return `Math.floor((wall - before * 60_000) / 1000)` (the offset before the gap). Worked through for the three AC-1 cases: `America/Sao_Paulo` (fixed -03:00) has one valid candidate, 12:30Z; `America/New_York` `2026-11-01 01:30` has valid candidates 05:30Z (EDT) and 06:30Z (EST) and returns 05:30Z; `2026-03-08 02:30` has no valid candidate (07:30Z would be 03:30 EDT, 06:30Z would be 01:30 EST) and returns `wall + 5 h` = 07:30Z. Leave `src/shared/dates.ts` byte-identical: Reminders still use `localPartsToInstant`. Delivers AC-A1 (PRD AC-1).
- **MIRROR**: `# SOURCE: src/shared/dates.ts:147-151` for the return shape; `# SOURCE: src/shared/dates.ts:187-211` is read, not copied (its gap result differs; see Notes).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json; git diff --exit-code "$(git merge-base HEAD main)" -- src/shared/dates.ts` (type-checks both targets and proves `dates.ts` was not edited; the behaviour of the three AC-1 instants is exercised by the pair-authored suite in Level 2)

### Task 3: UPDATE src/shared/events.ts — local-day arithmetic and the all-day exclusive end

- **ACTION**: Export `isValidLocalDay(day: string): boolean` (matches `^\d{4}-\d{2}-\d{2}$` and survives a `Date.UTC` round trip, so `2026-02-30` is false and `2028-02-29` is true); `shiftLocalDay(day: string, delta: number): string` (a `Date.UTC` shift on explicit components that crosses month and year boundaries: `2026-10-31` + 1 = `2026-11-01`, `2026-12-31` + 1 = `2027-01-01`); `displayEndDay(endDate: string): string`, which turns a stored EXCLUSIVE all-day end into the inclusive last day shown to the owner (`2026-10-28` -> `2026-10-27`); and `allDaySpanFromInclusive(startDate: string, lastDayInclusive?: string | null): EventResult<{ startDate: string; endDate: string }>`, the form-side helper that turns the owner's inclusive last day into Google's exclusive end: `("2026-10-26", "2026-10-27")` -> `{ startDate: "2026-10-26", endDate: "2026-10-28" }`; a missing or equal last day is a single day, so `2026-10-20` stores end `2026-10-21`; a last day before the start returns `{ ok: false, error: { field: "endDate", code: "end_not_after_start" } }`; an invalid start returns `{ field: "startDate", code: "invalid_date" }`. No function reads a clock. Delivers AC-A2 (PRD AC-2).
- **MIRROR**: `# SOURCE: src/shared/missed-sweep.ts:50-54` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json` (the day arithmetic is proved by the pair-authored suite in Level 2)

### Task 4: UPDATE src/shared/events.ts — resolveEventTimes and validateEventInput

- **ACTION**: Export `EVENT_DEFAULT_TIMEZONE` (re-exporting `PRAESTO_TIMEZONE` from `./dates`, so it cannot drift from `recurrence_series.timezone`); `isValidTimeZone(timeZone: string): boolean` (true iff `new Intl.DateTimeFormat("en-US", { timeZone })` constructs without a `RangeError`; `Mars/Base` and the empty string are false); and these types: `EventTimesInput { allDay: boolean; startAt?: number | null; endAt?: number | null; startDate?: string | null; endDate?: string | null }`, `EventTimes { allDay: boolean; startAt: number | null; endAt: number | null; startDate: string | null; endDate: string | null }`, `EventInput` (the `EventTimesInput` fields plus `title: string`, `description?: string | null`, `location?: string | null`, `timezone?: string | null`) and `ResolvedEvent` (`title: string; description: string | null; location: string | null; allDay: boolean; startAt: number | null; endAt: number | null; startDate: string | null; endDate: string | null; timezone: string`). Export `resolveEventTimes(input: EventTimesInput): EventResult<EventTimes>`: for a timed event `startAt` is required (a missing or non-integer value is `{ field: "startAt", code: "required" }`), a missing `endAt` becomes `startAt + EVENT_DEFAULT_DURATION_SECONDS`, an `endAt` before `startAt` is `{ field: "endAt", code: "end_before_start" }` while an `endAt` equal to `startAt` is accepted, and any non-null `startDate` or `endDate` is `{ code: "not_allowed" }` on that field; for an all-day event `startDate` is required and must pass `isValidLocalDay` (`required` / `invalid_date` on `startDate`), a missing `endDate` becomes `shiftLocalDay(startDate, 1)`, an invalid `endDate` is `{ field: "endDate", code: "invalid_date" }`, an `endDate` that is not after `startDate` (equal or earlier) is `{ field: "endDate", code: "end_not_after_start" }`, and any non-null `startAt` or `endAt` is `{ code: "not_allowed" }` on that field. Export `validateEventInput(input: EventInput): EventResult<ResolvedEvent>` that checks in this fixed order and returns the FIRST failure: title (trimmed; empty is `{ field: "title", code: "blank" }`, longer than `EVENT_TITLE_MAX` is `too_long`), description and location (trimmed; longer than their maxima is `too_long`; an empty trimmed value is stored as `null`), the zone (a missing or null zone becomes `EVENT_DEFAULT_TIMEZONE`; an invalid one is `{ field: "timezone", code: "unknown_zone" }`), then `resolveEventTimes`. Lengths are `String.length` of the trimmed value, the unit `validateLifeAreaName` uses. Typeof checks of an untrusted JSON body stay in the phase 2 route. A 200-character title, `America/Sao_Paulo` and a timed end equal to its start are accepted. Delivers AC-A3 (PRD AC-3) and AC-A2's stored-span rule (an all-day end not after its start is rejected).
- **MIRROR**: `# SOURCE: src/shared/life-areas.ts:1-32` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json` (the defaults and each error code are proved by the pair-authored suite in Level 2)

### Task 5: CREATE src/shared/event-hash.ts — computeEventContentHash

- **ACTION**: Create the file with NO imports, a header saying it is pure and uses only Web Crypto and `TextEncoder`, which exist in the browser, workerd and Node alike (no Node `crypto` import), and documenting the canonicalization byte for byte. Export `interface EventHashInput { title: string; description: string | null | undefined; location: string | null | undefined; allDay: boolean; startAt: number | null; endAt: number | null; startDate: string | null; endDate: string | null; timezone: string }` (structurally the same as `ResolvedEvent`; declare it here rather than importing, so the module stays import-free) and `computeEventContentHash(input: EventHashInput): Promise<string>`. The digest is the lowercase hex, exactly 64 characters, of `crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))` where `canonical = "v1\n" + JSON.stringify([title.trim(), (description ?? "").trim(), (location ?? "").trim(), allDay, allDay ? startDate : startAt, allDay ? endDate : endAt, timezone])`. Epoch seconds are plain numbers (a caller holding a `Date` converts first). Only these seven fields are read, so `id`, `source`, `createdAt`, `updatedAt` and any other key on the object are ignored, and the order of the object's keys is irrelevant. Bump the `v1` prefix whenever a hashed field is added (ADR-0016 consequences). Document in the header the fixed example `{ title: "Dentista", description: null, location: "Clínica Sorriso", allDay: false, startAt: 1792499400, endAt: 1792503000, startDate: null, endDate: null, timezone: "America/Sao_Paulo" }` whose canonical string is `v1` + newline + `["Dentista","","Clínica Sorriso",false,1792499400,1792503000,"America/Sao_Paulo"]`; the test pair computes its SHA-256 independently and pins it. Do not read `.attendees`, `.reminders` or `.recurrence` anywhere (the mirror-inventory tripwire scans `src/`). Delivers AC-A4 (PRD AC-4).
- **MIRROR**: `# SOURCE: src/shared/life-areas.ts:1-32` (header contract and exported-constant style).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx tsc -p tsconfig.app.json; node -e "import('./src/shared/event-hash.ts').then(async (m) => { const base = { title: 'Dentista', description: null, location: 'Clinica Sorriso', allDay: false, startAt: 1792499400, endAt: 1792503000, startDate: null, endDate: null, timezone: 'America/Sao_Paulo' }; const a = await m.computeEventContentHash(base); const same = await m.computeEventContentHash({ timezone: 'America/Sao_Paulo', id: 'other-id', source: 'google', createdAt: 5, ...base, title: '  Dentista ', description: '' }); const other = await m.computeEventContentHash({ ...base, endAt: 1792503001 }); if (a.length !== 64 || /[^0-9a-f]/.test(a) || a !== same || a === other) { console.error('hash invariants violated', a, same, other); process.exit(1); } })"` (type-checks both targets, then runs the real function: a 64-character lowercase hex digest, equal when only trimming, null versus empty description and non-hashed keys differ, different when the end differs)

### Task 6: UPDATE src/worker/db/schema.ts — the events and event_sync_links tables

- **ACTION**: Rewrite the header paragraph at `schema.ts:20-22` so it no longer says events are "deliberately absent": it must say `event_exceptions`, `task_events` (N:N) and `reminders.event_id` are still absent (later phases and units), and that `events` and `event_sync_links` arrived with unit 14 (ADR-0016). Add `export const events = sqliteTable("events", ...)` with columns `id` (`text("id").primaryKey()`), `title` (`text("title").notNull()`), `description` and `location` (nullable text), `allDay` (`integer("all_day", { mode: "boolean" }).notNull()`), `startAt` and `endAt` (`integer("start_at"/"end_at", { mode: "timestamp" })`, nullable), `startDate` and `endDate` (nullable text, local `YYYY-MM-DD`), `timezone` (`text("timezone").notNull()`), `source` (`text("source", { enum: ["local", "google"] }).notNull().default("local")`), `contentHash` (`text("content_hash").notNull()`), and `createdAt`/`updatedAt` exactly as `tasks` declares them. Give NO SQL default to `all_day`, `timezone` or `content_hash` (AC-A6 requires that omitting them is refused, not filled). Extra config, in this order: an `index` named `events_start_at_idx` on `t.startAt`; an `index` named `events_start_date_idx` on `t.startDate`; a `check` named `events_title_not_empty` whose `sql` template is `length(trim(<title>, char(32, 9, 10, 13))) > 0` (plain `trim()` strips only spaces, so a tab-only or newline-only title would otherwise pass); a `check` named `events_source_chk` whose template is `<source> in ('local','google')`; and a `check` named `events_shape_chk` whose template is the `or` of two branches, `(all_day = 1 and start_at is null and end_at is null and start_date is not null and end_date is not null and end_date > start_date) or (all_day = 0 and start_date is null and end_date is null and start_at is not null and end_at is not null and end_at >= start_at)`, with each column interpolated from `t` (for example `${t.allDay}`) in the style of `tasks_completed_at_chk` (every `and` chain contains a term that is never NULL, so the CHECK cannot silently pass on a NULL). Add `export const eventSyncLinks = sqliteTable("event_sync_links", ...)` with `id` (text primary key), `eventId` (`text("event_id").references(() => events.id, { onUpdate: "cascade", onDelete: "set null" })`, nullable), `calendarId` and `externalEventId` (`text("calendar_id")` / `text("external_event_id")`, both `.notNull()`), `etag` and `syncedContentHash` (nullable text) and `syncedAt` (nullable `timestamp` integer); extra config `uniqueIndex("event_sync_links_event_id_unq").on(t.eventId)` (a nullable unique column: SQLite lets orphan rows coexist) and `uniqueIndex("event_sync_links_external_unq").on(t.calendarId, t.externalEventId)`. Append `export type EventRow = typeof events.$inferSelect; export type NewEventRow = typeof events.$inferInsert; export type EventSyncLink = typeof eventSyncLinks.$inferSelect; export type NewEventSyncLink = typeof eventSyncLinks.$inferInsert;` after the last pair of the types block, with a one-line comment that `Event` is not used as a type name because it would shadow the DOM global. Import nothing new into `schema.ts` (drizzle-kit loads it on its own), and keep the `source` enum as an inline literal like every other enum in the file. Delivers AC-A6 (PRD AC-6) and AC-A7 (PRD AC-7).
- **MIRROR**: `# SOURCE: src/worker/db/schema.ts:392-405`, `# SOURCE: src/worker/db/schema.ts:184-193`, `# SOURCE: src/worker/db/schema.ts:219-230`, `# SOURCE: src/worker/db/schema.ts:171-174`, `# SOURCE: src/worker/db/schema.ts:41-44` and `# SOURCE: src/worker/db/schema.ts:442-445` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json` (the schema compiles with the new tables and exported row types; the SQL itself is generated and inspected in Task 7; the completeness guard is not run here because it stays red until Task 8 classifies the tables)

### Task 7: CREATE migrations/0007_<drizzle-generated-name>.sql — generate, review, apply

- **ACTION**: Run `npm run db:generate`. Accept the single generated `migrations/0007_<drizzle-generated-name>.sql`, its `migrations/meta/0007_snapshot.json` and the `migrations/meta/_journal.json` entry exactly as emitted; never write the SQL by hand, never run `drizzle-kit migrate` or `push`. Read the generated SQL end to end and confirm: it holds only `CREATE TABLE` for `events` and `event_sync_links` and `CREATE INDEX` / `CREATE UNIQUE INDEX` statements; it contains no `ALTER`, `DROP`, `PRAGMA` or `__new_`; the three named CHECKs of `events` (`events_title_not_empty`, `events_source_chk`, `events_shape_chk`) appear as `CONSTRAINT "<name>" CHECK(...)`; `event_sync_links` carries ``FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE cascade ON DELETE set null``; and the two unique indexes and the two `events` indexes exist. If drizzle emits anything other than CREATE statements, fix `schema.ts` (Task 6) and regenerate; do not hand-edit around it. Then apply it locally with `npm run db:migrate` (wrangler). Migrations `0000` to `0006` and their snapshots are not touched. Delivers AC-A8 (PRD AC-8), and makes AC-A6 and AC-A7 runnable (the test D1 applies every migration automatically).
- **MIRROR**: `# SOURCE: migrations/0000_neat_the_fallen.sql:1-10` and `# SOURCE: migrations/0000_neat_the_fallen.sql:46` (the expected rendering; nothing is copied).
- **VALIDATE**: `` set -euo pipefail; test "$(ls migrations/0007_*.sql | wc -l)" -eq 1; f="$(ls migrations/0007_*.sql)"; test -f "$f"; test -f migrations/meta/0007_snapshot.json; grep -q '0007_' migrations/meta/_journal.json; if grep -nEi '\b(alter|drop|pragma)\b|__new_' "$f"; then echo "FAIL: 0007 is not CREATE-only"; exit 1; else echo "PASS: 0007 is CREATE-only"; fi; grep -q 'CREATE TABLE `events`' "$f"; grep -q 'CREATE TABLE `event_sync_links`' "$f"; grep -q 'CONSTRAINT "events_shape_chk" CHECK(' "$f"; grep -q 'REFERENCES `events`(`id`) ON UPDATE cascade ON DELETE set null' "$f"; npm run db:migrate; npx wrangler d1 execute praesto-db --local --command "SELECT count(*) FROM events"; npx wrangler d1 execute praesto-db --local --command "SELECT count(*) FROM event_sync_links" `` (the migration applies to the local D1 and both tables answer a query; a missing table makes wrangler exit non-zero; re-running is safe because wrangler records applied migrations)

### Task 8: UPDATE src/worker/db/export-manifest.ts — classify the two new tables

- **ACTION**: Append `"events"` and `"event_sync_links"` to `EXPORTED_TABLE_NAMES` and update its doc comment from "The five data-bearing tables" to say the list now holds seven and that `events` and `event_sync_links` were classified here in unit 14 phase 1 so that the schema-enumerating completeness guard stays green, while the dump route, the envelope and the `.ics` start emitting them in phase 2 (no code path can create an Event row before then). Do not touch `EXCLUDED_TABLES`: the tables are owner data, and listing them as excluded would contradict FR-042 and ADR-0016 decision 3 (the link table is dumped so a restore cannot orphan links). The test pair updates `test/export-completeness.test.ts` in the same phase (its sorted literal list of exported names grows from five to seven; the guard's logic and its fixture cases are unchanged). Delivers AC-A10 (PRD AC-19, classification half).
- **MIRROR**: `# SOURCE: src/worker/db/export-manifest.ts:14-21` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.worker.json; npx vitest run --project worker export-completeness` (the guard suite, with the real schema now holding the new tables, passes once they are classified; it runs the pair-updated expected lists)

### Task 9: UPDATE test/isolation.ts — the reset helper learns both tables, children first

- **ACTION**: Extend the schema import at `test/isolation.ts:39` with `eventSyncLinks` and `events`, and in `resetTaskTables()` add `await db.delete(eventSyncLinks);` then `await db.delete(events);` immediately after `const db = createDb(env);` and before the existing `await db.delete(tasks);`, so the wipe runs children first (link table, then events, then tasks, then series). Change nothing else in the file: `settleRunningBodies()`, `isolatedIt`, `pendingBodyCount` and `DRAIN_BUDGET_MS` stay as they are, and `reset()` from `cloudflare:test` is still not used. This file matches no R-X test glob (it is neither `*.test.ts` nor under `__tests__/`, `tests/` or `spec/`) and it can only change after Task 6 gives it the table exports; every `*.test.ts` file still goes through the test pair. Infrastructure task: delivers no criterion by itself; it supports AC-A6 and AC-A7 (the schema suite wipes between tests with this helper).
- **MIRROR**: `# SOURCE: test/isolation.ts:147-152` (Patterns to Mirror).
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.test.json; npx vitest run --project worker isolation export` (the whole test target type-checks, then the isolation canary and every export suite, which all use the helper, still pass against the migrated database)

### Task 10: VERIFY the pure modules and the frozen files

- **ACTION**: Verification only, no source edit; target files `src/shared/events.ts` and `src/shared/event-hash.ts`. Confirm both new modules are pure (no clock read, no DOM, Worker, Drizzle or Hono import), that `event-hash.ts` has no import at all and `events.ts` imports only `./dates`, and that `src/shared/recurrence.ts`, `src/shared/adherence.ts`, `src/shared/dates.ts` and migrations `0000` to `0006` (SQL and snapshots) are byte-identical to the fork point from `main`. Infrastructure/verification task: it delivers AC-A9 (PRD AC-33, the frozen-file part) by checking, and adds no behaviour.
- **MIRROR**: `# SOURCE: src/shared/life-areas.ts:1-32` (the purity contract in the header).
- **VALIDATE**: `set -euo pipefail; test -f src/shared/events.ts; test -f src/shared/event-hash.ts; if cat src/shared/events.ts src/shared/event-hash.ts | grep -vE '^[[:space:]]*(//|/\*|\*)' | grep -nE 'Date\.now\(|new Date\(\)|performance\.now|\bwindow\.[A-Za-z]|\bdocument\.[A-Za-z]|\bnavigator\.[A-Za-z]|localStorage|cloudflare:|from "hono|from "drizzle-orm'; then echo "FAIL: impure or environment-bound construct in a new shared module"; exit 1; else echo "PASS: new shared modules are pure"; fi; test -z "$(grep -hE '^import ' src/shared/event-hash.ts || true)"; test -z "$(grep -hE '^import ' src/shared/events.ts | grep -vE 'from "\./dates"' || true)"; base="$(git merge-base HEAD main)"; for f in src/shared/recurrence.ts src/shared/adherence.ts src/shared/dates.ts migrations/0000_neat_the_fallen.sql migrations/0001_violet_pretty_boy.sql migrations/0002_lazy_earthquake.sql migrations/0003_brave_dexter_bennett.sql migrations/0004_massive_ser_duncan.sql migrations/0005_quiet_rogue.sql migrations/0006_goofy_zombie.sql; do test -f "$f"; git diff --exit-code "$base" -- "$f"; done` (both shared files are new, so the whole file is the diff; whole-line comments are skipped because the module headers legitimately name what the modules do not do; the frozen files are checked individually after confirming each exists, so a missing path cannot pass vacuously)

## Validation Commands

### Level 1 STATIC_ANALYSIS

```bash
set -euo pipefail
# wrangler types --check + tsc -b (includes test/) + eslint + prettier --check.
# Run `npx prettier --write` on the touched src files first; the test files are formatted by the test pair.
npm run check
```

### Level 2 UNIT_TESTS

```bash
set -euo pipefail
# The whole suite, both vitest projects: the pair-authored AC-1..AC-8 suites run here.
# A local runner flake (exit 127 with no failing test) gets exactly one retry; a real
# failing test fails both attempts and fails this gate.
if ! npx vitest run; then
  echo "first vitest run failed - retrying once"
  npx vitest run
fi
# Frozen files and the old migrations are byte-identical to the fork point from main.
base="$(git merge-base HEAD main)"
for f in \
  src/shared/recurrence.ts src/shared/adherence.ts src/shared/dates.ts \
  migrations/0000_neat_the_fallen.sql migrations/0001_violet_pretty_boy.sql \
  migrations/0002_lazy_earthquake.sql migrations/0003_brave_dexter_bennett.sql \
  migrations/0004_massive_ser_duncan.sql migrations/0005_quiet_rogue.sql \
  migrations/0006_goofy_zombie.sql \
  migrations/meta/0000_snapshot.json migrations/meta/0001_snapshot.json \
  migrations/meta/0002_snapshot.json migrations/meta/0003_snapshot.json \
  migrations/meta/0004_snapshot.json migrations/meta/0005_snapshot.json \
  migrations/meta/0006_snapshot.json; do
  test -f "$f"
  git diff --exit-code "$base" -- "$f"
done
```

### Level 3 INTEGRATION

```bash
set -euo pipefail
# The generated migration applies to the local D1 through wrangler (never drizzle-kit migrate/push),
# and both tables answer a query (a missing table makes wrangler exit non-zero). Re-runnable.
npm run db:migrate
npx wrangler d1 execute praesto-db --local --command "SELECT count(*) FROM events"
npx wrangler d1 execute praesto-db --local --command "SELECT count(*) FROM event_sync_links"
# Exactly one new migration, and it is CREATE-only.
test "$(ls migrations/0007_*.sql | wc -l)" -eq 1
f="$(ls migrations/0007_*.sql)"
test -f "$f"
if grep -nEi '\b(alter|drop|pragma)\b|__new_' "$f"; then
  echo "FAIL: 0007 is not CREATE-only"; exit 1
else
  echo "PASS: 0007 is CREATE-only"
fi
```

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** `wallClockToInstant` resolves `2026-10-20` `09:30` in `America/Sao_Paulo` to `Date.UTC(2026, 9, 20, 12, 30) / 1000`; `2026-11-01` `01:30` in `America/New_York` (an hour that occurs twice) to its first occurrence, `Date.UTC(2026, 10, 1, 5, 30) / 1000`; `2026-03-08` `02:30` in `America/New_York` (an hour that does not exist) with the offset before the gap, `Date.UTC(2026, 2, 8, 7, 30) / 1000`; and `instantToWallClock` of an ordinary instant returns the same day and time. The existing `localPartsToInstant` export of `src/shared/dates.ts` is unchanged.
- **AC-A2 (PRD AC-2):** `allDaySpanFromInclusive("2026-10-26", "2026-10-27")` gives `startDate` `2026-10-26` and `endDate` `2026-10-28` (exclusive); a single day `2026-10-20` stores end `2026-10-21`; `displayEndDay("2026-10-28")` returns `2026-10-27`; a last day before the start is an error naming `endDate`; and an all-day span whose end is not after its start is rejected (`end_not_after_start`) by `resolveEventTimes`.
- **AC-A3 (PRD AC-3):** `validateEventInput` gives a timed start with no end an end of start + 3600 s; an all-day start with no end the next day (`2026-10-31` -> `2026-11-01`, `2026-12-31` -> `2027-01-01`); and returns `{ ok: false, error: { field, code } }` naming the field for a blank or whitespace title, a 201-character title, an unknown zone (`Mars/Base`), an end before the start and an all-day end equal to its start, while a 200-character title, `America/Sao_Paulo` and a timed end equal to its start are accepted.
- **AC-A4 (PRD AC-4):** `computeEventContentHash` is equal for two inputs that differ only in `id`, `source` or timestamps; differs when any one of the seven fields differs; treats `""` and `null` description as equal; ignores surrounding whitespace in title, description and location; ignores key order; and yields, for the fixed input documented in the module, a fixed 64-character lowercase hex digest pinned in the test so a change of canonicalization is a visible, versioned event.
- **AC-A5 (PRD AC-5):** `eventCapabilities("local")` is editable and deletable and does not open in Google; `eventCapabilities("google")` is neither editable nor deletable and opens in Google; the function is an exhaustive switch over `EventSource`, so adding a value stops compiling.
- **AC-A6 (PRD AC-6):** On the migrated test database, rows inserted directly (bypassing every route) with a blank title, a `source` of `outlook`, an all-day row with `start_at` set, a timed row with dates set, an all-day row whose `end_date` is not after `start_date`, a timed row whose `end_at` is before `start_at`, and a null `timezone`, `content_hash` or `all_day` are each rejected by SQL, while a valid timed row and a valid all-day row are accepted.
- **AC-A7 (PRD AC-7):** Given event E and a link row for E under calendar `c1` and external id `x1`, a second link with the same (`c1`, `x1`) and a second link for E are each rejected; deleting E leaves the link with `event_id` null and changes no other row; two orphan links with different external ids coexist; and a freshly migrated database holds zero rows in `event_sync_links`.
- **AC-A8 (PRD AC-8):** `migrations/` holds exactly one new file `0007_*.sql`; it contains only `CREATE TABLE` and `CREATE [UNIQUE] INDEX` statements for `events` and `event_sync_links` — no `ALTER`, `DROP`, `PRAGMA` or `__new_` rebuild — and migrations `0000` to `0006` are byte-identical to `main`.
- **AC-A9 (PRD AC-33):** `src/shared/recurrence.ts` and `src/shared/adherence.ts` (and `src/shared/dates.ts`, per the PRD's Time-model note) are byte-identical to the fork point from `main`; the only new migration is the single drizzle-kit-generated `0007`; every existing suite is still green with the new migration applied; no test was removed, skipped or loosened.
- **AC-A10 (PRD AC-19):** Both new tables are classified in `EXPORTED_TABLE_NAMES`, so the schema-enumerating completeness guard passes with both tables listed; the guard test and its expected list are updated (five names become seven), never loosened, and the two tables are not placed in `EXCLUDED_TABLES`.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| A time lands an hour off across a DST gap or overlap, or an all-day event lands a day off | M | H | One new pure helper that follows the RFC 5545 rule, tested on `America/New_York` (AC-A1) because `America/Sao_Paulo` has had no DST since 2019 and would never reveal the bug; exclusive-end tests at every boundary (AC-A2). Reading `dates.ts` showed the shipped `localPartsToInstant` is wrong inside a gap, which is why it is not reused |
| The content-hash canonicalization drifts silently | M | H | The canonical bytes are fixed in this plan and in the module header; a pinned golden digest and the `v1` prefix make any change a visible, versioned event (AC-A4) |
| The migration touches real data | L | H | `0007` is CREATE-only, generated by drizzle-kit, hand-reviewed, inspected by a Node-side test (AC-A8) and by Task 7 / Level 3; nothing is applied remotely in this phase (chore C6 and the remote apply are phase 5) |
| The link table's columns are wrong for unit 15 | L | M | Only identity and baseline columns are fixed; the table is empty, so altering it later costs nothing (ADR-0016) |
| The manifest classifies the tables as exported before the dump route emits them (the guard checks classification only; `src/worker/routes/export.ts` hard-codes five selects and `src/shared/export.ts` hard-codes five keys) | M | M | No route can create an Event in phase 1, so no row can be missed; phase 2 extends `ExportTables`, the envelope, the route and `test/export-envelope.test.ts`, and its AC-19 test proves `tables.events` and `tables.event_sync_links`. Nothing deploys before phase 5 |
| `PRAGMA foreign_keys` may not be enforced in the test D1, which would make the `ON DELETE SET NULL` half of AC-A7 fail for a reason unrelated to the schema | L | M | No existing test asserts FK behaviour from a direct insert (research-codebase gap), so AC-A7's test proves it behaviourally; D1 enforces foreign keys by default. If the test D1 does not, raise it as a finding rather than weakening the test |
| `crypto.subtle`, `TextEncoder` or `Intl` options are untyped in one compile target (the app target has DOM lib; the worker target takes its types from `worker-configuration.d.ts`) | L | L | Tasks 1-5 type-check `src/shared/` under both `tsconfig.worker.json` and `tsconfig.app.json`; Level 1 runs `tsc -b` over all five targets |
| `isValidTimeZone` accepts any zone `Intl` accepts, including a differently-cased spelling, and storage does not rewrite it | L | L | The only writer in unit 14 is the owner's native select of canonical names; a non-canonical string would hash differently but never corrupt data. Not worth a canonicalization rule now |
| The Task 1 and Task 5 runtime probes rely on Node's built-in type stripping | L | L | `package.json` `engines` requires Node >= 24, where it is on by default; the repo already uses `erasableSyntaxOnly`. The same functions are exercised by the Level 2 suites in workerd |
| research-web found no authoritative source for a pure-`Intl` wall-clock-to-instant algorithm | M | L | The RFC gap and overlap rule itself is sourced (RFC 5545 section 3.3.5); the algorithm is built here and proven on the three AC-1 vectors, including a gap and an overlap |
| `scripts/check-mirror-inventory.mjs` scans `src/` for `.attendees`, `.reminders` and `.recurrence`; reading `src/shared/export.ts` suggests the script may already flag `tables.reminders` there, but it was not run | L | L | The new modules read none of those names. The script is not part of `npm run check`; AC-33 (phase 5) must run it on `main` first to learn the baseline |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test glob (`*.test.ts`, `__tests__/`, `tests/`, `spec/`), so this plan's per-task `**VALIDATE**` commands exercise the change directly rather than invoking the test framework (Level 2 runs the pair-authored suites as a gate over the finished phase). The one file under `test/`, `test/isolation.ts`, is test-support code that matches none of those globs; it is an Implementer edit because it can only compile after Task 6 exports the new tables, and an earlier edit by the pair would turn every existing suite RED for the wrong reason.
- **Suites the pair is expected to author** (names are suggestions; Level 2 does not depend on them): AC-A1, AC-A2, AC-A3, AC-A5 in a worker-project file importing `../src/shared/events`; AC-A4 in a worker-project file importing `../src/shared/event-hash` (Web Crypto exists in workerd); AC-A6 and AC-A7 in a worker-project file doing direct inserts through `createDb(env)` with `isolatedIt`, `resetTaskTables` and `DRAIN_BUDGET_MS`; AC-A8 in a Node-side file; AC-A10 as an update of `test/export-completeness.test.ts`, whose literal list of exported names (the test at lines 92-102) becomes the seven names. A missing module or export is a legitimate RED reason for the first two groups.
- **AC-A8 inspection (Node-side).** The docs project runs in plain Node and `vitest.config.ts` registers its suites in BOTH the docs `include` and the worker `exclude` (the comment at `vitest.config.ts:64-70` explains why). A new Node-side file must be registered in both lists by the test pair as part of delivering its suite; `vitest.config.ts` is not an Implementer file in this plan. The inspection should split the migration on `--> statement-breakpoint`, accept `CREATE TABLE` and `CREATE UNIQUE INDEX` as well as `CREATE INDEX` (AC-A7 needs unique indexes), reject `ALTER`, `DROP`, `PRAGMA` and `__new_`, and assert exactly one `0007_*.sql`. For "byte-identical to main", `.gitattributes` pins `eol=lf`, so a SHA-256 of each of `0000` to `0006` is stable across platforms; pin the digests taken from `main`. Level 2 and Task 10 independently prove the same fact with `git diff --exit-code` against the fork point.
- **phase_type is `feature`, not `foundation`.** The phase does create a seam (schema, pure modules, migration) that later phases build on, but every acceptance criterion here is a pure-function or schema-invariant behaviour that is specified by input and output (AC-1..AC-5) or by a SQL rejection (AC-6, AC-7), so it can be exercised test-first: the tests import the module paths this plan names and fail RED until the Implementer creates them. `foundation` would make the TDD track skip test-first for the phase, which would be wrong here.
- **AC-A1 verification against `localPartsToInstant` (dates.ts:187-211), by reading.** For `2026-03-08 02:30` in `America/New_York` the first pass reads the offset at 02:30Z (EST, -300) and gets 07:30Z; the second pass reads the offset at 07:30Z (EDT, -240 — DST began at 07:00Z) and recomputes `wall + 4 h` = 06:30Z, which is 01:30 EST. AC-1 and RFC 5545 require 07:30Z (the offset BEFORE the gap), so the shipped function disagrees inside a gap. For `2026-11-01 01:30` it gets 05:30Z, the first occurrence, which agrees; `America/Sao_Paulo` (fixed -03:00) agrees. Reminders already depend on the shipped behaviour, so the RFC rule is a NEW function in `events.ts` and `dates.ts` is not edited (PRD Architecture Notes, "Time model"). The pair may add a case showing the divergence, but it is not required.
- **Canonicalization contract (single source for the test pair and the Implementer).** Bytes hashed = UTF-8 of `"v1\n" + JSON.stringify([title.trim(), (description ?? "").trim(), (location ?? "").trim(), allDay, allDay ? startDate : startAt, allDay ? endDate : endAt, timezone])`; digest = lowercase hex of SHA-256. The golden input is `{ title: "Dentista", description: null, location: "Clínica Sorriso", allDay: false, startAt: 1792499400, endAt: 1792503000, startDate: null, endDate: null, timezone: "America/Sao_Paulo" }`, i.e. `Date.UTC(2026, 9, 20, 12, 30) / 1000` and one hour later. The pair derives the golden digest independently of the implementation (for example with Node's `crypto.createHash("sha256")` over exactly these bytes) and pins it.
- **Export classification, stated explicitly.** The completeness guard (`test/export-completeness.test.ts:44-60`) enumerates the real schema, so adding the tables in Task 6 without classifying them would turn it red. Phase 1 keeps it green without loosening it by adding both tables to `EXPORTED_TABLE_NAMES` (Task 8) and having the pair update the literal expected list in the same phase; the alternative of parking them in `EXCLUDED_TABLES` was rejected because they are owner data that FR-042 must carry. `src/worker/routes/export.ts` imports only `EXCLUDED_TABLES` and `src/shared/export.ts` hard-codes five keys, so the dump itself changes in phase 2.
- **Documentation sync is deferred to phase 5** by the PRD (D-T, AC-34). Until then `docs/context/architecture.md` still says Events are "absent from the schema by design"; that known, bounded staleness closes in phase 5. The code comment at `schema.ts:20-22` is updated now (Task 6).
- **Local command notes.** `npm test` and `npm run check` are re-runnable and idempotent; a foreground `vitest run` that exits 127 with no failing test is a local runner flake and is simply run again (Level 2 does this once). Run `npx prettier --write` on `src/shared/events.ts`, `src/shared/event-hash.ts`, `src/worker/db/schema.ts`, `src/worker/db/export-manifest.ts` and `test/isolation.ts` before Level 1.
- **Research grounding.** research-web confirmed RFC 5545 section 3.3.5 (gap: "interpreted using the UTC offset before the gap in local times"; overlap: "refers to the first occurrence"), Cloudflare's Web Crypto SHA-256 digest with `padStart` hex, and Drizzle's named `check()`, `unique`/`uniqueIndex` and the SQLite rule that a CHECK evaluating to NULL passes (which is why `events_shape_chk` is written so no branch can evaluate to NULL). research-codebase supplied the schema, pure-module, isolation, manifest, vitest-project and migration-shape anchors above; it found no existing workerd test that asserts direct-SQL constraint rejection, hence the Risks row on foreign-key enforcement.

*Generated: 2026-10-19*
*Approved: 2026-10-19*
*Implemented: 2026-10-19*
*Status: IMPLEMENTED*
