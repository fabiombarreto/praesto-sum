# Feature: The switch and the proof (Phase 4 of repeated-miss-nudge)

```
**Decision Gate**
- Active context: none
- Activated criteria: any change under `src/app/` (mandatory UI/UX guidelines and review checklist); a wire addition (`nudgeMuted` on `SeriesAdherenceDto`); domain rules for tasks (Recurrence Series, the series section of the Task sheet) and reminders (muting touches no Reminder); a manual device proof
- Decisions found:
  - ADR-0009 — visible copy pt-BR, code, identifiers, comments and tests English
  - ADR-0010 / ADR-0011 — tokens only (`src/app/tokens.css`) and the owned UI library under `src/app/components/ui/`; no new token, no new dependency
  - ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation, missed recording — the series record is derived from real rows; the switch edits an owner preference, never the record
  - ADR-0003 — one Worker, no offline writes: the switch waits for the server (guidelines §8 "Pending request")
  - PRD repeated-miss-nudge D-E (silencing is per series, persistent, through the series PATCH, in the sheet where the owner lands), D-F (the sheet already hosts *Encerrar repetição* and the rule editor), D-I (a muted run is consumed), D-J (vocabulary *não concluída*)
- Applicable anti-patterns:
  - Hand-duplicated entity types (`nudgeMuted` on the adherence wire is mapped in `src/worker/dto.ts` from the schema row, declared once in `src/shared/api.ts`)
  - Glossary synonym drift (the copy says *não concluídas* and *avisos*, never "falha", "falhando" or "pulada")
  - Portuguese in artifacts (copy values pt-BR; identifiers, comments and file names English)
  - Weakening tests to force green (the test pair owns every test file; no task here touches one)
  - Editing accepted ADRs (append-only; none touched)
  - Claiming a screenshot or a live pass that was not taken (guidelines §12.6 — the checklist records what was actually run)
- Applicable architectural rules:
  - `src/shared/` stays free of DOM/Worker globals; every string a state *chooses* between lives there behind a pure function the test pair can pin (guidelines §12.3, methodology "split the logic out, then the glue is exempt")
  - Types flow from `src/worker/db/schema.ts` through `src/worker/dto.ts` to `src/shared/api.ts`
  - UI components have no component tests by project methodology ("UI stays manually verified"); decidable UI logic therefore lives in pure `src/shared` helpers
  - `src/shared/recurrence.ts`, `src/shared/adherence.ts`, `src/shared/nudge.ts` and `src/shared/nudge-copy.ts` stay byte-unchanged
  - Every API route stays behind the bearer gate (no route is added; the existing series PATCH carries the write)
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/repeated-miss-nudge.prd.md` — Implementation Phases row 4: "The switch and the proof" — Goal: the owner can silence one series where he lands, and the unit is observed working — Success signal: AC-15, AC-16 recorded; AC-17 observed on the owner's device.

## Summary

This phase puts the nudge's per-series mute in the owner's hands and makes the unit observable. The series section of the Task sheet (the occurrence of an active series) gains a native switch that shows the nudge state in pt-BR and persists immediately through the existing `PATCH /api/series/:id` `{ nudgeMuted }` — outside the Task draft and *Salvar*; it is absent for a one-off Task and for an occurrence of an ended series. The *Aderência* route's series rows say *Avisos silenciados* for a muted series, which needs `nudgeMuted` on `SeriesAdherenceDto`. What the screens say and when the switch exists is decided by two pure `src/shared` helpers, so the test pair covers it without a component test. The UI/UX review checklist result is recorded under `PRPs/reports/repeated-miss-nudge/phase-4/`, and a device-proof template (status OWED) carries the AC-17 procedure for the owner.

## User Story

As the owner of Praesto Sum
I want to silence the repeated-miss notification for one series from the sheet the notification opens, and see which series I silenced
So that a commitment I have decided to let go stops notifying me without touching any of my Reminders.

## Problem Statement

Phases 1-3 deliver the pure decision, the persisted `nudge_muted` column with its PATCH, and the cron step that sends one push per run. The owner still has no way to reach the switch: the only control that exists is an API field. The notification lands him on the open occurrence's sheet precisely so he can replan, end or accept the pattern; "accept and silence" needs a control there, and a silenced series must stay legible on the screen where he reviews his series. Without both, the exit signal's second half ("silenced that series without losing the other reminders") cannot be exercised, and the unit cannot be observed working.

## Solution Statement

