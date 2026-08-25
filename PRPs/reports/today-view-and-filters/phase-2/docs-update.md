# Docs Update — today-view-and-filters (phase 2)

**PR:** N/A — implement-time docs sync, no PR exists yet (`diff_source: patch`)
**Patch read:** `PRPs/reports/today-view-and-filters/phase-2/attempts/1/diff.implementer.patch`
**Synced at:** 2026-08-23
**Source PRD:** PRPs/prds/today-view-and-filters.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** The phase-2 diff adds two new pieces to the PWA client's shape
that the file's repository-layout table already enumerates member-by-member:
a new pure module `src/shared/task-groups.ts` (`groupTasks(tasks, today)`,
new file in the diff) and a new screen component
`src/app/components/TaskGroup.tsx` (new file in the diff, imported and used
five times by `TodayScreen.tsx` per the diff's hunk on that file). Both rows
already name every sibling module/component individually (`format.ts`,
`connectivity.ts`, `toast.ts`, `task-sheet.ts` for `src/shared/`;
`TodayScreen`, `TodayHeader`, `TaskRow`, `InlineTitle`, `CaptureDeck`,
`EmptyState`, `TaskSheet`, `TokenGate` for `components/`), so leaving the two
new ones out would make the table quietly incomplete. Two narrow `Edit`s
applied, each traceable to the diff hunks that add
`src/shared/task-groups.ts` and `src/app/components/TaskGroup.tsx`:

1. The `src/shared/` row: inserted `task-groups.ts` into the module list,
   describing it as the single-pass, never-sorting stable partition into the
   five buckets (overdue/today/upcoming/undated/closed), consistent with the
   module's own header comment in the diff ("PARTITIONS... It never sorts").
2. The `src/app/` row's `components/` entry: inserted `TaskGroup` into the
   component list, describing it as the one collapsible group section reused
   five times, consistent with the component's own header comment in the diff
   ("generalized from the shipped *Concluídas* markup... reused four times
   for the groups plus a fifth time for *Concluídas*").

No other line in either row was touched; both edits are pure insertions into
an existing enumerated list, byte-identical elsewhere.

## Candidate Decisions (for operator review)

The following decision was observed, explicitly and concretely, in the
source PRD's own "Decisions Log" table, but was **NOT** written into
`docs/decisions.md` this run:

- **Where grouping happens: in the client, as a pure stable partition over
  the API-ordered array, never a sort.** The PRD's Decisions Log records
  this with its rejected alternatives (grouping on the API via a `group`
  field or a grouped payload; grouping inline in the component) and its
  rationale (the frozen Task read contract forbids re-deriving order in a
  client; a partition does not re-order; it keeps a presentation concern out
  of a contract eleven later units inherit). The fact itself is already
  captured in `docs/api-reference.md` (the unit-3 "Not built yet" row: "
  Grouping is NOT an API concern — the today/overdue/upcoming/undated groups
  are a client-side stable partition...") per this project's own prior sync,
  so the knowledge base is not silent on it.
  **Why it wasn't promoted to `docs/decisions.md` here:** every one of that
  file's 11 existing entries cites an explicit `documentation/60-decisions/
  ADR-NNNN-*.md` as its `Source`, and its own header states "Nothing here is
  inferred — every entry has an explicit, owner-validated source." No ADR
  exists for this choice (the phase-2 diff adds no file under
  `documentation/60-decisions/`), only a PRD Decisions Log row. Writing an
  entry without an ADR source would depart from the file's established
  convention on my own inference, which the PRESERVE-ENTIRELY rule asks me
  not to do. The operator should decide whether this architectural
  client/API boundary is significant enough to warrant its own ADR (and
  therefore a `decisions.md` entry sourced from it), or whether the PRD +
  `docs/api-reference.md` record is sufficient as is.

## Deferred Questions

None. `non_interactive: true` was honored throughout — no operator question
was asked — but no genuine either/or ambiguity (a change codable into
`decisions.md` in two or more materially different ways, per the
Interactivity Clause's test) arose during this sync. The one open item
above is a scope/convention question about *whether* to record a decision
at all, not a choice between materially different decisions, so it is
filed under Candidate Decisions rather than here.

## Files Scanned — No Edit Required

- `docs/decisions.md` — read in full (PRESERVE-ENTIRELY, 11 ADR-sourced
  entries, at least one substantive entry present). The one decision the
  diff/PRD states explicitly is recorded under Candidate Decisions above
  instead of written in — see the rationale there.
- `docs/anti-patterns.md` — read in full. The PRD's own "Applicable
  anti-patterns" section (hand-duplicated entity types, weakening tests,
  Portuguese-in-artifacts carve-out, version ranges, glossary synonym
  drift) lists only patterns already on record with no new pattern or new
  exception introduced by this diff; `TaskDto` is reused, not duplicated,
  and the pt-BR group-header strings fall inside the existing ADR-0009
  carve-out already documented here.
- `docs/KNOWLEDGE_BASE.md` — read in full. This phase adds no new file
  under `docs/`, so no index entry is missing; the existing
  `docs/context/architecture.md` entry ("stack..., thin-client pattern,
  planned layout, data safeguards") stays accurate as a one-line summary
  after the additive edits above.
- `CLAUDE.md` — read in full. No essential command, key pattern, or
  context-reading pointer changed. The intro's "Unit 3
  `today-view-and-filters` is `next`" framing is now slightly ahead of
  reality (phase 1 is complete and phase 2 is landing), but that sentence
  reads at full-unit granularity and, by this project's own precedent (the
  same paragraph was last rewritten when the UI/UX plan fully closed, not
  per-activity), is left for the operator to refresh when the whole unit
  — all three phases — completes, not mid-unit. Not edited this run.
- `docs/domain/areas/tasks.md` — read in full. Already carries the
  phase-1 filter/priority-NULL sentence (per the calling agent's
  instructions, not re-touched here). Grouping is a client-side
  presentation partition, not a new business rule, so phase 2 adds nothing
  further to this file's business-rules list.
- `docs/domain/glossary.md` — read in full. The five group names
  (*Atrasadas · Hoje · Próximas · Sem data · Concluídas*) are UI-surface
  buckets over the existing `status`/date fields, not a new domain entity
  or a synonym for Task/Event/Reminder/Life Area — no glossary row applies.
- `docs/domain/flows.md` — read in full. Flow 2 ("Organizing the day")
  already reads, at its non-technical level, "sees today's picture: tasks
  due or scheduled for today" — accurate before and after this diff; adding
  the five literal group names would push implementation detail into a
  file whose own header scopes it to non-technical descriptions.
- `docs/context/testing.md` — read in full. This diff is the
  implementer-only patch (`diff.implementer.patch`); it carries no test
  file changes (the AC-7 test for `groupTasks` was authored by the
  test-writer step ahead of it, per this PRD's `tdd: true` routing) and
  introduces no new suite, tier, or command. Unaffected.
- `docs/context/ui-guidelines.md` — read in full. A generic pointer to
  `documentation/40-engineering/ui-ux-guidelines.md`; nothing about this
  diff's specific grouping markup changes the pointer or its checklist.
- `docs/context/conventions.md` — read in full. No new naming, casing, or
  dependency convention introduced.
- `docs/context/constraints.md` — read in full. Unaffected.
- `docs/context/methodology.md` — read in full, including frontmatter
  (`tdd: true`, `docs_sync: true`, `figma_track: false`,
  `visual_first_approval: auto`). `figma_track: false` gates Step 3.5 of
  this agent's contract off entirely for this run. Otherwise unaffected by
  this diff.
- `docs/architecture.md` (developer view) — read in full. Its generic
  "Where to add things" table already routes "A screen or component" to
  `src/app/` and "Domain logic... " to `src/shared/` as pure functions with
  unit tests — both new files fit those existing rows without needing a
  new one.
- `docs/api-reference.md` — read in full to confirm the calling agent's
  note. Already corrected (per the calling agent): the unit-3 "Not built
  yet" row and the Task read contract's "Filter vocabulary" paragraph
  already record that grouping is a client-side concern. Not re-touched.
- `documentation/10-product/visual-identity.md` — read in full to confirm
  the calling agent's note. The diff's own hunk on this file (Task 2) adds
  the four group-header names to the approved microcopy table and a
  History row, ahead of the code that uses them. `documentation/` is this
  project's authoritative source and is never a docs-updater write target
  regardless (Hard Constraint 4 / this project's own CLAUDE.md: "docs/ ...
  is derived from documentation/"). Not touched by this agent.

---
*Generated: 2026-08-23*
*Approved: 2026-08-23*
*Status: APPROVED*
