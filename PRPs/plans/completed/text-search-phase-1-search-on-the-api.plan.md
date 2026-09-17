# Feature: Search on the API (Phase 1 of text-search)

```
**Decision Gate**
- Active context: none
- Activated criteria: new pure module under src/shared/; modifies an existing token-gated API route (GET /api/tasks); modifies TaskFilter, the single source of truth for filter state; additive-only change to the frozen unit-2 wire contract
- Decisions found: ADR-0003 (search runs on the server, no offline copy — search is read-only and online-only, consistent with the thin-client posture); ADR-0005 (types flow from src/worker/db/schema.ts through src/worker/dto.ts to src/shared/api.ts — results stay TaskDto, no new wire type; bearer token on every API route); ADR-0008 (test-first for routes, validation and pure src/shared logic — tdd: true here); unit-3 decision that filters are SQL WHERE clauses composed beside the frozen urgency ordering, and that TaskFilter in src/shared/task-filter.ts is the single source of truth for filter state; 2026-08-29 decision that an APPROVED PRD's phase-table row may only be mutated on its own Status/PRP Plan cells
- Applicable anti-patterns: Hand-duplicated entity types (search results stay TaskDto via the existing toTaskDto — no new result type); Portuguese in artifacts (every new identifier, comment and error message here is English; pt-BR is reserved for UI copy, out of this API-only phase); Glossary synonym drift ("Task", never "todo"/"item"); Weakening tests to force green (the test-file routing note below keeps the Implementer out of test files entirely)
- Applicable architectural rules: one Worker serves everything; src/shared/ stays DOM-free, clock-free and dependency-free (search.ts and task-filter.ts both compile into the browser AND the Worker); migrations only via drizzle-kit generate + wrangler d1 migrations apply (this phase needs none — AC-13); every API route requires the auth token (unaffected — q validation is added to the same pre-auth-independent, pre-DB validation block the existing filters already use); TaskFilter is the single filter-state source of truth (the chip row / filter sheet must never grow a second copy)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/text-search.prd.md` — Implementation Phases row 1: "Search on the
  API" — Goal: two words find any Task through a token-gated request, and the
  normalization has one tested definition — Success signal: AC-1 through AC-11
  and AC-13 green, and `npm run check` clean.

## Summary

Adds an optional `q` query parameter to the existing `GET /api/tasks` route.
Every whitespace-separated word of `q` must occur, in any order and anywhere,
in the Task's title or description, ignoring case and Portuguese diacritics,
across every status. The approach is one new pure module,
`src/shared/search.ts`, holding a single diacritic-mapping table that
generates BOTH the JavaScript normalizer (`normalizeSearchText`,
`searchWords`) and the SQL expression (`buildNormalizedSqlExpression`) used to
build `instr()`-based clauses (`buildSearchClauses`) — so the two sides cannot
drift (AC-11). The route composes one clause per word into the SAME `clauses`
array the existing status/priority/date filters already use, so ordering,
`limit` and AND-composition (AC-6, AC-9) are inherited for free. `q` is
validated (blank/whitespace → 400 naming `q`; over 100 chars → 400) entirely
BEFORE any database access, mirroring the existing route's own
validate-then-query shape. `TaskFilter` gains a `q: string | null` field so it
stays the single source of truth for filter state. No schema change, no
migration (AC-13). The client search route (header icon, debounce, states) is
explicitly out of scope — that is Phase 2 (AC-12).

## User Story

As the owner, I want to type a word or two into the Task list request and get
back every Task — open, done or missed — whose title or description contains
every word, so that a Task I cannot place by date, status or priority is still
reachable by something I remember about it.

## Problem Statement

The owner has no way to find a Task again except by scrolling *Hoje* or
narrowing it with status, date and priority filters — and a completed Task
falls into the collapsed *Concluídas* group where scrolling stops working as a
retrieval method. `GET /api/tasks` has no text parameter at all
(`src/worker/routes/tasks.ts:53-118`), and no search code of any kind exists
in `src/` or `migrations/`. Phase 1 narrows this to the API layer only: the
route, the shared filter state and the normalization logic that must exist
before any UI can call it.

## Solution Statement

