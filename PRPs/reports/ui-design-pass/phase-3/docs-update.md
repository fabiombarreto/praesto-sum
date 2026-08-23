# Docs Update — ui-design-pass

**PR:** N/A (pre-PR — see "Merged at")
**Merged at:** N/A — not merged. This run is the docs-sync sub-phase of `/relay-implement` Phase A.3.5 for **Phase 3** ("Detail sheet, delete confirmation and token gate") of the `ui-design-pass` PRD, dispatched after code-review APPROVED (`PRPs/plans/ui-design-pass-phase-3-sheet-confirmation-and-token-gate.code-review.jsonl`: attempt 1 `CHANGES_REQUESTED`, attempt 2 `APPROVED`). Per the dispatching agent's explicit instruction, BOTH implementer patches were read as the diff for this run — `PRPs/reports/ui-design-pass/phase-3/attempts/1/diff.implementer.patch` (the `patch_path` this run was given, 10 files) and `PRPs/reports/ui-design-pass/phase-3/attempts/2/diff.implementer.patch` (the fix round that earned the `APPROVED` verdict, 3 files: the build report's amended gzip numbers, `TaskSheet.tsx`'s `lastDraft` ref, and `Sheet.tsx`'s added native `cancel`-event guard) — rather than a merged PR (`diff_source: patch`). This manifest overwrites the feature-level `docs-update.md` that Phase 2's docs-sync left here; that Phase 2 content is preserved, unedited, at `PRPs/reports/ui-design-pass/phase-2/docs-update.md` (`Status: APPROVED`, and Phase 1's own copy is likewise preserved at `PRPs/reports/ui-design-pass/phase-1/docs-update.md`) — the edits recorded there (to the same two files touched below) are untouched by this run; this run only adds to them.
**Source PRD:** PRPs/prds/ui-design-pass.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

Grounding: `PRPs/prds/ui-design-pass.prd.md` (Phase 3 row + AC-2 completion, AC-3 gate+sheet, AC-11, AC-12, the "Component layout" and "`Sheet` moves to a native `<dialog>`" Architecture Notes, PRD risk row 400, and the Decisions Log rows "Sheet primitive" and "Delete placement and confirmation"), `PRPs/plans/completed/ui-design-pass-phase-3-sheet-confirmation-and-token-gate.plan.md`, `PRPs/reports/ui-design-pass/phase-3/build-report.md`, and both implementer patches named above (Phase 1's and Phase 2's parts of the branch are already reflected in `docs/` per their own `APPROVED` manifests, so they were not re-read as source for this run). Unlike Phase 1 and Phase 2, **no `documentation/` file appears in either phase-3 patch** — this phase touched only `src/app/`, `src/shared/` and its own report; nothing here required an authoritative-doc update, so there is nothing to note as "already updated elsewhere" this time. After making the edits below, `npx vitest run --project docs` (`test/docs-consistency.test.ts`) was run and is green: 1 file, 62 tests passed.

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** The Phase 3 patch makes three concrete facts in the "Repository layout" table's `src/app/` and `src/shared/` rows (both already touched by Phase 1 and Phase 2) stale. First, `App.tsx`'s parenthetical described the token-gate switch as rendering bare `TokenGate` or `TodayScreen`; the diff adds a `gateReason` state set to `"unauthorized"` on a 401 route from `TodayScreen` and threads it into `TokenGate` as a new `reason` prop (`App.tsx` hunk, `TokenGateReason` export) — the switch now carries a reason, not just a screen choice. Second, the `components/` cell's own words — "`TaskDetail` and `TokenGate` moved out of `App.tsx` verbatim, still inline-styled and transitional until Phase 3 rebuilds them" — describe a Phase 3 that has now happened: `TaskDetail.tsx` is deleted (confirmed absent via `test -f`; a repo-wide grep finds no reference anywhere outside one historical provenance comment in the new `task-sheet.ts`, which cites the deleted file's old line numbers without depending on it) and fully replaced by the new `TaskSheet.tsx`; `TokenGate.tsx` is rebuilt on the tokens (the identity's flat mark + wordmark, a visible label, the 401 reason, `Button`) and is no longer transitional or inline-styled. Third, the `components/ui/` cell still described `Sheet` as sitting "over Base UI Dialog" from its own Phase-1-era doc comment; the diff rewrites `Sheet.tsx` onto a native `<dialog>` opened with `showModal()` (ADR-0011's named contingency — "native `<dialog>` first for sheets unless Base UI Dialog is verified on the device" — now realised) and the build report's structural gate confirms `grep -rnF "@base-ui/react/dialog" src` finds nothing left in the whole tree; the same cell gains `ConfirmView`, a new owned primitive. Fourth, the `src/shared/` row's three-module list (`format.ts`, `connectivity.ts`, `toast.ts`) is one module short of the new `task-sheet.ts` — a DOM-free reducer with the same "environment-agnostic" shape, backing the new `TaskSheet.tsx` per `docs/context/methodology.md`'s "Browser-API work" split, exactly as its own doc comment states by citing `connectivity.ts` and `toast.ts` by name. Four surgical edits across these two rows; every existing cell's wording — including both prior phases' own additions — is preserved verbatim; nothing was removed or reworded beyond replacing the now-false "transitional" language the diff itself supersedes.

