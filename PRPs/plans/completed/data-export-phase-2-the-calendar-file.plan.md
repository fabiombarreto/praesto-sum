# Feature: The calendar file (Phase 2 of data-export)

```
**Decision Gate**
- Active context: none
- Activated criteria: durable file format the owner must be able to read years from now, in a program he already uses; domain rules (tasks); a cross-cutting artifact this unit's PRD already treats as binding
- Decisions found:
  - ADR-0003 — binding safeguard "day-1 JSON+iCalendar export"; this phase delivers the iCalendar half (the JSON half shipped in phase 1)
  - `PRPs/prds/data-export.prd.md` Decisions Log, 2026-09-03 — "`.ics` emits all-day `VEVENT`, not `VTODO`" — Google Calendar and Outlook silently ignore `VTODO` on import, and the owner lives in Google Calendar; the loss is deliberate and recorded in the file itself via a `COMMENT` property. Not re-litigated here.
  - ADR-0009 — visible UI copy is pt-BR; every other artifact, including the `.ics`'s own property names and values, stays English. There is no UI in this phase, so this decision constrains only the file's own content.
  - `src/shared/dates.ts:22` — `PRAESTO_TIMEZONE` is the single place the app's timezone is named; the `.ics`'s all-day dates are quoted from `deadline`/`scheduledDate` verbatim and carry no `TZID`, since RFC 5545 `VALUE=DATE` is zone-less by definition.
- Applicable anti-patterns:
  - Hand-duplicated entity types (`docs/anti-patterns.md:91-97`) — the serializer takes the existing `TaskDto` (already derived from `src/worker/db/schema.ts` via `dto.ts`) and reads only `deadline`/`scheduledDate`/`title`/`id`; it introduces no parallel Task shape.
  - Weakening tests to force green (`docs/anti-patterns.md:121`) — not directly exercised by this phase's scope, but AC-8's "exactly two `VEVENT`s, the undated Task appears nowhere" is exactly the kind of precise assertion a later change could be tempted to loosen.
  - Portuguese in artifacts (`docs/anti-patterns.md:105`) — the `.ics`'s `SUMMARY`/`COMMENT`/`PRODID` text stays English; there is no owner-facing UI copy in this phase's scope (that is phase 3).
- Applicable architectural rules:
  - `src/shared/` carries no DOM and no Worker globals and reads no clock — the serializer lives there and receives its instant as a parameter, exactly like `src/shared/export.ts`'s `buildExportEnvelope`.
  - `app.use("/api/*", requireToken)` runs before every mount (`src/worker/index.ts:18`) — the new `.ics` route is authenticated by construction, with no auth code of its own.
  - Types flow from the Drizzle schema outward through `dto.ts`; the serializer consumes `TaskDto`, never a raw Drizzle row.
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/data-export.prd.md` — Implementation Phases row 2: "The calendar file" — Goal: The dated half of the owner's data readable by a calendar program he already uses. — Success signal: AC-7 and AC-8 pass, and the produced file imports into Google Calendar showing the owner's dated Tasks on their correct days.

## Summary

This phase adds a second, pure module in `src/shared/` — an RFC 5545 `.ics` serializer — and a second authenticated route, `GET /api/export.ics`, that returns it. Each dated Task (`deadline ?? scheduledDate`, exactly as `dayItemFromTask` already computes it) becomes an all-day `VEVENT` with `DTSTART;VALUE=DATE`, a stable `UID` derived from the Task's own id, a `DTSTAMP` of the generation instant, and a `COMMENT` property stating the event originated as a to-do — so a future reader of the file is not misled into thinking these were appointments. Undated Tasks are silently omitted (per AC-8, not an error). The file is built as an array of content lines, each folded per RFC 5545 §3.1's 75-octet limit (continuation lines beginning with a single space, split on UTF-8 code-point boundaries, never mid-character) before being joined with `\r\n` (CRLF), and text values are escaped per §3.3.11 before being written. Folding is in scope here, not deferred: AC-7's "CRLF line endings per RFC 5545" invokes the same §3.1 section that defines folding, and pt-BR task titles routinely exceed the 75-octet threshold once `SUMMARY:`'s own 8-octet prefix and 2-octet-per-accented-character UTF-8 encoding are counted. Scope is exactly AC-7 and AC-8; the download button (AC-9, phase 3) and the unattended pull (AC-10/AC-11, phase 4) are out of scope here.