Add `q` to `GET /api/tasks` as one more `WHERE` clause beside the unit-3
filters and the frozen urgency ordering. Normalization — lowercasing plus
Portuguese-diacritic folding — lives in exactly one mapping table in
`src/shared/search.ts`, which generates both the JS normalizer used to split
and normalize the query into words, and the SQL `lower()` + chained
`replace()` expression applied to the normalized `title` and `description`
columns (joined by a newline so a word can never match across that boundary).
Each word becomes one bound-parameter `instr(normalized, word) > 0` clause —
no `LIKE`, so special characters are literal by construction (AC-7). `q`
validation (blank/whitespace, over-length) happens before any of the route's
existing DB access, exactly where the existing `status`/`limit`/`from`/`to`/
`priority` validation already happens. `TaskFilter`/`EMPTY_FILTER`/`toQuery`
gain a `q: string | null` dimension, appended after `priority` in the fixed
param order so no existing `toQuery` assertion's string shape changes.

## Metadata

| Field | Value |
|---|---|
| Type | Feature (additive API capability) |
| Complexity | Medium — one genuinely novel technique (JS/SQL-agreeing diacritic normalization), but scoped to one route + two small shared modules, no schema change |
| Systems Affected | Worker API (`src/worker/routes/tasks.ts`), `src/shared/` (`search.ts` new, `task-filter.ts`, `api.ts`) |
| Dependencies | None (`Depends: -` in the PRD's Implementation Phases row 1) |
| Estimated Tasks | 4 |
| Source PRD line ref | `PRPs/prds/text-search.prd.md` lines 267, 272-279 (Implementation Phases row 1 + Phase 1 Details) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/worker/routes/tasks.ts` | 53-118 | The exact validate-everything-then-build-`clauses`-then-hit-the-DB shape this phase extends; the `q` validation must land in the same pre-DB block |
| P0 | `src/shared/task-filter.ts` | 1-54 | `TaskFilter`/`EMPTY_FILTER`/`toQuery` shape, and the DOM-free/clock-free/dependency-free discipline `search.ts` must also follow (both compile into the browser AND the Worker) |
| P0 | `src/shared/api.ts` | 231-239 | `MAX_TASK_LIMIT`'s doc-comment + exported-const pattern to mirror for `MAX_SEARCH_QUERY_LENGTH` |
| P1 | `src/worker/db/schema.ts` | 147-224 | Confirms `tasks.title` (`NOT NULL`) / `tasks.description` (nullable) shape and that no schema change is required (AC-13) |
| P1 | `test/export-completeness.test.ts` | 43-60 | Confirms the completeness guard enumerates real Drizzle `SQLiteTable` objects — this phase adds none, so it cannot trip |
| P2 | `test/task-list-filters.test.ts` | 1-103 | The D1 isolation/seeding/request pattern the test pair will mirror for the new `q` route tests (context only — this plan's Implementer never authors test files) |
| P2 | `docs/context/methodology.md` | 1-22 | `tdd: true` — test-first ordering: the suite exists, RED-for-the-right-reason, before this plan's tasks run |

## Patterns to Mirror

```
# SOURCE: src/worker/routes/tasks.ts:53-118
taskRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  if (status !== undefined && !isTaskStatus(status)) {
    return c.json({ error: `Unknown status: ${status}` }, 400);
  }
  const rawLimit = c.req.query("limit");
  let limit = MAX_TASK_LIMIT;
  if (rawLimit !== undefined) {
    const parsed = /^\d+$/.test(rawLimit) ? Number(rawLimit) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TASK_LIMIT) {
      return c.json({ error: `Invalid limit: ${rawLimit}` }, 400);
    }
    limit = parsed;
  }
  // ...from/to/priority validated the same way, all before any DB access...
  const clauses = [
    status === undefined ? undefined : eq(tasks.status, status),
    // ...
  ].filter((clause) => clause !== undefined);
  const db = createDb(c.env);
  const rows = await db.select().from(tasks)
    .where(clauses.length === 0 ? undefined : and(...clauses))
    .orderBy(urgencyBucket, dueDate, desc(tasks.createdAt))
    .limit(limit);
  return c.json({ tasks: rows.map(toTaskDto) });
});
```
Copies into: Task 3 (`q` validation joins this same pre-DB block; the resulting clauses are appended to this same `clauses` array so ordering/limit/AND-composition are inherited unchanged — AC-6, AC-9).

```
# SOURCE: src/worker/routes/tasks.ts:86-93
const dueDate = sql`coalesce(${tasks.deadline}, ${tasks.scheduledDate})`;
const urgencyBucket = sql`case
    when ${dueDate} is null then 3
    when ${dueDate} < ${today} then 0
    when ${dueDate} = ${today} then 1
    else 2
  end`;