One pure module `src/shared/nudge-switch.ts` owns the switch's visibility rule, its pt-BR label and status text, the `Avisos silenciados` wording and the PATCH body. `useSeriesSheet` (shared by *Hoje* and search, so the two sheets cannot drift) gains the immediate, server-first persistence with its own pending and error state; `TaskSheet` renders a native `<input type="checkbox" role="switch">` inside the active-series branch of the series section. `adherence-view.ts` gains `formatNudgeMuted`, and the route row renders it. `SeriesAdherenceDto` gains `nudgeMuted`, mapped by `toSeriesAdherenceDto`. No new route, dependency, token or primitive.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT (UI over shipped wire + one wire addition) |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/api.ts`, `src/worker/dto.ts`, `src/shared/nudge-switch.ts` (new), `src/shared/adherence-view.ts`, `src/app/hooks/useSeriesSheet.ts`, `src/app/components/TaskSheet.tsx`, `TodayScreen.tsx`, `SearchScreen.tsx`, `DesignPlayground.tsx`, `AdherenceScreen.tsx`, two report files |
| Dependencies | Phase 2 (`nudgeMuted` on `SeriesDto`, `UpdateSeriesInput.nudgeMuted`, the PATCH allowlist); phase 3 (the cron that makes the switch meaningful); no new package, no migration, no token |
| Estimated Tasks | 12 |
| Source PRD line ref | `PRPs/prds/repeated-miss-nudge.prd.md` Implementation Phases row 4; AC-15, AC-16, AC-17; D-E, D-F, D-I, D-J |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|----------|------|-------|-----|
| P0 | `PRPs/prds/repeated-miss-nudge.prd.md` | 133-144, 186-193, 286-291, 296-308 | AC-15/16/17 text, the MoSCoW rows for the mute UI and the Aderência state, the phase scope and D-E/D-F/D-I/D-J |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 75-103, 105-119, 136-168 | MANDATORY on every `src/app/` change: states (§8), copy and voice (§9), accessibility (§10), components and code (§12), and the Tier A/B review checklist this phase must run and record |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 39-43, 55-66 | The sheet is a native `<dialog>` and never stacks; the detail content order; where adherence lives (a settings-level route) |
| P0 | `src/app/components/TaskSheet.tsx` | 369-579 | The occurrence block: the series section, its three states (error / loading / ended / active) and where the new control goes |
| P0 | `src/app/hooks/useSeriesSheet.ts` | 1-80 | The series side of the sheet, shared by *Hoje* and search; the effect that resets per-Task state; `acceptSeries` re-seeds the rule draft (the new write must NOT use it) |
| P0 | `src/shared/api.ts` | 351-398 | `UpdateSeriesInput.nudgeMuted`, `SeriesDto`, and `SeriesAdherenceDto` (the interface that gains `nudgeMuted`) |
| P0 | `src/worker/dto.ts` | 123-148 | `seriesWireFields` / `toSeriesDto` (already carry `nudgeMuted`) and `toSeriesAdherenceDto` (the mapper that gains it) |
| P1 | `src/shared/adherence-view.ts` | 39-60 | The row formatters the new `formatNudgeMuted` sits beside; zero-and-plural conventions |
| P1 | `src/app/components/AdherenceScreen.tsx` | 29-47 | The series row the muted state is added to |
| P1 | `src/app/components/TodayScreen.tsx` | 291-295, 691-701, 1196-1209 | `useSeriesSheet(sheetTask)` call, the existing `updateSeries` write path for *Encerrar repetição*, and the `TaskSheet` series props |
| P1 | `src/app/components/SearchScreen.tsx` | 88-93 | The second `useSeriesSheet` call site and its `onUnauthorized` |
| P1 | `src/app/components/DesignPlayground.tsx` | 362-400 | The dev-only third `TaskSheet` call site (props all stubbed) |
| P1 | `src/shared/nudge.ts` | 14-18 | `NUDGE_THRESHOLD` (3) — the number the switch's label states; imported, never re-declared (read only) |
| P1 | `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md` and `device-proof.md` | whole file | The shape of a recorded checklist (what "pending live check" and "owed to the owner's device" mean) and of a device-proof file |
| P1 | `docs/context/testing.md` | whole file | The mandatory test guardrail this phase's final report must answer |

## Patterns to Mirror

```tsx
// SOURCE: src/app/components/TaskSheet.tsx:393-403
              {seriesError !== null ? (
                <p role="alert" className="m-0 font-text text-t2 text-overdue">
                  {seriesError}
                </p>
              ) : series === null || seriesRuleDraft === null ? (
                <p className="m-0 font-text text-t2 text-muted">Carregando repetição…</p>
              ) : series.status === "ended" ? (
                <p className="m-0 font-text text-t2 text-muted">
                  Repetição encerrada — nenhuma nova ocorrência será criada.
                </p>
              ) : (
```
Copied by Task 6 (the control is rendered only in the final, active-series branch; the ended and loading branches stay as they are, which is what makes it absent for an ended series).

```tsx
// SOURCE: src/app/components/TaskSheet.tsx:527-536
                  <p className="m-0 font-text text-t1 text-muted">
                    Mudanças na repetição valem a partir da próxima ocorrência. Esta continua na
                    data atual.
                  </p>

                  {seriesRuleError !== null && (
                    <p role="alert" className="m-0 font-text text-t2 text-overdue">
                      {seriesRuleError}
                    </p>
                  )}
```
Copied by Task 6 (the inline-error idiom — `role="alert"`, `text-overdue`, `text-t2` — and the exact insertion point: directly after this block, before the *Encerrar repetição* confirmation).

```ts
// SOURCE: src/app/hooks/useSeriesSheet.ts:43-65
  useEffect(() => {
    setSeries(null);
    setSeriesError(null);
    setRuleDraft(null);
    setApplyTo("series");
    if (seriesId === null) return;

    let cancelled = false;
    getSeries(seriesId)
      .then((loaded) => {
        if (cancelled) return;
        setSeries(loaded);
        setRuleDraft(seriesRuleDraftFromSeries(loaded));
      })
      .catch(() => {
        // Not swallowed: the sheet shows this in place of the rule controls, and
        // the rest of the sheet keeps working on the occurrence itself.
        if (!cancelled) setSeriesError("Não foi possível carregar a repetição desta tarefa.");
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, seriesId]);
```
Copied by Task 5 (the per-Task reset effect the new pending/error state joins, and the "ignore a result that arrives after the sheet moved on" discipline).

```ts
// SOURCE: src/app/components/TodayScreen.tsx:691-701
  /** Ends the series: this occurrence stays, no new one will be created. Irreversible. */
  function endSheetSeries(): void {
    const series = seriesSheet.series;
    if (sheetTask === null || series === null) return;
    const id = sheetTask.id;
    void runSheet(async () => {
      seriesSheet.acceptSeries(await updateSeries(series.id, { status: "ended" }));
      dispatchSheet({ type: "saved", taskId: id });
      showToast({ key: "series-ended", text: "Repetição encerrada" });
    });
  }
```
Copied by Task 5 (the series PATCH call shape — `updateSeries(series.id, body)` returning the fresh `SeriesDto` — without its `runSheet`/`dispatchSheet` closing, which would shut the sheet).

