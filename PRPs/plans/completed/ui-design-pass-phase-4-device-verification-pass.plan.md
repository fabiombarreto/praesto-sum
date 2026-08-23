# Feature: Device verification pass (Phase 4 of ui-design-pass)

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: cross-cutting artifact (a plan the Implementer consumes); closes activity A5 by producing the evidence its exit signal names; touches every screen's accessibility semantics (the WCAG 2.2 Level A walk and the fixes it demands); the deploy and the two-device verdict are the OWNER's actions, not this pipeline's
- Decisions found:
  - ADR-0009 (pt-BR copy), ADR-0010 (identity and tokens), ADR-0011 (owned components) — unchanged by this phase; only ARIA semantics and one label are touched
  - Guidelines §10 — "Conformance is per screen and all 31 Level A criteria must hold (N/A ones vacuously). Tier A covers what changes per edit; the full Level A pass runs once per screen in A5 and whenever a screen is added, recorded under PRPs/reports/" — this phase IS that pass
  - Guidelines §11 — the budget table and its two Lighthouse rows (the device run via chrome://inspect, the built-shell run ≥ 90); testing-strategy.md keeps UI verification manual and buys no browser tier (ui-ux-plan.md:113)
  - dev-environment.md:70-77 — the deploy runbook: `npm run check && npm test` green → review pending SQL under migrations/ → `npm run db:migrate:remote` → `npm run deploy`; this feature adds NO migration, so the third step is a no-op this time and the plan says so rather than dropping it silently
  - PRD Phase Details — "`npm run deploy` by the owner; the owner's verdict on both devices recorded in the plan's History. The docs close-out itself (roadmap hold, plan `deprecated`, guideline amendments) stays with activity A6"
  - PRD Open Question 1 + risk row 400 — the Android back gesture is verified on the device here; the `history.pushState` fallback inside `Sheet.tsx` is switched on only if that check fails
- Applicable anti-patterns:
  - Weakening tests to force green — no task touches test/; the test pair is expected to record EXISTING_COVERAGE_SUFFICIENT (this phase adds no decidable logic)
  - Claiming a screenshot that was not taken (guidelines §12.6) — every unmeasurable item is recorded with its reason instead
  - Deploying from the pipeline — the deploy is the owner's, by the PRD's own words; no task runs `wrangler deploy`
  - Doing A6's work here — the guideline amendments, the roadmap hold lift and the plan's `deprecated` flip stay with A6; this phase only leaves the divergence list ready
- Applicable architectural rules:
  - One Worker; no API, schema or dependency change (Lighthouse is invoked ad hoc, never installed — testing-strategy.md:37)
  - tokens.css is the only style scale; pt-BR literals in components
  - UI verification stays manual: the browser pane is the main session's job, the phone and the PC are the owner's
  - Pillar 2 never commits
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/ui-design-pass.prd.md` — Implementation Phases row 4: "Device
  verification pass" — Goal: the exit signal of activity A5 is met and
  recorded, not assumed — Success signal: the owner opens the deployed app on
  the Android phone and the Windows PC and asks for no change before unit 3;
  `npm test` and `npm run check` green; the report under
  `PRPs/reports/ui-design-pass/` names every measurement and every screenshot.

## Summary

The three screens exist; this phase proves they hold up. It has three parts.
**First, the fixes the accessibility walk already found** — four ARIA/labelling
defects located in the phase-4 grounding pass: the toast's explicit
`aria-live="polite"` silently downgrades `role="alert"`, so an error toast
announces no more urgently than *Tarefa salva*; the sheet names two adjacent
controls *Data*; the capture deck's offline hint appears with no announcement;
and the inline title editor is the app's only input with neither a visible
label nor a programmatic description of what it edits. **Second, the record**:
the full WCAG 2.2 Level A walk of guidelines §10, all 31 criteria against each
of the three screens (token gate, *Hoje*, detail sheet), written to
`PRPs/reports/ui-design-pass/phase-4/level-a-walk.md` with a per-criterion
verdict and evidence — the pass §10 says runs "once per screen in A5" — plus
the phase's build report carrying the size table, the §11 budget probe and the
Tier B measurements the browser pane can take (375 px and, for the first time
in this feature, 1280 px). **Third, the hand-over**: a runbook the owner
follows to deploy and verify on both devices, and the divergence list A6 will
consume. Nothing here changes behaviour beyond the four fixes; no test file is
touched; the deploy and the two-device verdict are the owner's, as the PRD
says.

## User Story

```
As the owner
I want the pass to end with evidence rather than a claim — every Level A
criterion walked per screen, every measurement filed, the app deployed and
opened on my phone and my PC
So that I can say "nothing to change before unit 3" and know what that
sentence is standing on
```

## Problem Statement

Phases 1–3 each recorded a Tier A run and a partial Tier B, and each left the
same three gaps: **1280 px was never measured** (the browser pane kept its
375 × 812 viewport in all three runs), **no screenshot exists** (the pane never
composited frames), and **every step that needs a stored API token or a real
phone is owed** — including the one the PRD raised as its first Open Question,
whether the Android back gesture closes the sheet. The full Level A walk
guidelines §10 requires "once per screen in A5" has not been run at all: Tier A
item 6 checks only what each change touched. The phase-4 grounding pass, reading
the three screens as they now stand, already surfaced four defects no Tier A run
would have caught, because each is about how a state is *announced* rather than
how it looks: `src/app/components/ui/Toast.tsx:27-28` sets
`role={isError ? "alert" : "status"}` and then `aria-live="polite"`
unconditionally, and an explicit `aria-live` overrides the implicit `assertive`
of `role="alert"`; `src/app/components/TaskSheet.tsx:110` and `:123` both
expose the accessible name *Data* on adjacent controls;
`src/app/components/CaptureDeck.tsx:91` renders the offline hint as a plain
`<p>` while the identical connectivity state one level up is announced by
`Banner.tsx:9`'s `role="status"`; and `src/app/components/InlineTitle.tsx:52`
carries an `aria-label` but no visible label, the one case where guidelines §10
3.3.2 ("a placeholder is not a label") has to be ruled on explicitly rather
than assumed. Until the walk is written and those four are settled, A5's exit
signal cannot be claimed and A6 has nothing to close out.

## Solution Statement

Fix the four, then write the evidence. `Toast.tsx` drops the unconditional
`aria-live` and lets each role carry its own politeness (`alert` → assertive,
`status` → polite), which is what the §8 toast row means by an error being
different from a confirmation. `TaskSheet.tsx` renames the date input's
accessible name so the chip group (*Data*, the mode) and the input (*Data —
dia*) are distinguishable in a forms list, and gives the priority group the
same treatment only if the walk finds the same collision. `CaptureDeck.tsx`
wraps the offline hint in `role="status"` so a screen reader hears why the
field went quiet. `InlineTitle.tsx` keeps its `aria-label` (which already names
the Task) and adds the visible cue the guideline asks for by describing the
editor through the row it replaces — the ruling and its reasoning are recorded
in the walk rather than hidden in a diff. Then
`PRPs/reports/ui-design-pass/phase-4/level-a-walk.md` records all 31 criteria ×
3 screens with a verdict, the evidence (a file:line or a measured value) and an
explicit N/A reason where a criterion cannot apply, and
`PRPs/reports/ui-design-pass/phase-4/build-report.md` carries the gates, the
size table, the §11 probe and a placeholder the main session fills with the
pane's Tier B measurements at 375 px and 1280 px. Finally
`PRPs/reports/ui-design-pass/phase-4/owner-runbook.md` spells out, in pt-BR,
the deploy and the device checks the owner performs, with a box for his verdict
— the only thing that closes A5.

## Metadata

| Key | Value |
|---|---|
| Type | Verification phase: four small accessibility fixes + the Level A record + the phase report and the owner's runbook |
| Complexity | Low for the code, high for the evidence — the deliverable is mostly documentation grounded in measurement |
| Systems Affected | `src/app/components/ui/Toast.tsx`, `src/app/components/TaskSheet.tsx`, `src/app/components/CaptureDeck.tsx`, `src/app/components/InlineTitle.tsx`, `PRPs/reports/ui-design-pass/phase-4/` (three new records) |
| Dependencies | Phase 3 (`implemented`): the three screens as they now stand; phases 1–3's build reports, whose OWED lists this phase closes |
| Estimated Tasks | 5 |
| Source PRD line ref | `PRPs/prds/ui-design-pass.prd.md:416` (Implementation Phases row 4); Phase Details at `:467-470`; the criteria at `:174, 181, 185, 190, 194-195` (AC-1, AC-8, AC-12, AC-17, AC-21, AC-22) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/ui-design-pass.prd.md` | 174, 181, 185, 190, 194-195, 467-470 | The AC text verbatim (AC-1 device, AC-8 targets, AC-12 the sheet on the device, AC-17 the keyboard shell on the phone, AC-21 the Level A walk, AC-22 the gates and the filed record) and this phase's own scope and success signal |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 104-120, 122-133, 144-167 | §10's 31 Level A criteria as this project states them (the walk's checklist, verbatim), §11's budget table with its two Lighthouse rows, and the Tier A / Tier B review checklist the report is written against |
| P0 | `documentation/40-engineering/dev-environment.md` | 66-77, 106-119 | The deploy runbook the owner follows (gates → migrations → `db:migrate:remote` → `npm run deploy`) and the mandatory post-deploy smoke test, both quoted into the owner runbook |
| P0 | `src/app/components/ui/Toast.tsx` | 22-35 | The `role` / `aria-live` pair being fixed, and the icon that already distinguishes an error visually |
| P0 | `src/app/components/TaskSheet.tsx` | 104-126 | The date chip group and the date input, the two controls sharing the name *Data* |
| P0 | `src/app/components/CaptureDeck.tsx` | 88-97 | The offline hint and the inline error, and how the latter already carries `role="alert"` |
| P0 | `src/app/components/InlineTitle.tsx` | 36-55 | The in-place editor: its `aria-label`, its commit rule, and the row context it replaces |
| P1 | `src/app/components/ui/Banner.tsx` | 1-18 | The `role="status"` idiom the deck's hint copies |
| P1 | `src/app/components/TokenGate.tsx` | 33-95 | Screen 1 for the walk: the `<main>`, the single `<h1>`, the visible label, the 401 reason paragraph |
| P1 | `src/app/components/TodayScreen.tsx` | 242-380 | Screen 2 for the walk: the shell, `<main>`, the *Concluídas* disclosure with `aria-expanded`, the toast host, the deck |
| P1 | `src/app/components/TodayHeader.tsx` | 1-26 | The `<header>` landmark and the screen's single `<h1>` |
| P1 | `src/app/components/ui/Sheet.tsx` | 84-110 | Screen 3 for the walk: the native `<dialog>`, `aria-labelledby`, the *Fechar* control, and the close-request contract |
| P1 | `src/app/components/ui/ConfirmView.tsx` | 36-70 | The confirmation's `<h3>`, its focus rule and its two buttons |
| P1 | `src/app/components/TaskRow.tsx` | 63-142 | The row's controls and names, for 1.3.1 / 2.5.3 / 4.1.2 on screen 2 |
| P1 | `PRPs/reports/ui-design-pass/phase-1/build-report.md` | 100-147 | Phase 1's Tier A/B record and its OWED list — the shape this phase's report follows and the gaps it closes |
| P1 | `PRPs/reports/ui-design-pass/phase-2/build-report.md` | 90-214 | Phase 2's record: the same shape, the focus-ring divergence, and its own OWED list |
| P1 | `PRPs/reports/ui-design-pass/phase-3/build-report.md` | 106-224 | Phase 3's record: the Tier A/B section, the two defects it caught, the `cancel`-guard divergence and the device check still owed |
| P1 | `PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md` | 28-58 | The 13 pre-A5 findings; the walk states which are closed and by what |
| P2 | `documentation/50-planning/ui-ux-plan.md` | 56-57, 113 | A5's exit signal (the bar this phase produces evidence for) and A6's close-out scope (what this phase must NOT do, but must leave ready) |
| P2 | `documentation/40-engineering/testing-strategy.md` | 30-40 | Why there is no browser tier and no Lighthouse dependency — the honest framing for the Lighthouse rows of the report |
| P2 | `docs/context/methodology.md` | 30-36 | The "a purely visual PRD produces no test file" path this phase's test pair takes |

## Patterns to Mirror

```tsx
# SOURCE: src/app/components/ui/Banner.tsx:6-12
export function Banner({ lead, body }: { lead: string; body: string }) {
  return (
    <div
      role="status"
      className="flex min-h-12 items-center gap-3 border-b border-line bg-surface-1 px-4 text-t2 text-ink"
    >
      <WifiOff className="size-5 flex-none text-muted" aria-hidden="true" />
```

The announcement idiom for a connectivity state: `role="status"` on the
container, the icon `aria-hidden`, the words carrying the meaning. The capture
deck's offline hint gets the same treatment. Mirrored by Task 3.

```tsx
# SOURCE: src/app/components/ui/Toast.tsx:26-30
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className="flex min-h-12 items-center gap-3 rounded-control border border-line bg-surface-2 px-4 py-2 text-t2 text-ink shadow-row"
    >
```

The pair being fixed: `role="alert"` already implies `aria-live="assertive"`,
and the explicit `polite` overrides it, so the error toast is announced with
the same urgency as *Tarefa salva*. Dropping the attribute restores each
role's own politeness. Edited by Task 1.

```tsx
# SOURCE: src/app/components/CaptureDeck.tsx:90-97
      {!canWrite && (
        <p className="mt-2 font-text text-t1 text-muted">Captura indisponível sem conexão.</p>
      )}
      {error !== null && (
        <p role="alert" className="mt-2 font-text text-t2 text-overdue">
          {error}
        </p>
      )}
```

The two hints under the field: the request error already announces itself, the
offline hint does not — the asymmetry Task 3 removes. Edited by Task 3.

```tsx
# SOURCE: src/app/components/InlineTitle.tsx:36-45
  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
```

The in-place editor whose visible label is the row it replaced. Task 4's
ruling records why that satisfies 3.3.2 (or what it adds if it does not), and
Task 1 leaves the `aria-label` untouched. Read by Task 1 and Task 4.

```tsx
# SOURCE: src/app/components/TodayHeader.tsx:11-15
    <header className="flex items-end gap-3 px-4 pt-6 pb-2">
      <h1 className="m-0 font-text text-t4 font-bold text-ink">Hoje</h1>
      <span className="pb-0.5 font-data text-t1 font-medium text-muted tabular-nums">
        {formatHeaderDate(now)}
      </span>
```

Screen 2's landmark and its single `<h1>` — the 1.3.1 / 2.4.1 evidence the
walk cites verbatim. Read by Task 4.

```markdown
# SOURCE: PRPs/reports/ui-design-pass/phase-3/build-report.md:126-128
| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ the sheet has one primary (*Salvar*) with *Cancelar* beside it and *Excluir* set apart (ghost, `margin-top: 16px`); the gate has one field and one *Salvar*; the confirmation has exactly two buttons |
```

How a Tier A/B row is written in this feature: the verdict glyph, then the
measured evidence, never an adjective on its own. Task 5's report and Task 4's
walk follow this shape. Mirrored by Task 4 and Task 5.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/app/components/ui/Toast.tsx` | UPDATE | Drop the unconditional `aria-live="polite"` so `role="alert"` keeps its implicit `assertive` — the §8 distinction between an error and a confirmation, in the one place it is announced |
| `src/app/components/TaskSheet.tsx` | UPDATE | The date input's accessible name is disambiguated from the date-mode chip group's (both are *Data* today) |
| `src/app/components/CaptureDeck.tsx` | UPDATE | The offline hint gains `role="status"` so the disabled field is explained to a screen reader, as `Banner.tsx` already does one level up |
| `src/app/components/InlineTitle.tsx` | UPDATE | The in-place editor gains the programmatic description 3.3.2 asks for, without adding a visible label the row already provides |
| `PRPs/reports/ui-design-pass/phase-4/level-a-walk.md` | CREATE | The WCAG 2.2 Level A pass guidelines §10 requires once per screen in A5: 31 criteria × 3 screens, each with a verdict and its evidence |
| `PRPs/reports/ui-design-pass/phase-4/build-report.md` | CREATE | The phase record: gates, the `vite build` size table, the §11 probe, and the Tier B section the main session fills from the pane (375 px and 1280 px) |
| `PRPs/reports/ui-design-pass/phase-4/owner-runbook.md` | CREATE | The pt-BR runbook for the only steps this pipeline cannot take: the deploy, the smoke test, the two devices, the back gesture, and the verdict that closes A5 |

## NOT Building (Scope Limits)

- **No deploy.** `npm run deploy` is the owner's, by the PRD's own Phase
  Details. No task runs `wrangler` against production.
- **No A6 work.** The guideline amendments, the roadmap hold lift, the plan's
  flip to `deprecated` and the delivery-history row belong to activity A6;
  this phase only leaves the divergence list and the evidence ready.
- **No new dependency and no browser tier** — Lighthouse is invoked ad hoc by
  the owner from his own Chrome (guidelines §11, testing-strategy.md:37); the
  plan records what cannot be run here rather than installing anything.
- **No behavioural change beyond the four fixes** — no layout, no copy, no
  token, no API, no schema, no service-worker change. The four are ARIA and
  naming only.
- **No authoring or editing of test files.** The `test-writer` /
  `test-reviewer` pair owns `test/` (R-X); this phase adds no decidable logic,
  so the pair is expected to record `EXISTING_COVERAGE_SUFFICIENT`.
- **No fix invented for a criterion the walk finds N/A** — a criterion that
  cannot apply is recorded as N/A with its reason, never "fixed" to look
  complete.

## Step-by-Step Tasks

### Task 1: UPDATE `src/app/components/ui/Toast.tsx`

- **ACTION**: Remove the `aria-live="polite"` attribute from the container
  `<div>` (line 28), leaving `role={isError ? "alert" : "status"}` to carry
  the politeness: `role="alert"` implies `aria-live="assertive"` and
  `role="status"` implies `polite`, and an explicit `aria-live` overrides the
  implicit value — which is why the error toast currently announces no more
  urgently than *Tarefa salva*. Add a comment above the `role` line naming
  the rule ("the role carries the politeness — an explicit aria-live would
  override `alert`'s implicit assertive"). Change nothing else in the file.
- **MIRROR**: `# SOURCE: src/app/components/ui/Toast.tsx:26-30` (the pair
  being fixed).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'role={isError ? "alert" : "status"}' src/app/components/ui/Toast.tsx
  if grep -nF 'aria-live' src/app/components/ui/Toast.tsx; then
    echo "FAIL: the explicit aria-live must be gone so role=alert keeps assertive"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A1.

### Task 2: UPDATE `src/app/components/TaskSheet.tsx`

- **ACTION**: The date-mode `ChipGroup` keeps `label="Data"` (line 110); the
  native date input's `aria-label="Data"` (line 123) becomes
  `aria-label="Data — dia"`, so the two adjacent controls are distinguishable
  by name in a screen reader's forms list (Level A 4.1.2 name/role/value; the
  visible group heading stays *Data* for everyone else). Check the priority
  pair the same way and leave it alone if the chip group's `label="Prioridade"`
  is the only control carrying that name — record which in the task's output,
  and change nothing else in the file.
