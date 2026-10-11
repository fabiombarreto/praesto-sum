# Docs Update — adherence-mirror

**PR:** none (implement-time sync, Phase A.3.5, phase 1 of 3)
**Merged at:** 2026-10-04 (not yet merged; worktree diff)
**Source PRD:** PRPs/prds/adherence-mirror.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

## Files Edited

### `docs/context/architecture.md` (in worktree `.worktrees/adherence-mirror`)

**Change type:** additive
**Rationale:** The diff adds `src/shared/adherence.ts` (pure `computeSeriesAdherence`, `rankAdherence`, `RECENT_WINDOW_DAYS`). The `src/shared/` listing row now names it, after `series-edit.ts`, matching how earlier pure modules were recorded.

---

## Candidate Decisions (for operator review)

- The window for recent misses is `[today - 30, today)` (`RECENT_WINDOW_DAYS = 30`), and the ranking tie-break order is misses desc, latest miss desc, title asc, id asc. If the PRD does not already record this in its Decisions Log, the owner may want to promote it.

## Deferred Questions

- Should the roadmap or the `documentation/` architecture docs list `adherence.ts` now or only when the unit closes? — suggested default: wait until phases 2-3 expose the API and UI, as the orchestrator/owner handles unit state.

## Files Scanned — No Edit Required

- `documentation/30-architecture/architecture-overview.md` — has no per-module `src/shared` listing, only the general rule; nothing to add.
- `docs/domain/areas/tasks.md` — adherence is not user-visible behavior until phases 2-3; deferred.
- `docs/decisions.md`, `docs/anti-patterns.md`, `docs/context/methodology.md`, `CLAUDE.md`, `docs/KNOWLEDGE_BASE.md` — no new file under `docs/`, no stated decision or pattern in the diff.
- `documentation/50-planning/roadmap.md` — unit state belongs to the orchestrator/owner; not touched.
- `test/adherence.test.ts` — test file, read-only for this agent.

---
*Generated: 2026-10-04*
*Approved: 2026-10-04*
*Status: APPROVED*