```tsx
// SOURCE: src/app/components/TodayScreen.tsx:1201-1208
        series={seriesSheet.series}
        seriesError={seriesSheet.seriesError}
        seriesRuleDraft={seriesSheet.ruleDraft}
        onSeriesRuleDraftChange={seriesSheet.changeRuleDraft}
        applyTo={seriesSheet.applyTo}
        onApplyToChange={seriesSheet.setApplyTo}
        onSaveSeriesOccurrence={saveSeriesOccurrence}
        onEndSeries={endSheetSeries}
```
Copied by Tasks 7, 8 and 9 (the series prop block of the `TaskSheet` call sites; the new `nudge` prop is added directly after `onEndSeries`).

```ts
// SOURCE: src/shared/adherence-view.ts:39-48
/** `<done> de <closed> feitas`, with zero closed special-cased. */
export function formatDoneOfClosed(done: number, closed: number): string {
  if (closed === 0) return "Nenhuma ocorrência concluída ainda";
  return `${done} de ${closed} feitas`;
}

/** The current streak of completed occurrences. */
export function formatStreak(currentStreak: number): string {
  return currentStreak >= 1 ? `Sequência atual: ${currentStreak}` : "Sem sequência";
}
```
Copied by Tasks 3 and 4 (a pure, DOM-free formatter returning the pt-BR string; one-line doc comment; no clock).

```tsx
// SOURCE: src/app/components/AdherenceScreen.tsx:35-43
        {series.map((s) => (
          <li key={s.seriesId} className="flex flex-col gap-1 rounded-card bg-surface-1 p-4">
            <p className="m-0 font-text text-t3 font-semibold text-ink">{seriesDisplayTitle(s)}</p>
            <p className="m-0 font-data text-t2 text-ink">
              {formatDoneOfClosed(s.done, s.closed)} · {formatStreak(s.currentStreak)}
            </p>
            <p className="m-0 font-data text-t2 text-muted">{formatMissDates(s.recentMisses)}</p>
          </li>
        ))}
```
Copied by Task 10 (the row; the muted state is one more plain-text line in the same classes, rendered only when `formatNudgeMuted` returns a string).

```ts
// SOURCE: src/worker/dto.ts:134-148
/** Maps a series row plus its computed adherence for `/api/series/adherence`; a missing title becomes `""`. */
export function toSeriesAdherenceDto(
  row: RecurrenceSeries,
  adherence: SeriesAdherence,
): SeriesAdherenceDto {
  return {
    seriesId: row.id,
    title: row.title ?? "",
    status: row.status,
    done: adherence.done,
    closed: adherence.closed,
    currentStreak: adherence.currentStreak,
    recentMisses: adherence.recentMisses,
  };
}
```
Copied by Task 2 (field-by-field mapping from the row so schema drift is a compile error).