## User Story

```
As the owner
I want the dated half of my Tasks in a file my calendar program already reads
So that I have a second, readable copy of my agenda outside Praesto
```

## Problem Statement

ADR-0003 names JSON + iCalendar export as the two binding safeguards against Cloudflare being the single point of loss for the owner's data. Phase 1 shipped the JSON half; the iCalendar half does not exist yet — there is no `.ics` serializer anywhere in the repository (confirmed by search, not assumed), and the owner's dated Tasks currently have no representation any calendar program can open.

## Solution Statement

A pure function `buildTasksIcs(now: Date, tasks: TaskDto[]): string` in `src/shared/ics.ts` filters the given Tasks to those with a non-null `deadline ?? scheduledDate`, and for each one emits a `VEVENT` block: `UID` (`<task.id>@praesto.local`), `DTSTAMP` (the given `now`, UTC basic format), `DTSTART;VALUE=DATE` (the Task's date with hyphens stripped), `SUMMARY` (the Task's title, escaped), and `COMMENT` (a fixed English sentence stating the event was originally a Praesto to-do). The whole document is wrapped in `BEGIN:VCALENDAR`/`VERSION:2.0`/`PRODID`/`END:VCALENDAR`. Before the final CRLF join, every content line is passed through a `foldContentLine` helper that measures the line's UTF-8 encoded byte length (via `TextEncoder`, never a JavaScript string's UTF-16 `.length`) and, when it exceeds 75 octets, splits it at a UTF-8 code-point boundary into a 75-octet leading segment and one or more space-prefixed continuation segments — folding is a physical-serialization step applied uniformly to every line, not something any individual property's own value construction has to know about. A new route, `GET /api/export.ics` (`src/worker/routes/export-ics.ts`), mounted the same way `export.ts` is, fetches every Task, maps it through the existing `toTaskDto`, calls the serializer with the current instant, and returns the string with `Content-Type: text/calendar; charset=utf-8` and a dated `Content-Disposition` filename — mirroring the JSON route's header pattern exactly.

## Metadata

| Key | Value |
|-----|-------|
| Type | Feature |
| Complexity | Small |
| Systems Affected | `src/shared/` (new pure module), Worker API (`src/worker/routes/`, `src/worker/index.ts`) |
| Dependencies | Phase 1 (`The dump and its guard`) — `implemented`/`complete`; reuses `TaskDto`, `toTaskDto`, the `/api/export` route's header pattern |
| Estimated Tasks | 3 |
| Source PRD line ref | `PRPs/prds/data-export.prd.md` lines 171, 186-189 |
| phase_type | feature |

`phase_type: feature`, not `foundation`: the seam this phase needs (`TaskDto`, `toTaskDto`, the `/api/*` auth mount, `PRAESTO_TIMEZONE`) already exists from phase 1, and AC-7 and AC-8 are directly testable, test-first, against types that are already there. A `foundation` classification would incorrectly cause the orchestrator's A.3.5 gate to self-skip the test-first pass `tdd: true` requires.

