# Docs Update — repeated-miss-nudge

**PR:** none (implement-time sync, uncommitted worktree `.worktrees/repeated-miss-nudge`, phase 3, attempt 2)
**Merged at:** 2026-10-10 (not merged; pre-PR)
**Source PRD:** PRPs/prds/repeated-miss-nudge.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

Phase-2 manifest preserved at `PRPs/reports/repeated-miss-nudge/docs-update.phase-2.md`. All edits below were applied in the worktree's `docs/` tree.

## Files Edited

### `docs/domain/areas/tasks.md`

**Change type:** additive (plus correction of a phase-2 sentence)
**Rationale:** The phase-2 bullet said the cron step was not built; corrected to "shipped (phase 3)" with the UI still phase 4. New bullet describes `sweepRepeatedMissNudges`: ordering after the missed sweep and Reminder loop, threshold/09:00-local/mute/claim rules, one push per subscription (title <= 30, tag `nudge-<seriesId>`, route `/tasks/<open occurrence id>`), gone pruned, retryable releases the claim, no subscription or no open occurrence takes no claim, muted run consumed silently, deferred failure recorded in `cron_runs` without blocking Reminders, and the open edge (all subscriptions pruned as gone in one run leaves the claim set, parity with the Reminder sweep). Mentions `src/worker/series-closed-rows.ts`. Mute UI and Aderência row state stated as not built.

### `docs/api-reference.md`

**Change type:** additive (plus correction of a phase-2 sentence)
**Rationale:** The unit-12 planned-surface row said the job was not built; it now records that the cron step shipped in phase 3 with no HTTP surface, the notification shape, and that the mute screen (phase 4) is not built.

### `docs/context/architecture.md`

**Change type:** additive (plus correction of a phase-2 sentence)
**Rationale:** The unit-12 sentence in the recurrence paragraph replaced "the cron step and the UI are not built yet" with the phase-3 cron step, `src/shared/nudge-copy.ts` and `src/worker/series-closed-rows.ts`; UI stays not built.

## Candidate Decisions (for operator review)

- Open edge accepted for unit 12: when every stored subscription is pruned as `gone` in one run, `nudged_at` stays set and that run is not retried (parity with the Reminder sweep). Record in the unit-12 PRD decision log / ADR if the owner wants it durable.
- A muted series reaching the threshold has its run consumed (marker set, nothing sent), so unmuting never fires an old run. Candidate for the unit-12 decision log.
- A nudge failure is deferred in `runScheduledJob` and combined with a missed-sweep failure into one error, never blocking Reminders. Candidate for the decision log.

## Deferred Questions

None.

## Files Scanned — No Edit Required

- `docs/decisions.md`, `docs/anti-patterns.md` — no explicit new decision or forbidden pattern stated in the diff; candidates listed above.
- `docs/domain/areas/reminders.md` — describes the Reminder sweep only; the nudge is a series concern documented in tasks.md.
- `docs/architecture.md`, `docs/development.md`, `docs/troubleshooting.md` — no change in workflow or setup.
- `CLAUDE.md`, `docs/KNOWLEDGE_BASE.md` — no new command, key pattern or docs file; unit-12 status line is the owner's to update.
- `docs/design/component-map.md` — Step 3.5 skipped: no Figma track in this phase.
- `documentation/`, `.claude/` — not touched by this agent.

---
*Generated: 2026-10-10*
*Approved: 2026-10-10*
*Status: APPROVED*