```ts
// SOURCE: src/shared/api.ts:377-391
/** One Recurrence Series' record, derived from its real occurrence rows (adherence-mirror, ADR-0006). */
export interface SeriesAdherenceDto {
  seriesId: string;
  /** Empty string when the series has no title. */
  title: string;
  status: "active" | "ended";
  /** Occurrences completed. */
  done: number;
  /** Occurrences closed: `done` plus `missed`. */
  closed: number;
  /** Trailing consecutive `done` occurrences; 0 if the latest closed one is `missed`. */
  currentStreak: number;
  /** Local `YYYY-MM-DD` days of recent misses in the series' own time zone, newest first. */
  recentMisses: string[];
}
```
Copied by Task 1 (the interface that gains one documented field).

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/shared/api.ts` | UPDATE | `SeriesAdherenceDto` gains `nudgeMuted: boolean` — the only wire addition of the phase (AC-A3) |
| `src/worker/dto.ts` | UPDATE | `toSeriesAdherenceDto` maps `row.nudgeMuted` (AC-A3) |
| `src/shared/nudge-switch.ts` | CREATE | Pure: the switch's visibility rule, pt-BR label and status text, the `Avisos silenciados` wording and the PATCH body (AC-A1, AC-A2) |
| `src/shared/adherence-view.ts` | UPDATE | `formatNudgeMuted(nudgeMuted)` for the row's muted state (AC-A3) |
| `src/app/hooks/useSeriesSheet.ts` | UPDATE | Immediate, server-first persistence of the switch with its own pending/error state, shared by *Hoje* and search (AC-A2) |
| `src/app/components/TaskSheet.tsx` | UPDATE | Render the switch in the active-series branch of the series section (AC-A1, AC-A2) |
| `src/app/components/TodayScreen.tsx` | UPDATE | Pass `onUnauthorized` to the hook and the nudge control to `TaskSheet` |
| `src/app/components/SearchScreen.tsx` | UPDATE | Same wiring for the search sheet |
| `src/app/components/DesignPlayground.tsx` | UPDATE | The dev-only `TaskSheet` call site gets the new required prop (stubbed) so the project still compiles |
| `src/app/components/AdherenceScreen.tsx` | UPDATE | Render *Avisos silenciados* in a muted series' row (AC-A3) |
| `PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md` | CREATE | The recorded ✔/✘ Tier A/B result (AC-A4, PRD AC-16) |
| `PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md` | CREATE | The AC-17 procedure, status OWED (AC-A5) |

## NOT Building (Scope Limits)

- Any edit to `documentation/` or `docs/` (`docs/api-reference.md`, `docs/domain/areas/tasks.md`, `docs/context/architecture.md`, the layout standard, the roadmap Delivery history): the orchestrator and the owner close the unit and own the docs sync; the Notes list what each doc needs.
- Authoring or editing any test file: the test pair (`test-writer`/`test-reviewer`) owns them, including the extension of the adherence endpoint and adherence-view suites.
- A change to `src/shared/nudge.ts`, `src/shared/nudge-copy.ts`, `src/shared/recurrence.ts` or `src/shared/adherence.ts`; the threshold, the 09:00 gate and the wording of the notification are phases 1 and 3's.
- A component test, a browser tier or a new test harness (rejected at its own trigger; "UI stays manually verified").
- A new UI primitive (`ui/Switch.tsx`), a new dependency, a new design token or a new route: the control is a native element styled with existing token classes.
- Silencing from the notification itself, snooze, a global mute, a configurable threshold, or a "nudge now" action (PRD "What We're NOT Building").
- Any change to Reminders, the cron, the PATCH route or the schema (phases 2 and 3 delivered them).
- Marking AC-17 observed: the device proof is the owner's and stays `OWED` until he records it.

## Step-by-Step Tasks

### Task 1: UPDATE src/shared/api.ts

**ACTION**: In `SeriesAdherenceDto`, add one field after `recentMisses`, with this exact doc comment and declaration: `/** The owner silenced this series' repeated-miss nudge. */` then `nudgeMuted: boolean;`. Change nothing else in the file. The compile is intentionally red for `src/worker/dto.ts` until Task 2 lands. Delivers AC-A3 (PRD AC-15: the *Aderência* route can mark a silenced series, which requires the datum on the wire).
**MIRROR**: `src/shared/api.ts:377-391` (Patterns to Mirror — the interface that gains one documented field).
**VALIDATE**: `node -e "const s=require('fs').readFileSync('src/shared/api.ts','utf8');const m=/export interface SeriesAdherenceDto \{[\s\S]*?\n\}/.exec(s);if(m===null||!m[0].includes('nudgeMuted: boolean;')){console.error('FAIL: nudgeMuted missing from SeriesAdherenceDto');process.exit(1)}console.log('PASS: SeriesAdherenceDto carries nudgeMuted')"`

### Task 2: UPDATE src/worker/dto.ts

**ACTION**: In `toSeriesAdherenceDto`, add `nudgeMuted: row.nudgeMuted,` to the returned object, after `recentMisses`. Keep it field-by-field (no spread of `row`); `nudged_at` is never exposed here (system state). Do not touch `seriesWireFields`, `toSeriesDto` or `toRecurrenceSeriesDto`. Delivers AC-A3 (the endpoint `GET /api/series/adherence` answers `nudgeMuted` per series, true exactly when the row's `nudge_muted` is true).
**MIRROR**: `src/worker/dto.ts:134-148` (Patterns to Mirror — field-by-field mapping from the row).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npx vitest run test/adherence-endpoint.test.ts`

### Task 3: CREATE src/shared/nudge-switch.ts

**ACTION**: Create the pure module. It imports `type { SeriesDto, UpdateSeriesInput }` from `./api` and `{ NUDGE_THRESHOLD }` from `./nudge`; no DOM, Worker or database dependency, no clock. Export exactly: (a) `export const NUDGE_MUTED_LABEL = "Avisos silenciados";`. (b) `export interface NudgeSwitchView { label: string; checked: boolean; statusText: string }`. (c) `export function nudgeSwitchView(series: Pick<SeriesDto, "status" | "nudgeMuted"> | null): NudgeSwitchView | null` — returns `null` when `series` is `null` or `series.status !== "active"` (an ended series and a not-yet-loaded series show no control, AC-15); otherwise `label` is `` `Avisar após ${NUDGE_THRESHOLD} não concluídas seguidas` `` (renders "Avisar após 3 não concluídas seguidas"), `checked` is `!series.nudgeMuted` (the switch reads "notify me": on = the nudge is active), and `statusText` is `"Avisos ativos para esta série."` when checked or `` `${NUDGE_MUTED_LABEL}. Seus lembretes continuam normais.` `` when not. (d) `export function nudgePatch(enabled: boolean): UpdateSeriesInput` — returns `{ nudgeMuted: !enabled }` and nothing else (never part of the Task draft, never combined with rule or template keys). No output string may contain `falha`, `falhando` or `pulada` (glossary: *não concluída*). Code, identifiers and comments English; one doc comment per export. Delivers AC-A1 (the control exists for an occurrence of an active series, shows its state in pt-BR, and is absent for an ended or unloaded series) and the body half of AC-A2 (PRD AC-15: toggling saves through the series route as `{ nudgeMuted }`).
**MIRROR**: `src/shared/adherence-view.ts:39-48` (Patterns to Mirror — a pure pt-BR formatter with a one-line doc comment).
**VALIDATE**: `set -euo pipefail; npx tsc -b; grep -qF 'export function nudgeSwitchView' src/shared/nudge-switch.ts; grep -qF 'export function nudgePatch' src/shared/nudge-switch.ts; grep -qF 'export const NUDGE_MUTED_LABEL = "Avisos silenciados";' src/shared/nudge-switch.ts; if grep -qiE 'falha|falhando|pulada' src/shared/nudge-switch.ts; then echo "FAIL: forbidden vocabulary in nudge-switch"; exit 1; else echo "PASS: no forbidden vocabulary"; fi; if grep -qE 'document\.|window\.|from "\.\./worker' src/shared/nudge-switch.ts; then echo "FAIL: shared module reaches the DOM or the Worker"; exit 1; else echo "PASS: shared module stays environment-agnostic"; fi`

### Task 4: UPDATE src/shared/adherence-view.ts