`design_source` and `phase_scope` are both omitted from this table: `docs/context/methodology.md` declares `figma_track: false`, and the source PRD carries no `## Visual-First Mode` section — neither conditional key applies, and the table stays at its unconditional shape.

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `src/shared/export.ts` | 1-72 | The precedent pure serializer this phase's `ics.ts` mirrors directly: no clock read, `now` as a parameter, imports only from `./api` and `./dates` |
| P0 | `src/worker/routes/export.ts` | 1-64 | The precedent route this phase's `export-ics.ts` mirrors: sub-router shape, `Content-Disposition`/`Content-Type` header pattern, no auth code of its own |
| P0 | `src/shared/day-item.ts` | 65-78 | `dayItemFromTask` — the exact `deadline ?? scheduledDate` rule this phase's date selection must reuse, not reimplement |
| P0 | `src/shared/dates.ts` | 1-37 | `PRAESTO_TIMEZONE` and the day-vs-instant distinction; confirms `deadline`/`scheduledDate` are zone-less calendar-day text, matching RFC 5545 `VALUE=DATE`'s own zone-less semantics |
| P1 | `src/worker/index.ts` | 15-23 | Exact mount order the new `/api/export.ics` route joins, below `app.use("/api/*", requireToken)` |
| P1 | `src/shared/api.ts` | 24-40 | `TaskDto` — the only shape the serializer reads from (`id`, `title`, `deadline`, `scheduledDate`) |
| P1 | `src/worker/auth.ts` | 28-31 | The only existing precedent in this codebase for encoding a string to its UTF-8 byte representation (`TextEncoder`, used there for `timingSafeEqual`'s HMAC comparison) — `foldContentLine` mirrors the `new TextEncoder().encode(...)` idiom, not a JS string's UTF-16 `.length`, to measure the 75-octet fold threshold |
| P2 | `test/export-envelope.test.ts` | 1-103 | The idiom the test pair is expected to follow for `test/export-ics.test.ts`: fixed-`Date` fixtures, a "reads no clock of its own" regression test, `describe` block titled by PRD AC |
| P2 | `vitest.config.ts` | 60-71 | The `worker`-project `include`/`exclude` split — the new pure-module test file belongs in `test/**/*.test.ts` (the default), not the Node-only `docs` project |
| P2 | `docs/anti-patterns.md` | 91-97, 105-112 | "Hand-duplicated entity types" and the English-artifacts/pt-BR-UI-only split, both of which bound this phase's serializer content |

## Patterns to Mirror

```
# SOURCE: src/shared/export.ts:10-14
/**
 * Pure, DB-free assembly of the export document (FR-042, data-export PRD
 * AC-5). Reads no clock — like every other module in `src/shared/` — so the
 * generation instant is a parameter, never `Date.now()`.
 */
```
Copied by Task 1's `buildTasksIcs(now: Date, tasks: TaskDto[])` — `now` is a parameter, never `Date.now()`, matching this exact convention.

```
# SOURCE: src/shared/day-item.ts:65-78
export function dayItemFromTask(task: TaskDto): TaskDayItem {
  return {
    source: "task",
    id: task.id,
    dueDate: task.deadline ?? task.scheduledDate,
    closed: task.status !== "open",
    task,
  };
}
```
Copied by Task 1 — the `task.deadline ?? task.scheduledDate` expression is the exact rule the serializer uses to decide which Tasks get a `VEVENT` and which are skipped; the serializer does not reimplement this as a separate comparison.

```
# SOURCE: src/shared/dates.ts:22
export const PRAESTO_TIMEZONE = "America/Sao_Paulo";
```
Referenced (not imported) by Task 1's design decision: `deadline`/`scheduledDate` are already zone-less `YYYY-MM-DD` calendar days, matching RFC 5545's `DTSTART;VALUE=DATE` semantics exactly, so no timezone conversion or `TZID` is ever attached.

```
# SOURCE: src/worker/auth.ts:28-31
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
```
Copied by Task 1's `foldContentLine` — the `new TextEncoder().encode(...)` idiom is the only existing precedent in this codebase for turning a JS string into its actual UTF-8 byte sequence; `foldContentLine` reuses this exact call to measure the 75-octet threshold (never a string's UTF-16 `.length`, which double-counts every pt-BR accented character) and to find code-point-safe split points.

