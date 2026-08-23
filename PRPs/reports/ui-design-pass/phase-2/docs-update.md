# Docs Update — ui-design-pass

**PR:** N/A (pre-PR — see "Merged at")
**Merged at:** N/A — not merged. This run is the docs-sync sub-phase of `/relay-implement` Phase A.3.5 for **Phase 2** ("Today screen") of the `ui-design-pass` PRD, dispatched after code-review APPROVED (`PRPs/plans/ui-design-pass-phase-2-today-screen.code-review.jsonl`), reading `PRPs/reports/ui-design-pass/phase-2/attempts/1/diff.implementer.patch` directly (`diff_source: patch`) rather than a merged PR. This manifest overwrites the feature-level `docs-update.md` that Phase 1's docs-sync left here; that Phase 1 content is preserved, unedited, at `PRPs/reports/ui-design-pass/phase-1/docs-update.md` (`Status: APPROVED`) — the edits recorded there (to the same two files touched below) are untouched by this run; this run only adds to them.
**Source PRD:** PRPs/prds/ui-design-pass.prd.md
**Effective configuration:** diff_source=patch, non_interactive=true, docs_sync=true

Grounding: `PRPs/prds/ui-design-pass.prd.md` (Phase 2 row + AC-2/AC-3/AC-8–AC-10/AC-13–AC-17, the "Component layout" and "Update flow" Architecture Notes, and the Decisions Log), `PRPs/plans/ui-design-pass-phase-2-today-screen.plan.md`, and `PRPs/reports/ui-design-pass/phase-2/attempts/1/diff.implementer.patch` (22 files — this attempt's own changes only; Phase 1's part of the branch is already reflected in `docs/` per its own APPROVED manifest, so it was not re-read as source). `documentation/10-product/visual-identity.md` and `documentation/50-planning/roadmap.md` were already updated by the implementer inside this same patch (a microcopy row and a closed backlog item respectively) and stayed out of scope for this docs-updater run — `documentation/` is authoritative and read-only for this agent on every run; `docs/` is derived from it and never contradicts it. After making the edits below, `npx vitest run --project docs` (`test/docs-consistency.test.ts`) was run and is green: 1 file, 62 tests passed.

## Files Edited

### `docs/context/architecture.md`

**Change type:** additive
**Rationale:** The Phase 2 patch makes the "Repository layout" table's `src/app/` and `src/shared/` rows (both already touched by Phase 1) stale in two concrete ways. First, `App.tsx` shrank to only the token-gate switch (`Skeleton` while the stored token is still being read, else `TokenGate` or `TodayScreen`) — the ~500-line inline-styled board/detail/inline-title code it used to contain moved into new files under `src/app/components/` (`TodayScreen`, `TodayHeader`, `TaskRow`, `InlineTitle`, `CaptureDeck`, `EmptyState`, plus `TaskDetail` and `TokenGate` moved verbatim and still transitionally inline-styled per their own doc comments — "allowed here until Phase 3 rebuilds") and three new primitives landed under `src/app/components/ui/` (`Banner`, `Skeleton`, `Toast`); and a new `src/app/toast-store.ts` (a module-level `useSyncExternalStore` store) plus a new `src/app/hooks/` directory (`useConnectivity.ts`) appeared, both explicitly documented in the diff's own comments as the "exempt glue" `docs/context/methodology.md`'s "Browser-API work" rule names. Second, the `src/shared/` row was one module short: `src/shared/toast.ts`, a DOM-free `show`/`dismiss`/`expire` reducer with the same "environment-agnostic, compiled into both the browser and the Worker projects" shape as the `format.ts`/`connectivity.ts` it now sits beside (its own doc comment says so explicitly, citing `connectivity.ts` by name). Extended both rows; every existing cell's wording — including Phase 1's own additions to the `public/` row and the `scripts/` row it added — is preserved verbatim; nothing was removed or reworded.

---

### `docs/context/conventions.md`

**Change type:** additive
**Rationale:** The patch populates `src/app/components/` (screens) for the first time with real files, alongside the pre-existing `src/app/components/ui/` (primitives) the "UI code" bullet already named — realizing, file for file, the split the PRD's "Component layout" Architecture Note states explicitly ("`src/app/components/ui/` keeps the primitives ...; `src/app/components/` holds the screens and their parts ...; `App.tsx` keeps only the three-valued token state and the screen switch"). The existing bullet named only the `ui/` half of that split; extended it to name both halves with a representative file list on each side, keeping the rest of the sentence (Tailwind-tokens-only, `cva`/`cn()`, Base UI data attributes, pt-BR literals, the guidelines-checklist pointer) unchanged. Phase 1's two bullets appended directly below this one (owner-facing pt-BR messages in `src/shared`; self-hosted fonts) are unedited.

---

## Candidate Decisions (for operator review)