**ACTION**: Add `import { NUDGE_MUTED_LABEL } from "./nudge-switch";` (a same-directory sibling, as the file header requires) and export `formatNudgeMuted(nudgeMuted: boolean): string | null` — `NUDGE_MUTED_LABEL` (the text `Avisos silenciados`) when `nudgeMuted` is `true`, `null` otherwise, so an unmuted row renders no extra element. It applies to a muted series of either status: the flag is the owner's persisted preference and the line states a fact, not an offer. Keep the file's "no division, no percentage" rule and leave every existing export byte-for-byte as it is. Delivers AC-A3 (PRD AC-15: the *Aderência* route marks a silenced series with *Avisos silenciados* in its row).
**MIRROR**: `src/shared/adherence-view.ts:39-48` (Patterns to Mirror).
**VALIDATE**: `set -euo pipefail; npx tsc -b; grep -qF 'export function formatNudgeMuted' src/shared/adherence-view.ts; npx vitest run test/adherence-view.test.ts`

### Task 5: UPDATE src/app/hooks/useSeriesSheet.ts

**ACTION**: Change the signature to `useSeriesSheet(sheetTask: TaskDto | null, onUnauthorized: () => void)` and extend the return value with `nudge: { pending: boolean; error: string | null; setEnabled: (enabled: boolean) => void }`. Implementation: two new states (`nudgePending`, `nudgeError`) reset to `false`/`null` in the existing `[taskId, seriesId]` effect; a ref holding the series id currently loaded, kept in step with that effect. `setEnabled(enabled)`: return when `series === null`, when `series.status !== "active"` or when a write is already pending; otherwise capture `const id = series.id`, set pending, clear the error, call `updateSeries(id, nudgePatch(enabled))` (import `updateSeries` and `ApiError` from `../api`, `nudgePatch` from `../../shared/nudge-switch`, `classifyRequestFailure` from `../../shared/request-failure`). On success `setSeries(updated)` ONLY — never `acceptSeries`, which re-seeds `ruleDraft` and would erase an unsaved rule edit the owner is in the middle of. On failure: a 401 calls `onUnauthorized()`; any other failure sets `nudgeError` to `classifyRequestFailure(cause).message` (the control stays enabled for a retry). In every branch ignore the result when the ref no longer equals `id` (the sheet moved to another Task), and clear pending only for the current series. The write is server-first and never optimistic (guidelines §8 "Pending request"); it does not close the sheet, toast, or touch `busy`/`sheetError` of the screen. Update the hook's doc comment with one sentence naming the nudge switch. Delivers AC-A2 (PRD AC-15: toggling is persisted immediately through the series route, outside *Salvar*).
**MIRROR**: `src/app/hooks/useSeriesSheet.ts:43-65` and `src/app/components/TodayScreen.tsx:691-701` (Patterns to Mirror — the per-Task reset effect, and the `updateSeries(series.id, body)` call shape).
**VALIDATE**: `set -euo pipefail; grep -qF 'updateSeries(' src/app/hooks/useSeriesSheet.ts; grep -qF 'nudgePatch(' src/app/hooks/useSeriesSheet.ts; grep -qF 'onUnauthorized' src/app/hooks/useSeriesSheet.ts; if grep -nE 'acceptSeries\(await updateSeries' src/app/hooks/useSeriesSheet.ts; then echo "FAIL: the switch write re-seeds the rule draft"; exit 1; else echo "PASS: the switch write keeps the rule draft"; fi` (the full compile is checked in Task 9, once every caller of the hook and of `TaskSheet` is updated)

### Task 6: UPDATE src/app/components/TaskSheet.tsx

**ACTION**: Add one required prop `nudge: { pending: boolean; error: string | null; onChange: (enabled: boolean) => void }` (with a doc comment: "The repeated-miss nudge switch's own write state — persisted immediately by the parent, never part of the Task draft") and import `nudgeSwitchView` from `../../shared/nudge-switch`. Compute `const nudgeView = nudgeSwitchView(series);` beside the other derived values. In the active-series branch of the Repetição block, directly after the `seriesRuleError` alert and before the `confirmEnd` block, render when `nudgeView !== null`: a `<label>` row (`flex min-h-12 items-center gap-3`, text classes `font-text text-t2 text-ink`) wrapping a native `<input type="checkbox" role="switch">` and the `nudgeView.label`; `checked={nudgeView.checked}`, `disabled={busy || nudge.pending}`, `onChange={(event) => nudge.onChange(event.target.checked)}`, sized to a 48 px target with token classes only (for example `size-6` inside the `min-h-12` row and `accent-accent`); no `name` and no submit behaviour — it is not a field of the form. Beneath it a `<p role="status" className="m-0 font-text text-t1 text-muted">` with `nudgeView.statusText`, and when `nudge.error !== null` a `<p role="alert" className="m-0 font-text text-t2 text-overdue">` with the message. The control must not render for a one-off Task (it is inside the `isOccurrence` block), for a loading/errored series, or for an ended series (`nudgeSwitchView` returns `null`). Do not change *Salvar*'s disabled expression, the submit handler, or any other copy. Delivers AC-A1 (PRD AC-15: the switch shows the nudge state in pt-BR and is absent for an ended series and for a one-off Task) and the UI half of AC-A2.
**MIRROR**: `src/app/components/TaskSheet.tsx:393-403` and `src/app/components/TaskSheet.tsx:527-536` (Patterns to Mirror — where the control sits and the inline-error idiom).
**VALIDATE**: `set -euo pipefail; grep -qF 'role="switch"' src/app/components/TaskSheet.tsx; grep -qF 'nudgeSwitchView(series)' src/app/components/TaskSheet.tsx; grep -qF 'nudge.onChange(' src/app/components/TaskSheet.tsx; if grep -qiE 'falha|falhando|pulada' src/app/components/TaskSheet.tsx; then echo "FAIL: forbidden vocabulary in TaskSheet"; exit 1; else echo "PASS: no forbidden vocabulary"; fi` (the full compile is checked in Task 9)

