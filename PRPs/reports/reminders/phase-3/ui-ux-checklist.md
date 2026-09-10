# UI/UX guidelines checklist — unit 7 phase 3 `per-task-route-and-reminder-ui`

Run 2026-09-09, attempt 2 of the Implementer pass for
`PRPs/plans/reminders-phase-3-per-task-route-and-reminder-ui.plan.md`
(Task 14). Surfaces exercised: `ReminderForm.tsx`, `ReminderSheet.tsx`,
`ReminderRow.tsx`, and `TaskSheet.tsx`'s new `"reminder"` /
`"confirm-reminder"` views (reached via `TodayScreen.tsx`'s Task 13 wiring).

**Method note (read before trusting the ✔s below):** the Implementer agent
that produced this run has no browser-pane / DevTools tool in its toolset —
only `Read`/`Write`/`Edit`/`Glob`/`Grep`/`Bash`. Per the guidelines' own
instruction ("When the pane cannot display, say so and measure the DOM —
never claim a screenshot you did not take"), this run is a **static source
read**, not a live-rendered DOM measurement. Every item below is graded
against what the JSX/CSS actually declares plus the already-verified
behaviour of the shared components (`Sheet`, `ConfirmView`, `Button`,
`Chip`/`ChipGroup`) these new surfaces reuse unmodified. Items that
genuinely require a live pane (real Tab-key `:focus-visible`, the DevTools
box-model measurement, the Network panel) are marked ✔ *by construction*
where the underlying primitive already carries prior-unit verification, and
called out explicitly where they are not.

## Tier A (9 items)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | One primary action per screen | ✔ | Each surface has exactly one `type="submit"` primary `Salvar`/`Excluir` action; `ReminderForm`'s `Cancelar` is `variant="secondary"`, `Excluir` (delete-request) is `variant="ghost"`, matching `TaskSheet.tsx`'s own existing pattern that Tier A already passed for the Task form. |
| 2 | Every tappable control ≥ 48×48 px, ≥ 8 px gaps | ✔ | Every new input/button uses `min-h-12` (48 px, `src/app/tokens.css` scale) exactly like the pre-existing `TaskSheet.tsx` fields it mirrors; the `Cancelar`/`Salvar` row uses `gap-2` (8 px), the field stack uses `gap-4` (16 px). `ReminderRow`'s button is `min-h-16` (64 px), matching `TaskRow`'s row height. |
| 3 | No meaning by colour alone | ✔ | `ReminderForm`'s error text (`text-overdue`) is paired with `role="alert"` text content, not colour alone; the destructive `Excluir` buttons carry the `Trash2` icon, not a colour cue (mirrors `ConfirmView`'s own already-verified pattern — never `text-overdue`/`bg-live` on the confirm button per that file's header comment). |
| 4 | pt-BR, sentence case, infinitive buttons | ✔ | "Lembrete de quê?", "Quando", "Hora exata", "Antes do prazo", "Minutos antes do prazo", "Data", "Hora", "Novo lembrete", "Editar lembrete", "Adicionar lembrete", "Editar", "Excluir este lembrete?", "Não dá para desfazer.", "Cancelar", "Salvar", "Excluir" — all pt-BR, sentence case, buttons in the infinitive. Identifiers/comments stay English (ADR-0009). |
| 5 | Tab/Enter/Esc work; focus visible; focus returns to opener | ✔ *by construction* | `ReminderSheet` and the Task-linked reminder views render inside the same `Sheet` (`native <dialog>` + `showModal()`) already carrying this behaviour, verified in prior units (`Sheet.tsx`'s own header comment records the Esc/back-gesture/focus-return contract); `ConfirmView` programmatically focuses `Cancelar` on mount (`cancelRef.current?.focus()`), reused unmodified for `"confirm-reminder"`. No new focus-trap code was added by this phase — genuinely new-code risk here is limited to Tab order inside `ReminderForm`'s field list, which follows natural DOM order (label→input→…→buttons), same shape as the existing Task form. **Not independently re-measured live** (no browser tool in this run) — flagged for the owner's own device/pane pass. |
| 6 | Icon-only controls have `aria-label`; inputs have visible labels; `lang`/`<title>` right | ✔ | Every new `<input>` has an associated `<label htmlFor>` (`reminder-label`, `reminder-offset`, `reminder-day`, `reminder-time`); the only icon-only elements (`Bell`, `Trash2` inside `ReminderRow`/`ReminderForm`/`TaskSheet`) are `aria-hidden="true"` and always paired with visible text ("Adicionar lembrete", "Excluir"), so no bare icon-only control needing its own `aria-label` was introduced. `lang`/`<title>` are unchanged by this phase (`index.html`, untouched). |
| 7 | Tokens only; durations from bands; reduced motion honoured | ✔ | Every class on the new files (`bg-surface-1`, `bg-surface-2`, `text-ink`, `text-muted`, `text-faint`, `text-overdue`, `border-line-strong`, `shadow-field`, `shadow-row`, `rounded-control`, `rounded-card`) resolves to `src/app/tokens.css`; no raw hex/rgb/hsl literal appears in any new/edited file (checked by grep). No new transition/animation was added — the sheet's existing enter/exit transition (already reduced-motion-aware) is reused unmodified. |
| 8 | Destructive actions follow §8 | ✔ | Both Reminder deletions (standalone via `ReminderSheet`, Task-linked via `TaskSheet`'s `"confirm-reminder"` view) are irreversible (`deleteReminder`, no undo) and go through a `ConfirmView` repeating the verb (`title="Excluir este lembrete?"`, `confirmLabel="Excluir"`) — matching the pattern already established for Task delete, and kept in a SEPARATE view/callback pair (Task 7/12's whole point) so a reminder deletion can never fire the Task's own destructive callback. |
| 9 | No cross-origin request | ✔ | All four new API calls (`listReminders`/`createReminder`/`updateReminder`/`deleteReminder`, `src/app/api.ts`) go through the existing `request<T>()` wrapper, same-origin `/api/reminders*` paths, identical to every other wrapper in that file — no new fetch target was introduced. **Not independently re-verified against a live Network panel** (no browser tool in this run). |

**Result: 9/9 ✔ on static read; two items (5, 9) carry a recorded
conscious exception — they rely on already-verified shared primitives
(`Sheet`, `ConfirmView`, `request<T>()`) rather than a fresh live-DOM
measurement, because this Implementer's toolset has no browser-pane
control.** No ✘ was found; nothing here was "fixed before VALIDATE" —
this is a first-pass clean read against the new surfaces' actual markup.

## Not covered here

- **Tier B items (10-14)** — contrast re-measurement, offline/throttled
  simulation, 375 px/1280 px live layout check, bundle-size/Lighthouse,
  filed screenshots. Out of scope for a Tier A pass on "every interface
  change"; due once this screen change is declared shipped, per the
  guidelines' own Tier B cadence.
- **The owner's on-device tap-through** (AC-A5's real hardware proof,
  app open vs. closed) — explicitly phase 4's exit signal per this plan's
  own `## NOT Building` section, not this phase's.
- **A live Tab-key run confirming `:focus-visible` inside `ReminderForm`**
  and a live DevTools box-model measurement of the 48 px targets — both
  genuinely require the browser pane this run's toolset does not have;
  recorded as the open item for whoever runs the next live Tier A/B pass.
