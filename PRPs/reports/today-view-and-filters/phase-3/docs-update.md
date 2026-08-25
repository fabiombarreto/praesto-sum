# Docs Update — today-view-and-filters (phase 3)

**PR:** N/A — implement-time docs sync, no PR exists yet (`diff_source: patch`)
**Patch read:** `PRPs/reports/today-view-and-filters/phase-3/attempts/3/diff.implementer.patch`. Note on structure: this patch file recursively embeds attempts 1 and 2's own `diff.implementer.patch` files as bookkeeping artifacts (each attempt re-diffs from the same original pre-state commit `294a79c`, so earlier attempts' committed patch files show up as "new files" inside later ones). The single authoritative, non-nested diff — attempt 3's real changes against the true pre-implementation baseline — is the file's final top-level section (after the last `attempts/3/pre-state.txt` hunk); that is the section read and summarized below.
**Synced at:** 2026-08-24
**Source PRD:** PRPs/prds/today-view-and-filters.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

## What shipped in this phase

A new pure module `src/shared/task-filter.ts` (`TaskFilter`, `EMPTY_FILTER`,
`toQuery`, `activeCount`, `isChipActive`, `toggleChip`) — DOM-free and
clock-free like its `today-view-and-filters` phase-2 sibling
`task-groups.ts` — is the single source of truth for the filter state; two
new components, `FilterChips` (the quick-filter row) and `FilterSheet`
(Status/Prioridade/Período over `Sheet`), are two VIEWS of that one state,
never two states kept in sync; `Sheet` gained an opt-in `lightDismiss` prop
used only by `FilterSheet`; `TodayHeader` gained the filter icon button with
a numeric badge; `EmptyState` gained a filtered branch; `listTasks` now takes
the filter object; and `TodayScreen` owns the one filter state, seeded from
`EMPTY_FILTER` and persisted nowhere (asymmetric with the persisted group
collapse state — layout standard §2.3 expressed as code).
`documentation/10-product/visual-identity.md` (microcopy rows) and
`documentation/40-engineering/ui-layout-standard.md` (§2.3 amended, History
row) were already updated inside the diff by the plan's own Task 2 — not
touched by this run; `documentation/` is this project's authoritative source
and is never a docs-updater write target. No route or API-surface file is in
this diff — phase 3 is client-only; `docs/api-reference.md` (a route-level
contract file maintained by the implementer directly, per this project's
established convention — see phase 1's manifest) needed no change from this
phase specifically.

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** The repository-layout table's `src/shared/` and `src/app/`
rows already enumerate every sibling module/component member-by-member
(mirroring exactly how phase 2 added `task-groups.ts` and `TaskGroup` to
these same two rows), and this phase's diff adds one new pure module and two
new components that the enumeration would otherwise silently omit. Three
narrow `Edit`s applied, each traceable to a specific diff hunk:

1. `src/shared/` row: inserted `task-filter.ts`, right after the existing
   `task-groups.ts` entry, describing its six exports and that it is the
   single source of truth the chip row and the sheet are two VIEWS of —
   consistent with the new file's own header comment in the diff ("The
   single source of truth for what a Task filter IS... The quick-filter
   chip row and the filter sheet are two VIEWS of one `TaskFilter` — never
   two states that must be kept in sync"). Also changed the "and" joining
   `task-sheet.ts`/`task-groups.ts` to a comma, since a third pure module
   now follows.
2. `src/app/` row's `components/` list: inserted `FilterChips` and
   `FilterSheet` between the existing `EmptyState` and `TaskSheet` entries,
   describing each consistent with its own new-file header comment in the
   diff (`FilterChips`: "this row is a VIEW of the one `TaskFilter`
   `TodayScreen` owns, not a second copy of it"; `FilterSheet`: "there is no
   *Aplicar* button and no draft to lose").

No other line in either row was touched; both edits are pure insertions into
an existing enumerated list, byte-identical elsewhere. `EmptyState`'s new
filtered branch, `TodayHeader`'s new filter-button prop, and `Sheet`'s new
`lightDismiss` prop were deliberately NOT separately annotated on those
already-listed entries — consistent with phase 2's precedent, which only
annotated genuinely NEW list entries and left modifications to
already-listed components (e.g. `TodayScreen` gaining group rendering)
unannotated.

---

## Candidate Decisions (for operator review)

The following decisions are stated explicitly and concretely in the source
PRD's own "Decisions Log" table, with named alternatives and rationale, but
were **NOT** written into `docs/decisions.md` this run:

- **Quick-filter chips in the MVP: *Abertas · Para hoje · Alta prioridade* +
  *Filtros…*, replacing the layout standard's literal *Abertas · Alta
  prioridade · Com hora*.** Rationale recorded in the PRD: *Com hora* is not
  expressible for a Task (calendar days only, no time of day — enforced by
  `tasks_single_date_chk`); *Para hoje* replaces it and answers the unit's
  own question; the standard is amended in place, dated (already done inside
  this diff, outside this run's scope).
- **Filter persistence is session-only — every dimension resets on a cold
  start, unlike group collapse state, which persists.** Rationale recorded
  in the PRD: layout standard §2.3 requires a narrowing filter to never
  survive a cold start silently; the header badge is a disclosure, not a
  licence to persist quietly. This is exactly what `TodayScreen.tsx`'s diff
  implements (`useState<TaskFilter>(EMPTY_FILTER)`, never read from or
  written to storage).

**Why neither was promoted to `docs/decisions.md` here:** every one of that
file's existing entries cites an explicit `documentation/60-decisions/
ADR-NNNN-*.md` as its `Source`, and the file's own header states "Nothing
here is inferred — every entry has an explicit, owner-validated source." No
ADR file appears anywhere in this diff. Writing either entry in without one
would depart from the file's established convention on my own inference,
which the PRESERVE-ENTIRELY rule asks me not to do — this is the identical
disposition phase 2's docs-update.md reached for the analogous "where
grouping happens" PRD decision. The operator should decide whether either
architectural choice above is significant enough to warrant its own ADR (and
therefore a `decisions.md` entry sourced from it), or whether the PRD's own
`*Status: APPROVED*` Decisions Log is sufficient as the durable record.

## Deferred Questions

None. `non_interactive: true` was honored throughout — no operator question
was asked. No genuine either/or ambiguity (a change codable into
`docs/decisions.md` in two or more materially different ways, per the
Interactivity Clause's own test) arose during this sync: both candidates
above have exactly one shape each in the PRD, with no unresolved
alternative. The one scope judgment made directly — leaving `CLAUDE.md`
untouched despite this being the unit's final phase (see the flagged note
under Files Scanned below) — is a write-scope/timing call bounded by this
agent's own Step-3 CLAUDE.md trigger (essential commands or key patterns
only), not a `decisions.md`-codifiable ambiguity, so it does not qualify for
this section either; it is recorded as a plain observation instead.

## Files Scanned — No Edit Required

- `docs/api-reference.md` — no API-surface file is in this diff (phase 3 is
  client-only: no route, no query parameter changed). Separately, and
  regardless of this phase's content: this file is maintained by the
  implementer directly as part of a route-touching plan task (confirmed by
  phase 1's manifest and by this project's own convention), and it is not
  listed in this agent's Explicit Write Scope table, so it is out of bounds
  for edits by this agent either way. **One pre-existing staleness noted for
  operator awareness, not caused by this diff:** the "Not built yet" table's
  unit-3 row ("`from`, `to` and `priority` filters on the list query...")
  appears to predate phase 1's own sync — the "Implemented" table above it
  and the "Task read contract" section already both describe those same
  filters as shipped (dated 2026-08-23, phase 1's own session). That row
  looks like unfinished cleanup left over from phase 1, outside phase 3's
  diff and outside this agent's write scope; flagged here so the operator
  can remove or correct it by hand if wanted.
- `CLAUDE.md` — read in full; on-disk content confirmed unchanged from the
  copy already in context. No new essential command or key pattern. **Flag
  for the operator:** phase 2's own docs-update.md explicitly deferred
  refreshing the intro's "Unit 3 `today-view-and-filters` is `next`" framing
  until "the whole unit — all three phases — completes, not mid-unit."
  Phase 3 is that unit's final phase, so the condition phase 2 named has now
  been reached. This agent still did not make that edit: this agent's own
  Step-3 trigger for `CLAUDE.md` is scoped narrowly to "essential commands
  or key patterns," which a roadmap-status narrative paragraph is neither,
  and this project's own precedent for this exact paragraph (the "hold is
  lifted" rewrite) was a dedicated, standalone close-out commit
  (`d8e9a36 docs(ui-ux): close out the UI/UX plan (A6)...`) rather than a
  side effect of a phase-level docs sync. Recorded here, not edited, for the
  operator to action in its own deliberate pass once phase 3 is fully
  settled (tested/reviewed).
- `docs/decisions.md` — read in full (PRESERVE-ENTIRELY; at least one
  substantive, ADR-sourced entry present). The two decisions the PRD states
  explicitly are recorded under Candidate Decisions above instead of written
  in directly — see the rationale there.
- `docs/anti-patterns.md` — read in full (PRESERVE-ENTIRELY). No new
  forbidden pattern and no exception to an existing one is introduced by
  this diff; `TaskDto` and the existing validators (`isTaskStatus`,
  `isTaskPriority`, `isCalendarDate`) are reused, never hand-duplicated, and
  the new pt-BR chip/sheet strings fall inside the existing ADR-0009
  carve-out already documented here.
- `docs/KNOWLEDGE_BASE.md` — read in full. This phase adds no new file under
  `docs/` (only existing files were edited), so no new index entry is
  needed; the "Architecture (rules)" one-line summary stays accurate at its
  Tier-2 abstraction level after the additive edits above.
- `docs/domain/areas/tasks.md` — read in full. Already carries the phase-1
  filter/`priority=normal`-matches-`NULL` sentence (per the calling agent's
  instructions, not re-touched here). Phase 3 adds no new *business* rule —
  the chip vocabulary, the sheet, the badge and the cold-start reset are UI
  presentation over the existing FR-007 filter rule, already recorded, not
  a new domain fact.
- `docs/domain/glossary.md` — read in full. No new domain entity or synonym;
  "quick-filter chip" and "filter sheet" are UI-surface terms over the
  existing Task attributes (`status`, `priority`, dates), not glossary
  concepts.
- `docs/domain/flows.md` — read in full. Flow 2 ("Organizing the day")
  already reads, at its non-technical level, "sees today's picture: tasks
  due or scheduled for today" — accurate before and after this diff; adding
  chip/sheet mechanics would push implementation detail into a file whose
  own header scopes it to non-technical descriptions.
- `docs/context/conventions.md` — read in full. No new naming, casing, or
  dependency convention introduced. Its `src/app/components/` list is
  explicitly illustrative (prefixed "e.g."), not the exhaustive enumeration
  `docs/context/architecture.md`'s repository-layout table is — confirmed
  non-exhaustive by precedent, since phase 2's own new `TaskGroup` component
  was never added here either.
- `docs/context/constraints.md` — read in full. CON-001..007/QA-001..004 are
  infrastructure- and process-level; a client-side filter UI touches none of
  them.
- `docs/context/methodology.md` — read in full, including frontmatter
  (`tdd: true`, `tdd_evidence: "user-declared"`, `docs_sync: true`,
  `figma_track: false`, `visual_first_approval: auto`). `figma_track: false`
  gates this agent's Step 3.5 (component-map `verified:auto` upgrade) off
  entirely for this run — per that step's own instruction, nothing further
  is recorded about it. The effective `docs_sync: true` in this manifest's
  header was read from here. Otherwise unaffected by this diff; phase 3
  sits inside the already-declared TDD scope (`task-filter.ts`'s AC-12 was
  authored test-first by the test pair ahead of the implementer, per the
  PRD's own TDD routing section).
- `docs/context/testing.md` — read in full. This diff is the
  implementer-only patch; it carries no test file changes and introduces no
  new suite, tier, or command.
- `docs/context/ui-guidelines.md` — read in full. A generic pointer to
  `documentation/40-engineering/ui-ux-guidelines.md`; nothing about this
  diff's specific chip/sheet markup changes the pointer or its checklist.
- `docs/architecture.md` (developer view) — read in full. Its generic
  "Where to add things" table already routes "A screen or component" to
  `src/app/` and "Domain logic" to `src/shared/` as pure functions with unit
  tests — both new files fit those existing rows without needing a new one.
- `documentation/10-product/visual-identity.md` — read to confirm the
  calling agent's note. The diff's own hunk (Task 2) adds the chip/icon/sheet
  microcopy rows to the approved table and a History row, ahead of the code
  that renders them. `documentation/` is this project's authoritative source
  and is never a docs-updater write target regardless (Hard Constraint 4;
  this project's own CLAUDE.md: "docs/ ... is derived from documentation/").
  Not touched by this agent.
- `documentation/40-engineering/ui-layout-standard.md` — read to confirm the
  calling agent's note. The diff's own hunk (Task 2) amends §2.3 in place
  (dated, with a History row naming the retired *Com hora* chip by name,
  deliberately, so it stays findable by search) and updates `last_updated`.
  Same authoritative-source/out-of-scope reasoning as above. Not touched by
  this agent.

---
*Generated: 2026-08-24*
*Approved: 2026-08-24*
*Status: APPROVED*