### Task 7: UPDATE src/app/components/TodayScreen.tsx

**ACTION**: Change `const seriesSheet = useSeriesSheet(sheetTask);` to `useSeriesSheet(sheetTask, onUnauthorized)`, and pass `nudge={{ pending: seriesSheet.nudge.pending, error: seriesSheet.nudge.error, onChange: seriesSheet.nudge.setEnabled }}` to the `<TaskSheet>` element (next to the other `seriesSheet.*` props). Make no other change; the write is the hook's and does not go through `runSheet`. Delivers AC-A2 on *Hoje*.
**MIRROR**: `src/app/components/TodayScreen.tsx:1201-1208` (Patterns to Mirror — the series prop block this edit extends).
**VALIDATE**: `set -euo pipefail; grep -qF 'useSeriesSheet(sheetTask, onUnauthorized)' src/app/components/TodayScreen.tsx; grep -qF 'seriesSheet.nudge.setEnabled' src/app/components/TodayScreen.tsx` (the full compile is checked in Task 9)

### Task 8: UPDATE src/app/components/SearchScreen.tsx

**ACTION**: Same wiring as Task 7 in the search screen: `useSeriesSheet(sheetTask, onUnauthorized)` and the `nudge={{ pending, error, onChange }}` prop built from `seriesSheet.nudge` on its `<TaskSheet>`. A search result's sheet must offer the same switch with the same behaviour as *Hoje* (the screen's own header comment promises "TaskSheet wiring verbatim"). Make no other change. Delivers AC-A2 on the search route.
**MIRROR**: `src/app/components/TodayScreen.tsx:1201-1208` (Patterns to Mirror — the same series prop block, which the search screen's `TaskSheet` copies verbatim).
**VALIDATE**: `set -euo pipefail; grep -qF 'useSeriesSheet(sheetTask, onUnauthorized)' src/app/components/SearchScreen.tsx; grep -qF 'seriesSheet.nudge.setEnabled' src/app/components/SearchScreen.tsx` (the full compile is checked in Task 9)

### Task 9: UPDATE src/app/components/DesignPlayground.tsx

**ACTION**: In the dev-only "Sheet de tarefa" section, pass the new required prop to its `<TaskSheet>`: `nudge={{ pending: false, error: null, onChange: () => {} }}`, after `onEndSeries`. The playground keeps `series={null}`, so the control stays absent there by construction; do not add a fixture series. This is the task that closes the compile: `TaskSheet`'s new required prop and the hook's new parameter now have no unsatisfied caller. Infrastructure task: it delivers no acceptance criterion of its own; its guard is that the project compiles and lints again after Tasks 5-8.
**MIRROR**: `src/app/components/TodayScreen.tsx:1201-1208` (Patterns to Mirror — the series prop block; the playground stubs the same props, so the new one is added after `onEndSeries` there too).
**VALIDATE**: `set -euo pipefail; npx tsc -b; npm run check`

### Task 10: UPDATE src/app/components/AdherenceScreen.tsx

**ACTION**: Import `formatNudgeMuted` from `../../shared/adherence-view` (extend the existing import list). In `SeriesSection`'s row, after the miss-dates line, render `<p className="m-0 font-data text-t2 text-muted">{muted}</p>` only when `const muted = formatNudgeMuted(s.nudgeMuted)` is not `null` (compute it inside the `map` callback, which becomes a block body). The state is plain text — never colour alone, no icon, no new control; an unmuted row renders exactly what it renders today. The screen stays read-only (the switch lives in the sheet, where the owner lands). Delivers AC-A3 (PRD AC-15: the *Aderência* route marks a silenced series with *Avisos silenciados* in its row).
**MIRROR**: `src/app/components/AdherenceScreen.tsx:35-43` (Patterns to Mirror — the row's classes and lines).
**VALIDATE**: `set -euo pipefail; npx tsc -b; grep -qF 'formatNudgeMuted(s.nudgeMuted)' src/app/components/AdherenceScreen.tsx; npx vitest run test/adherence-view.test.ts test/adherence-endpoint.test.ts`

### Task 11: CREATE PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md

**ACTION**: Read `documentation/40-engineering/ui-ux-guidelines.md` and `documentation/40-engineering/ui-layout-standard.md` first, then run the guidelines' review checklist (Tier A items 1-9; Tier B items 10-14 where the change reaches them) on the change and record the ✔/✘ result in the shape of `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md`: a header naming the change under review (the nudge switch in the sheet's series section; the *Avisos silenciados* line on the *Aderência* row; no new token, primitive, route or origin), the method stated honestly per item (static inspection, `npm run check`, `npm test`, `npm run build` with the gzip numbers read against §11), `pending live check (orchestrator browser pass)` for anything a rendered screen is needed for, `owed to the owner's device` for the phone, and never a ✔ from imagination or a screenshot that was not taken (§12.6). The record MUST address, by name: item 2 (the switch row is `min-h-12`, and its 8 px distance from *Encerrar repetição* and the chips); item 3 (the state is text, `Avisos ativos…` / `Avisos silenciados…`, not colour or position alone); item 4 (pt-BR, sentence case, no "eu" — implied subject —, zero-safe, vocabulary *não concluída* with the forbidden-words grep result); item 5 (Tab / Space toggle, visible focus ring on a native checkbox, focus return on close); item 6 (the switch has a visible `<label>`; `role="switch"` on a native checkbox); item 8 (n/a: the switch is reversible by tapping it again, no confirmation); and the one conscious exception to flag for the owner: the switch persists immediately instead of waiting for *Salvar* (a toggle is an action, not a field — the owner asked for exactly this), with its pending and failure states handled inline per §8. Also record the hybrid check that the switch write does not reset an unsaved rule edit. Delivers AC-A4 (PRD AC-16: the review checklist has a recorded ✔/✘ result before the merge, and no visible string leaves pt-BR).
**MIRROR**: `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md` (the structure and the honesty conventions of a recorded run).
**VALIDATE**: `set -euo pipefail; test -s PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md; grep -qF 'Tier A' PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md; grep -qF 'Tier B' PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md; grep -qF 'ui-ux-guidelines.md' PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md; n=$(grep -cE '^(1|2|3|4|5|6|7|8|9)\. ' PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md); test "$n" -ge 9`

### Task 12: CREATE PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md

**ACTION**: Create the device-proof file in the shape of `PRPs/reports/adherence-mirror/phase-3/device-proof.md`, titled `# Device proof — AC-17 (repeated-miss-nudge, phase 4)` with the line `Status: OWED` directly below the title, then `## Procedure` (numbered, for the owner) and an empty `## Observation (owner)` section stating that it stays empty until he records it. The procedure: (1) in production with this unit deployed, choose a real daily or weekly series and let three consecutive occurrences lapse (or note a series already at three: each is nudged once on first run, D-H); (2) after the third is recorded by the cron and the local 09:00 window arrives, expect exactly ONE notification on the phone with the app closed — title the series' title (≤ 30 characters), body `<N> não concluídas seguidas. Toque para replanejar ou encerrar.`; (3) tap it and expect the series' open occurrence's sheet, showing the *Repetição* block and the *Avisar após 3 não concluídas seguidas* switch; (4) confirm no second notification arrives while the run continues (4th, 5th miss) and note whether a same-`tag` notification replaced rather than stacked on the installed PWA (the iOS/PWA open question); (5) flip the switch off and confirm *Avisos silenciados. Seus lembretes continuam normais.*, that the *Aderência* row now reads *Avisos silenciados*, and that a Reminder of that series' Task (and of another Task) still rings; (6) record the observation here and in the roadmap Delivery history, with the Open Questions it answers (unmute behaviour D-I, the upper bound of the window, the first-day burst, the tag replacement). Do not fabricate an observation. Delivers AC-A5 (PRD AC-17: the manual, owner-observed proof is defined, owed and not claimed).
**MIRROR**: `PRPs/reports/adherence-mirror/phase-3/device-proof.md` (the file shape and the Status line).
**VALIDATE**: `set -euo pipefail; test -s PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md; grep -qF 'Status: OWED' PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md; grep -qF 'AC-17' PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md; grep -qF '## Procedure' PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md; grep -qF 'Avisos silenciados' PRPs/reports/repeated-miss-nudge/phase-4/device-proof.md`

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
set -euo pipefail
npm run check
```

### Level 2: UNIT_TESTS

```bash
set -euo pipefail
npm test
# the rule, the aggregation and the pure nudge must be byte-identical to main
git diff --quiet main -- src/shared/recurrence.ts src/shared/adherence.ts
```

### Level 3: INTEGRATION

```bash
set -euo pipefail
# the adherence route and the series routes stay green with the wire addition
npx vitest run test/adherence-endpoint.test.ts test/adherence-view.test.ts test/series.test.ts test/series-edit.test.ts
# the UI builds inside the performance budget (read the gzip numbers into the ui-checklist, guidelines §11)
npm run build
# no new dependency and no new design token
git diff --quiet main -- package.json package-lock.json src/app/tokens.css
# no forbidden vocabulary introduced in this phase's UI copy (diff-scoped; the new file is checked whole)
if git diff --unified=0 main -- src/app/components/TaskSheet.tsx src/app/components/AdherenceScreen.tsx src/app/hooks/useSeriesSheet.ts src/shared/adherence-view.ts | grep -E "^\+[^+]" | grep -qiE "falha|falhando|pulada"; then
  echo "FAIL: forbidden vocabulary introduced in UI copy"; exit 1
else
  echo "PASS: no forbidden vocabulary introduced"
fi
```

## Acceptance Criteria

- **AC-A1 (PRD AC-15):** Given the sheet of an occurrence of an `active` series, when it opens, a switch for the nudge shows its state in pt-BR — label *Avisar após 3 não concluídas seguidas*, on when the series is not muted — and the sheet of an occurrence of an `ended` series, of a series still loading, or of a one-off Task shows no such control.
- **AC-A2 (PRD AC-15):** Given that switch, when the owner toggles it, the change is persisted immediately through `PATCH /api/series/:id` with exactly `{ nudgeMuted: <boolean> }`, outside the Task draft and *Salvar*; the control is disabled while the write is pending, a failure is shown inline next to it with the control left enabled for a retry, and a success does not reset an unsaved edit of the series' rule.
- **AC-A3 (PRD AC-15):** Given a muted series, `GET /api/series/adherence` answers `nudgeMuted: true` for it (and `false` for the others), and its row on the *Aderência* route reads *Avisos silenciados*; an unmuted row shows no extra line.
- **AC-A4 (PRD AC-16):** Given the change touches `src/app/`, the review checklist of `documentation/40-engineering/ui-ux-guidelines.md` has a recorded ✔/✘ result at `PRPs/reports/repeated-miss-nudge/phase-4/ui-checklist.md` before the merge, and every visible string introduced is pt-BR with the vocabulary *não concluída* (never "falha", "falhando" or "pulada").
- **AC-A5 (PRD AC-17):** Given production with this unit deployed, a device-proof file with status `OWED` defines the owner's procedure — one notification from 09:00 local after three consecutive misses, the tap landing on the open occurrence, silencing preventing any more, Reminders unaffected — and claims no observation.

R8b (PRD AC-N token check) is satisfied: every criterion above names the PRD AC it derives from.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| The switch's write calls `acceptSeries`, re-seeding `ruleDraft` and silently erasing an unsaved rule edit | M | M | Task 5 requires `setSeries` only and its VALIDATE fails on `acceptSeries(await updateSeries`; the checklist records the manual check |
| The switch sits inside the sheet's `<form>`: Enter in a text field or a stray submit could persist or close it | L | M | A checkbox's change never submits; the control has no `name`; Task 6 leaves the submit handler and *Salvar*'s disabled expression untouched |
| An immediately-persisted control contradicts guidelines §10 3.2.2 / the "nothing is saved without *Salvar*" rule of §8 | M | L | It is a toggle action, not a field (the owner's explicit ask, PRD D-E); handled with pending/error states per §8 and recorded as a conscious exception in the checklist (Task 11) |
| A stale response lands after the sheet moved to another Task and toggles the wrong series' view | L | M | Task 5 ignores any result whose series id no longer matches the ref, mirroring the existing `cancelled` discipline |
| A new required prop and a new hook parameter leave the compile red between Tasks 5-8 | H | L | Expected and stated: Tasks 5-8 validate by content, Task 9 closes the chain with `tsc -b` and lint; do not reorder |
| The native `role="switch"` checkbox has no owned styling and its focus ring is not the two-tone ring | M | L | Token classes only; the checklist item 5 is recorded as pending live check or ✘ with a conscious exception rather than a new primitive (ADR-0011 allows one later) |
| `src/shared/nudge.ts` is untracked in the worktree, so `git diff main` cannot prove it unchanged | M | L | Plain instruction to the Implementer; Task 3 only imports `NUDGE_THRESHOLD` and never edits the file |
| The device proof is never observed, as unit 7's week of reminders was not | M | L | Out of this phase's control by design: AC-A5 only defines and owes it; the unit's closing is the owner's decision |
| research-codebase / research-web were not dispatched for this plan | - | L | Grounding was taken from direct reads of the cited files, the approved PRD and the guidelines; the phase composes shipped primitives and has no web-research value |

## Notes

- **TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.
- **Test-file routing:** this phase's test-file creation and updates are routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger (`/relay-write-test` → `/relay-test-write-review`), not authored by the Implementer — R-X is a blanket straight-fail on any test glob in the Implementer's diff. No task below and no `## Files to Change` row targets a test file, so this plan's `**VALIDATE**` commands exercise the change directly rather than invoking the test framework (the `npx vitest run` calls only re-run the existing suites to prove they stay green).
- **What is testable and what is not:** the project keeps UI verification manual ("UI stays manually verified"). AC-A1 is therefore decided in the pure `nudgeSwitchView` and AC-A2's body in `nudgePatch` (both in `src/shared/nudge-switch.ts`), AC-A3's wording in `formatNudgeMuted` (`src/shared/adherence-view.ts`) and its wire half in the `GET /api/series/adherence` suite (`test/adherence-endpoint.test.ts`). The test pair derives its suite from those seams: visibility for `active` / `ended` / `null`, the exact label and both status strings, `{ nudgeMuted: !enabled }`, `Avisos silenciados` or `null`, and `nudgeMuted` per series on the endpoint (muted and unmuted, both statuses). The React glue (hook, `TaskSheet`, screens) is the exempt thin adapter, verified through the checklist and the device proof.
- **Exact strings, for the test pair and the Implementer (single source):** label `Avisar após 3 não concluídas seguidas` (the 3 is `NUDGE_THRESHOLD`); enabled status `Avisos ativos para esta série.`; muted status `Avisos silenciados. Seus lembretes continuam normais.`; row line `Avisos silenciados`. They were chosen over the brief's "Avisar quando eu não concluir 3 vezes seguidas" to follow guidelines §9.3 (implied subject, no first person) and glossary §9.7 (*não concluída*); the owner may flip the wording by editing one module.
- **Polarity:** the switch reads "notify me" — `checked = !nudgeMuted` — so on means the notification is active and off means silenced; the wire keeps the preference as `nudgeMuted` (PRD D-E).
- **Muted ended series:** the *Aderência* row line is rendered for a muted series of either status. The flag is a persisted fact; the sheet's switch is absent for an ended series, so the row is the only place that still says it. Say so in the checklist if the owner prefers it hidden for ended series (a one-line change in `formatNudgeMuted`'s caller).
- **Docs sync owed by the orchestrator/owner (not edited here):** `docs/api-reference.md` (`nudgeMuted` on `GET /api/series/adherence` rows, and on `PATCH /api/series/:id` / `SeriesDto` if phase 2 did not list it), `docs/domain/areas/tasks.md` (the mute rule and the switch), `docs/domain/areas/reminders.md` (muting never touches a Reminder), `docs/context/architecture.md`, `documentation/40-engineering/ui-layout-standard.md` (§3 detail content order gains the nudge switch in the series block; a History row), `documentation/50-planning/roadmap.md` Delivery history (including AC-17 once observed) and the PRD's Open Questions once the owner answers them.
- **Phase-3 dependency in the worktree:** phases 1-3 live uncommitted in `.worktrees/repeated-miss-nudge` (branch `feature/repeated-miss-nudge`); this phase builds on them there.

*Generated: 2026-10-10*
*Approved: 2026-10-10*
*Implemented: 2026-10-11*
*Status: IMPLEMENTED*