```
# SOURCE: src/worker/routes/export.ts:30-64
export const exportRoutes = new Hono<{ Bindings: Env }>();

exportRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  ...
  const now = new Date();
  const envelope = buildExportEnvelope(now, { ... }, EXCLUDED_TABLES);

  const filename = `praesto-${todayIn(now)}.json`;
  return new Response(JSON.stringify(envelope), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
```
Copied by Task 2 (`icsRoutes.get("/", ...)`) — same shape: open the DB, map rows through `dto.ts`, call the pure builder with `new Date()`, return a `Response` with an explicit `Content-Type` and a dated `Content-Disposition` filename. Only the content type (`text/calendar; charset=utf-8`), file extension (`.ics`), and the builder called (`buildTasksIcs` instead of `buildExportEnvelope`) differ.

```
# SOURCE: src/worker/index.ts:15-23
const app = new Hono<{ Bindings: Env }>();

// Every /api/* route is token-gated — including health, per ADR-0003.
app.use("/api/*", requireToken);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/tasks", taskRoutes);
app.route("/api/google", googleRoutes);
app.route("/api/export", exportRoutes);
```
Copied by Task 3 (`app.route("/api/export.ics", icsRoutes)` joins this same list, below the `requireToken` line).

```
# SOURCE: test/export-envelope.test.ts:50-62
const fixedPast = new Date("2020-01-01T00:00:00Z");

const first = buildExportEnvelope(fixedPast, emptyTables(), EXCLUDED);
const second = buildExportEnvelope(fixedPast, emptyTables(), EXCLUDED);

expect(first.generatedAt).toBe(Math.floor(fixedPast.getTime() / 1000));
expect(second.generatedAt).toBe(first.generatedAt);
```
Referenced by the test pair for `test/export-ics.test.ts` — this plan does not author test files (see `## Notes`), but the "reads no clock of its own" regression idiom this phase's `buildTasksIcs` test suite should follow is this one.

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `src/shared/ics.ts` | CREATE | Pure, DB-free `.ics` serializer — decidable, so it is authored test-first per `docs/context/methodology.md` |
| `src/worker/routes/export-ics.ts` | CREATE | The `GET /api/export.ics` sub-router: fetches all Tasks, maps them through the existing `toTaskDto`, calls the serializer, sets `Content-Type`/`Content-Disposition` |
| `src/worker/index.ts` | UPDATE | Mount `app.route("/api/export.ics", icsRoutes)` alongside the existing three route groups |

## NOT Building (Scope Limits)

- The `/settings` download control — phase 3 (AC-9).
- The unattended pull script and Windows Scheduled Task — phase 4 (AC-10, AC-11).
- `VTODO` components — the PRD's Decisions Log records this loss deliberately; not re-litigated here.
- Any Google Calendar or Google API interaction — this file is a static export the owner (or his browser/`curl`) downloads; nothing here reads from or writes to Google.
- A second calendar file per Life Area, per date range, or any other partitioning — one `.ics` covering all dated Tasks, per the PRD's "no filtering/paging/windowing" rule.

## Step-by-Step Tasks

### Task 1: CREATE src/shared/ics.ts

