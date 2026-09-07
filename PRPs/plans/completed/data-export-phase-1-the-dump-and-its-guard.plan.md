# Feature: The dump and its guard (Phase 1 of data-export)

```
**Decision Gate**
- Active context: none
- Activated criteria: new API route under `/api/*`; handling of credential-bearing tables; a durable JSON file format future units and the owner depend on; domain rules spanning `life_areas`, `recurrence_series`, `tasks`, `reminders`, `google_calendar_selections`
- Decisions found:
  - ADR-0003 — binding safeguard "day-1 JSON+iCalendar export"; this phase delivers the JSON half (the `.ics` is phase 2)
  - ADR-0005 — types originate in `src/worker/db/schema.ts` and flow outward; `src/worker/dto.ts` is the single mapping point; exact version pins
  - ADR-0008 — test-first for the decidable parts; the envelope builder and the completeness guard are both decidable
  - `src/worker/db/schema.ts:328-333` — the `google_connections` export-exclusion reason is inherited verbatim, not re-decided
  - `docs/decisions.md` 2026-08-12 correction — FR-043 (the unattended pull, phase 4) is scheduled in this same unit, confirming the unit's binding status under ADR-0003
- Applicable anti-patterns:
  - Syncing the live database file (`docs/anti-patterns.md:19-25`) — this phase IS the sanctioned alternative: an on-demand, authenticated route producing a consistent snapshot, never a raw file copy
  - Hand-duplicated entity types (`docs/anti-patterns.md:91-97`) — the dump derives its shape from `schema.ts` via `dto.ts`'s explicit-mapping convention, never a parallel hand-written column list
  - Weakening tests to force green (`docs/anti-patterns.md:121`) — the AC-4 completeness guard is exactly the kind of test a later table addition is tempted to relax
- Applicable architectural rules:
  - `app.use("/api/*", requireToken)` runs before every mount (`src/worker/index.ts:16-38`) — the export route needs no auth code of its own
  - `src/shared/` carries no DOM/Worker globals and reads no clock — the envelope builder takes its instant as a parameter, like every other module there
  - Free plan: 10 ms CPU and 50 subrequests per invocation (confirmed against Cloudflare's current limits page) — this phase must measure the real dump's cost against that ceiling and record the number
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/data-export.prd.md` — Implementation Phases row 1: "The dump and its guard" — Goal: A complete, documented, credential-free copy of the database reachable with one authenticated request. — Success signal: AC-1 through AC-6 pass, and a `curl` against production writes a file the owner can open and read whose content he recognizes as his own.

## Summary

This phase adds one authenticated route, `GET /api/export`, that returns a single self-describing JSON document containing every row of the five data-bearing tables (`life_areas`, `recurrence_series`, `tasks`, `reminders`, `google_calendar_selections`). Three infrastructure tables (`google_connections`, `push_subscriptions`, `oauth_states`) are excluded by name, each with a non-empty written reason, and a schema-enumerating completeness guard fails the build if any table in `src/worker/db/schema.ts` is in neither list. The route inherits authentication for free from the existing `/api/*` middleware, derives its DTO shapes from the Drizzle schema through `dto.ts`'s explicit-mapping convention (never a hand-written column list), and names its response for download via `Content-Disposition`. The real dump's size and CPU cost against production data — the PRD's open question on the free plan's ceiling — is measured as a deliberate post-deploy manual step once this phase ships, outside these tasks (see `## Notes`), not as one of them.

## User Story

```
As the owner
I want to fetch one authenticated request that returns a complete, documented copy of my Tasks, Life Areas, Recurrence Series, Reminders and Google calendar selections
So that Cloudflare is no longer the single place my data can be lost
```

## Problem Statement

There is no export route in the Worker today — the whole `/api/*` surface is `/api/health`, `/api/tasks*` and `/api/google/*`. The only way to get a copy of the owner's data out of D1 is `wrangler d1 export` from an authenticated dev machine, which produces SQLite-dialect SQL rather than a documented format and is reachable from neither the phone nor a scheduled job. ADR-0003 accepted the single-copy design conditionally, naming a JSON export as one of two binding safeguards; until this phase exists, that condition is unmet.

## Solution Statement

`GET /api/export`, mounted under the existing `/api/*` prefix so `requireToken` gates it by construction, queries the five data-bearing tables, maps each row through an explicit `dto.ts` function (matching the `toTaskDto` convention), and passes the resulting DTO arrays plus the current instant into a pure, DB-free envelope builder in `src/shared/export.ts`. The builder returns one JSON document carrying a format version, the generation instant, `PRAESTO_TIMEZONE`, the per-table rows, and the excluded-table list with reasons. The route sets `Content-Disposition: attachment; filename="praesto-<date>.json"` and `Content-Type: application/json`. A single manifest module (`src/worker/db/export-manifest.ts`) is the one place both the route and the completeness guard read the exported/excluded table lists from, so the two can never independently drift. The alternative — dumping raw rows and filtering credentials out afterward — was rejected by the PRD because it puts credential material in the response body first and removes it second.

## Metadata

| Key | Value |
|-----|-------|
| Type | Feature |
| Complexity | Medium |
| Systems Affected | Worker API (`src/worker/routes/`, `src/worker/dto.ts`, `src/worker/index.ts`), `src/shared/` (new pure module), D1 schema (read-only — no migration) |
| Dependencies | None (row 1; no `Depends` cell) |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/data-export.prd.md` lines 170, 181-184 |
| phase_type | feature |

`phase_type: feature`, not `foundation`: this phase does not create the seam a later phase needs before its own ACs become testable — the Drizzle schema (`src/worker/db/schema.ts`) already exists in full, and every one of AC-1 through AC-6 is directly testable, test-first, against types that are already there. A `foundation` classification would incorrectly cause the orchestrator's A.3.5 gate to self-skip the test-first pass this phase's methodology (`tdd: true`) requires.

`design_source` and `phase_scope` are both omitted from this table: `docs/context/methodology.md` declares `figma_track: false`, and the source PRD carries no `## Visual-First Mode` section — neither conditional key applies, and the table stays at its unconditional shape.

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `src/worker/db/schema.ts` | 1-396 | The full schema: the five tables to dump, the three to exclude, and the `google_connections` exclusion-reason comment (328-333) this phase inherits verbatim |
| P0 | `src/worker/index.ts` | 14-21 | Exact `app.use("/api/*", requireToken)` → `app.route(...)` mount order the new route joins |
| P0 | `src/worker/auth.ts` | 11-26 | `requireToken` — confirms the export route needs no auth code of its own |
| P0 | `src/worker/dto.ts` | 1-45 | The explicit, field-by-field mapping convention (`toTaskDto`, `toGoogleConnectionDto`) and the private `toEpochSeconds` helper this phase's new DTO functions must follow |
| P1 | `src/worker/routes/tasks.ts` | 1-23 | Sub-router shape: `export const xRoutes = new Hono<{ Bindings: Env }>()`, imports from `../db/schema`, `../dto` |
| P1 | `src/worker/routes/google.ts` | 1-28 | A second sub-router example that also imports a pure `src/shared/` serializer module (`google-events.ts`) alongside the route — the precedent this phase's `src/shared/export.ts` follows |
| P1 | `src/shared/dates.ts` | 1-37 | `PRAESTO_TIMEZONE` and the day-vs-instant distinction the envelope must preserve and document |
| P1 | `test/tasks.test.ts` | 1-30 | The route-test harness: `auth()` header helper, `exports.default.fetch(...)`, no HTTP server |
| P2 | `test/isolation.ts` | 1-153 | `isolatedIt`/`resetTaskTables` pattern — read-only export tests likely do not need table resets, but any seeding helper the test pair adds should follow this file's isolation discipline |
| P2 | `vitest.config.ts` | 1-92 | Two-project split (`worker` in workerd vs `docs` in plain Node) — everything this phase touches (schema-aware code) belongs in the `worker` project, not `docs` |
| P2 | `docs/anti-patterns.md` | 91-97 | "Hand-duplicated entity types" — the rule the envelope builder and DTO additions must not violate |

## Patterns to Mirror

```
# SOURCE: src/worker/index.ts:14-21
const app = new Hono<{ Bindings: Env }>();

// Every /api/* route is token-gated — including health, per ADR-0003.
app.use("/api/*", requireToken);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/google", googleRoutes);
```
Copied by Task 5 (`app.route("/api/export", exportRoutes)` joins this same list).

```
# SOURCE: src/worker/dto.ts:10-29
export function toTaskDto(row: Task): TaskDto {
  return {
    id: row.id,
    title: row.title,
    ...
    completedAt: toEpochSeconds(row.completedAt),
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
  };
}

function toEpochSeconds(value: Date | null): number | null {
  return value === null ? null : Math.floor(value.getTime() / 1000);
}
```
Copied by Task 3 (`toLifeAreaDto`, `toRecurrenceSeriesDto`, `toReminderDto`, `toGoogleCalendarSelectionDto` — each field written explicitly, reusing the same instant-conversion shape).

```
# SOURCE: src/worker/db/schema.ts:328-333
 * The refresh token lives here because a Worker cannot write its own secret at
 * runtime, so an in-app connect has nowhere else to put what it obtains. Three
 * rules follow and are enforced elsewhere in the code rather than here: it is
 * never logged, it never appears in any DTO or response body, and it is
 * excluded from the FR-042 export — an export carrying a live credential would
 * make every backup file a credential.
```
Copied (as the reason text, adapted) by Task 1's `EXCLUDED_TABLES` entry for `google_connections`.

```
# SOURCE: test/tasks.test.ts:9-30
function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

async function post(path: string, body?: unknown): Promise<Response> {
  return exports.default.fetch(
    path,
    auth(body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) }),
  );
}
```
Referenced by the test pair for `test/export.test.ts` — this plan does not author test files (see `## Notes`), but the harness this phase's route tests must use is this one, not a new one.

```
# SOURCE: src/shared/dates.ts:22
export const PRAESTO_TIMEZONE = "America/Sao_Paulo";
```
Copied by Task 2's envelope builder, which quotes this constant in the document rather than restating the string literal.

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `src/worker/db/export-manifest.ts` | CREATE | Single source of the exported-table list and the reasoned exclusion list, read by both the route and the completeness guard — so the two can never drift independently (AC-4's own premise) |
| `src/shared/export.ts` | CREATE | Pure, DB-free envelope builder (format version, generated instant, timezone, exclusion list, per-table DTO arrays) — decidable, so it is authored test-first per `docs/context/methodology.md` |
| `src/worker/dto.ts` | UPDATE | Add `toLifeAreaDto`, `toRecurrenceSeriesDto`, `toReminderDto`, `toGoogleCalendarSelectionDto`, each field written explicitly like `toTaskDto` |
| `src/worker/routes/export.ts` | CREATE | The `GET /api/export` sub-router: fetches the five tables, maps rows through `dto.ts`, calls the envelope builder, sets `Content-Disposition`/`Content-Type` |
| `src/worker/index.ts` | UPDATE | Mount `app.route("/api/export", exportRoutes)` alongside the existing two route groups |

## NOT Building (Scope Limits)

- The `.ics` calendar file — phase 2 (AC-7, AC-8).
- The `/settings` download button — phase 3 (AC-9).
- The unattended pull script and Windows Scheduled Task — phase 4 (AC-10, AC-11).
- In-app import/restore into the running app — out of scope for the whole PRD; C6 proves the restore out of band.
- Any filtering, paging or date-windowing of the dump — 100% of every included table's rows, `done` and `missed` included.
- Encryption of the export file — the dump carries no credential by construction.
- A second export format (CSV, SQL, Markdown).

## Step-by-Step Tasks

### Task 1: CREATE src/worker/db/export-manifest.ts

- **ACTION**: Create a standalone module (no Drizzle import, so it stays trivially inspectable) exporting `EXPORTED_TABLE_NAMES: readonly string[]` with the five dumped table names (`"life_areas"`, `"recurrence_series"`, `"tasks"`, `"reminders"`, `"google_calendar_selections"`) and `EXCLUDED_TABLES: ReadonlyArray<{ readonly name: string; readonly reason: string }>` with exactly three entries: `google_connections` (reason adapted from `schema.ts:328-333` — "excluded from the FR-042 export; an export carrying a live credential would make every backup file a credential"), `push_subscriptions` (reason: holds a device's push delivery credentials — `p256dh`/`auth` — not portable owner data), `oauth_states` (reason: single-use nonces, worthless once consumed or expired, carrying no user data, per the table's own doc comment at `schema.ts:301-303`). Every reason string must be non-empty after trimming.
- **MIRROR**: `# SOURCE: src/worker/db/schema.ts:328-333` (the `google_connections` reason text)
- **VALIDATE**:
  ```
  set -euo pipefail
  count=$(grep -oE '"(life_areas|recurrence_series|tasks|reminders|google_calendar_selections|google_connections|push_subscriptions|oauth_states)"' src/worker/db/export-manifest.ts | sort -u | wc -l)
  if [ "$count" -ne 8 ]; then
    echo "FAIL: expected 8 distinct table-name literals in export-manifest.ts, found $count"; exit 1
  fi
  echo "PASS: all 8 table names present"
  npx vitest run test/export-completeness.test.ts
  ```

Serves **AC-A4 (PRD AC-4)** and **AC-A3 (PRD AC-3)** — the manifest is the single source both the completeness guard and the route's exclusion list read from.

### Task 2: CREATE src/shared/export.ts

- **ACTION**: Add a pure function `buildExportEnvelope(now: Date, tables: { lifeAreas: LifeAreaDto[]; recurrenceSeries: RecurrenceSeriesDto[]; tasks: TaskDto[]; reminders: ReminderDto[]; googleCalendarSelections: GoogleCalendarSelectionDto[] }, excluded: ReadonlyArray<{ name: string; reason: string }>)` returning one document object: `{ formatVersion: 1, generatedAt: <epoch seconds of now>, timezone: PRAESTO_TIMEZONE, excludedTables: excluded, tables: { ...the five arrays, keyed by table name } }`. Takes `now` as a parameter — reads no clock — matching every other module in `src/shared/`. Imports `PRAESTO_TIMEZONE` from `./dates`; imports only DTO types (already environment-agnostic) from `./api`, never anything from `src/worker/`.
- **MIRROR**: `# SOURCE: src/shared/dates.ts:22` (the `PRAESTO_TIMEZONE` constant, quoted not restated)
- **VALIDATE**:
  ```
  npx vitest run test/export-envelope.test.ts
  ```

Serves **AC-A5 (PRD AC-5)** — the envelope is where `formatVersion`, `generatedAt`, `timezone` and the excluded-table list are assembled into the document shape AC-5 checks.

### Task 3: UPDATE src/worker/dto.ts

- **ACTION**: Add four new mapping functions — `toLifeAreaDto`, `toRecurrenceSeriesDto`, `toReminderDto`, `toGoogleCalendarSelectionDto` — each taking the corresponding Drizzle row type from `./db/schema` and returning a plain object with every field written out explicitly (no spread), reusing the existing private `toEpochSeconds` helper for any `Date | null` field and passing calendar-day text fields (`dtstart`, `untilDate`, `occurrenceDate`, etc.) through verbatim. Corresponding DTO interfaces (`LifeAreaDto`, `RecurrenceSeriesDto`, `ReminderDto`, `GoogleCalendarSelectionDto`) are added to `src/shared/api.ts` alongside the existing `TaskDto`/`GoogleConnectionDto`, following the same shape (instants as epoch-second numbers, calendar days as strings).
- **MIRROR**: `# SOURCE: src/worker/dto.ts:10-29` (`toTaskDto` — the explicit-field convention)
- **VALIDATE**:
  ```
  npx tsc -b
  ```

Serves **AC-A2 (PRD AC-2)** and **AC-A3 (PRD AC-3)** — these are the only explicit field mappings the five newly-dumped tables get, and an explicit mapping is what guarantees no credential field (there are none on these five tables, but the convention is what AC-3 depends on for every future table) leaks through by accident.

### Task 4: CREATE src/worker/routes/export.ts

- **ACTION**: Create `export const exportRoutes = new Hono<{ Bindings: Env }>()` with a single `exportRoutes.get("/", async (c) => { ... })` handler that: opens `createDb(c.env)`; selects every row of the five tables in `EXPORTED_TABLE_NAMES`' order; maps each row set through the corresponding `dto.ts` function; calls `buildExportEnvelope(new Date(), { ...mapped arrays }, EXCLUDED_TABLES)`; serializes the result with `JSON.stringify`; and returns a `Response` with `Content-Type: application/json`, `Content-Disposition: attachment; filename="praesto-<YYYY-MM-DD>.json"` (the date from `todayIn(new Date())`), and that JSON body. No row is ever read from `google_connections`, `push_subscriptions` or `oauth_states` — the handler never imports those tables from `./db/schema`.
- **MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:1-23` (sub-router shape and imports)
- **VALIDATE**:
  ```
  npx vitest run test/export.test.ts
  ```

Serves **AC-A1 (PRD AC-1)**, **AC-A2 (PRD AC-2)**, **AC-A3 (PRD AC-3)**, **AC-A5 (PRD AC-5)** and **AC-A6 (PRD AC-6)** — the handler is where auth is inherited, the five tables are queried and mapped, the three excluded tables are never imported, the envelope is assembled, and the `Content-Disposition`/`Content-Type` headers are set.

### Task 5: UPDATE src/worker/index.ts

- **ACTION**: Import `exportRoutes` from `./routes/export` and add `app.route("/api/export", exportRoutes);` immediately after the existing `app.route("/api/google", googleRoutes);` line, keeping it below `app.use("/api/*", requireToken)` so the mount inherits the auth gate with no changes to `auth.ts`.
- **MIRROR**: `# SOURCE: src/worker/index.ts:14-21`
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx vitest run test/export.test.ts
  ```

Serves **AC-A1 (PRD AC-1)** — mounting the route under `/api/*` is what makes `requireToken` apply to `/api/export` without any auth code of its own.

## Validation Commands

**Level 1 STATIC_ANALYSIS**
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` — exits non-zero on any type, lint or format violation.)

**Level 2 UNIT_TESTS**
```
npm test
```
(`vitest run` — exercises `test/export-envelope.test.ts`, `test/export-completeness.test.ts` and `test/export.test.ts` alongside the existing suite; exits non-zero on any failing test, via Vitest's own exit code, not a parsed count.)

**Level 3 DRY-RUN END-TO-END**
```
npx wrangler deploy --dry-run --outdir dist-dry-run
```
(Builds and bundles the whole Worker — including the new route and its imports — without publishing; exits non-zero on any build/bundling failure, which would catch a broken import or an unresolvable binding before a real deploy attempt.)

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** Given the Worker is running, when `GET /api/export` is called without an `Authorization: Bearer` header, then the response is 401 and carries no body content from the database.
- **AC-A2 (PRD AC-2):** Given a database seeded with at least one row in each of `life_areas`, `recurrence_series`, `tasks`, `reminders` and `google_calendar_selections`, when the export is fetched, then the document contains a key for each of the five tables and each contains the seeded row.
- **AC-A3 (PRD AC-3):** Given a `google_connections` row with a known sentinel `refresh_token` and a `push_subscriptions` row with known sentinel `p256dh`/`auth` values, when the export is fetched, then the serialized response text contains none of those three sentinel strings and has no key for any of the three excluded tables.
- **AC-A4 (PRD AC-4):** Given the exported table list and the exclusion list in `src/worker/db/export-manifest.ts`, when the guard test enumerates every table exported by `src/worker/db/schema.ts`, then any table present in neither list fails the test by name, and any exclusion entry with an empty (or whitespace-only) reason also fails.
- **AC-A5 (PRD AC-5):** Given any export, when the document is inspected, then it carries `formatVersion`, `generatedAt` (an instant), `timezone` (`America/Sao_Paulo`, quoting `PRAESTO_TIMEZONE`), and the list of excluded tables with their reasons.
- **AC-A6 (PRD AC-6):** Given an authenticated request, when the export is fetched, then the response carries `Content-Disposition: attachment` with a filename containing the generation date, and `Content-Type: application/json`.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| The whole-database dump exceeds the free plan's 10 ms CPU or response-size ceiling as the owner's data accumulates | M | H | A post-deploy manual measurement (see `## Notes`) checks the real cost against production data once this phase ships; the documented fallback (per the PRD) is a per-table streamed response, which the envelope's shape already permits without a format change |
| The schema-enumeration approach chosen for the completeness guard (e.g. `drizzle-orm`'s `is()`/`SQLiteTable`/`getTableConfig`) does not behave as expected against the pinned `drizzle-orm@0.45.2` | L | M | `npx tsc -b` (Level 1) and `npx vitest run test/export-completeness.test.ts` (Task 1's own VALIDATE) surface a mismatch immediately, before any dependent task runs |
| The completeness guard is relaxed rather than satisfied when a future table is added under time pressure | M | H | AC-4 requires each exclusion to carry a non-empty reason, so disarming the guard means writing a false justification rather than deleting a line; `docs/anti-patterns.md:121` and R-X make weakening tests a reviewable event |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task above and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands invoke the test framework's own runner (`npx vitest run <suite>`) directly against the suite the test pair will have already written, rather than the Implementer authoring or editing any spec.

**Test file naming convention (informational, not binding on test-writer):** this plan's per-task VALIDATE commands assume the test pair names its suites `test/export-envelope.test.ts` (Task 2 — the pure builder), `test/export-completeness.test.ts` (Task 1 — the AC-4 guard) and `test/export.test.ts` (Tasks 4-5 — the route-level AC-1/2/3/5/6 tests), mirroring the existing module-name convention (`test/tasks.test.ts`). If the test pair chooses different names, the VALIDATE commands must be updated to match before code review; `npm test` (Level 2) passes or fails identically either way since it is not name-scoped.

**One endpoint, deferring `.ics` to phase 2:** the PRD's open question ("one endpoint or two for the `.ics`?") is resolved here for phase 1's scope only: `GET /api/export` returns JSON; phase 2 adds a second route (`GET /api/export.ics` is the leading candidate) rather than content-negotiating on `Accept`, because a single-purpose route is simpler to test and to `curl` from the phase 4 script — but that choice is phase 2's plan's to make, not re-litigated here.

**No migration in this phase:** the route is read-only against the existing schema; no schema change, so no `drizzle-kit generate` / `wrangler d1 migrations apply` step is part of this plan.

**Measuring the real dump size and CPU cost is a deliberate post-deploy manual step, outside these tasks:** the PRD's Open Questions section carries "What is the real dump size and CPU cost?" as a question this phase is meant to close, but doing so requires a `npm run deploy` to the owner's production Worker plus a manual `curl`/dashboard inspection against real data — both a hard-to-reverse, outward-facing action past relay's Pillar 2 execution boundary, and a step that cannot be re-attempted by `/relay-implement`'s retry loop the way a code-level task can (there is no code fix for a VALIDATE that depends on a human deploying and reading a dashboard). It is intentionally not a Step-by-Step Task here: the owner takes the measurement himself once this phase is live, and records the figure directly in `PRPs/prds/data-export.prd.md`'s Open Questions bullet, in place of the current placeholder. This plan's own `## Risks and Mitigations` row above documents the fallback (a per-table streamed response) if the measured number turns out to exceed the free plan's ceiling.

*Generated: 2026-09-04*
*Approved: 2026-09-04*
*Status: IMPLEMENTED*