- **MIRROR**: `# SOURCE: src/app/components/TodayHeader.tsx:11-15` (the
  project's habit of one clear name per element).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'label="Data"' src/app/components/TaskSheet.tsx
  grep -qF 'aria-label="Data — dia"' src/app/components/TaskSheet.tsx
  if [ "$(grep -cF 'aria-label="Data"' src/app/components/TaskSheet.tsx)" != "0" ]; then
    echo "FAIL: two controls still share the accessible name Data"; exit 1
  fi
  npx tsc -b
  ```
- Delivers AC-A2.

### Task 3: UPDATE `src/app/components/CaptureDeck.tsx`

- **ACTION**: Wrap the offline hint (line 91) so it is announced when it
  appears: `<p role="status" className="mt-2 font-text text-t1 text-muted">Captura indisponível sem conexão.</p>`
  — the same idiom `Banner.tsx:9` uses for the identical connectivity state,
  and the counterpart of the request error's `role="alert"` two lines below.
  Add a short comment naming why (the field goes disabled with no other
  signal). Change nothing else: the copy, the classes and the `!canWrite`
  condition stay byte-identical.
- **MIRROR**: `# SOURCE: src/app/components/ui/Banner.tsx:6-12` (the
  announcement idiom).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'role="status"' src/app/components/CaptureDeck.tsx
  grep -qF 'Captura indisponível sem conexão.' src/app/components/CaptureDeck.tsx
  grep -qF 'role="alert"' src/app/components/CaptureDeck.tsx
  npx tsc -b
  ```
- Delivers AC-A3.

### Task 4: UPDATE `src/app/components/InlineTitle.tsx` and CREATE `PRPs/reports/ui-design-pass/phase-4/level-a-walk.md`

- **ACTION**: In `InlineTitle.tsx`, keep the existing
  `aria-label={`Editar título de ${task.title}`}` (line 52) and add
  `aria-describedby` pointing at a visually-hidden `<span>` rendered beside
  the input carrying *Enter salva, Esc cancela.* — the instruction guidelines
  §10 3.3.2 asks for, given the editor replaces the row's own visible title
  and cannot carry a second visible label without duplicating it. Use
  `className="sr-only"` only if that utility already exists in the project;
  otherwise inline the standard clip pattern in the component's class list
  (`absolute -m-px h-px w-px overflow-hidden [clip-path:inset(50%)]`) — no new
  CSS file, no new token. Then write the walk record with: a header naming the
  date, the three screens, the criteria source (guidelines §10) and the method
  (source read + the browser-pane measurements of phases 1–3 and this phase);
  one table per screen with a row for every one of the 31 Level A criteria —
  the criterion id and name, the verdict (`✔` / `✘` / `n/a`), and the evidence
  as a `file:line` or a measured value, never an adjective alone; an explicit
  reason on every `n/a` (the media criteria 1.2.x, 1.4.2, 2.3.1 and 2.5.4 are
  vacuous here — no media, no flashing, no motion actuation — and 2.1.4 has no
  single-key shortcut to switch off); a section listing the four findings of
  this phase with what Tasks 1–4 did about each, including the 3.3.2 ruling
  for the inline editor written out in full; and a closing section mapping the
  13 findings of `PRPs/reports/ui-ux-guidelines/checklist-run-2026-08-19.md`
  to the phase that closed each, with the one still open (the Android back
  gesture) named as the owner's check. Anything the walk cannot decide from
  source or from an existing measurement is listed as owed to the pane or the
  device, never guessed.
- **MIRROR**: `# SOURCE: PRPs/reports/ui-design-pass/phase-3/build-report.md:126-128`
  (the verdict-plus-evidence row shape).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  grep -qF 'aria-describedby' src/app/components/InlineTitle.tsx
  grep -qF 'Enter salva, Esc cancela.' src/app/components/InlineTitle.tsx
  grep -qF 'aria-label={`Editar título de ${task.title}`}' src/app/components/InlineTitle.tsx
  test -f PRPs/reports/ui-design-pass/phase-4/level-a-walk.md
  grep -qF '1.3.1' PRPs/reports/ui-design-pass/phase-4/level-a-walk.md
  grep -qF '4.1.2' PRPs/reports/ui-design-pass/phase-4/level-a-walk.md
  grep -qF '3.3.2' PRPs/reports/ui-design-pass/phase-4/level-a-walk.md
  grep -qF 'checklist-run-2026-08-19' PRPs/reports/ui-design-pass/phase-4/level-a-walk.md
  npx tsc -b
  ```
- Delivers AC-A4 and AC-A5.

### Task 5: RUN the gates and CREATE the phase record and the owner runbook

- **ACTION**: Run `npm run check`, `npm test` and `npm run build` and confirm
  all three green — a failure is fixed in production code, never in a test.
  Measure the built bundle with the §11 probe below and write
  `PRPs/reports/ui-design-pass/phase-4/build-report.md` in the shape of
  phase 3's: the gates, the `vite build` size table, the probe output with the
  delta against phase 3's 92,902 B JS / 7,756 B CSS gzip, the structural gate,
  and a clearly marked **placeholder** section for the browser-pane Tier B
  measurements (375 px and 1280 px, contrast, the states) that the main
  session fills after this run — do not invent them. Then write
  `PRPs/reports/ui-design-pass/phase-4/owner-runbook.md`, in pt-BR, as a
  numbered checklist the owner can follow without reading anything else:
  (1) the gates he can re-run himself (`npm run check`, `npm test`);
  (2) the deploy, quoting `documentation/40-engineering/dev-environment.md:70-77`
  — with the explicit note that **this feature adds no migration**, so
  `npm run db:migrate:remote` is a no-op this time and `npm run deploy` is the
  only command that changes production; (3) the post-deploy smoke test of
  `dev-environment.md:106-119`; (4) the phone checks, each as one line with
  what to look for: the cold start showing `#161012` with no white flash
  (AC-1), the capture field and the keyboard (AC-17), the row targets (AC-8),
  the sheet opening and **the back gesture closing it without leaving the app**
  (AC-12, PRD Open Question 1) and the back gesture on the confirmation
  closing the sheet without deleting, plus the note that if the gesture leaves
  the app the fallback in `Sheet.tsx` is switched on and the check repeated;
  (5) the same screens on the Windows PC at a wide window, where the sheet
  should be a centred 560 px card rather than a bottom sheet; (6) optional
  Lighthouse from his own Chrome (`chrome://inspect` for the phone, or
  DevTools → Lighthouse on the deployed URL) with the §11 targets quoted, and
  the plain statement that no Lighthouse tooling is installed in the repo and
  none will be; (7) a place for his verdict — "nada a mudar antes da unidade
  3" or the list of what to change — and the note that his answer is what
  closes A5 and releases A6.
