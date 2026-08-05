# Docs Update — install-and-quick-capture (Phase 3)

**PR:** N/A — no PR and no git remote exist for this repository. Per the
dispatching agent's explicit DEVIATION instruction, the change set was
derived from the working tree: `git diff HEAD` (Phase 1 is already
committed at `c6ec954`, so `HEAD` now shows only Phase 3 work) plus
`git ls-files --others --exclude-standard`, scoped to exactly the three
production files the dispatch named. Other dirty paths (the PRD, the
plan, `.jsonl` review logs, the test-suite manifest diff) are pipeline
artifacts from this same run and are excluded, per instruction.
**Merged at:** N/A — not merged; this is a pre-merge, per-phase docs sync
dispatched inline by `/relay-implement`'s Phase A.3.5 for Phase 3
(Shortcut and focused capture) of the `install-and-quick-capture` PRD.
**Source PRD:** `C:\repos\assistente-pessoal\PRPs\prds\install-and-quick-capture.prd.md`
(Open Question 1; Phase 3 row of Implementation Phases)
**Effective configuration:** diff_source=worktree (closest standard match
to the DEVIATION's `git diff HEAD` + untracked-files procedure — no
`patch_path` was supplied and no PR exists), non_interactive=false
(not supplied; default), docs_sync=true (parsed from
`docs/context/methodology.md` frontmatter)

## Files Edited

None. See the two judgment calls below (autofocus decision, and the
ADR-0004 tension) for the reasoning behind not writing either into
`docs/decisions.md`, and Files Scanned for every other file considered.

## Judgment call 1 — does the autofocus-stays-unconditional decision belong in `docs/decisions.md`?

