# Text Search over Tasks

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a PRD that downstream plan, test and implement stages consume); cross-cutting — touches the wire contract, the Task list route, src/shared and a new SPA route
- Decisions found: ADR-0003 thin client over a canonical store — search runs on the server and there is no offline search copy; ADR-0005 types flow from src/worker/db/schema.ts through src/worker/dto.ts to src/shared/api.ts, and the bearer token guards every /api/* route; ADR-0008 test-first for routes, validation and pure logic in src/shared, UI verified manually; ADR-0009 visible copy in pt-BR, everything else English; unit 2 froze the Task wire contract — this PRD only ADDS an optional query parameter and leaves every existing response byte-identical; unit 3 decided filters are SQL WHERE clauses composed beside the frozen urgency ordering, and TaskFilter in src/shared/task-filter.ts is the single source of truth for filter state; 2026-08-29 an APPROVED PRD's phase table may grow only with a dated amendment note
- Applicable anti-patterns: Hand-duplicated entity types (results are TaskDto, no new result type); Portuguese in artifacts (identifiers English, copy pt-BR under the ADR-0009 carve-out); Glossary synonym drift ("Task", never "todo"/"item"); Offline write queue (not approached — search is read-only and online-only); Weakening tests to force green
- Applicable architectural rules: one Worker serves everything; src/shared stays DOM-free, clock-free and dependency-free; migrations only via drizzle-kit generate + wrangler d1 migrations apply (this PRD needs none); every API route requires the auth token; the export completeness guard must keep classifying every table (this PRD adds none)
- Result: PROCEED
```

## Problem Statement

The owner has no way to find a Task again except by scrolling *Hoje* or narrowing
it with status, date and priority filters — and a completed Task falls into the
collapsed *Concluídas* group where scrolling stops working as a retrieval method.
The vision names this as a core failure ("I know I noted this somewhere"), and
once the scattered notes move in, every Task the owner cannot find again is a
reason to go back to the notes.

## Evidence

- `documentation/10-product/vision.md:45` — principle 5, "adding information and
  finding it again must be near-zero friction; the moment capture or retrieval
  feels like work, the assistant loses to memory, paper and old habits."
- `documentation/10-product/vision.md:71` — success criterion **found-again rate**,
  whose failure signal is "I know I noted this somewhere" happening inside the
  assistant too.
- FR-040 was **promoted Should → Must** on 2026-08-03 because "retrieval is a core
  owner pain" (`documentation/20-requirements/functional-requirements.md:67`).
- `GET /api/tasks` has no text parameter at all (`src/worker/routes/tasks.ts:53-118`),
  and no search code of any kind exists in `src/` or `migrations/`.
- **Counter-evidence, recorded rather than hidden:** the 2026-09-14 production
  snapshot holds 14 Tasks, all `done`, all test rows ("Teste", "Hello world 2").
  The pain is anticipated from the vision, not yet observed in real use — see
  Open Questions.

## Proposed Solution

Add an optional `q` parameter to the existing `GET /api/tasks` route, composed as
one more `WHERE` clause beside the unit-3 filters and the frozen urgency ordering.
Every whitespace-separated word of `q` must occur, in any order and anywhere, in
the Task's title or description, ignoring case and Portuguese diacritics, across
every status. Normalization is one mapping table in `src/shared/` that produces
both the JavaScript normalizer for the query and the SQL expression applied to
the columns, so the two sides cannot drift. On the client, the header's
*Pesquisar* icon — already reserved for unit 8 by the layout standard — opens a
search route with the field at the top; results reuse the *Hoje* grouping and
open the existing Task sheet. This was chosen over SQLite FTS5 because FTS5 is a
virtual table, which Cloudflare documents as blocking `wrangler d1 export`, would
need a hand-written migration, and would escape the export completeness guard —
three costs to buy ranking and typo tolerance that a single owner's few thousand
Tasks do not need.

## Key Hypothesis

We believe that typing two words into a search field that looks at every Task,
closed ones included, will make Tasks reliably found again for the owner.
We'll know we're right when the owner finds a Task completed weeks earlier by
typing two words, with no filter selected first.

## What We're NOT Building

- Search over Events and standalone Reminders — Events do not exist until unit 14,
  which the traceability table already assigns FR-040's extension to; standalone
  Reminders are not Tasks.
- Relevance ranking, match highlighting or snippets — results keep the frozen
  urgency ordering and the *Hoje* grouping; ranking is what FTS5 would buy.
- Query operators (OR, NOT, quoted phrases, wildcards) — two plain words is the
  whole job; operators are a power-user surface for a single casual user.
- Typo tolerance or stemming — no fuzzy index without FTS5; accents and case are
  the pt-BR mismatches that actually occur.
- Search history, saved searches, or the query in the URL — nothing in the exit
  signal needs them.
- Offline search — ADR-0003: the client holds no authoritative copy to search.
- A new table, column, index or migration — scale does not need one, and none
  keeps chores C6 and C7 untriggered.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Exit signal | The owner finds a Task completed weeks earlier by typing two words, no filter selected first | Owner's own report, as for units 3 and 4 |
| Time from tapping *Pesquisar* to that Task's sheet open | ≤ 10 s on the Android phone | Owner's device check at phase 2 |
| Schema changes introduced | 0 tables, 0 columns, 0 migrations | `git diff` of `src/worker/db/schema.ts` and `migrations/` at unit close |
| JS/SQL normalization disagreement | 0 strings in the AC-11 fixture | The AC-11 test, run inside workerd against D1 |

## Acceptance Criteria (test scenarios)

Mandatory. Each criterion is an observable scenario the resulting code must
satisfy. If `tdd: true` in `docs/context/methodology.md`, these are the
contract the test pair authors test-first (before the Implementer). If
`tdd: false` with a declared framework, they are the contract the test pair
authors test-after (after the Implementer + Code Review). With no framework
declared, no tests are authored.

- **AC-1 One word, any case, any position:** Given a Task titled "Pagar o Aluguel
  de setembro", when `GET /api/tasks?q=ALUGUEL` is requested, then that Task is in
  `tasks`; and `q=lugue` (a fragment inside a word) also returns it.
- **AC-2 Diacritics ignored both ways:** Given Tasks titled "Reunião com o
  contador" and "cafe da manha", when `q=reuniao` is requested then the first is
  returned, and when `q=CAFÉ MANHÃ` is requested then the second is returned.
- **AC-3 Every word must match, in any order:** Given a Task titled "Renovar
  passaporte na PF", when `q=passaporte renovar` is requested then it is returned,
  and when `q=passaporte carteira` is requested then it is not.
- **AC-4 Description is searched, separately from the title:** Given a Task titled
  "Documentos" whose description is "levar comprovante de residência", when
  `q=comprovante residencia` is requested then it is returned; given a Task titled
  "ab" with description "cd", when `q=bc` is requested then it is not returned
  (no match across the title/description boundary); a Task with a `NULL`
  description is still searched by title.
- **AC-5 All statuses without a filter:** Given one `open`, one `done` and one
  `missed` Task all titled "boleto", when `q=boleto` is requested with no `status`
  parameter, then all three are returned.
- **AC-6 Composes with the existing filters:** Given the three Tasks of AC-5, when
  `q=boleto&status=done` is requested, then only the `done` one is returned; and
  `priority`, `from`, `to` and `limit` apply to `q` results exactly as they apply
  to the unfiltered list.
- **AC-7 Special characters are literal:** Given Tasks titled "100% pago" and
  "1000 pagos", when `q=100%` is requested then only the first is returned; and
  `q=_` returns no Task whose text has no underscore.
- **AC-8 Invalid queries are rejected, not guessed:** When `q=` or `q=%20%20` is
  requested, then the response is `400` with an error naming `q`; when `q` is
  longer than 100 characters, then the response is `400`. A request with no `q`
  key at all behaves exactly as today.
- **AC-9 Ordering and existing responses unchanged:** Given any set of Tasks, when
  `q` is added to a list request, then the result equals the unfiltered list's
  order restricted to the matching Tasks; and every existing
  `test/task-list-filters.test.ts` assertion still passes untouched.
- **AC-10 Token gate:** When `GET /api/tasks?q=boleto` is requested without the
  bearer token, then the response is `401` and no Task data is returned.
- **AC-11 One normalization, two implementations that agree:** Given the pure
  helpers in `src/shared/`, `normalizeSearchText("ÁÉÍÓÚ Ç ãõ â ê ô à ü")` returns
  `"aeiou c ao a e o a u"`; `searchWords("  Renovar   PASSAPORTE ")` returns
  `["renovar", "passaporte"]`; and for every string in a fixture of pt-BR titles
  covering each mapped character in both cases, the SQL expression generated from
  the same mapping table, evaluated by D1, returns exactly what the JavaScript
  normalizer returns.
- **AC-12 The search route (manually verified, UI):** Given *Hoje* is open, when
  the owner taps the header's *Pesquisar* icon (or presses `/` on the PC), then a
  search route opens with the field focused; typing two or more characters shows
  matching Tasks grouped as on *Hoje* after a short pause, with no request per
  keystroke; tapping a result opens that Task's existing sheet; back or `Esc`
  returns to *Hoje*; a query with no match shows a pt-BR empty state naming the
  query; offline shows the existing connectivity banner and never a stale result
  list presented as current.
- **AC-13 Export untouched:** Given the change set of this unit, when
  `test/export-completeness.test.ts` runs, then it passes unchanged, and
  `src/worker/db/schema.ts` and `migrations/` show no added table, column or
  migration.

## Open Questions

- [ ] The exit signal needs real Tasks completed weeks earlier, and on 2026-09-14
  production held only 14 test Tasks. The unit can be built now, but it can only
  close after real use accumulates — accepted as the same shape units 3 and 4
  closed on, but the date it becomes earnable is unknown.
- [ ] Debounce length and the 2-character minimum for as-you-type search are
  starting values to be confirmed on the owner's device in phase 2, not measured
  choices.
- [ ] Whether the search route keeps the last query when the owner opens a result
  and comes back. Proposed: yes for the session, never across a cold start
  (mirroring the unit-3 rule that a narrowing filter never survives a cold start);
  to confirm at phase 2's plan.

---

## Users & Context

**Primary User**
- **Who:** the owner — the project's single user, on his Android phone and his
  Windows PC.
- **Current behavior:** scrolls *Hoje*, expands *Concluídas*, or narrows with the
  unit-3 filters; outside the app, remembers or searches the scattered notes.
- **Trigger:** "I know I noted this somewhere" — a Task he remembers by a word or
  two but not by date, status or priority.
- **Success state:** the Task's sheet is open within seconds, whether it is open,
  done or missed.

**Job to Be Done**
When I remember a couple of words of something I noted, I want to type them and
see the Task, so I can act on it or confirm it was done without digging.

**Non-Users**
Nobody else: there are no other users, accounts or shared lists (single-user
by design, CON-002 and ADR-0003).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `q` on `GET /api/tasks`: every word matches title or description, case- and diacritic-insensitive, all statuses | The exit signal verbatim — two words, a completed Task, no filter |
| Must | One mapping table in `src/shared/` generating both the JS normalizer and the SQL expression | Two hand-written normalizations would drift silently; AC-11 proves agreement |
| Must | Search route opened from the header icon, results opening the existing Task sheet | The layout standard already reserves this entry point for unit 8 |
| Must | Validation (blank, over-long) and literal special characters | A query must never be silently reinterpreted |
| Must | `q` composing with the existing status/priority/date filters | Free once `q` is a clause; keeps TaskFilter the single filter state; pinned by AC-6, part of phase 1's success signal |
| Must | `/` focuses search and `Esc` closes on the PC | Named in the layout standard's keyboard model; pinned by AC-12, part of phase 2's success signal |
| Could | Keeping the last query for the session when returning from a result | Convenience; see Open Questions |
| Won't | FTS5, ranking, highlighting, operators, typo tolerance, history, Events | See What We're NOT Building |

### MVP Scope

The `q` parameter with AC-1..AC-11 green, plus the search route of AC-12
verified on the owner's phone and PC. Nothing else.

### User Flow

*Hoje* → tap *Pesquisar* in the header → type "passaporte renovar" → the matching
Task appears (grouped as on *Hoje*, *Concluídas* included) → tap it → its sheet
opens → back returns to *Hoje*.

---

## Technical Approach

**Feasibility:** HIGH — one additive query parameter on a route that already
composes clauses, one pure helper, one SPA route; no schema change, no new
dependency, no external service.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

### Architecture Notes

- **Matching is `instr()`, not `LIKE`.** Each normalized word is tested with
  `instr(<normalized text>, ?) > 0`, bound as a parameter. `instr` has no
  wildcard characters, so AC-7 holds by construction rather than by escaping.
- **SQLite's `lower()` folds ASCII only**, so uppercase accented letters must be
  in the mapping table in both cases — `lower('Á')` is still `'Á'`. The SQL
  expression is a nested `replace()` chain over `lower(...)` generated from the
  table; AC-11 is the guard.
- **Title and description are normalized separately and joined with a
  newline**, and words are split on whitespace, so a word can never match across
  the boundary (AC-4).
- **The clause joins the existing `clauses` array** in `src/worker/routes/tasks.ts`,
  so ordering and `limit` stay untouched (AC-9). `TaskFilter` in
  `src/shared/task-filter.ts` gains `q: string | null`, keeping one filter state;
  `toQuery` emits it.
- **Results are `TaskDto`** through the existing `toTaskDto`; no new wire type.
- **The client route extends `AppRoute` / `routeFromPath` / `pathOf`** the way
  unit 7 added the Task route; the field debounces and cancels the in-flight
  request when the query changes.
- **Scale:** a full scan of a few thousand rows is well inside the free plan's
  CPU budget; no index can serve `instr` anyway, which is exactly why none is
  added.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JS and SQL normalization disagree on a character, so a query silently misses a Task | M | Single mapping table generating both sides; AC-11 compares them inside D1 on a fixture covering every mapped character in both cases |
| Characters outside the table (e.g. `ñ`, `œ`) never match their unaccented form | L | Out of scope for pt-BR; the table is one constant, extended in one line when a real miss appears |
| A request per keystroke, or a slow response overwriting a newer one, shows wrong results | M | Debounce plus aborting the previous request; verified in phase 2 with throttled network |

---

## Implementation Phases

| # | Phase | Description | Status | Repo | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|------|----------|---------|----------|
| 1 | Search on the API | The `src/shared/` mapping table with `normalizeSearchText`, `searchWords` and the SQL-expression generator; `q` validation and the `instr` clause in `GET /api/tasks`; `q` added to `TaskFilter` and `toQuery` | pending | - | - | - | - |
| 2 | The search route | `AppRoute` search variant and codec, the header *Pesquisar* icon, the focused field with debounce and request abort, grouped results opening the existing Task sheet, `/` and `Esc`, empty/offline/error states in pt-BR; device verification and documentation updates | pending | - | - | 1 | - |

### Phase Details

**Phase 1: Search on the API**
- **Goal:** two words find any Task through a token-gated request, and the
  normalization has one tested definition.
- **Scope:** `src/shared/` search helpers and their mapping table;
  `src/worker/routes/tasks.ts` validation and clause; `src/shared/task-filter.ts`
  `q` field. No UI, no schema change.
- **Success signal:** AC-1 through AC-11 and AC-13 green, and `npm run check`
  clean.

**Phase 2: The search route**
- **Goal:** the owner reaches any Task from the header in a few taps.
- **Scope:** the search route and header icon per `ui-layout-standard.md`; reuse of
  the *Hoje* grouping, `TaskGroup`, `TaskRow` and `TaskSheet`; keyboard model;
  states per `ui-ux-guidelines.md` §8 with its review checklist run and recorded.
  Documentation: `documentation/50-planning/roadmap.md` (unit 8 row and delivery
  history), `docs/domain/areas/tasks.md` (the search rule),
  `docs/context/architecture.md` (FR-040 no longer "not built yet"),
  `documentation/40-engineering/ui-layout-standard.md` if the built route departs
  from §2.
- **Success signal:** AC-12 verified on the Android phone and the Windows PC, the
  UI/UX checklist result recorded, and the whole suite green.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Search technique | `instr()` over a `lower()` + `replace()` normalization generated from one `src/shared/` table | SQLite FTS5 (`unicode61 remove_diacritics`); a stored normalized `search_text` column; `LIKE` with escaping | FTS5 is a virtual table: Cloudflare documents it blocking `wrangler d1 export`, it needs a hand-written migration, and it escapes the export completeness guard. A stored column needs a migration and a backfill SQL cannot compute. `LIKE` needs escaping `instr` avoids. Scale needs no index |
| Where search lives on the wire | Optional `q` on `GET /api/tasks` | A separate `/api/search` returning a union of kinds | Composes with the unit-3 filters for free, reuses `TaskDto` and the frozen ordering; Events extend FR-040 in unit 14, which decides its own shape then |
| Default status scope | Every status — `open`, `done`, `missed` | Open only, with a "search completed" action (Todoist's documented default) | The exit signal is literally a completed Task found with no filter chosen first |
| Word semantics | Every word must occur, any order, any position | Exact phrase; any word (OR); whole-word only | "Two words find it" reads as AND; substring tolerates plurals and partial recall |
| Fields searched | Title and description | Title only | The Task sheet already edits a description (unit 2), so a word remembered from that note should find the Task |
| Result ordering | The list's frozen urgency ordering, grouped as on *Hoje* | Relevance ranking; newest first | No ranking signal exists without FTS5; reusing the ordering and grouping reuses `TaskGroup` and adds no contract |
| Exit signal kept despite no real data | Kept verbatim; the unit closes by use | Rewrite to a signal earnable with test data | A signal met on test rows proves the test rows; units 3 and 4 closed the same way |
| Opening while unit 7 is `in-progress` | Recorded exception to "at most one in-progress", owner decision 2026-09-15 | Wait for unit 7's week of real use | Unit 7's only remaining work is the owner's use, which consumes none of the development hour |
| Answers to the authoring round | The owner instructed "cria o PRD" after the writer proposed an answer to each of 14 questions, without amending any; the proposals are this PRD | Re-ask each question | The owner's stated working style is one consolidated round with proposed answers; approval still happens explicitly at review |

---

## Research Summary

**Market Context**
- Todoist does not search completed tasks by default; the user must click
  "Search completed tasks", and active tasks are listed first
  (https://www.todoist.com/help/articles/introduction-to-search-fAfiDSAp). This
  unit deliberately inverts that default.
- Todoist searches task descriptions and comments, and offers `&`, `|`, `!` and
  wildcard operators (same source) — operators are out of scope here.
- Cloudflare D1 does not support export of databases containing virtual tables,
  FTS5 included; the workaround is drop, export, recreate
  (https://developers.cloudflare.com/d1/best-practices/import-export-data/).
- SQLite FTS5's default `unicode61` tokenizer removes Latin diacritics, and the
  `trigram` tokenizer supports substring matching but not queries under three
  characters (https://www.sqlite.org/fts5.html).
- A D1-based project weighed the same trade-off: FTS5 at 1–6 ms over 150k rows
  with ranking, versus indexed `LIKE` under 1 ms with no ranking or multi-token
  support (https://github.com/KeeprDigital/shop-keepr/issues/16).
- Gap: no primary documentation was found for TickTick, Things 3, Microsoft To Do
  or Google Tasks on completed-task search, word semantics or diacritics.

**Technical Context**
- `GET /api/tasks` validates each filter, composes a `clauses` array and orders by
  urgency bucket before `limit`; no text parameter exists
  (`src/worker/routes/tasks.ts:53-118`). `MAX_TASK_LIMIT` is 500
  (`src/shared/api.ts:239`).
- `TaskFilter` is the single filter state shared by the chip row and filter sheet
  (`src/shared/task-filter.ts:20-54`).
- `tasks.title` is `NOT NULL` text, `tasks.description` nullable text, `status`
  CHECK-enforced `open|done|missed`; no FTS table or search code exists
  (`src/worker/db/schema.ts:147-224`).
- `toTaskDto` is the only row-to-wire mapping (`src/worker/dto.ts:28-43`).
- The export completeness test enumerates only Drizzle `SQLiteTable` objects, so a
  raw-SQL virtual table would escape it (`test/export-completeness.test.ts:52-59`).
- The layout standard reserves the header *Pesquisar* icon and a search route for
  unit 8, with `/` to focus and `Esc` to close
  (`documentation/40-engineering/ui-layout-standard.md:18,52,64`).
- `TodayScreen` threads header actions from `App.tsx` and seeds filter state from
  `EMPTY_FILTER`, never from storage (`src/app/components/TodayScreen.tsx:131-147,198-203`).
- Gap: no diacritic-normalization helper exists anywhere in `src/shared/`.

---

*Generated: 2026-09-15*
*Approved: 2026-09-15*
*Status: APPROVED*
