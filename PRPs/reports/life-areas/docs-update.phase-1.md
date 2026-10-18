# Docs Update — life-areas

**PR:** none (implement-time sync, Phase A.3.5 Step A; uncommitted worktree `.worktrees/life-areas`, branch `feature/life-areas`, phase 1 of 4, attempt 1)
**Merged at:** 2026-10-11 (not merged; pre-PR)
**Source PRD:** PRPs/prds/life-areas.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

Diff read: `PRPs/reports/life-areas/phase-1/attempts/1/diff.patch` (production + docs changes of the attempt against the post-test-suite tree snapshot). Phase 1 is the API only: `/api/life-areas` create/list/rename/delete, existence validation on Task and series writes, `lifeAreaId` editable on `PATCH /api/tasks/:id`, the `lifeAreaId=<id>|none` list filter. No UI, no migration, no schema change, no export-code change. Every statement below describes API behaviour only; no sentence written describes a screen that does not exist yet.

All edits were applied in the worktree's `docs/` tree and `CLAUDE.md`. Nothing under `documentation/`, `.claude/` or `PRPs/prds/` was written.

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive (two spots; one stale clause removed from an existing sentence)
**Rationale:** (1) The `src/shared/` row of the repository-layout table enumerates the shared modules; the diff adds `src/shared/life-areas.ts` (`LIFE_AREA_NAME_MAX`, `LIFE_AREA_LIMIT`, `validateLifeAreaName`, `lifeAreaNameKey`, `compareLifeAreaNames`), so an entry in the same style was appended. (2) The "Current implementation state" paragraph said "Not built yet: export (FR-042), Life Area endpoints." The diff makes the second half false (`routes/life-areas.ts` mounted at `/api/life-areas` behind the `requireToken` gate), so "Life Area endpoints" was removed from that sentence and a phase-1 summary inserted before it: the pure module, the four routes (delete unassigns in the same `db.batch`), the shared `checkLifeAreaId` existence check, `lifeAreaId` as an editable `PATCH /api/tasks/:id` key, the `lifeAreaId=<id>|none` filter, no migration / schema / export-code change, and an explicit statement that no Áreas screen, Task-sheet control or filter-sheet group exists yet (phases 2-4). The "export (FR-042)" half of that sentence was deliberately left byte-for-byte as it was (see Deferred Question 3).

### `docs/domain/areas/tasks.md`

**Change type:** additive (one narrow in-place amendment, one bullet replaced)
**Rationale:** (1) The FR-002 bullet listed what `PATCH /api/tasks/:id` covers as "title, description, the two dates and priority"; the diff adds `lifeAreaId` to `EDITABLE_TASK_FIELDS`, so a clause pointing at the Life Area bullet was inserted. (2) The bullet "A Task may belong to a Life Area (FR-008, unscheduled)." was false on both counts (FR-008 is scheduled in unit 13, per the 2026-08-12 correction already in `docs/decisions.md`, and the API now exists). It was replaced by the rules the diff makes concrete: at most one area (ADR-0015), `lifeAreaId` on create/edit with `null`/absent meaning no area, an unknown id is a 400 naming `lifeAreaId` and writes nothing, the `lifeAreaId=<id>|none` filter (ANDed, unknown id = empty list, empty value = 400), editing an occurrence's area detaches it and leaves the series' area untouched while `PATCH /api/series/:id` updates the template and the open non-detached occurrence and leaves `done`/`missed` rows alone (ADR-0006), and deleting an area never deletes a Task. Marked API-only.

### `docs/domain/areas/life-areas.md`

**Change type:** additive (new section appended after "Resolved 2026-08-03"; no existing line touched)
**Rationale:** The file held only the 2026-08-03 growth rules and no record of what a Life Area is once it exists as data. New section "Delivered — unit 13 `life-areas`, phase 1: the API (2026-10-11, ADR-0015)" restates, from the diff and the already-recorded ADR-0015, the API-level domain rules: an area is a name (trimmed, 1-40, unique ignoring case and diacritics with the bytewise index as backstop, at most 12, pt-BR alphabetical, `description` never written by the API, no migration); rename keeps the id; one area per Task and per series (template carries it, occurrences and spawned successors copy it, closed rows keep theirs); delete unassigns in the same batch and loses nothing; the area-less grouping is `noArea.openTaskCount` and `lifeAreaId=none`, never a stored area. Points readers to `docs/api-reference.md` and `src/shared/life-areas.ts`. The existing "implicit Unsorted grouping" line was left alone (phase 4 reconciles it with *Sem área*, PRD AC-25).