**The case for adding it:** This phase resolves the PRD's Open Question 1
("auto-focusing the capture field may be unwelcome on desktop... to be
validated in real use rather than decided now") with an explicit,
reasoned call — not gating `autoFocus` by device/pointer type — recorded
both in a code comment (`src/app/App.tsx`, directly above `autoFocus`)
and in the approved plan's `## Notes` section. `docs/decisions.md`'s
stated purpose is exactly to stop the AI from re-litigating settled
questions, and a future phase touching this same `<input>` could
plausibly wonder whether to add device gating — an entry would settle
that in one lookup. The source is concrete and traceable to a specific,
approved artifact (the plan's Notes, quoted near-verbatim), satisfying
the Hard Constraints' "surgical, additive edit a specific hunk... states
explicitly and concretely" exception to PRESERVE-ENTIRELY.

**The case against, which I am ruling with:** Every existing entry in
`docs/decisions.md` cites `Source: documentation/60-decisions/ADR-XXXX`
— the file's own header states "every entry has an explicit,
owner-validated source" and frames itself as "the relay-facing index"
of the ADRs, not a general decision log. This autofocus call has no ADR
and, per the dispatching agent's own instruction, should get none — it
is explicitly a small, local, reversible UX call, not a project-wide
architectural commitment like every other entry in the file. More
importantly, the decision is explicitly **provisional**: the plan's own
words are "if real use on the Windows PC surfaces friction, revisiting
with a `matchMedia(...)` check is the natural next step." Writing it
into a file whose own intro states its contents "não devem ser
reavaliadas pela IA" (should not be re-evaluated by the AI) would
misrepresent a decision that explicitly *wants* to be re-evaluated once
real-use evidence exists, as if it were closed. The two artifacts that
already carry it — the code comment sitting directly on the line it
concerns, and the approved plan's Notes section — are the right-sized,
correctly-scoped record for a decision this local: a future agent
editing this exact `<input>` will see the comment before it could ever
consult `docs/decisions.md`, so the file would add process weight
without adding retrievability.

**Ruling: do not add an entry.** If real-use validation later confirms
or overturns the no-gating call, that is the moment (per the plan's own
words) to consider whether the *outcome* — not this interim call —
belongs in `docs/decisions.md`.

## Judgment call 2 — does the launcher shortcut change any capability statement in either tree? (flagged for operator review, not auto-edited)

Yes, and it surfaces something worth the operator's attention beyond
Phase 3 alone. `documentation/60-decisions/ADR-0004-single-pwa-as-sole-interface.md`
(accepted, append-only) lists under "Negative / accepted trade-offs":

> **No deep OS integration:** no native share targets, widgets, or OS
> calendar hooks in the MVP — deferred until a real need fires a revisit
> trigger.

Two accepted PWA-track phases now sit on the other side of that
sentence: Phase 1 (`share_target` manifest member, already shipped to
production per `documentation/50-planning/roadmap.md`'s 2026-08-05 entry)
and this Phase 3 (`shortcuts` manifest member, a launcher long-press
"widget"-adjacent entry). Both phases' own Decision Gates read ADR-0004
as *permitting* this ("the manifest IS the app's identity surface, so
`share_target`/`shortcuts` belongs in `public/manifest.webmanifest`"),
and both plans' research (MDN, web.dev, cited in each plan's `##
Research Summary`/`## Notes`) documents `share_target` and `shortcuts`
as ordinary, Baseline-adjacent *installable-PWA* manifest capabilities —
not the native-wrapper (Capacitor/Tauri-class) or native-app (App
Actions, Google Assistant) integration the ADR's Alternatives section
was actually weighing against. Read charitably, the ADR's "no native
share targets" bullet was likely written to rule out a *native app*
integration path, and the PWA manifest's own `share_target`/`shortcuts`
members were either not yet known to be available without one, or
considered part of ordinary installability rather than "deep OS
integration." Read literally, the bullet is now factually stale: the
MVP has shipped exactly what it says is deferred.

**I am not resolving this myself.** `documentation/60-decisions/` ADRs
are append-only and I must not edit ADR-0004 (Hard Constraint 2 /
`docs/anti-patterns.md` "Editing accepted ADRs"), and writing a new
ADR is outside the Docs Updater's scope and outside what this dispatch
authorized ("no new ADR should be written" was said of the autofocus
call, but the same append-only rule binds this finding too). Unlike
Judgment call 1, this is not a small local UX note — it is a factual
tension between an accepted architectural trade-off and two already-
merged phases, exactly the kind of thing the Hard Constraints say to
"record in the manifest and defer to the operator" rather than infer my
way through. Recording it here as a candidate for the operator's
attention:

## Candidate Decisions (for operator review)

- **ADR-0004's "no native share targets... in the MVP" trade-off appears
  stale against two already-merged phases.** Suggested operator actions,
  not mutually exclusive: (a) do nothing — the project precedent in
  `documentation/30-architecture/architecture-overview.md` (the
  2026-08-03 "Mechanism clarification" note on ADR-0003's safeguard 2)
  shows this project is comfortable treating an ADR's literal wording as
  imprecise without reopening it, provided the *intent* (no native-app
  wrapper) still holds; (b) add a clarifying note to `docs/decisions.md`'s
  existing `[2026-08-03] Single installable PWA as the sole interface`
  entry, mirroring its own existing `(Note 2026-08-04: ...)` pattern, to
  record that `share_target`/`shortcuts` shipped as ordinary PWA-manifest
  capabilities without contradicting the "no native wrapper" intent; (c)
  treat it as a genuine scope drift and open a new ADR that formally
  narrows or supersedes the "no deep OS integration" bullet. I did not
  take action (b) myself despite it being inside my nominal write scope,
  because judging *which* reading of the ADR's intent is correct is an
  owner-level call, not a docs-sync inference.

## Files Scanned — No Edit Required

- `public/manifest.webmanifest` (`shortcuts` member added) — See
  Judgment call 2 above for the ADR-0004 tension this raises (flagged as
  a candidate decision, not auto-edited). No `docs/`/`documentation/`
  file describes the manifest's member-level contents at a granularity
  this would edit; the file-level facts already on record (single source
  of truth is `public/manifest.webmanifest`, not a Vite plugin option —
  `docs/context/architecture.md`, `documentation/40-engineering/tech-stack.md`)
  are unaffected by adding a second top-level member.
- `src/app/main.tsx` (`/new-task` branch added) — Extends the exact
  `/share-target`-detect-then-strip pattern Phase 1 established; no new
  idiom, no routing dependency, no Worker route. Already covered
  generically by `docs/context/architecture.md`'s `src/app/`
  repository-layout row. No edit needed.
- `src/app/App.tsx` (comment-only) — No functional change; `autoFocus`
  and every surrounding line are byte-identical per the diff. See
  Judgment call 1 above for the substantive decision this comment
  records and why it is not mirrored into `docs/decisions.md`.
- `docs/decisions.md` — PRESERVE-ENTIRELY. Read in full; see Judgment
  calls 1 and 2. No edit.
- `docs/anti-patterns.md` — PRESERVE-ENTIRELY. Read in full. No new
  forbidden pattern or exception; Phase 3 adds no dependency, no routing
  library, no new `createTask` call site. No edit.
- `docs/context/architecture.md` — Re-read. The "Current implementation
  state (Phase 1)" section still summarizes roadmap-Phase-1 (MVP Tasks)
  at the schema/API/CRUD grain; it did not gain a share-target line after
  Phase 1 shipped (see the sibling Phase 1 manifest,
  `docs/context/architecture.md` was judged not to need updating there
  either) and the same reasoning holds now: this section tracks coarser
  milestones than one manifest member. `documentation/50-planning/roadmap.md`'s
  own 2026-08-05 delivery-history entry is where Phase 1's shipment is
  already recorded, and roadmap edits are explicitly out of scope for
  this dispatch. No edit.
- `docs/context/methodology.md` — Read (including frontmatter) to derive
  the effective `docs_sync` value for this run's header. `figma_track:
  false` confirmed, consistent with the plan's own Metadata note. No
  content change required.
- `docs/context/conventions.md`, `docs/context/constraints.md`,
  `docs/context/integrations.md` — Read in full. No naming, casing,
  dependency, git, constraint, or integration/auth-surface fact changed
  by this diff (no new dependency; the shortcut reuses the existing
  `/icons/icon-192.png` asset rather than adding one; CON-007's
  maskable/monochrome-badge icon requirement is about the top-level
  `icons` member, which this diff does not touch). No edit.
- `docs/KNOWLEDGE_BASE.md` — No new `docs/` file was added by this
  phase. No index entry needed.
- `CLAUDE.md` — Essential commands and Key patterns unchanged. No edit.
- `docs/domain/areas/tasks.md`, `docs/domain/flows.md` — Both already
  state the near-zero-friction capture goal (FR-045) and the
  non-technical "quick capture" flow in terms general enough to cover a
  second capture entry point without contradiction; neither enumerates
  entry points explicitly. No edit.
- `documentation/10-product/vision.md` — Read in full, specifically
  principle 5 ("Effortless in, effortless out"). Generic and already
  accurate; does not enumerate mechanisms. No edit.
- `documentation/30-architecture/architecture-overview.md` — Re-read
  (C4 diagrams, drivers, containers, integrations, risks, key decisions
  table). A launcher shortcut is a client manifest capability, not a new
  container, external integration, or security/privacy fact — the C4
  diagrams and containers table are unaffected. The "Key decisions"
  table's ADR-0004 row is a one-line pointer to the ADR and is accurate
  as a pointer regardless of Judgment call 2's finding. No edit.
- `documentation/60-decisions/ADR-0004-single-pwa-as-sole-interface.md`
  — Read in full; append-only, not edited (see Judgment call 2). No new
  ADR written, per the dispatch's explicit instruction and my own
  independent read of the append-only rule.
- `documentation/40-engineering/testing-strategy.md`,
  `docs/context/testing.md` — Read. This phase's own plan confirms it
  has no pure-`src/shared` testable unit (the `EXISTING_COVERAGE_SUFFICIENT`
  path) — a manifest member, a no-parse route branch, and a comment. No
  new test tier, framework, or location introduced. No edit.
- `documentation/40-engineering/dev-environment.md` — Read the setup and
  day-to-day command sections. No command, prerequisite, or deploy-runbook
  step changed by this diff. No edit.
- `documentation/20-requirements/functional-requirements.md` — FR-045
  already covers this work exactly as worded; this phase implements it
  and adds no scope, consistent with the "do NOT invent requirements"
  instruction. No edit.
- `documentation/50-planning/roadmap.md` — Read (current phase, delivery
  units table, delivery history). Explicitly out of scope per instruction
  ("unit and phase state are handled elsewhere"). No edit, by
  instruction.
- `documentation/README.md` — Read for the maintenance map. Nothing in
  this diff matches a maintenance-map trigger (no new ADR was written by
  this agent, no domain concept, no scope change, no stack/component/
  data/integration change, no milestone/phase close, no convention
  change). No edit — status panel `last_updated` values stay untouched
  since no `documentation/` document was edited by this run.
- `PRPs/prds/install-and-quick-capture.prd.md` — Read (Open Question 1,
  Phase 3 row). Already modified by an upstream planning step, not by
  this agent; outside this agent's write scope
  (`PRPs/prds/` is not in the Explicit Write Scope table). No action.

## Deferred Questions

None. `non_interactive` was not set to `true` for this run, but neither
judgment call above met the bar for a live operator question: Judgment
call 1 was resolved by argument (see above) without needing the
operator's input, and Judgment call 2 is recorded as a Candidate
Decision precisely because it is the kind of call — reconciling an
accepted ADR's wording against two already-merged phases — an operator
should make deliberately, not answer as a single rushed yes/no mid-run.

---
*Generated: 2026-08-05*
*Status: DRAFT*