- **ACTION**: Create a pure function `buildTasksIcs(now: Date, tasks: TaskDto[]): string` that: (1) filters `tasks` to those where `task.deadline ?? task.scheduledDate` is non-null, using that exact expression (mirrored from `dayItemFromTask`); (2) for each surviving Task, builds a `VEVENT` block with, in order, `BEGIN:VEVENT`, `UID:<task.id>@praesto.local`, `DTSTAMP:<now formatted as UTC basic-format YYYYMMDDTHHMMSSZ>`, `DTSTART;VALUE=DATE:<the date with hyphens stripped, e.g. 20260904>`, `SUMMARY:<task.title, escaped>`, `COMMENT:<a fixed English sentence — e.g. "Originally a Praesto to-do (Task), exported as an all-day event for calendar compatibility.">`, `END:VEVENT`; (3) wraps every `VEVENT` in `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//Praesto Sum//Data Export//EN`, `CALSCALE:GREGORIAN`, then the `VEVENT`s, then `END:VCALENDAR`; (4) maps every content line through a new `foldContentLine(line: string): string` helper (RFC 5545 §3.1), then joins the (possibly now-multi-physical-line) results with `\r\n` (CRLF) and terminates the final line with `\r\n` too. Add a private `escapeIcsText(value: string): string` helper that escapes `\`, `;`, `,` and literal newlines per RFC 5545 §3.3.11 (backslash-escape the first three, replace newlines with `\n`), applied to `SUMMARY` and `COMMENT` values. The `UID` decision (`<task.id>@praesto.local`, stable across every export of the same Task rather than freshly generated per export) is deliberate: `task.id` is already a globally-unique `crypto.randomUUID()` value (`src/worker/routes/tasks.ts:155`), so reusing it costs nothing and makes re-imports of the same file idempotent in calendar clients that de-duplicate by `UID` — the PRD's own open question, decided here. No import from `src/worker/` or any Drizzle type; only `TaskDto` from `./api`.
  - **Folding (RFC 5545 §3.1, in scope via AC-7):** `foldContentLine` measures `line`'s UTF-8 encoded byte length using `new TextEncoder().encode(line).length` — never `line.length` (UTF-16 code units, which under-counts every multi-byte character and would let an over-long line slip through, or over-counts and folds a line that was already within budget). When the encoded length is `<= 75`, return `line` unchanged. When it exceeds 75, walk the encoded byte array and find code-point-safe cut points (never splitting a UTF-8 continuation byte away from its lead byte — decode incrementally, or cut only at offsets that are also valid string-index boundaries) so the first physical line carries up to 75 octets, and each continuation physical line is prefixed with a single space (which itself counts toward that line's own 75-octet budget) and carries up to 74 further content octets; join the physical lines with `\r\n`. This is the whole reason the item matters for this app: `SUMMARY:` alone costs 8 octets before any title text, and pt-BR accented characters (á, ã, ç, é, ô, …) are 2 octets each in UTF-8 — a routine title like `"Levar o carro à revisão amanhã"` is already past half of the 75-octet budget, so unfolded long lines are the normal case for this owner's real data, not an edge case.
- **MIRROR**: `# SOURCE: src/shared/day-item.ts:65-78` (the `deadline ?? scheduledDate` rule), `# SOURCE: src/shared/export.ts:10-14` (the no-clock-read, `now`-as-parameter convention), and `# SOURCE: src/worker/auth.ts:28-31` (the `TextEncoder`-based UTF-8 byte-encoding idiom `foldContentLine` reuses to measure and cut at 75 octets)
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx vitest run test/export-ics.test.ts
  ```

Serves **AC-A1 (PRD AC-7)** and **AC-A2 (PRD AC-8)** — this is the module where every RFC 5545 minimum, the CRLF requirement (including its §3.1 line-folding companion rule), and the dated-vs-undated Task selection are all decided.

### Task 2: CREATE src/worker/routes/export-ics.ts

- **ACTION**: Create `export const icsRoutes = new Hono<{ Bindings: Env }>()` with a single `icsRoutes.get("/", async (c) => { ... })` handler that: opens `createDb(c.env)`; selects every row of `tasks` (`db.select().from(tasks)` — no `WHERE`, since `buildTasksIcs` itself decides which Tasks produce a `VEVENT`, exactly as `dayItemFromTask` decides bucket membership rather than the query); maps each row through the existing `toTaskDto`; calls `buildTasksIcs(new Date(), mappedTasks)`; and returns a `Response` with `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="praesto-<YYYY-MM-DD>.ics"` (the date from `todayIn(now)`, same helper the JSON route already uses), and the serialized string as the body.
- **MIRROR**: `# SOURCE: src/worker/routes/export.ts:30-64`
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx vitest run test/export-ics-route.test.ts
  ```

Serves **AC-A1 (PRD AC-7)** and **AC-A2 (PRD AC-8)** — the route is where the `.ics` becomes reachable by an authenticated `GET`, inheriting `requireToken` the same way `/api/export` does.

### Task 3: UPDATE src/worker/index.ts

- **ACTION**: Import `icsRoutes` from `./routes/export-ics` and add `app.route("/api/export.ics", icsRoutes);` immediately after the existing `app.route("/api/export", exportRoutes);` line, keeping it below `app.use("/api/*", requireToken)` so the mount inherits the auth gate with no changes to `auth.ts`.
- **MIRROR**: `# SOURCE: src/worker/index.ts:15-23`
- **VALIDATE**:
  ```
  set -euo pipefail
  npx tsc -b
  npx vitest run test/export-ics-route.test.ts
  ```