### `CLAUDE.md`

**Change type:** additive (one clause of the status paragraph replaced)
**Rationale:** The paragraph ended the unit-12 sentence with "unit 13 `life-areas` is the other candidate." That became false when the unit opened and phase 1 was delivered in code. Replaced by a unit-13 clause in the same bold style as the neighbouring units: `in-progress`, PRD APPROVED 2026-10-11, four phases, no migration, ADR-0015; phase 1 of 4 (the API) delivered in code, not yet merged or deployed, no UI yet (phases 2-4). Nothing else in the file was touched; the unit-12 clause is intentionally unchanged (see Deferred Question 2).

## Candidate Decisions (for operator review)

The following were observed in the diff but are inferred or are implementation latitude the PRD left to the plan, so they were NOT written to `docs/decisions.md` or `docs/anti-patterns.md` per the PRESERVE-ENTIRELY rule:

- **Delete nulls explicitly in the same `db.batch`, with `ON DELETE SET NULL` only as a backstop.** The route code comment gives the reason: "so the outcome does not depend on foreign-key enforcement where the suite runs". The PRD (Technical Approach, "Delete") left this to the plan; ADR-0015 decision 3 and the `docs/decisions.md` entry both name the existing foreign key as the mechanism. The observable outcome is identical, so no contradiction, but the relay-facing decision text and the shipped mechanism now differ in wording. If the owner wants it durable, a dated note on the `docs/decisions.md` entry (the ADR itself is append-only) is the place.
- **Possible anti-pattern: "a write path that accepts a foreign-key id without an existence check".** `src/worker/life-area-check.ts` exists specifically so an unknown `lifeAreaId` is a 400 naming the field instead of reaching the foreign key and answering 500; the PRD's risk table lists the same failure. It is stated as a risk and a helper, not as a project-wide prohibition, so it is a candidate only. The same file's pt-BR copy for the two refusals is not a decision.
- **Validation order on `PATCH /api/life-areas/:id`:** body shape, then non-editable key, then empty body, then `name` validity, and only then the 404 for an unknown id and the 409 for a duplicate. A malformed body to an unknown id therefore answers 400, not 404. The route's own comment says it mirrors the hand-rolled shape of `src/worker/routes/reminders.ts`; it is recorded for awareness, not as a decision to promote (whether a test pins this order was not checked).

## Deferred Questions

- **Q1 — `docs/api-reference.md` wording for `description`.** The `GET /api/life-areas` row says `description` is "always `null` from the API". `toLifeAreaDto` maps `row.description` straight through, so an area restored from a snapshot that carried a description (the AC-18 drill rebuilds `life_areas` field for field) would surface it; "always" holds only for areas the API itself created. This file is outside this agent's Explicit Write Scope (the Implementer already amended it; every other claim in its new rows was verified against the diff), so it was not edited. — suggested default: reword to "never written by the API, so `null` for every area it creates".
- **Q2 — CLAUDE.md unit-12 clause is stale against the authoritative roadmap.** CLAUDE.md still reads "(PR #11, not yet merged or deployed)" for unit 12, while `documentation/50-planning/roadmap.md:105` says "merged (PR #11) and deployed as `v0.12.0`" and `git log` shows `5e7321b` (merge), `21b5d73` (0.12.0) and `3720da3`. This phase does not change unit 12's truth, so per the instruction it was left. — suggested default: fix it as a separate one-clause docs change outside this phase ("merged (PR #11) and deployed as `v0.12.0`; AC-17 owed"), by whoever owns the unit-12 close-out.
- **Q3 — pre-existing drift left in place, not caused by this phase.** (a) `docs/context/architecture.md` still says "Not built yet: export (FR-042)" although `/api/export` and `/api/export.ics` are mounted in `src/worker/index.ts` and CLAUDE.md records unit 5 `data-export` as shipped. (b) The "Implemented" table of `docs/api-reference.md` has no rows for `/api/export`, `/api/export.ics`, `/api/reminders` or the `/api/series` CRUD (only the adherence read and, now, the life-area write rows). (c) CLAUDE.md's "Suite is 1174 tests / 72 files" predates several units and this phase's five new suites; the new count cannot be derived from the diff. — suggested default: one dedicated docs-catch-up pass over these three, not mixed into a feature phase.
- **Q4 — `documentation/` rows now false after phase 1.** `documentation/50-planning/roadmap.md:66` ("Nothing is built yet.") and `:105` ("nothing built yet") for unit 13 no longer hold. `documentation/` is outside this agent's scope and the PRD assigns the close-out amendments (glossary, domain-model, FR-008, layout standard, roadmap row) to phase 4 (AC-25). — suggested default: let the phase-completion step or phase 4's docs sync update the roadmap row to "phase 1 of 4 delivered in code (API only)"; no other action.

