# Docs Update — repeated-miss-nudge

**PR:** none (implement-time sync, uncommitted worktree `.worktrees/repeated-miss-nudge`, phase 2, attempt 1)
**Merged at:** 2026-10-10 (not merged; pre-PR)
**Source PRD:** PRPs/prds/repeated-miss-nudge.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

Phase-1 manifest preserved at `PRPs/reports/repeated-miss-nudge/docs-update.phase-1.md`. All edits below were applied in the worktree's `docs/` tree.

## Files Edited

### `docs/api-reference.md`

**Change type:** additive
**Rationale:** (1) The `POST /api/tasks/:id/complete` row gains one sentence: completing a series occurrence now also nulls the series' `nudged_at` in the same batch (`src/worker/routes/tasks.ts`), a `missed` close never does. (2) The planned-surface row for unit 12 records what phase 2 shipped: `PATCH /api/series/:id` accepts `nudgeMuted` (boolean, else 400 naming it, nothing written), `SeriesDto.nudgeMuted`, and that `nudgedAt` is NOT on the series wire but is in the export row. It states that the cron job is not built yet.

### `docs/domain/areas/tasks.md`

**Change type:** additive
**Rationale:** New bullet describing the two series state columns (`nudge_muted` owner preference, `nudged_at` system claim marker), migration `0006`, the clearing rule and the wire/export visibility, explicitly marking the cron step and UI as not built (phases 3-4).

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** One sentence in the recurrence paragraph recording unit 12's partial state (phase 1 pure module, phase 2 columns/migration `0006`/wire/PATCH/clearing; cron and UI not built).

## Candidate Decisions (for operator review)

- `nudgedAt` is system state kept off the series wire (`SeriesDto = Omit<RecurrenceSeriesDto, "nudgedAt"> & ...`) and carried only by the export row via a shared `seriesWireFields` helper in `src/worker/dto.ts`. This follows the PRD's marker/preference split; if the owner wants it as a durable decision, record it in `docs/decisions.md` / an ADR when unit 12 closes.
- `nudgeMuted` is deliberately an editable series field that does not set `touchesTemplate` (never propagates to the occurrence). Candidate to record with the unit-12 ADR/PRD decision log.

## Deferred Questions

None.

## Files Scanned — No Edit Required

- `docs/decisions.md`, `docs/anti-patterns.md` — no explicit new decision or forbidden pattern stated in the diff; candidates listed above.
- `docs/domain/areas/reminders.md` — no series-field description; mute leaves Reminders untouched, nothing to change.
- `docs/architecture.md`, `docs/development.md`, `docs/troubleshooting.md` — migration workflow unchanged (drizzle-kit generated `0006`, applied by wrangler).
- `CLAUDE.md`, `docs/KNOWLEDGE_BASE.md` — no new command, key pattern or docs file; the unit-12 status line there is the owner's to update when the unit moves.
- `docs/design/component-map.md` — Step 3.5 skipped: no Figma track in this phase.
- `documentation/` — not touched by this agent.

---
*Generated: 2026-10-10*
*Approved: 2026-10-10*
*Status: APPROVED*
