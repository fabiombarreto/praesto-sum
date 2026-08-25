# Docs Update — today-view-and-filters (phase 1)

**PR:** none — implement-time run (`diff_source: patch`); no PR exists yet for this feature
**Merged at:** N/A (not merged); diff captured 2026-08-23 from `PRPs/reports/today-view-and-filters/phase-1/attempts/1/diff.implementer.patch`
**Source PRD:** PRPs/prds/today-view-and-filters.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

## What shipped in this phase

`GET /api/tasks` gained `from`, `to` and `priority` query parameters, validated
at the boundary (`isCalendarDate`, `isTaskPriority`) and applied in the `WHERE`
clause beside the existing urgency ordering, so ordering-then-`limit` still
operates over the filtered set. Two semantics are load-bearing: a date range
compares against `coalesce(deadline, scheduledDate)` so undated Tasks fall
outside every range, and `priority=normal` matches rows whose priority is
`normal` OR `NULL`. `docs/api-reference.md` and
`documentation/30-architecture/architecture-overview.md` were already updated
inside the diff by the plan's own Tasks 2 and 3 — not touched by this run.

## Files Edited

### `docs/domain/areas/tasks.md`

**Change type:** additive
**Rationale:** This file already declared the FR-007 filter rule and the
"`NULL` sorts as `normal`" domain rule (line 15), but as statements of intent,
not of where they're enforced. The diff's route JSDoc
(`src/worker/routes/tasks.ts`: "Filters live in SQL, next to the ordering" /
"`priority=normal` must also match `NULL`") and the source PRD's Architecture
Notes make the enforcement location and the extended filter semantic concrete
and verifiable for the first time — this file's own established style already
does this for the priority enum ("enforced by a TypeScript union AND the
`tasks_priority_chk` CHECK"), so the same pattern was extended: one trailing
sentence appended to the existing bullet, noting (a) the filters are now
enforced in SQL by the list route's `WHERE` clause beside the frozen urgency
ordering, (b) the `coalesce(deadline, scheduledDate)` range comparison, and
(c) that `priority=normal` now also matches `NULL` in the *filter*, not only
in the pre-existing sort-as-normal reading. No existing sentence was altered
or removed. Verified after the edit against this project's own
`test/docs-consistency.test.ts` (`docs` Vitest project via
`npx vitest run --project docs`) — 62/62 passing, confirming no broken
`docs/`/`documentation/` path citation and no ADR/frontmatter-index mismatch
was introduced.

---

## Candidate Decisions (for operator review)

None. The two facts this phase makes concrete — SQL-enforced date-range
filtering against `coalesce(deadline, scheduledDate)`, and `priority=normal`
also matching `NULL` in a filter — are not new project-level decisions. They
implement the `from`/`to`/`priority` vocabulary the frozen unit-2 read
contract had already reserved by name in `docs/api-reference.md`, and they
enforce a domain rule already recorded in `docs/domain/areas/tasks.md` before
this phase existed. The source PRD's own Decisions Log
(`PRPs/prds/today-view-and-filters.prd.md`, e.g. "Where filtering happens" /
"Where grouping happens") is the correct, already owner-approved home for this
phase's rationale (`*Status: APPROVED*`). Nothing found here rises to the
"stable project decision that should not be re-evaluated"
bar `docs/decisions.md` sets for itself, so nothing was inferred into it —
consistent with the PRESERVE-ENTIRELY rule.

## Deferred Questions

None. `non_interactive: true` was set, so any judgment call in this run would
have gone through the "record and defer" fallback rather than a question — but
no genuine `decisions.md`-level ambiguity (a change codifiable in two or more
materially different *stable-decision* shapes, per the Interactivity Clause)
arose in this diff to defer in the first place. The one wording choice made
directly (the `docs/domain/areas/tasks.md` addition above) is low-stakes,
matches the file's own pre-existing style, and touches no `decisions.md`
content, so it did not qualify for deferral either.

## Files Scanned — No Edit Required

- `docs/api-reference.md` — already updated inside the merged diff by the
  plan's own Task 2/3 (Implemented table row + Filter vocabulary paragraph
  moved from "reserved" to "implemented"). Explicitly out of this run's job
  per the dispatch instructions; read only, to confirm it, not re-edited or
  duplicated.
