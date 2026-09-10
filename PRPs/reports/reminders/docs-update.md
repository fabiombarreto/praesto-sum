# Docs Update — reminders

**PR:** none — pre-merge run at the end of the four-phase orchestrated implementation on branch `feature/reminders` (worktree `C:/repos/assistente-pessoal/.worktrees/reminders`), diffed against base commit `f963738`
**Merged at:** not yet merged (2026-09-10, this docs-update run)
**Source PRD:** C:/repos/assistente-pessoal/PRPs/prds/reminders.prd.md (APPROVED, all four Implementation Phases `complete`)
**Effective configuration:** diff_source=worktree (`git -C <target_root> diff f963738`), non_interactive=false, docs_sync=true

## Files Edited

### `docs/domain/areas/reminders.md`

**Change type:** additive
**Rationale:** The unit shipped standalone and Task-linked Reminders (absolute and relative-to-deadline) end to end, added the deadline-recompute rule (PATCH /api/tasks/:id recomputes relative, unsent Reminders and leaves absolute/sent ones alone), and added closed-Task suppression (done/missed Tasks do not ring, row still marked sent). The "Business rules" section only recorded the standalone case and the bare trigger-time rule; it now names all three shipped rules with their PRD AC citations. The "Delivery architecture" paragraph described a bare scan-and-send with "Push failure is SILENT" as the operative fact; that was true before this unit gave the sweep a real claim-before-send/retry/prune shape (`runScheduledJob`, `src/worker/cron.ts`, phase 2) and a per-Task deep link (phase 3) — the paragraph now describes the actual mechanism. Every added sentence traces to a specific hunk in `src/worker/cron.ts`, `src/worker/routes/tasks.ts`, or `src/shared/dates.ts`, or to the PRD's Acceptance Criteria (AC-3, AC-5–AC-12, AC-14) that those hunks implement. The pre-existing "Open Questions" and "Resolved" sections were left untouched — none of the diff resolves or invalidates them.

---

### `docs/context/architecture.md`

