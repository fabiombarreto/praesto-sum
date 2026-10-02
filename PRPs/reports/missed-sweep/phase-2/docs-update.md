# Docs Update — missed-sweep

**PR:** n/a (pre-PR docs-sync, /relay-implement Phase A.3.5, unit 10 phase 2)
**Merged at:** 2026-10-01 (not merged; worktree)
**Source PRD:** C:/repos/assistente-pessoal/PRPs/prds/missed-sweep.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

## Files Edited

### `docs/context/architecture.md` (worktree `.worktrees/missed-sweep`)

**Change type:** additive (one sentence replaced; it had become false)
**Rationale:** The diff makes `runScheduledJob` call `sweepMissedOccurrences` before the Reminder sweep, so "the `scheduled()` handler still runs no `missed` sweep" was actively false. Replaced with a factual statement of what phase 2 built (sweep in `src/worker/cron.ts`, one `db.batch` per series via `writeMissedSweepPlan`, shared builders in `src/worker/successor.ts`) and a pointer that the rest is phase 3. Not a decision; no ADR touched.

---

## Candidate Decisions (for operator review)

- Clock split: the injected `now` drives only the missed sweep; the Reminder sweep keeps its own wall-clock read, and a sweep failure is rethrown after Reminders go out so `runCronHeartbeat` records it. May already be covered by PRD decisions (D-B..D-F); not written to `docs/decisions.md`.
- Successor-building helpers moved out of `routes/tasks.ts` into `src/worker/successor.ts` (`buildRecurrenceRule`, `buildSuccessorStatements` with `armReminders`, `buildMissedOccurrenceStatement`, `isUniqueConflict`) as a convention for cron and routes to share statement builders.

## Deferred Questions

- Should `docs/domain/areas/tasks.md` and `documentation/` (roadmap, architecture, FR-009/FR-011 status, maintenance-map docs) be updated now rather than in phase 3? — suggested default: no; the PRD and plan assign the documentation pass to Phase 3, and no other statement is false.
- Should `docs/context/architecture.md` line 41 be mirrored in a `documentation/30-architecture` counterpart? — suggested default: no counterpart statement exists (grep found none); revisit in phase 3.

## Files Scanned — No Edit Required

- `CLAUDE.md` — unit 10 described as `in-progress`, no phase planned yet; stale in detail ("no phase planned yet") but status line is a Phase 3 / unit-closure update, not made false in a way that misleads about behavior. Deferred to Phase 3.
- `docs/domain/areas/tasks.md` — no statement contradicted; `routes/tasks.ts` reference is about list filters, unchanged. Missed-state rules deferred to Phase 3.
- `documentation/50-planning/roadmap.md`, `documentation/20-requirements/functional-requirements.md`, `docs/api-reference.md` — unit 10 status and FR traceability remain accurate; update at Phase 3.
- `docs/decisions.md`, `docs/anti-patterns.md`, ADRs — untouched (PRESERVE; ADRs append-only).

---
*Generated: 2026-10-01*
*Approved: 2026-10-02*
*Status: APPROVED*