- `documentation/30-architecture/architecture-overview.md` — already updated
  inside the diff by the plan's own Task 3 (frozen-contract paragraph no
  longer calls the vocabulary "reserved"). `documentation/` is this project's
  authoritative source, never a `docs/` derivation target, and is outside this
  agent's write scope regardless of content — read only.
- `docs/context/architecture.md` — stack/pattern/repo-layout document; it
  operates at a coarser grain than per-route query parameters, which is
  `docs/api-reference.md`'s job (already current). "Current implementation
  state" already lists Task "list" generically; adding three query parameters
  to an already-listed capability doesn't contradict or extend anything stated
  here.
- `docs/context/constraints.md` — CON-001..007 / QA-001..004 are
  infrastructure- and process-level; a backend filter addition on an existing
  route touches none of them.
- `docs/context/conventions.md` — no new casing, dependency, or git
  convention introduced; the new parameters reuse the existing
  `isTaskStatus`/`isTaskPriority`/`isCalendarDate` gates exactly as this
  file's "reject, don't clamp" pattern already documents for `limit`.
- `docs/context/methodology.md` — frontmatter (`tdd: true`,
  `tdd_evidence: "user-declared"`, `docs_sync: true`, `figma_track: false`,
  `visual_first_approval: auto`) unaffected; this phase sits squarely inside
  the already-declared TDD scope ("API routes and their validation"). The
  effective `docs_sync: true` recorded in this manifest's header was read from
  here.
- `docs/decisions.md` — PRESERVE-ENTIRELY; reviewed for a new ADR-worthy entry
  and found none (see Candidate Decisions above). Every accepted ADR this file
  must cite (ADR-0001..0011) is unaffected by this diff; confirmed by
  `test/docs-consistency.test.ts`'s "every accepted ADR reaches the derived
  decisions index" check passing.
- `docs/anti-patterns.md` — PRESERVE-ENTIRELY; no new forbidden pattern, and
  no exception to an existing one, is introduced by this diff.
- `docs/KNOWLEDGE_BASE.md` — no new `docs/` file was added by this diff to
  index (only the already-current `docs/api-reference.md` and
  `documentation/.../architecture-overview.md` were touched, and the latter
  isn't indexed here anyway). The "Tasks rules" and "API reference" one-line
  summaries remain accurate at their Tier-2 abstraction level; the
  "Methodology" line's quoted `` `tdd: true` `` / `` `docs_sync: true` `` /
  `` `figma_track: false` `` values still match `docs/context/methodology.md`'s
  frontmatter exactly, confirmed by `test/docs-consistency.test.ts`.
- `CLAUDE.md` — no new essential command or key pattern; the top status
  narrative ("Unit 3 `today-view-and-filters` is `next` ... Build on that
  foundation") remains accurate — this run completes only phase 1 of the
  unit's 3 phases, not the unit itself.
- `docs/domain/glossary.md` — no new domain concept, synonym, or relationship;
  `status`/`priority`/dates are already-glossary-consistent Task attributes.
- `docs/domain/flows.md` — the "Organizing the day" flow is a non-technical
  narrative, unaffected by how the API implements filtering underneath it.
- `docs/architecture.md` (developer view) — read for awareness only; not in
  this agent's Explicit Write Scope regardless of findings. "Where to add
  things" → "An API route" stays accurate; no new request path or top-level
  behavior was added, only new query parameters on an existing route.
- `docs/context/testing.md` — read for awareness of this project's own `docs`
  Vitest project (`test/docs-consistency.test.ts`), which partially guards
  exactly this class of drift; run after the edit above (62/62 passing) as a
  sanity check. No change needed to this file itself.
- `docs/context/ui-guidelines.md` — not applicable. The diff touches zero
  files under `src/app/`, `index.html`, the manifest, or `src/sw.ts` — only
  `src/worker/routes/tasks.ts` — so the mandatory UI review checklist does not
  apply to this phase.

---
*Generated: 2026-08-23*
*Approved: 2026-08-23*
*Status: APPROVED*
