# UI/UX review checklist — the nudge switch and the *Avisos silenciados* row (unit 12, phase 4)

Run 2026-10-10 by the Implementer against `documentation/40-engineering/ui-ux-guidelines.md`
(Tier A items 1-9, Tier B items 10-14) and `ui-layout-standard.md`, **by reading the code and
running the check, the suite and the build only**. No browser pane and no device were used: no
screenshot was taken and nothing below claims a live pass. Items a rendered screen is needed
for are marked `pending live check (orchestrator browser pass)`; items for the owner's phone
are marked `owed to the owner's device`. No item is ✔ from imagination (§12.6).

Change under review: a native `<input type="checkbox" role="switch">` in the active-series
branch of the Task sheet's *Repetição* block (shared by *Hoje* and search through
`useSeriesSheet`), persisted immediately through `PATCH /api/series/:id` `{ nudgeMuted }`;
and one conditional plain-text line, *Avisos silenciados*, on the *Aderência* route's series
row. No new token, primitive, route, dependency or origin.

## Tier A — every interface change

1. ✔ — method: static inspection. The sheet keeps *Salvar* as its primary action; the switch
   is a secondary toggle inside the series block and adds no second primary. The *Aderência*
   row gains a text line, not a control.
2. pending live check (orchestrator browser pass) — by construction: the switch row is a
   `<label>` with `min-h-12` (48 px) and the checkbox is `size-6`, inside a `gap-*` column
   like its neighbours (rule chips, *Encerrar repetição*), so the 8 px distance follows the
   block's existing gap. Not measured in the DOM box model.
3. ✔ — method: static inspection. The state is text: label *Avisar após 3 não concluídas
   seguidas* plus the status line *Avisos ativos para esta série.* /
   *Avisos silenciados. Seus lembretes continuam normais.*; the *Aderência* row says
   *Avisos silenciados*. Neither is colour- or position-only; the failure is `role="alert"`
   text.
4. ✔ — method: static inspection + grep. Visible strings are pt-BR, sentence case, implied
   subject (no "eu"), vocabulary *não concluída*; no number is formatted by hand (the 3 is
   `NUDGE_THRESHOLD`). Zero-safe: the row line is absent, not "0". Grep of the diff for
   falha / falhando / pulada: clean (and the new module checked whole).
5. pending live check (orchestrator browser pass) — a native checkbox, so Tab and Space
   toggle by construction; the sheet's `<dialog>` already returns focus to the opener on
   close. The browser's own focus ring on a native checkbox was not looked at and is not
   claimed to be the two-tone ring of §4.5 (ADR-0011 allows a `ui/Switch` primitive later).
6. ✔ — method: static inspection. The switch has a visible wrapping `<label>`;
   `role="switch"` on a native checkbox exposes name, role and state (4.1.2); the status
   line is `role="status"`. `lang` and `<title>` untouched.
7. ✔ — method: static inspection. Token classes only (`min-h-12`, `size-6`, `accent-accent`
   — compiled to `accent-color: var(--color-accent)` in the built CSS — `font-text`,
   `text-t1`/`t2`, `text-ink`, `text-muted`, `text-overdue`, `font-data`); no literal
   colour, size or duration; no animation added.
8. n/a — method: static inspection. The switch is reversible by tapping it again, so no
   confirmation and no *Desfazer* toast (§8 "Destructive — reversible"); nothing is deleted.
   *Encerrar repetição* keeps its existing confirmation, untouched.
9. ✔ — method: static inspection. The only request is the existing same-origin
   `PATCH /api/series/:id`. Not observed in DevTools Network (pending live check).

## Tier B — a new control on a shipped sheet and a new line on a shipped route

10. owed to the owner's device — contrast was not re-measured; no new colour pair is
    introduced (`text-ink`/`text-muted`/`text-overdue` on the sheet and `bg-surface-1` already
    ship).
11. pending live check (orchestrator browser pass) — states to simulate: switch absent for a
    one-off Task, for a series still loading and for an ended series; pending (checkbox
    disabled while the write runs); failed request (inline `role="alert"`, control left
    enabled for retry). By construction (hook): the write is server-first, never optimistic
    (§8 "Pending request"); a result for a sheet that moved to another Task is ignored.
12. owed to the owner's device — 375 px / 1280 px layout, safe areas, overscroll and back
    gesture on the phone; the 375 px look is also pending the orchestrator's browser pass.
13. ✔ — method: `npm run build`, 2026-10-10, read against §11:
    - First-load JavaScript: `index-CQ92gNgv.js` 363.25 kB, **110.37 kB gzip** (budget
      <= 170 KB gzip).
    - First-load CSS: `index-DLqiSGmD.css` 26.47 kB, **6.27 kB gzip** (budget <= 30 KB gzip).
    - Precache: **25 entries, 479.05 KiB** (budget <= 1 MB).
    Lighthouse on the phone: owed to the owner's device.
14. owed to the owner's device — no screenshot was taken and none exists: no browser pane or
    device was available to the Implementer.

## Conscious exception (flag for the owner)

The switch **persists immediately** instead of waiting for *Salvar* (§8 last row, §10 3.2.2).
A toggle is an action, not a field, and the owner asked for exactly this (PRD D-E). It is
handled as an action should be: server-first, its own pending state (control disabled), its
own inline failure with the control left enabled for a retry, and it never closes the sheet or
touches the Task draft.

## Hybrid check — the switch write does not reset an unsaved rule edit

By construction: the hook's write calls `setSeries(updated)` only, never `acceptSeries`
(which re-seeds `ruleDraft`); `ruleDraft` is state independent of `series`, so a rule edit in
progress survives a toggle. Static grep: no `acceptSeries(await updateSeries` in the hook.
Live confirmation: pending live check (orchestrator browser pass).

## Note for the owner

The *Aderência* line is rendered for a muted series of either status: the flag is a persisted
fact and the switch is absent for an ended series, so the row is the only place that still
says it. Hiding it for ended series is a one-line change in `AdherenceScreen`.

Result: no ✘. Pending: items 2, 5, 11 and the live halves of 1, 9, and the hybrid check
(orchestrator browser pass); owed to the owner's device: 10, 12, 14 and Lighthouse.