None. Every decision this patch touches — pt-BR visible copy (ADR-0009),
the amber/press-physics token system (ADR-0010), the owned-component
library with no toast/dialog dependency (ADR-0011) — is already an
accepted, indexed entry in `docs/decisions.md`. The phase-scoped
implementation choices (optimistic complete/reopen with rollback and a
toast-based *Desfazer*; one shared toast slot via a module-level
`useSyncExternalStore` store rather than prop-drilling; the signature
completion moment's CSS anchored on `[data-shell]:has(...)` rather than
`:root`) are all stated explicitly in the source PRD's own Decisions Log
and Architecture Notes, not inferred from this diff — and none of them
rises above phase-scoped implementation detail to a project-wide
precedent needing its own ADR, so none is a candidate for a new
`docs/decisions.md` entry. (One item, the safe-area-padding CSS recipe, is
explicitly flagged in the PRD itself as "to be reflected in the
guidelines at A6" — a later activity's job, not this sync's and not
`docs/decisions.md`'s.)

## Deferred Questions

None. Reconciling this patch against `docs/` produced no case meeting the
Interactivity Clause's bar for a docs decision "genuinely ambiguous" — no
point where the merged diff could plausibly be recorded in `decisions.md`
(or elsewhere) in two or more materially different ways with the source
PRD silent on which. Every fact recorded above is concrete and directly
traceable to one diff hunk or one PRD passage. `non_interactive: true` was
in effect for this run; had a genuine ambiguity arisen, it would have been
recorded here instead of asked, per the ALWAYS-defer rule.

## Files Scanned — No Edit Required

Source files touched by this attempt's own patch, and why no further
`docs/` edit followed beyond the two above:

- `documentation/10-product/visual-identity.md` — already updated by the implementer inside this same patch (new "List load error" microcopy row + History entry); `documentation/` is authoritative and out of this agent's write scope on every run.
- `documentation/50-planning/roadmap.md` — already updated by the implementer inside this same patch (closed the "Refresh the view when a window returns to the foreground" backlog row, `done 2026-08-21`); same out-of-scope reason.
- `PRPs/reports/ui-design-pass/phase-2/build-report.md`, `PRPs/reports/ui-design-pass/phase-2/attempts/1/pre-state.txt` — Implementer-produced run artifacts, read for scope/context only; not `docs/` content.
- `src/app/App.tsx`, `src/app/components/{CaptureDeck,DesignPlayground,EmptyState,InlineTitle,TaskDetail,TaskRow,TodayHeader,TodayScreen,TokenGate}.tsx`, `src/app/components/ui/{Banner,CompleteControl,Skeleton,Toast}.tsx`, `src/app/hooks/useConnectivity.ts`, `src/app/main.tsx`, `src/app/styles.css`, `src/app/toast-store.ts`, `src/shared/toast.ts` — every new path and every behavioural fact in these files (the component split, the toast store, the connectivity hook, the update-toast wiring, the signature-completion keyframes) is covered by the two `docs/context/architecture.md` / `docs/context/conventions.md` edits above; nothing left an uncovered residue.

`docs/` files read and found unaffected by this patch:

- `docs/decisions.md`, `docs/anti-patterns.md` — no new or contradicted decision/forbidden pattern; no new ADR was authored by this patch (confirmed: no `documentation/60-decisions/` file appears in the diff). The build report's structural-gate checks (no inline `style={}` outside the two named transitional files, no `window.confirm`, no CSS `text-transform: uppercase`) restate rules that already live in `documentation/40-engineering/ui-ux-guidelines.md` (routed via the `docs/context/ui-guidelines.md` pointer and its review checklist), not new entries for this file's curated ADR/convention-sourced set.
- `docs/context/methodology.md` — frontmatter (`tdd: true`, `docs_sync: true`, `figma_track: false`) unchanged by this patch.
- `docs/context/constraints.md` — no CON/QA change.
- `docs/context/testing.md` — the new `test/toast.test.ts` (22 cases) already falls under the existing, generically-documented `test/*.test.ts` row; no table update needed.
- `docs/context/ui-guidelines.md` — a pointer file that does not restate rules; its routing target and related links are unaffected.
- `docs/domain/areas/tasks.md` — no business rule changed: the `open → done` lifecycle and its undo (FR-003) are unchanged; optimistic complete/reopen with rollback is a UI request-timing strategy, not a new domain rule.
- `docs/domain/flows.md` — the capture and organize-the-day flows are unchanged in substance, only restyled.
- `docs/KNOWLEDGE_BASE.md` — no new `docs/` file was added by this run (only two existing files were further edited), so the index-update trigger does not fire.
- `CLAUDE.md` — Essential commands and Key patterns are unaffected (no new script, no cross-cutting architectural change); the ON-HOLD roadmap banner stays accurate (Phase 3 and Phase 4 of this same PRD remain before the hold's exit criterion is met).

---
*Generated: 2026-08-21*
*Approved: 2026-08-21*
*Status: APPROVED*