- **MIRROR**: `# SOURCE: PRPs/reports/ui-design-pass/phase-3/build-report.md:126-128`
  (the record's row shape).
- **VALIDATE**:
  ```bash
  set -euo pipefail
  npm run check
  npm test
  npm run build
  node --input-type=module -e '
  import { readdirSync, readFileSync } from "node:fs";
  import { join } from "node:path";
  import { gzipSync } from "node:zlib";
  const dir = "dist/client/assets";
  let js = 0, css = 0;
  for (const f of readdirSync(dir)) {
    const size = gzipSync(readFileSync(join(dir, f))).length;
    if (f.endsWith(".js")) js += size;
    if (f.endsWith(".css")) css += size;
  }
  console.log(`JS ${js} B gzip (budget 174080) · CSS ${css} B gzip (budget 30720)`);
  if (js > 174080 || css > 30720) { console.error("FAIL: guidelines §11 budget exceeded"); process.exit(1); }
  console.log("PASS: inside the §11 budget");
  '
  test -f PRPs/reports/ui-design-pass/phase-4/build-report.md
  test -f PRPs/reports/ui-design-pass/phase-4/owner-runbook.md
  grep -qF 'npm run deploy' PRPs/reports/ui-design-pass/phase-4/owner-runbook.md
  grep -qF 'db:migrate:remote' PRPs/reports/ui-design-pass/phase-4/owner-runbook.md
  if grep -rn 'wrangler deploy' --include='*.sh' --include='*.mjs' --include='*.js' scripts/ 2>/dev/null; then
    echo "FAIL: the deploy is the owner's — no script in this phase may run it"; exit 1
  fi
  ```
- Delivers AC-A6 and AC-A7. This task changes no source file; its only writes
  are the two phase records — it is the gate and hand-over step of the phase.

## Validation Commands

**Level 1 — STATIC_ANALYSIS**

```bash
set -euo pipefail
npm run check
```

`npm run check` is `wrangler types --check && tsc -b && eslint . && prettier --check .`
(`package.json`); each stage exits non-zero on failure and `&&` propagates.

**Level 2 — UNIT TESTS**

```bash
set -euo pipefail
npx vitest run --project worker
npx vitest run --project docs
```

`vitest run` exits non-zero when any test fails. This phase adds no decidable
logic, so the corpus is expected to stay at its phase-3 size (313 across both
projects); the `docs` project guards the derived docs.

**Level 3 — BUILD + STRUCTURAL GATE**

```bash
set -euo pipefail
npm run build
node --input-type=module -e '
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
let js = 0, css = 0;
for (const f of readdirSync("dist/client/assets")) {
  const size = gzipSync(readFileSync(join("dist/client/assets", f))).length;
  if (f.endsWith(".js")) js += size;
  if (f.endsWith(".css")) css += size;
}
if (js > 174080 || css > 30720) { console.error(`FAIL: JS ${js} / CSS ${css} gzip over budget`); process.exit(1); }
console.log(`PASS: JS ${js} B gzip, CSS ${css} B gzip`);
'
if grep -rn "style={" src/app --include="*.tsx" | grep -v "DesignPlayground.tsx"; then
  echo "FAIL: an inline style object survived outside the playground (PRD AC-2)"; exit 1
fi
if grep -rnF "aria-live" src/app/components/ui/Toast.tsx; then
  echo "FAIL: the toast's politeness must come from its role alone"; exit 1
fi
grep -qF 'role="status"' src/app/components/CaptureDeck.tsx
grep -qF 'aria-label="Data — dia"' src/app/components/TaskSheet.tsx
grep -qF 'aria-describedby' src/app/components/InlineTitle.tsx
test -f PRPs/reports/ui-design-pass/phase-4/level-a-walk.md
test -f PRPs/reports/ui-design-pass/phase-4/build-report.md
test -f PRPs/reports/ui-design-pass/phase-4/owner-runbook.md
if grep -rlF 'tokens e estados' dist/client >/dev/null; then
  echo "FAIL: the /design playground leaked into the production bundle"; exit 1
fi
```

`npm run build` stays the real Level 3. The greps pin this phase's four fixes
and the three records. **The device pass itself is NOT covered by any command
here**: the browser-pane Tier B measurements are the main session's, and the
deploy and the two-device verdict are the owner's — see `## Notes`.

## Acceptance Criteria

- **AC-A1 (PRD AC-21):** the toast's politeness comes from its role alone —
  `role="alert"` for an error (implicitly assertive) and `role="status"` for a
  confirmation (implicitly polite); no `aria-live` attribute remains in
  `Toast.tsx` to override either.
- **AC-A2 (PRD AC-21):** no two controls on the detail sheet share an
  accessible name: the date-mode group is *Data* and the date input is
  *Data — dia* (Level A 4.1.2).
- **AC-A3 (PRD AC-21):** the capture deck's offline hint is announced when it
  appears (`role="status"`), like the banner one level up and like the request
  error beside it.
- **AC-A4 (PRD AC-21):** the inline title editor carries both its
  `aria-label` naming the Task and an `aria-describedby` instruction
  (*Enter salva, Esc cancela.*), and the walk records the 3.3.2 ruling that
  the row's own visible title is the editor's visible label.
- **AC-A5 (PRD AC-21):** `PRPs/reports/ui-design-pass/phase-4/level-a-walk.md`
  records all 31 Level A criteria against each of the three screens with a
  verdict and its evidence, an explicit reason on every `n/a`, the four
  findings of this phase and their resolutions, and the 2026-08-19 findings
  list mapped to the phase that closed each.
- **AC-A6 (PRD AC-22):** `npm run check`, `npm test` and `npm run build` are
  green with no test weakened, and
  `PRPs/reports/ui-design-pass/phase-4/build-report.md` carries the size
  table, the §11 probe with its delta against phase 3, and the Tier B section
  the main session fills from the pane (375 px **and 1280 px**, the first time
  the wide width is measured in this feature).
- **AC-A7 (PRD AC-1, AC-8, AC-12, AC-17):**
  `PRPs/reports/ui-design-pass/phase-4/owner-runbook.md` gives the owner, in
  pt-BR, the numbered steps that only he can take — the gates, the deploy
  (with the no-migration note), the smoke test, the phone checks including the
  back gesture on the sheet and on the confirmation, the PC check at a wide
  window, the optional Lighthouse with the §11 targets, and the box for the
  verdict that closes A5.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dropping `aria-live` changes nothing because the toast mounts before the role is read | Low | Low | The toast element is created when the toast appears, so the role is present at insertion — which is when a live region announces; the pane check re-reads `role` and the absence of `aria-live` after the change |
| The `sr-only` class does not exist and the inlined clip pattern collides with Tailwind's utilities | Medium | Low | Task 4 checks for the utility first and otherwise uses the arbitrary-property form, which Tailwind emits verbatim; `npm run build` and the pane both confirm the span is not visible |
| The walk turns into an adjective list rather than evidence | Medium | High — it is the phase's main deliverable | Every row must carry a `file:line` or a measured value; the VALIDATE greps require the criterion ids, and the Tier A/B row shape of phase 3 is the mirrored pattern |
| The owner cannot run Lighthouse and the §11 rows stay empty | Medium | Low | The runbook marks it optional and quotes the targets; the report records "not run, and why" — guidelines §11 asks for the number when a screen is new, not for a tool in the repo |
| A criterion is marked `n/a` to avoid work | Low | High | Each `n/a` carries a reason, and the six vacuous ones are named in advance (1.2.x, 1.4.2, 2.3.1, 2.5.4, and 2.1.4 with no single-key shortcut) — anything else claiming `n/a` is a review finding |
| The device pass finds something that needs a code change | Medium (by design) | Medium | That is what the phase is for: the fix rides in a new attempt of this same plan, as phases 2 and 3 did, and the record names it |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

- **Test-file routing:** this phase adds **no decidable logic** — the four
  fixes are ARIA attributes and one accessible name, and the three
  deliverables are records. `docs/context/methodology.md:30-36` names exactly
  this case: "A PRD whose acceptance criteria are purely visual produces no
  test file — that is the `EXISTING_COVERAGE_SUFFICIENT` / no-test-required
  path, not a violation." The pair is expected to write only the suite
  manifest with that aggregate verdict and to leave every existing suite
  untouched; `test/` stays at its phase-3 shape (14 files, 313 cases). No task
  above targets a test file (R-X).
- **Manual verification script (main session, after Task 5, recorded in the
  phase-4 build report):** (1) `/design` at 375 px — re-read the four fixed
  points: `Toast` has `role` and no `aria-live`, the deck's hint has
  `role="status"`, the sheet's two date controls have distinct names, the
  inline editor has both `aria-label` and `aria-describedby` and the
  description is not visible; (2) **1280 px** — the first wide measurement of
  this feature: the column cap (`max-w-[640px]` on the shell,
  `max-w-[560px]` on the gate and the playground), the sheet as a centred
  560 px card with `sm:rounded-card`, no stretched row, no horizontal
  overflow; (3) contrast of the pairs §4.3 names on whichever surface changed;
  (4) the §8 states once more on the playground; (5) a screenshot at each
  width, or the written reason none exists — the pane has not composited a
  frame in any phase of this feature, so the reason is likely the same and
  must be stated again, never implied.
- **What only the owner can do** (`owner-runbook.md` is the artefact): the
  deploy, the post-deploy smoke test, the Android phone (cold start, keyboard,
  targets, the sheet and **the back gesture**), the Windows PC, the optional
  Lighthouse, and the verdict. A5's exit signal is his sentence, not a green
  suite — the PRD says so, and this plan does not pretend otherwise.
- **Divergences to hand to A6** (collected across the four phases, recorded
  here so A6 has one list): (a) layout standard §2.6 "title on one line" vs
  guidelines §12.4 "two lines then ellipsis" — the guidelines won, with
  `line-clamp-2`; (b) standard §2.7's empty state without a duplicate button
  vs the approved microcopy's *Nova tarefa* CTA — the PRD won; (c) the
  `:has()` rule is anchored on the shell, not `:root`, on MDN's advice; (d)
  `--color-faint` is a UI-only colour (4.36:1 on `surface-2`), never body
  text; (e) phase 2's plan text carried `outline-none` on two inputs — the
  measured focus ring superseded it; (f) phase 3's plan said "no `onCancel`
  handler" — a measured close-request failure superseded it, with the control
  experiment recorded; (g) the standard says "centred at 560 px from 600 dp"
  while the code breaks at Tailwind's `sm` (640 px); (h) no `.claude/settings.json`
  exists, so `/relay-test` was hand-run in every phase, with `run.json`
  written by hand each time.
- **Research grounding.** `research-codebase` returned 8 findings (scope cap
  reached; every `# SOURCE:` anchor above was re-opened at the cited lines in
  the main session — `Toast.tsx` 26-30, `InlineTitle.tsx` 36-52,
  `CaptureDeck.tsx` 88-96, `TaskSheet.tsx` 104-126, `TodayHeader.tsx` 11-13,
  `Sheet.tsx` 84-110, `TokenGate.tsx` 33-95, `TodayScreen.tsx` 242-380,
  `ConfirmView.tsx` 36-70, `Banner.tsx` 6-12, `Chip.tsx` 28): the deploy
  runbook and its gate order (`dev-environment.md:70-77`), that only
  `API_BEARER_TOKEN` is provisioned and the VAPID keys belong to unit 6
  (`roadmap.md:118`), that no Lighthouse tooling and no browser tier exist
  (`testing-strategy.md:37`, `ui-ux-plan.md:113`), that 12 of the 13
  2026-08-19 findings are closed by phases 1–3 with the Android back gesture
  the only one still owed, and the four ARIA/labelling cases Tasks 1–4 fix.
  Gaps it recorded: no `<nav>` landmark exists in any screen (the walk
  confirms `header` + `main` satisfy 2.4.1 for a single-screen model); 1280 px
  was never measured; no screenshot exists for any phase; the back gesture has
  only ever been reasoned about, never observed on the device; and no
  Lighthouse run is recorded for phases 1–3. **No web research was dispatched
  for this phase**: it introduces no new platform API — the two ARIA rules it
  applies (a role's implicit `aria-live`, and one accessible name per control)
  are already stated in guidelines §10, and the deploy path is internal
  documentation.
- **Not changed in this phase, on purpose:** every other file under `src/`,
  `documentation/` (A6 owns the doc close-out), `test/`, `public/`,
  `index.html`, `wrangler.jsonc`, `package.json` and the service worker.

*Generated: 2026-08-22*
*Approved: 2026-08-22*
*Implemented: 2026-08-22*
*Status: IMPLEMENTED*
