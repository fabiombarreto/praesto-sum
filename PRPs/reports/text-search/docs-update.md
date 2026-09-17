# Docs Update — text-search

**PR:** none (dispatched non-interactively by `/relay-implement` Phase A.3.5 docs-sync, phase 1 code review APPROVED at attempt 2)
**Merged at:** 2026-09-15
**Source PRD:** C:\repos\assistente-pessoal\PRPs\prds\text-search.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

Diff read from `PRPs/reports/text-search/phase-1/attempts/2/diff.patch` (cumulative
against base `7116a10`) — server-side search only: optional `q` on
`GET /api/tasks`, `src/shared/search.ts` normalization, and `q` on `TaskFilter`.
No UI exists yet (phase 2), so no UI-facing doc was touched.

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** The diff adds a new `src/shared/` module (`search.ts`, new file,
diff hunk `src/shared/search.ts`) that the repository-layout table's `src/shared/`
row did not yet list, and adds `q: string | null` to `TaskFilter` (diff hunk
`src/shared/task-filter.ts`). Appended a clause naming `search.ts` and its five
exports in the same enumeration style as the row's other modules, and noted
`TaskFilter`'s new field inline. Also updated the "Not built yet" line: it named
plain "search (FR-040)" as unbuilt, which the merged diff makes partially untrue
— the server-side `q` parameter now exists — so the line now scopes the
remaining gap to "the search route UI" and cites where the shipped half lives.
No other content in the line or its neighbors was touched.

### `docs/domain/areas/tasks.md`

**Change type:** additive
**Rationale:** The business-rules bullet already describing the list route's
`WHERE`-clause filters (`from`/`to`/`priority`, unit 3) is the exact paragraph
the PRD names for this update ("the list route's filters paragraph"). Appended
one sentence stating the `q` rule the merged diff implements (diff hunk
`src/worker/routes/tasks.ts`: every word in title or description, case- and
diacritic-insensitive, all statuses, composes with other filters, 400 on blank
or over 100 chars — matching `MAX_SEARCH_QUERY_LENGTH` in `src/shared/api.ts`
and the validation in `src/shared/search.ts`) and one sentence flagging that the
search route (UI) is still phase 2, unbuilt. No other line in the file was
touched.

## Candidate Decisions (for operator review)

The merged diff's Technical Approach and Decisions Log (both in the source PRD,
not the diff itself, since `docs/decisions.md` is PRESERVE-ENTIRELY) state
several concrete decisions explicitly. They are recorded here rather than
written into `docs/decisions.md` because this is phase 1 of 2 — the unit has
not closed, and the project's own precedent (e.g. the `reminders` unit's two
decisions.md entries) records decisions.md entries once a delivery unit's full
shape has landed, not mid-phase. Promote if the team wants these visible before
phase 2 closes the unit:

- Search technique: `instr()` over a `lower()` + chained `replace()`
  normalization generated from one `src/shared/search.ts` `DIACRITIC_MAP` table
  (rejected: SQLite FTS5 — blocks `wrangler d1 export`, needs a hand-written
  migration, escapes the export completeness guard; a stored `search_text`
  column — needs a migration + backfill; `LIKE` — needs escaping `instr` avoids).
- Where search lives on the wire: an optional `q` on the existing
  `GET /api/tasks`, not a separate `/api/search` route — composes with the
  unit-3 filters for free and reuses `TaskDto`.
- Default status scope: every status (`open`/`done`/`missed`) is searched with
  no `status` filter required — a deliberate reversal of Todoist's
  completed-tasks-hidden-by-default posture.
- Word semantics: every whitespace-separated word of `q` must match, in any
  order, anywhere (substring, not whole-word) — not an exact phrase, OR, or
  whole-word-only match.
- Fields searched: title AND description, normalized and newline-joined so a
  word can never match across the title/description boundary.
