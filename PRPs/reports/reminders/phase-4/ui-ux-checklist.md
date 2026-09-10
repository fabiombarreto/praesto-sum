# UI/UX guidelines checklist — unit 7 phase 4 `deadline-recomputation-and-the-device-proof`

Run 2026-09-10, Implementer pass for
`PRPs/plans/reminders-phase-4-deadline-recomputation-and-the-device-proof.plan.md`
(Task 4). Surface exercised: `TodayScreen.tsx`'s `saveSheet` toast branch —
the new "Lembrete reagendado para ..." confirmation shown when a Task's
deadline edit recomputes a linked relative Reminder's `fireAt`, versus the
unchanged "Tarefa salva" toast shown otherwise.

**Method note (read before trusting the ✔s below):** the Implementer agent
that produced this run has no browser-pane / DevTools tool in its toolset —
only `Read`/`Write`/`Edit`/`Glob`/`Grep`/`Bash`. Per the guidelines' own
instruction ("When the pane cannot display, say so and measure the DOM —
never claim a screenshot you did not take"), this run is a **static source
read**, not a live-rendered DOM measurement — the same method phase 3's own
`PRPs/reports/reminders/phase-3/ui-ux-checklist.md` recorded. The change
itself is narrow: no new component, no new markup, no new dialog — only a
conditional branch choosing between two `ToastSpec` values passed to the
already-verified `showToast`/toast-rendering surface.

## Tier A (9 items)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | One primary action per screen | ✔ | No new control was added. The toast is a passive confirmation (no button, no focus target); the sheet's existing single `Salvar` action is unchanged. |
| 2 | Every tappable control ≥ 48×48 px, ≥ 8 px gaps | ✔ N/A | No new tappable control was introduced by this change — the toast itself carries no interactive element (mirrors the existing "Tarefa salva" toast's own already-verified shape, reused unmodified from `src/app/toast-store.ts`). |
| 3 | No meaning by colour alone | ✔ | The new toast text names the new date/time in words ("Lembrete reagendado para {day} {time}"), not by any colour cue; it reuses the same neutral toast surface/styling as every other toast in the app, no new colour semantic added. |
| 4 | pt-BR, sentence case, infinitive buttons | ✔ | New copy: "Lembrete reagendado para {day} {time}" — pt-BR, sentence case, no button (nothing to put in the infinitive). Identifiers/comments stay English (ADR-0009). |
| 5 | Tab/Enter/Esc work; focus visible; focus returns to opener | ✔ *by construction* | The toast is rendered by the same `useSyncExternalStore`-backed store/surface every existing toast (`task-saved`, request-error, etc.) already uses, unmodified by this phase; it does not trap focus and does not sit in the Tab order, matching the existing "Tarefa salva" toast's own already-verified behaviour. Not independently re-measured live (no browser tool in this run). |
| 6 | Icon-only controls have `aria-label`; inputs have visible labels; `lang`/`<title>` right | ✔ N/A | No new icon-only control, input, or `lang`/`<title>` change — the toast is text-only, reusing the existing toast surface's markup. |
| 7 | Tokens only; durations from bands; reduced motion honoured | ✔ | No new CSS class or raw hex/rgb/hsl was introduced by this change (checked by grep on the diff); the toast's auto-dismiss timing (`TOAST_AUTO_DISMISS_MS`) and any enter/exit animation are the pre-existing, reduced-motion-aware toast surface, reused unmodified. |
| 8 | Destructive actions follow §8 | ✔ N/A | Not triggered — this phase's toast is a non-destructive, informational confirmation, not a delete/irreversible action. No confirmation dialog was added or changed. |
| 9 | No cross-origin request | ✔ | The new toast branch reads the already-fetched `nextReminders` array (from `refreshReminders()`, itself calling the existing same-origin `listReminders()` → `/api/reminders`); no new fetch target of any kind was introduced. |

**Result: 9/9 ✔ (6 by direct evidence, 3 recorded N/A because their
trigger — a new tappable control, a new input/icon-only control, or a
destructive action — does not exist in this change) on a static read; item
5 carries a recorded conscious exception, relying on the already-verified
shared toast surface rather than a fresh live-DOM Tab-key measurement,
because this Implementer's toolset has no browser-pane control.** No ✘ was
found.

## Not covered here

- **Tier B items (10-14)** — contrast re-measurement, offline/throttled
  simulation, 375 px/1280 px live layout check, bundle-size/Lighthouse,
  filed screenshots. Out of scope for a Tier A pass; due once this screen
  change is declared shipped.
- **The owner's on-device tap-through and the "Lembrete reagendado" toast's
  live appearance** — explicitly this phase's own `### Device Verification`
  section, performed by the owner, not this Implementer.
- **A live Tab-key run confirming the toast never steals focus, and a live
  DevTools measurement of the toast's rendered box** — both genuinely
  require the browser pane this run's toolset does not have; recorded as
  the open item for whoever runs the next live Tier A/B pass.