**Change type:** additive/corrective
**Rationale:** The "Current implementation state (Phase 1)" section's "Not built yet" line still listed "Web Push dispatch" (shipped in unit 6, already stale before this diff) and "Reminder endpoints" (shipped by this unit's phase 1 — `src/worker/routes/reminders.ts` — and phase 2's real `runScheduledJob`) as outstanding, and still called `scheduled()` "an empty stub" for Reminders. This is a PRESERVE-ENTIRELY file (`docs/context/*`), so the edit is narrow: it removes only the two clauses this unit's merged diff makes false, adds one sentence naming what shipped and where, and leaves every other clause (recurrence, export, search, Life Area endpoints — all still genuinely unbuilt or out of this unit's scope) byte-identical. I did not attempt a wholesale refresh of this section's other staleness (e.g. export already shipped in unit 5 pre-dating this diff) — that is out of this run's scope per the PRESERVE-ENTIRELY rule and is noted below under "Files Scanned" for awareness.

---

### `docs/decisions.md`

**Change type:** additive
**Rationale:** Two entries added, both citing the PRD's own Decisions Log as source (the PRD is APPROVED — owner-validated — and its Decisions Log states these choices explicitly and concretely, matching the one permitted exception to PRESERVE-ENTIRELY: a surgical, additive edit for something the merged diff or PRD states explicitly, not something inferred). No new ADR exists for either, and none was invented here — the PRD Decisions Log entries were themselves not elevated to ADR status by this unit, matching the dispatching instruction that this unit produced no new ADR. (1) "The due-Reminder sweep claims before it sends" — the claim-before-send + retryable-release ordering (PRD "Sweep ordering" row, AC-5/AC-6/AC-10), a load-bearing correctness decision the sweep code (`src/worker/cron.ts`) implements verbatim. (2) "A relative Task Reminder resolves against end-of-day local, and is recomputed when the deadline moves" — merges the PRD's "Meaning of a deadline for a relative reminder" and "Behavior when a Task's deadline moves" rows (AC-3/AC-11/AC-12/AC-14), since both concern the same `offsetToInstant` convention and its one recomputation point, and recorded the still-open "TBD — needs validation" caveat from the PRD's own Open Questions so this entry does not overclaim finality. I judged these two as decisions worth surfacing at the relay-facing decisions.md tier (they are cross-phase, load-bearing, and already fully argued in an APPROVED PRD) and left the remaining PRD Decisions Log rows ("Reminders for closed Tasks", "Storage model", "Per-Task deep link", "Database change") as candidates below rather than also writing them in, since they are narrower / more implementation-detail-shaped and a reasonable reviewer could judge them redundant with the domain doc's business-rules update above.

---

### `CLAUDE.md`

**Change type:** additive
**Rationale:** The status line said "Suite is 814 tests / 57 files. Unit 7 `reminders` is `next`" — both now false: the suite is 889 tests / 62 files per the run's own numbers, and the roadmap row was moved from `next` to `in-progress` by this unit's own phase 4 (per the dispatching instructions, `documentation/50-planning/roadmap.md`'s unit 7 row already changed in the diff). The sentence was rewritten to say what shipped (CRUD, sweep, deep link, recomputation — all four PRD phases `complete`) and what remains (the owner's on-device proof), mirroring this file's existing style of narrating exactly what changed and what the next concrete step is. No other CLAUDE.md content was touched.

---

## Candidate Decisions (for operator review)

The following PRD Decisions Log rows were observed but NOT written into `docs/decisions.md` — narrower or more implementation-shaped than the two entries added above, and arguably already covered by the `docs/domain/areas/reminders.md` business-rules update. Review and promote any that should stand alone:

- **Reminders for closed Tasks are suppressed, not deleted, and marked sent so the sweep does not reconsider them every tick** (PRD Decisions Log row "Reminders for closed Tasks"; AC-9). Currently only recorded as a business rule in `docs/domain/areas/reminders.md`.
- **Storage model: no new table or column — the existing `reminders` table and `reminders_due_idx` are reused as designed, with rule expansion deliberately deferred to ADR-0006's units 9/17** (PRD Decisions Log row "Storage model"). This is closer to an architecture note than a decision the project could have gone another way on inside this unit's scope, but the operator may want it recorded so a future reader does not re-litigate "why no migration in this unit".
- **The per-Task deep link (`AppRoute` variant, codec, `sw.ts`, SPA listener) was scoped as new end-to-end work, not merely a device-proof of existing code** (PRD Decisions Log row "Per-Task deep link"). Recorded in the PRD as correcting a roadmap residual that understated the gap — the operator may want that correction reflected wherever the roadmap's residual language is quoted elsewhere in `docs/`.

## Deferred Questions

None. `non_interactive` was not set to `true` for this run, and no genuinely ambiguous docs decision arose that required asking the operator — every edit above traces to an explicit hunk in the merged diff or an explicit row in the APPROVED PRD's Decisions Log, and every inferred/ambiguous item was routed to "Candidate Decisions" above instead of being asked about or written in.

## Files Scanned — No Edit Required

- `docs/context/methodology.md` — read for the `docs_sync`/`figma_track` frontmatter (both confirmed: `docs_sync: true`, `figma_track: false`). No edit needed; `figma_track: false` means Step 3.5's component-map upgrade path does not apply to this feature and produces no manifest line, per that step's own gate.
- `docs/context/conventions.md`, `docs/context/constraints.md` — read; nothing in the merged diff contradicts, extends, or makes anything in either file stale.
- `docs/anti-patterns.md` — read; this unit introduced no new forbidden pattern and no exception to an existing one. Reusing the existing `reminders` table rather than adding a column/table is consistent with (not an exception to) the existing "hand-duplicated entity types" and "version ranges" entries; nothing new to record.
- `docs/KNOWLEDGE_BASE.md` — read; its one-line summary of `docs/domain/areas/reminders.md` ("attached or standalone; server-side cron + Web Push; silent-failure mitigations") is now a little thin next to the domain doc's updated content, but this unit added no new `docs/` file, and the Explicit Write Scope for this file is authorized only for "new `docs/` file added" index entries — updating an existing summary's wording is outside that authorization, so it was left as-is and is flagged here for the operator's awareness rather than edited.
- `docs/architecture.md` (developer view, `docs/` root, distinct from `docs/context/architecture.md`) and `docs/api-reference.md` — both are now visibly stale (the developer-view doc still narrates the sweep as "(unit 7) scan due Reminders" future work; the API reference's "Not built yet" table still lists unit 6 `reminders`'s Reminder CRUD and due-scan job as unbuilt, and the Implemented table has no `/api/reminders` rows at all). **Neither file appears in this agent's Explicit Write Scope table**, so both were left untouched rather than edited. Flagging for the operator: these two files need a manual or a future-authorized update to add the `/api/reminders` routes (GET/POST/PATCH/DELETE) to the Implemented table and to correct the cron narrative — they are read-only for this agent under the current contract.
- `documentation/` tree — read only to understand scope (`documentation/50-planning/roadmap.md`'s unit 7 row and `docs/domain/areas/reminders.md`'s stale `web-push` reference were already corrected as explicit phase-4 plan tasks per the dispatching instructions). Confirmed via `git diff --stat` that `documentation/50-planning/roadmap.md` is the only `documentation/` file the merged diff touches, and it was not touched by this agent, per the hard constraint that `documentation/` is owner-validated and out of this agent's write scope entirely.
- `src/*`, `test/*` — read only via `git diff` to ground every docs edit in a specific hunk; not edited, per scope.

---
*Generated: 2026-09-10*
*Approved: 2026-09-10*
*Status: APPROVED*