```
Copies into: Task 2 (`buildNormalizedSqlExpression`/`buildSearchClauses` build custom SQL the same way — a Drizzle `sql` template with interpolated sub-expressions and bound parameters, never string concatenation).

```
# SOURCE: src/shared/task-filter.ts:1-15
/**
 * ... Like `src/shared/task-groups.ts`, `format.ts` and `dates.ts`, this
 * module is compiled into BOTH the browser and the Worker projects, so it
 * stays environment-agnostic: no DOM globals, no runtime dependencies, and no
 * reads of the clock.
 */
```
Copies into: Task 2 (`src/shared/search.ts`'s own module header states and follows the identical discipline — no DOM, no runtime deps, no clock reads; every function is a pure transform of its arguments).

```
# SOURCE: src/shared/task-filter.ts:47-54
export function toQuery(filter: TaskFilter): string {
  const params = new URLSearchParams();
  if (filter.status !== null) params.set("status", filter.status);
  if (filter.from !== null) params.set("from", filter.from);
  if (filter.to !== null) params.set("to", filter.to);
  if (filter.priority !== null) params.set("priority", filter.priority);
  return params.size === 0 ? "" : `?${params.toString()}`;
}
```
Copies into: Task 4 (`q` is appended as a fifth `if (filter.q !== null) params.set("q", filter.q);` line, placed AFTER `priority` — last in the fixed order — so no existing `toQuery` assertion's expected string changes).

```
# SOURCE: src/shared/api.ts:231-239
/**
 * The hard ceiling on how many Tasks one list response may carry. ...
 */