- The `D1 rejects >100 bound parameters` finding from phase-1 attempt 1 (see
  `buildNormalizedSqlExpression`'s comment in `src/shared/search.ts`): the
  `DIACRITIC_MAP` accented/base literals are embedded via `sql.raw` rather than
  bound, because binding them would have produced ~92 parameters per
  normalized column and D1 caps bound parameters at 100. This is a concrete,
  diff-stated technical finding a future `src/shared/` SQL-generation helper
  should know about — worth an anti-patterns.md or architecture.md note if a
  second such helper is ever written, but a single occurrence today does not
  yet meet the bar for a standing rule.

## Deferred Questions

None arose. The one genuinely ambiguous call this run made — whether to write
the Decisions Log entries above into `docs/decisions.md` now or wait for the
unit to close — was resolved by following the existing project precedent
(record at unit-close granularity) rather than raised as a question, so it is
filed under Candidate Decisions instead of here. Per `non_interactive: true`,
had a genuine yes/no ambiguity remained, it would have been recorded here
instead of asked.

## Files Scanned — No Edit Required

- `docs/decisions.md` — PRESERVE-ENTIRELY; no ADR or owner-ratified decision is
  cited by the merged diff or PRD outside the candidates listed above, which
  are deferred per the rationale given there.
- `docs/anti-patterns.md` — PRESERVE-ENTIRELY; the merged diff introduces no
  new forbidden pattern and no exception to an existing one. The `sql.raw`
  embedding technique in `src/shared/search.ts` is a one-off engineering
  finding, not a project-wide rule yet (see Candidate Decisions).
- `docs/KNOWLEDGE_BASE.md` — no new `docs/` file was added by this phase (only
  `docs/context/architecture.md` and `docs/domain/areas/tasks.md` were edited
  in place), so no index entry is needed.
- `docs/context/conventions.md`, `docs/context/constraints.md`,
  `docs/context/methodology.md`, `docs/domain/glossary.md`,
  `docs/context/testing.md` — no mention of search, `q`, or FR-040 in any of
  these; the merged diff introduces no new convention, constraint, methodology
  change or glossary term, and the new test files (`test/search.test.ts`,
  `test/search-sql-agreement.test.ts`, `test/task-list-search.test.ts`) already
  fall under `docs/context/testing.md`'s existing `test/*.test.ts` pattern.
- `docs/design/component-map.md` — not applicable; `figma_track: false` in
  `docs/context/methodology.md`, and this phase ships no UI regardless.
- `CLAUDE.md` — no essential-command or key-pattern change; the merged diff
  adds a query parameter and a `src/shared/` helper, neither of which rises to
  CLAUDE.md's "essential commands" or "key patterns" level, and CLAUDE.md
  already points at `docs/KNOWLEDGE_BASE.md` and the domain-area files that
  were updated.
- `docs/api-reference.md` — out of the Docs Updater's Explicit Write Scope (not
  listed in the contract's write-scope table), so left untouched even though
  its `GET /api/tasks` row and its stale "Not built yet" table (row 7 still
  reads `text-search`; the roadmap renumbered it to unit 8 on 2026-08-12) do
  not yet reflect the new `q` parameter. Flagging for the operator: this file
  needs a manual `q` row/column update, ideally in the same pass that fixes
  the pre-existing unit-numbering staleness, since both predate this diff and
  neither is this agent's to touch.
- `documentation/**` (all files, including `documentation/30-architecture/
  architecture-overview.md`, `documentation/20-requirements/
  functional-requirements.md`, and `documentation/30-architecture/
  domain-model.md`) — all read for grounding, none written. The Docs Updater's
  Explicit Write Scope does not include any `documentation/` path, and Hard
  Constraint #4 requires treating every `documentation/` mention as a read or a
  manifest note, never a write target — even though this project's own
  `CLAUDE.md` designates `documentation/` (not the generic rendered HTML site
  the constraint anticipates) as its authoritative human-owned knowledge base
  that `docs/` derives from. Checked each candidate the task named:
  `architecture-overview.md` has no "not built yet" enumeration or per-module
  `src/shared/` listing to update (its Task-read-contract section already
  speaks abstractly of "the filter vocabulary" without naming `q`); the
  functional-requirements.md traceability table already reads
  `FR-040 | Phase 1 | 8 \`text-search\`` (unit 8, in-progress — accurate, no
  change needed for a phase that has not closed the unit); `domain-model.md`
  is structural (entities/relationships/invariants) and never described the
  list route's filters, so it carries nothing to update either way. **Operator
  action needed:** `test/docs-consistency.test.ts` only checks the four narrow
  mechanical properties named in its own header (ADR citations, no
  still-open-decision claims, KNOWLEDGE_BASE frontmatter echo, and cited-path
  existence) — it does NOT check `docs/` against `documentation/` for the
  `q`-parameter fact this session added to `docs/context/architecture.md` and
  `docs/domain/areas/tasks.md`. Confirmed the suite still passes (`npx vitest
  run test/docs-consistency.test.ts`, 65/65 green) after this session's edits.
  If any `documentation/` file is meant to carry the same `q`-parameter fact
  (the PRD's own phase table assigns exactly this update to phase 2, alongside
  the roadmap and UI docs, which this run correctly left alone per scope), that
  edit belongs to a human or to phase 2's own docs-sync, not to this phase-1
  run.
- `src/shared/api.ts`, `src/worker/routes/tasks.ts`, `src/shared/task-filter.ts`,
  `test/*.ts` — the actual source/test changes; covered by the doc edits above,
  no direct doc write required (these are outside the Docs Updater's write
  scope in any case).

---
*Generated: 2026-09-15*
*Approved: 2026-09-15*
*Status: APPROVED*
