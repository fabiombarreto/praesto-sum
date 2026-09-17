# UI/UX review checklist — the search screen (unit 8, phase 2)

Run 2026-09-17 in the browser pane, against a dev server serving the merged `main`
(unit 8 as deployed in `v0.8.0`), with the local dev database.

**Why it is dated after the deploy.** It should have run before. Phase 2's plan
assigned the checklist to AC-A12 alongside the owner's device pass, and the
pipeline recorded it as owed at every stage — but the unit was merged and
deployed with the item still open, and nobody stopped. The run below is that
debt being paid, and it found a real defect in shipped code (item 5), which is
the argument for not letting the order slip again.

## Tier A — every interface change

1. **One primary action on the screen; nothing added "just in case".** ✔ — the
   field is the screen. Results, the below-minimum prompt, the empty state and
   the offline banner are the only other things it can show, and never at once.
2. **Every tappable control ≥ 48 × 48 px and ≥ 8 px from its neighbours.** ✔ —
   measured from the live DOM: *Pesquisar*, *Filtros* and *Configurações* in the
   *Hoje* header are 48 × 48 each, the search screen's *Voltar* is 48 × 48, and
   the field itself is 48 tall. (A first measurement read 32 × 48 for the search
   icon; re-measuring after layout settled gave 48 × 48, so the first number was
   the measurement's fault, not the button's.)
3. **No meaning carried by colour alone.** ✔ — groups carry names and counts;
   completed rows carry the check control and strike-through, not just a tone.
4. **Copy is pt-BR, sentence case, infinitive buttons, "você", `Intl` dates.** ✔ —
   *Pesquisar tarefas…* (placeholder and `aria-label`), *Digite pelo menos 2
   letras para buscar.*, *Nenhuma tarefa encontrada para "…"*, *Sem conexão.* The
   `<title>` is *Pesquisar · Praesto Sum* and `lang` is `pt-BR`.
5. **Tab / Enter / Esc work, focus is visible, focus returns to the opener on
   close.** ✘ **— a real defect, found here and fixed in the same session.** The
   `/` shortcut opened the screen and then the same keystroke landed in the field
   it had just focused, so the query started as `/reuniao` and matched nothing.
   `TodayScreen`'s handler called `onOpenSearch()` without
   `event.preventDefault()`, though its own comment cites GitHub's shortcut,
   which prevents it for exactly this reason. Fixed; re-verified: `/` now opens
   the screen with the field focused and **empty**. The rest of the item passes —
   the field takes focus on open, `Esc` returns to *Hoje*, and `/` is correctly
   ignored while focus is already in a text field (verified by typing into the
   capture deck).
6. **Icon-only controls have `aria-label`; inputs have visible labels; `lang` and
   `<title>` are right.** ✔ — *Pesquisar*, *Voltar*, *Fechar* all labelled; the
   field carries `aria-label="Pesquisar tarefas"`.
7. **Tokens only; durations from the bands; reduced motion honoured.** ✔ — no
   raw colour or size in the diff; the screen reuses `TaskGroup`/`TaskRow` and
   the sheet, which were tokenised in the A5 design pass.
8. **Destructive actions follow §8.** ✔ — the screen has none; deletion still
   happens inside the Task sheet, with its existing confirmation.
9. **No request to another origin.** ✔ — 401 requests captured in the session,
   every one to the dev server's own origin. Typing `contador` (8 keystrokes)
   produced exactly **one** `GET /api/tasks?q=contador`, which is the debounce
   doing its job.

## Tier B — once per shipped screen

10. **Contrast measured for the §4.3 pairs and recorded.** ✔ — from the live
    DOM: the field's text 15.65:1, a result row's title 16.82:1, both against
    `--color-bg`. Well past AA (4.5:1) and AAA (7:1) for these sizes.
11. **The §8 states the screen can reach were simulated and read.** ✔ (partial) —
    below-minimum prompt, no-match empty state and results-with-groups were all
    read on screen. **Offline was NOT re-simulated here**: it is covered by the
    code review, which traced the gate branch by branch after rejecting an
    earlier version that left a stale list visible. The failed-request state was
    not forced either.
12. **Checked at 375 px and at 1280 px / the column cap.** ✔ — at 375 × 812 the
    document's scroll width equals its client width (no horizontal overflow), the
    field stays 48 tall, and results render in their groups; the desktop width was
    checked in the same session. **The phone's own safe areas and keyboard overlap
    are the owner's device step** — and he confirmed on 2026-09-17 that the search
    works on his devices.
13. **`vite build` size report read against §11; Lighthouse when the screen is
    new.** ✔ (partial) — `npm run build` clean, and the deployed bundle is
    294 KiB / 73 KiB gzipped. Lighthouse was not run on the new screen; recorded
    as a gap rather than claimed.
14. **Screenshots filed under `PRPs/reports/<activity>/` — or the reason none
    exists.** ✘ — no screenshot file is committed. The pane's captures were read
    in-session (and one screenshot call timed out at 375 px, where the numbers
    above came from the DOM instead); §12.6 permits a written reason, and this is
    it.

**Result: 12 ✔, 2 ✘.** Item 5's ✘ was a genuine defect and is fixed; item 14's is
the documented screenshot exception. Items 11, 12 and 13 carry the partial notes
above rather than a clean claim.

**What this run cost by being late:** the `/` defect shipped to production in
`v0.8.0` and was live until the fix. Nothing else found here was new.