## Files Scanned — No Edit Required

- `docs/api-reference.md` — verified row by row against the diff and the source: `GET /api/tasks` filter (`lifeAreaId=<id>|none`, 400 on empty, AND semantics), `POST`/`PATCH /api/tasks` (`lifeAreaId` validated; `PATCH` area edit detaches an occurrence and leaves the series untouched), the four `/api/life-areas` rows (shapes, 400/409/404, same-batch unassign), the `POST, PATCH /api/series` row (open non-detached occurrence only, closed rows keep theirs), the frozen read-contract "Filter vocabulary" paragraph and the "Not built yet" unit-13 row are all accurate. Not edited: outside the Explicit Write Scope; one wording nit in Q1.
- `docs/decisions.md` — ADR-0015 entry already present (2026-10-11) and cites `ADR-0015-life-areas-owner-named-single-membership.md`, so the docs-consistency index check holds; not touched per instruction. The diff states no new owner-level decision beyond ADR-0015 and PRD D-E, D-F, D-J, D-K; candidates above.
- `docs/anti-patterns.md` — no explicit new forbidden pattern in the diff or the PRD; one candidate above.
- `docs/KNOWLEDGE_BASE.md` — no new `docs/` file was added, which is the only trigger for an index edit; the "Life Areas rules" line remains accurate.
- `docs/context/testing.md` — its "Detected test suites" table is per tier and project (the worker project globs `test/*.test.ts`), with no per-suite mapping to extend. The five new suites (`test/life-areas.test.ts`, `test/life-areas-routes.test.ts`, `test/life-areas-task-routes.test.ts`, `test/life-areas-series.test.ts`, `test/life-areas-export.test.ts`) and the amended `test/task-update.test.ts` fall inside that glob; the `docs` project (`npx vitest run --project docs`) was run after the edits and passes (3 files, 80 tests).
- `docs/context/conventions.md`, `docs/context/constraints.md`, `docs/context/integrations.md`, `docs/context/methodology.md`, `docs/context/ui-guidelines.md` — no convention, constraint, integration or methodology change; no UI changed.
- `docs/domain/glossary.md` — left on purpose: the glossary's reading of Life Area is the PRD's first Open Question and is amended, with the owner deciding, in phase 4 together with `documentation/10-product/glossary.md` (AC-25).
- `docs/domain/flows.md` — no owner-facing flow exists until the screens land (phases 2-4).
- `docs/domain/areas/events.md`, `docs/domain/areas/reminders.md` — unaffected (areas on Events arrive with unit 14; a Reminder belongs to its Task).
- `docs/architecture.md`, `docs/development.md`, `docs/troubleshooting.md`, `docs/decision-gate.md` — no workflow, setup or gate change; also outside the Explicit Write Scope.
- `documentation/`, `.claude/`, `PRPs/prds/life-areas.prd.md` — not touched by this agent.

---
*Generated: 2026-10-11*
*Approved: 2026-10-12*
*Status: APPROVED*