Serves **AC-A1 (PRD AC-7)** — mounting the route under `/api/*` is what makes `requireToken` apply to `/api/export.ics` with no auth code of its own.

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
(`vitest run` — exercises `test/export-ics.test.ts` and `test/export-ics-route.test.ts` alongside the existing suite; exits non-zero on any failing test, via Vitest's own exit code, not a parsed count.)

**Level 3 DRY-RUN END-TO-END**
```
npx wrangler deploy --dry-run --outdir dist-dry-run
```
(Builds and bundles the whole Worker — including the new route and its imports — without publishing; exits non-zero on any build/bundling failure, which would catch a broken import or an unresolvable binding before a real deploy attempt.)

## Acceptance Criteria

- **AC-A1 (PRD AC-7):** Given at least one dated Task, when the `.ics` is fetched, then it opens with `BEGIN:VCALENDAR`, carries `VERSION:2.0` and a `PRODID`, and every component carries a `UID` and a `DTSTAMP`, with CRLF line endings per RFC 5545.
- **AC-A2 (PRD AC-8):** Given three Tasks — one with a `deadline`, one with a `scheduledDate`, one with neither — when the `.ics` is fetched, then it contains exactly two `VEVENT` components, each with `DTSTART;VALUE=DATE` equal to that Task's date, and the undated Task appears nowhere.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `foldContentLine`'s byte-cutting logic has an off-by-one or fails to respect a UTF-8 code-point boundary, corrupting a title's accented characters or producing a fold at the wrong offset | L | M | Task 1's `escapeIcsText`/`foldContentLine` pair is authored test-first; `test/export-ics.test.ts` is expected to include a title long enough to force a fold, asserting the continuation line begins with a single space and that re-joining the folded physical lines reproduces the original (unescaped) title exactly — a test that only checks "no line exceeds 75 octets" would pass on output that folded mid-character and corrupted the text, so it is not sufficient on its own |
| The `UID` stability decision (Task id + fixed suffix) means re-fetching the export twice for the same Task always yields the same `UID`, so an owner who imports the file twice into the same calendar may see de-duplication behavior he did not expect, depending on the client | L | L | Documented in Task 1's `ACTION` and this file's `## Solution Statement`; the PRD's own open question flagged this as "may be desirable or surprising" — idempotent re-import was judged the safer default for a personal backup tool |
| A Task title containing a comma, semicolon or backslash is written into `SUMMARY`/`COMMENT` unescaped | M | M | Task 1's `escapeIcsText` helper is mandatory for both fields; `test/export-ics.test.ts` is expected to assert on a title containing at least one of these characters |
| The real Google Calendar import behavior for `COMMENT` on a `VEVENT` was not confirmed against a primary source (only RFC 5545's own semantics were verified) | L | L | The success signal in Phase Details ("the produced file imports into Google Calendar showing the owner's dated Tasks on their correct days") is verified manually by the owner post-implementation, per this PRD's existing pattern for calendar-import verification |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task above and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands invoke the test framework's own runner (`npx vitest run <suite>`) directly against the suite the test pair will have already written, rather than the Implementer authoring or editing any spec.

**Test file naming convention (informational, not binding on test-writer):** this plan's per-task VALIDATE commands assume the test pair names its suites `test/export-ics.test.ts` (Task 1 — the pure serializer, AC-7/AC-8 shape assertions) and `test/export-ics-route.test.ts` (Tasks 2-3 — the route-level auth/headers/content assertions), mirroring phase 1's `test/export-envelope.test.ts` / `test/export.test.ts` split. If the test pair chooses different names, the VALIDATE commands must be updated to match before code review; `npm test` (Level 2) passes or fails identically either way since it is not name-scoped.

**Folding test expectation (informational, not binding on test-writer):** `test/export-ics.test.ts` is expected to include a fixture Task whose title is long enough, once UTF-8-encoded, to force at least one fold (e.g. a pt-BR title with several accented characters comfortably over 75 octets), and to assert two things about the resulting `SUMMARY` line's physical continuation: (1) every continuation physical line begins with exactly one space; and (2) stripping that leading space from each continuation line and re-joining all physical lines reproduces the original (pre-fold, pre-escape) title exactly. Asserting only "no physical line exceeds 75 octets" is explicitly insufficient — it would pass on a fold that landed mid-character and silently corrupted the text.

**Where phase 1's code currently lives:** at the time this plan was written, phase 1's deliverables (`src/worker/db/export-manifest.ts`, `src/shared/export.ts`, `src/worker/routes/export.ts`, the `dto.ts`/`api.ts` additions) exist only in the `feature/data-export` worktree (`C:\repos\assistente-pessoal\.worktrees\data-export\`), uncommitted to `main` — row 1 of the PRD's Implementation Phases table is `complete` under the project's phase-lifecycle rule ("`complete` does not mean merged"). This plan's paths are written repo-relative, as usual; the Implementer is expected to run against the same branch/worktree phase 1 was built in, where those files already exist.

**RFC 5545 grounding (external, not codebase):** VCALENDAR requires `VERSION` and `PRODID`; a VEVENT requires `UID` and `DTSTAMP` (`DTSTART` is required here too, since no calendar-level `METHOD` is set) — RFC 5545 §3.6.1, §3.7.3, §3.7.4 (https://www.rfc-editor.org/rfc/rfc5545.html). All-day `DTSTART;VALUE=DATE` uses the bare `YYYYMMDD` form with no separators (§3.3.4). Content lines are CRLF-terminated, and any content line whose UTF-8 encoded length exceeds 75 octets is folded into multiple physical lines whose continuations begin with a single space (§3.1) — the amendment folding into this plan's scope (2026-09-04), on the reading that AC-7's "CRLF line endings per RFC 5545" invokes the same §3.1 section that also defines folding. `COMMENT` is a repeatable, component-level TEXT property explicitly meant as non-processing annotation (https://icalendar.org/iCalendar-RFC-5545/3-8-1-4-comment.html) — exactly the vehicle the PRD's Architecture Notes call for to state that these events originated as to-dos. Community evidence (not a vendor primary source) confirms Google Calendar and Outlook both silently ignore `VTODO` on `.ics` import (https://groups.google.com/g/tasks-backup/c/YVUSYThNtl8), which is the PRD's own cited justification for `VEVENT` over `VTODO` and is not re-verified here.

**No deploy, no push, no network call to production in any task above** — every `**VALIDATE**` runs locally (`tsc`, `vitest`, a `wrangler deploy --dry-run` that never publishes). The Level 3 command builds and bundles only; it does not touch the owner's production Worker.

*Generated: 2026-09-04*
*Approved: 2026-09-04*
*Status: IMPLEMENTED*
