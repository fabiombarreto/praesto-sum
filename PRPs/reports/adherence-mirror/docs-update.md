# Docs Update — adherence-mirror

**PR:** 8 (https://github.com/fabiombarreto/praesto-sum/pull/8)
**Merged at:** 2026-10-06
**Source PRD:** PRPs/prds/adherence-mirror.prd.md
**Effective configuration:** diff_source=pr, non_interactive=true, docs_sync=true

This run supersedes the implement-time phase-3 manifest (kept at `PRPs/reports/adherence-mirror/phase-3/docs-update.md`). The `docs/` edits it and phases 1-2 applied (api-reference endpoint row and unit-11 planned row, `docs/context/architecture.md`, `docs/domain/areas/tasks.md`) are verified present in the merged diff and were not re-proposed.

## Files Edited

### `docs/api-reference.md`

**Change type:** additive
**Rationale:** The post-implement QA fix G-1 (commit 0df6169, `src/worker/routes/series.ts`, `todayForSeries`) makes an unresolvable series time zone fall back to `America/Sao_Paulo` instead of returning 500 for the whole endpoint. The `GET /api/series/adherence` row now states that fallback.

---

## Candidate Decisions (for operator review)

- G-1: fallback of an invalid series time zone to `America/Sao_Paulo` in the adherence endpoint. Consider an ADR if it should bind other endpoints that read a series' zone.
- *Hoje* adherence line threshold (at least 2 misses in 30 days, active series only, absent on fetch failure) and the `/settings/adherence` route placement, carried over from the phase-3 manifest; already in the layout standard, ADR only if they should become durable product rules.

## Deferred Questions

- Should the `CLAUDE.md` current-state paragraph mention unit 11 `adherence-mirror` (delivered in code, PR #8)? — suggested default: leave until the unit closes on AC-20 (device proof), as the Docs Reviewer already suggested.

## Files Scanned — No Edit Required

- `docs/context/architecture.md`, `docs/domain/areas/tasks.md` — already updated by the merged PR.
- QA fixes G-2 (newest-request-only writes) and G-4 (route keeps loaded list on failed refresh) are internal UI behaviors with no `docs/` contract; no edit.
- `docs/decisions.md`, `docs/anti-patterns.md`, `docs/KNOWLEDGE_BASE.md` (no new docs/ files), `CLAUDE.md` — no explicit decision, pattern or index change in the diff.
- `documentation/` — read-only for this agent; the PR already updated the layout standard and roadmap.

---
*Generated: 2026-10-06*
*Approved: 2026-10-06*
*Status: APPROVED*