export const MAX_TASK_LIMIT = 500;
```
Copies into: Task 1 (`MAX_SEARCH_QUERY_LENGTH = 100` gets the same doc-comment-explaining-the-why + exported-const shape).

The diacritic-mapping table itself (`DIACRITIC_MAP`) and the `lower()` +
chained `replace()` SQL-generation technique have **no existing in-repo
precedent** — confirmed by research-codebase (grep for
`diacritic|normalize|instr\(|unaccent|NFD` across `src/` returned zero
matches) and already flagged as a gap in the PRD's own Research Summary. This
part of Task 2 is genuinely new; only its module-header style and its use of
Drizzle's `sql` template are mirrored from the anchors above.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/api.ts` | UPDATE | Add the exported `MAX_SEARCH_QUERY_LENGTH` constant bounding `q` (AC-8), mirroring `MAX_TASK_LIMIT`'s doc-comment + exported-const shape |
| `src/shared/search.ts` | CREATE | The single `DIACRITIC_MAP` plus `normalizeSearchText`, `searchWords`, `buildNormalizedSqlExpression`, `validateSearchQuery` and `buildSearchClauses` — the one normalization definition and its two agreeing implementations (AC-1, AC-2, AC-4, AC-7, AC-8, AC-11) |
| `src/worker/routes/tasks.ts` | UPDATE | Validate `q` in the existing pre-DB validation block, then append one `instr()` clause per word to the existing `clauses` array of `GET /api/tasks` (AC-1..AC-9) |
| `src/shared/task-filter.ts` | UPDATE | Add `q: string \| null` to `TaskFilter`, `EMPTY_FILTER` and `toQuery` so the single filter-state source of truth also describes a text search |

## NOT Building (Scope Limits)

- The search route, header *Pesquisar* icon, debounce/request-abort, `/`/`Esc`
  keyboard model, and the empty/offline/error states — all AC-12, all Phase 2.
- Search over Events or standalone Reminders — out of this PRD entirely (see
  the PRD's own "What We're NOT Building").
- Relevance ranking, match highlighting or snippets.
- Query operators (`OR`, `NOT`, quoted phrases, wildcards).
- Typo tolerance or stemming.
- Search history, saved searches, or keeping `q` across a cold start.
- Offline search.
- Any new table, column, index or migration (AC-13 pins zero of each).

## Step-by-Step Tasks

### Task 1: UPDATE src/shared/api.ts — add MAX_SEARCH_QUERY_LENGTH

**ACTION**: Add an exported `MAX_SEARCH_QUERY_LENGTH = 100` constant near
`MAX_TASK_LIMIT`, with a doc comment explaining it bounds the `q` query
parameter on `GET /api/tasks` and citing AC-8 (over-100-char queries are
rejected with 400).

**MIRROR**: `# SOURCE: src/shared/api.ts:231-239` (doc-comment + exported-const
pattern).

**VALIDATE**:
```
node --experimental-strip-types --input-type=module -e '
import { MAX_SEARCH_QUERY_LENGTH } from "./src/shared/api.ts";
if (MAX_SEARCH_QUERY_LENGTH !== 100) {
  console.error("FAIL: MAX_SEARCH_QUERY_LENGTH must be 100, got", MAX_SEARCH_QUERY_LENGTH);
  process.exit(1);
}
console.log("PASS: MAX_SEARCH_QUERY_LENGTH is exported and equals 100");
'
```

### Task 2: CREATE src/shared/search.ts — normalization, validation, clause building

**ACTION**: Create `src/shared/search.ts` with: (1) `DIACRITIC_MAP`, a
`Readonly<Record<string,string>>` of lowercase pt-BR accented characters to
their base ASCII letter (á à â ã ä → a; é è ê ë → e; í ì î ï → i; ó ò ô õ ö →
o; ú ù û ü → u; ç → c); (2) `normalizeSearchText(text: string): string` —
`text.toLowerCase()` then replace every character present in `DIACRITIC_MAP`
with its mapped base letter; (3) `searchWords(query: string): string[]` —
trim, split on `/\s+/`, drop empty tokens, map each token through
`normalizeSearchText`; (4) `buildNormalizedSqlExpression(expr: SQL): SQL` —
wraps `expr` in `lower(...)`, then chains `replace(replace(result, accented,
base), accented.toUpperCase(), base)` for every `DIACRITIC_MAP` entry (BOTH
cases are needed because SQLite's `lower()` only folds ASCII — an uppercase
accented letter passes through `lower()` unchanged). **The accented and base
characters are embedded as SQL string literals with `sql.raw`, never bound as
parameters.** Binding them puts two parameters into every `replace()` —
roughly 92 per normalized column, doubled for title and description — and D1
rejects any statement over 100 bound parameters with "too many SQL variables"
(found by the phase-1 suite on attempt 1). Embedding is safe because the
literals are compile-time constants from `DIACRITIC_MAP`, never user input;
build each literal with every single quote doubled, so the generator stays
correct even if a future map entry contains a quote. The only bound parameter
this module ever adds is the search word itself; (5)
`validateSearchQuery(raw: string)` returning `{ ok: true; words: string[] }`
when `raw.trim().length > 0` and `raw.length <= MAX_SEARCH_QUERY_LENGTH`
(words from `searchWords(raw)`), else `{ ok: false; error: string }` naming
`q` in the error message; (6) `buildSearchClauses(raw: string, titleColumn:
SQL, descriptionColumn: SQL)` — calls `validateSearchQuery`, and on success
builds `searchable = buildNormalizedSqlExpression(titleColumn) || char(10) ||
buildNormalizedSqlExpression(coalesce(descriptionColumn, ''))` (the newline
join keeps a word from ever matching across the title/description boundary —
AC-4) and returns `{ ok: true; clauses: SQL[] }`, one bound-parameter
`instr(searchable, word) > 0` clause per word, or forwards the `{ ok: false }`
from validation.

**MIRROR**: `# SOURCE: src/shared/task-filter.ts:1-15` (pure/DOM-free/
clock-free module discipline) and `# SOURCE: src/worker/routes/tasks.ts:86-93`
(Drizzle `sql` template composition pattern).

**VALIDATE**:
```
npx vitest run test/search.test.ts test/search-sql-agreement.test.ts
```
(Both files belong to the B8-APPROVED test-first suite; the second evaluates the
generated SQL inside real D1, so it fails on the bound-parameter limit above.
Must exit 0.)

### Task 3: UPDATE src/worker/routes/tasks.ts — wire q into GET /

**ACTION**: In the existing pre-DB validation block of `taskRoutes.get("/", ...)`
(after the `priority` check, before `const db = createDb(c.env);`), read
`const q = c.req.query("q");` and, when `q !== undefined`, call
`buildSearchClauses(q, sql\`${tasks.title}\`, sql\`${tasks.description}\`)`; on
`{ ok: false }` return `c.json({ error: result.error }, 400)` immediately
(before any DB access — this is load-bearing for this task's own VALIDATE
below); on success, append `result.clauses` to the existing `clauses` array
(the same array `status`/`from`/`to`/`priority` already populate) so ordering
and `limit` are applied to the combined set unchanged (AC-6, AC-9). When `q`
is absent, the array and the query are byte-identical to today (AC-8's "no q
key at all behaves exactly as today").

**MIRROR**: `# SOURCE: src/worker/routes/tasks.ts:53-118` (validate-then-
clauses-array-then-DB shape).

**VALIDATE**:
```
npx vitest run test/task-list-search.test.ts test/task-list-filters.test.ts test/tasks.test.ts
```
(The route suite runs inside workerd against an ephemeral D1 and covers AC-1..AC-9,
including the 400 paths; the two pre-existing files prove the unfiltered list and
the token gate are unchanged. Must exit 0.)

### Task 4: UPDATE src/shared/task-filter.ts — add q to TaskFilter

**ACTION**: Add `q: string | null;` to the `TaskFilter` interface, `q: null`
to `EMPTY_FILTER`, and `if (filter.q !== null) params.set("q", filter.q);` as
the LAST line of `toQuery` (after the `priority` line), so `q` sits last in
the fixed param order and no existing `toQuery` assertion's expected string
changes.

**Infrastructure note (no phase-1 AC applies):** No AC-A<i> in this plan
exercises `TaskFilter.q` directly — AC-A6 (PRD AC-6) is about the SERVER
composing `q` with the other filters inside `GET /api/tasks`'s `clauses`
array (Task 3), not about this client-side wire-building struct. This task
is infrastructure/scaffolding for Phase 2's search route (PRD AC-12), whose
plan will call `toQuery({ ...EMPTY_FILTER, q: <value> })` to build its
request. It is done now, in Phase 1, because the PRD's own Architecture Notes
say so explicitly ("`TaskFilter` in `src/shared/task-filter.ts` gains `q:
string | null`, keeping one filter state") — so `TaskFilter` stays the single
source of truth for filter state from the moment `q` exists, rather than
Phase 2 having to retrofit it later.

**MIRROR**: `# SOURCE: src/shared/task-filter.ts:47-54` (`toQuery`'s fixed-
order, `URLSearchParams`-encoded composition).

**VALIDATE**:
```
npx vitest run test/task-filter.test.ts
```
(Must exit 0; the file already expects `q: null` on `EMPTY_FILTER` and on every
`TaskFilter` literal.)

## Validation Commands

### Level 1: STATIC_ANALYSIS
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .` — must
exit 0.)

### Level 2: CONTENT_INVARIANTS
```
npx vitest run test/search.test.ts test/search-sql-agreement.test.ts test/task-list-search.test.ts test/task-filter.test.ts test/task-list-filters.test.ts test/tasks.test.ts test/export-completeness.test.ts
```
(Every phase-1 AC file of the approved suite plus the regression files for AC-9,
AC-10 and AC-13. Must exit 0. Amended 2026-09-15: the original Level 2 was a
`node --experimental-strip-types` script, which cannot resolve
`src/shared/search.ts`'s extensionless `./api` import — the repo-wide
convention — so it could never pass.)

### Level 3: DRY-RUN END-TO-END
```
npm run build
```
(`tsc -b && vite build && node scripts/check-dev-token-absent.mjs` — proves
the whole Worker + client + service worker bundle, including the new module
and the changed route, actually compiles and bundles together. The
Implementer RUNS the approved suite at Level 2 and in the VALIDATE of Tasks 2–4,
but never authors or edits a test file — the test pair owns those. The deepest
behavioral proof — that the SQL expression generated by
`buildNormalizedSqlExpression`, evaluated inside real D1, agrees with
`normalizeSearchText` — is AC-11's dedicated D1-integrated test.)

## Acceptance Criteria

- **AC-A1 (PRD AC-1):** `GET /api/tasks?q=ALUGUEL` (or `?q=lugue`, a fragment)
  returns a Task titled "Pagar o Aluguel de setembro" — one word, any case,
  any position.
- **AC-A2 (PRD AC-2):** `q=reuniao` finds "Reunião com o contador" and
  `q=CAFÉ MANHÃ` finds "cafe da manha" — diacritics ignored both ways.
- **AC-A3 (PRD AC-3):** `q=passaporte renovar` finds "Renovar passaporte na
  PF"; `q=passaporte carteira` does not — every word must match, any order.
- **AC-A4 (PRD AC-4):** a description is searched separately from the title
  (never across the newline boundary), and a Task with a `NULL` description
  is still searched by title.
- **AC-A5 (PRD AC-5):** `q=boleto` with no `status` returns Tasks of every
  status (`open`, `done`, `missed`).
- **AC-A6 (PRD AC-6):** `q` composes with `status`/`priority`/`from`/`to`/
  `limit` exactly as those filters compose with each other today.
- **AC-A7 (PRD AC-7):** `q=100%` and `q=_` are matched literally — `instr()`
  has no wildcard characters, so this holds by construction.
- **AC-A8 (PRD AC-8):** `q=` or `q=%20%20` → `400` naming `q`; `q` over 100
  characters → `400`; no `q` key at all behaves exactly as today.
- **AC-A9 (PRD AC-9):** adding `q` never reorders the result set, and every
  existing `test/task-list-filters.test.ts` assertion still passes untouched.
- **AC-A11 (PRD AC-11):** `normalizeSearchText`/`searchWords` match the exact
  fixture values in the PRD, and the SQL expression `buildNormalizedSqlExpression`
  generates agrees with them inside D1 (proven by the test pair's dedicated
  AC-11 test, not by this plan's own Validation Commands).
- **AC-A13 (PRD AC-13):** `test/export-completeness.test.ts` passes unchanged,
  and `src/worker/db/schema.ts`/`migrations/` show no added table, column or
  migration.

(AC-12 — the search route UI — is explicitly Phase 2 and out of this plan's
scope, per the PRD's own Phase 1 Details.)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| JS and SQL normalization disagree on a character, so a query silently misses a Task | M | A real Task becomes unfindable by the exact word the owner remembers | Single `DIACRITIC_MAP` in `src/shared/search.ts` generates both `normalizeSearchText` and `buildNormalizedSqlExpression`; AC-11's D1-evaluated fixture test (authored by the test pair) compares them directly inside workerd |
| A character outside `DIACRITIC_MAP` (e.g. `ñ`, `œ`) never matches its unaccented form | L | A rare loanword/name doesn't match | Out of scope for pt-BR per the PRD; the map is one constant, extended in one line if a real miss appears |
| `TaskFilter` gaining a `q` field breaks `test/task-filter.test.ts`'s `EMPTY_FILTER` deep-equality assertion (`expect(EMPTY_FILTER).toEqual({ status: null, priority: null, from: null, to: null })`) | H | A structurally correct code change trips a now-stale assertion | Flagged here for the test pair: an `EXISTING_TEST_UPDATED` lifecycle entry adding `q: null` to that expectation is the correct, non-weakening fix — the filter's shape genuinely changed |
| D1 rejects a statement with more than 100 bound parameters ("too many SQL variables") | H — observed on attempt 1 | Every `q` request returns 500 | Task 2 embeds the `DIACRITIC_MAP` constants as escaped SQL literals and binds only the search word; the route suite exercises real D1, so a regression fails Level 2 |
| A request per keystroke or a slow response — Phase 2's concern | - | - | Out of this plan's scope entirely (AC-12); not re-litigated here |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd`
  in `docs/context/methodology.md`: **true**. Test-first ordering — the test
  pair (test-writer/test-reviewer) produces the initial test suite from the
  Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are
  routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger
  (`/relay-write-test` → `/relay-test-write-review`), not authored by the
  Implementer — R-X is a blanket straight-fail on any test glob in the
  Implementer's diff. No task above and no `## Files to Change` row targets a
  test file; the `**VALIDATE**` commands of Tasks 2–4 and Level 2 RUN the
  approved suite with `npx vitest run`, which reads tests without changing them.
- The `instr()` + `lower()`/`replace()`-chain technique and the `DIACRITIC_MAP`
  table are genuinely new to this codebase (no existing precedent — see
  "Patterns to Mirror" above); everything else in this phase (validation
  shape, `clauses`-array composition, `TaskFilter` shape) mirrors an existing,
  cited pattern.
- **Amended 2026-09-15, after attempt 1 halted:** the original per-task and
  Level 2 commands ran `node --experimental-strip-types` against the `.ts`
  sources. That cannot resolve extensionless relative imports (the repo-wide
  convention, e.g. `src/shared/format.ts` → `./dates`) and cannot give the route
  a D1 binding, so Tasks 2–4 and Level 2 now run the approved vitest suite.
  Task 1 keeps its `node` command: `src/shared/api.ts` has no relative import
  and was verified to load under plain Node on 2026-09-15. The same attempt
  exposed the D1 bound-parameter limit recorded in Task 2 and in the Risks table.

*Generated: 2026-09-15*
*Approved: 2026-09-15*
*Implemented: 2026-09-15*
*Status: IMPLEMENTED*