---

### `docs/context/conventions.md`

**Change type:** additive
**Rationale:** The existing "UI code" bullet's two representative file lists — `src/app/components/ui/` primitives and `src/app/components/` screens-and-parts — were both one file short of what this patch actually created: `ConfirmView.tsx` (a new owned primitive, the in-place destructive-action confirmation view guidelines §8 asks for) and `TaskSheet.tsx` (a new screen part, the sheet's field form plus its in-place delete confirmation). Both are PascalCase, one component per file, and follow every rule the bullet already states (Tailwind-tokens-only, `cva`/`cn()`, Base UI data attributes, pt-BR literals) — nothing about the rule itself changed, only the two representative lists gained the one name each that this phase added. `TokenGate.tsx` was not added to the list: it already existed as a `components/` file before this phase (unnamed in this "e.g." list both before and after Phase 2's own edit) and this phase rebuilds it rather than creating it, so adding it now would not be traceable to a "new file appeared" fact the way `ConfirmView` and `TaskSheet` are. No other part of the bullet, and no other bullet in the file, needed touching.

---

## Candidate Decisions (for operator review)

None. The two product/architecture facts this patch realizes in code — the
`Sheet` primitive swapping from Base UI `Dialog` to a native `<dialog>`, and
the delete confirmation living in-place inside the same sheet rather than a
second stacked dialog or a row-level control — are both already accepted,
indexed decisions: the first is ADR-0011's own named contingency ("native
`<dialog>` first ... unless Base UI Dialog is verified"), and both are also
stated explicitly, not inferred, in the source PRD's Decisions Log ("Sheet
primitive" and "Delete placement and confirmation" rows) and Architecture
Notes. `docs/decisions.md` already carries ADR-0011 as an indexed entry;
recording the same decision a second time as its own realization would
duplicate, not add, an entry — the realization belongs in
`docs/context/architecture.md` (edited above), not `docs/decisions.md`.

The attempt-2 fix — `Sheet.tsx` mirroring the native `cancel` event into
`onOpenChange(false)` alongside `close`, guarding against `requestClose()`
closing the dialog without ever firing `close` (observed directly in the
verification browser and accepted by code-review as a measured,
transparently-recorded departure from the plan's literal text, not
unauthorized scope creep) — is an implementation-level correctness fix to
one primitive, not a product or architecture decision; it is already
explained in full by its own code comment and does not rise to a
`docs/decisions.md` or `docs/context/conventions.md` entry.

## Deferred Questions

None. Reconciling this patch against `docs/` produced no case meeting the
Interactivity Clause's bar for a docs decision "genuinely ambiguous" — no
point where the merged diff could plausibly be recorded in `decisions.md`
(or elsewhere) in two or more materially different ways with the source PRD
silent on which. Every fact recorded above is concrete and directly
traceable to one diff hunk, one build-report line, or one PRD passage.
`non_interactive: true` was in effect for this run; had a genuine ambiguity
arisen, it would have been recorded here instead of asked, per the
ALWAYS-defer rule.

## Files Scanned — No Edit Required

Source files touched by either implementer patch, and why no further
`docs/` edit followed beyond the two above:

- `PRPs/reports/ui-design-pass/phase-3/build-report.md` — an Implementer-produced run artifact (gates, the `vite build` size table, the structural-gate greps, the "OWED, not yet run" browser/device checklists), read for scope/context only; not `docs/` content. One fact worth surfacing here rather than in `docs/`: the report's own "Owner's device check — OWED, not yet run" section confirms PRD Open Question 1 (does the Android back gesture close a native modal `<dialog>`) has **not** been verified on the device by this Implementer run — the `cancel`-event guard added in attempt 2 is a measured defensive fix for a *different*, browser-observed failure mode (`requestClose()` closing without firing `close`), not a stand-in for that still-open device check. This is PRD/plan territory (the Open Questions section and the plan's own fallback mechanism), not a `docs/` fact, so no `docs/` edit follows from it.
- `src/app/App.tsx` — the `gateReason` state and `TokenGateReason` type are covered by the `App.tsx` architecture.md edit above.
- `src/app/components/DesignPlayground.tsx` — adds a "Sheet de tarefa" playground section exercising `TaskSheet`/`ConfirmView`/the new reducer; this is the dev-only route already documented in `docs/context/architecture.md`'s `main.tsx` entry (Phase 1) — no new architectural fact beyond the two components/module already covered above.
- `src/app/components/TaskSheet.tsx` (new) — covered by the `components/` architecture.md edit and the conventions.md edit above; the attempt-2 `lastDraft` ref fix (rendering through the exit/confirm-view transition without reverting fields) is implementation detail of that one component, already explained by its own code comment.
- `src/app/components/TodayScreen.tsx` — wires `TaskSheet` in place of `TaskDetail` (`openSheet`/`saveSheet`/`deleteSheetTask`/`runSheet`), reuses the existing toast slot for the sheet's own toasts; every new path here is glue over `task-sheet.ts` and the existing `api.ts`/`toast-store.ts`, fully covered by the `task-sheet.ts` architecture.md edit above. No behavioural change to `buildTaskPatch` or the domain edit semantics — `src/shared/task-edit.ts` is untouched by this diff, confirmed by grep.
- `src/app/components/TokenGate.tsx` — the tokens rebuild (flat mark, wordmark, 401 reason, `Button`, pt-BR strings) is covered by the `components/` architecture.md edit above; the copy itself (already-approved microcopy from the PRD's "Microcopy added by this pass" table) needed no new `docs/` entry — ADR-0009 already governs pt-BR visible copy and is already an indexed `docs/decisions.md` entry.
- `src/app/components/ui/ConfirmView.tsx` (new) — covered by the `components/ui/` architecture.md edit and the conventions.md edit above.
- `src/app/components/ui/Sheet.tsx` — the Base-UI-Dialog-to-native-`<dialog>` rewrite is covered by the `components/ui/` architecture.md edit above; the attempt-2 `cancel`-event guard is implementation detail of this one primitive (see Candidate Decisions).
- `src/app/styles.css` — the sheet's `@starting-style`/`allow-discrete` slide-up transition CSS and `html:has(dialog[open]) { overflow: hidden; }` are the native-`<dialog>` realization already covered by the `components/ui/` architecture.md edit; no new token, scale or convention is introduced (still Tailwind utilities plus `var(--token)`, per the existing "tokens-only" rule).
- `src/shared/task-sheet.ts` (new) — covered by the `src/shared/` architecture.md edit above.

`docs/` files read and found unaffected by this patch:

- `docs/decisions.md`, `docs/anti-patterns.md` — no new or contradicted decision/forbidden pattern; no new ADR was authored by this patch (no `documentation/60-decisions/` file appears in either implementer patch). Both decisions this patch realizes (native `<dialog>`, in-place confirmation) are already indexed under ADR-0011 and the layout standard; see Candidate Decisions above for why no new entry follows.
- `docs/context/methodology.md` — frontmatter (`tdd: true`, `docs_sync: true`, `figma_track: false`) unchanged by this patch. `figma_track: false` means the Step 3.5 component-map upgrade does not apply to this run (no line recorded for it, per that step's own omission idiom).
- `docs/context/constraints.md` — no CON/QA change.
- `docs/context/testing.md` — the new `test/task-sheet.test.ts` (24 cases, `reduceTaskSheet`/`draftFromTask`/`currentDraft`) already falls under the existing, generically-documented `test/*.test.ts` row (`docs` project vs. `worker` project split is unchanged: this suite runs in the `worker` project alongside `test/task-edit.test.ts`, `test/toast.test.ts`, etc.); no table update needed — same call the Phase 2 manifest made for `test/toast.test.ts`.
- `docs/context/ui-guidelines.md` — a pointer file that does not restate rules; its routing target and related links are unaffected.
- `docs/domain/areas/tasks.md` — no business rule changed: `buildTaskPatch`/`dateModeOf` (`src/shared/task-edit.ts`) keep owning the edit semantics untouched by this diff; the delete confirmation and the draft-kept-in-memory rule are sheet *presentation* behaviour (guidelines §8, layout standard §3), not new Task domain rules — the `open → done → (deletion covers abandonment)` lifecycle this file already states is unchanged.
- `docs/domain/flows.md` — flow 2 ("Organizing the day") already covers "works through the day marking tasks done" at the business-flow level; the sheet's field layout and delete-confirmation mechanics are screen-level detail this non-technical flows doc deliberately does not carry (matches the Phase 2 manifest's identical judgment for the capture/organize flows).
- `docs/domain/glossary.md` — no new domain concept; the sheet's field labels (*Título*, *Descrição*, *Data*, *Prioridade*) are UI microcopy for already-canonical Task attributes, not new terms.
- `docs/KNOWLEDGE_BASE.md` — no new `docs/` file was added by this run (only two existing files were further edited), so the index-update trigger does not fire; its quoted `tdd`/`docs_sync`/`figma_track` values still match `docs/context/methodology.md`'s frontmatter (verified by the green consistency run above).
- `CLAUDE.md` — Essential commands and Key patterns are unaffected (no new script, no cross-cutting architectural change); the ON-HOLD roadmap banner stays accurate (Phase 4 of this same PRD — the device verification pass — remains before the hold's exit criterion is met).

---
*Generated: 2026-08-22*
*Approved: 2026-08-22*
*Status: APPROVED*
