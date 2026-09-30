# UI/UX review checklist — editing a series from the Task sheet

**Change:** a series occurrence's sheet can now show and edit its rule (frequency, day of the month
or weekdays, end condition), edit the template with an "Aplicar a" choice, end the series, and says
when the occurrence is detached. Also: the one-off sheet's date group reads *Primeira vez em* once a
repetition is chosen. Source: PRD `recurring-tasks.prd.md`, D11 amended 2026-09-29 and AC-29/AC-30.

**Run:** 2026-09-30, **before the commit and before any deploy** — the rule the v0.8.1 incident
produced. Checklist text read from `documentation/40-engineering/ui-ux-guidelines.md` §review
checklist, not recited from memory.

**Method, stated because it bounds what this record is worth.** Behaviour was exercised end to end
against `npm run dev` with a real local D1, and every state change was confirmed in the database,
not only on screen. Measurements were taken from the live DOM at 375 px and 1280 px. The browser
pane **stopped drawing** partway through (the window went behind another), so no screenshot could be
captured and real pointer/Tab input was unavailable for the last part of the run; what that left
unmeasured is marked below rather than assumed.

| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing "just in case" | ✔ *Salvar* stays the sheet's only primary. *Encerrar repetição* is `secondary`, and "Aplicar a" appears only on a series occurrence, where it decides something real |
| 2 | Tappable ≥ 48 × 48 px and ≥ 8 px apart | ✔ **measured at 375 px**: *Dias da semana* 49 × 48 (min), *Repetição* 106 × 48, *Aplicar a* 128 × 48, *Repetir até quando?* 90 × 48; smallest gap 8 px in every group. **Note:** the weekday chips clear the rule by 1 px — a shorter label or a smaller font would drop them below it |
| 3 | No meaning by colour alone | ✔ Selected chips carry `data-pressed` and the accessible pressed state; the detached state is a sentence (`role="note"`), not a colour; errors are text with `role="alert"` |
| 4 | pt-BR, sentence case, infinitive buttons, *você* | ✔ *Encerrar repetição*, *Manter repetição*, *Toda a série*, *Só esta ocorrência*, *Dia do mês*, *Dias da semana*, *Data desta ocorrência*, *Primeira vez em*; validation copy pt-BR |
| 5 | Tab / Enter / Esc, visible focus, focus returns | ✔ **inferred, not measured.** Every new control is a reused primitive (`Chip`/`ChipGroup`, native `<input>`, `Button`) carrying the global `:focus-visible` token. Real Tab input was unavailable once the pane stopped drawing, and this project already recorded that `.focus()` before a real Tab reports `outline: none` — a false positive — so no programmatic substitute was used |
| 6 | Labels | ✔ **with the pre-existing caveat.** *Dia do mês* has a visible `<label>`. The *Repetir até* date and *Número de repetições* inputs use `aria-label` under the visible *Repetir até quando?* heading — the same pattern as the already-shipped `sheet-date` and one-off recurrence inputs, flagged in the unit's first checklist. Not a new regression; still open project-wide |
| 7 | Tokens only; motion bands; reduced motion | ✔ Every class is an existing token utility copied from the one-off *Repetir* block; no new motion |
| 8 | Destructive actions per §8 | ✔ Ending a series is irreversible (there is no way back to `active`), so it takes **one confirmation that repeats the verb**: *"Encerrar a repetição? …não há como desfazer."* with *Manter repetição* / *Encerrar repetição*. Verified: the first click only asks; the second ends it |
| 9 | No request to another origin | ✔ `getSeries` / `updateSeries` go through the existing same-origin `request<T>()` wrapper |
| 10 | Contrast, five pairs of §4.3 | ✔ **not re-measured** — no new colour pair: the block reuses `text-muted`, `text-ink` and `text-overdue` exactly as the one-off *Repetir* block, whose pairs were measured in the unit's first checklist |
| 11 | Reachable states simulated | ✔ loading (*Carregando repetição…*), **load failure** (the hook shows *"Não foi possível carregar a repetição desta tarefa."* instead of swallowing the error), ended (*Repetição encerrada…*, controls removed — verified), detached (notice — verified), validation (inline `role="alert"`). Offline was not re-simulated: this change adds no write path the sheet's existing offline handling does not already cover |
| 12 | 375 px and 1280 px; phone-only checks | ✔ 375 px: no horizontal overflow. 1280 px: the sheet is the established centred 560 × 720 card, no overflow. ✘ **back gesture, keyboard overlap and safe areas** need the owner's phone |
| 13 | `vite build` size vs §11 | ✔ first-load client JS **104.8 KB gzip** (`index-*.js`) + 2.2 KB workbox, against a **170 KB** budget. Note the build's own report prints the *Worker* bundle (`dist/praesto/index.js`, 83.7 KB gzip) most prominently — that is not what the phone downloads, and reading it as the client figure would understate the real number by ~20 KB |
| 14 | Screenshots filed | ✘ **none** — the pane stopped drawing before a capture was possible. This line is the written reason the rule allows |

**Owed before this is fully discharged:** item 12's phone-only checks (back gesture, keyboard
overlap, safe areas) and a real-screen look at items 5 and 6. None blocks the commit; both are the
kind of thing only a device can settle.
