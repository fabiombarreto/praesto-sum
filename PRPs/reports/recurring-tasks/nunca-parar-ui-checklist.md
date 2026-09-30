# UI/UX review checklist — *Nunca* → *Nunca parar*

**Change:** the first chip of *Repetir até quando?* reads *Nunca parar* instead of *Nunca*, in both places it
appears in `src/app/components/TaskSheet.tsx`: the one-off sheet's *Repetir* block and the occurrence sheet's
*Repetição* block. Requested by the owner on 2026-09-30, after his device run of `v0.9.3`. Copy only: the value
(`never`) and every behaviour are unchanged, and no test asserts the word.

**Run:** 2026-09-30, **before the commit**. Checklist text read from
`documentation/40-engineering/ui-ux-guidelines.md` §review checklist. Tier A only, plus the items a copy change
can move (2, 12, 14); Tier B's contrast, states and bundle items are untouched by one longer string.

**Method.** Playwright browser at 375 × 812 against `npm run dev` (workerd + local D1). The owner's series
*teste recorrencia 1* was opened read-only and closed without saving; D1 confirms it unchanged (`daily`, `until`,
`active`).

| # | Item | Result |
|---|---|---|
| 1 | One primary action; nothing "just in case" | ✔ Unchanged |
| 2 | Tappable ≥ 48 × 48 px and ≥ 8 px apart | ✔ **measured at 375 px:** *Nunca parar* 108.1 × 48, *Até uma data* 134.4 × 48, *Depois de N vezes* 149.6 × 48; gaps 8.0 px |
| 3 | No meaning by colour alone | ✔ Unchanged |
| 4 | pt-BR, sentence case, infinitive buttons, *você* | ✔ *Nunca parar* — sentence case, an infinitive, and it now answers "até quando?" on its own instead of reading as "never repeat" beside two options that do stop |
| 5 | Tab / Enter / Esc, visible focus, focus returns | ✔ Same `Chip` primitive, measured with real keyboard input in `v0.9.3-ui-checklist.md` |
| 6 | Labels | ✔ The group keeps its visible heading *Repetir até quando?* and its accessible name |
| 7 | Tokens only; motion bands; reduced motion | ✔ No class changed |
| 8 | Destructive actions per §8 | ✔ n/a |
| 9 | No request to another origin | ✔ n/a |
| 12 | 375 px; no horizontal page overflow | ✔ No page overflow. The chip group **already scrolled horizontally** at 375 px before this change (visible in `v0.9.3-occurrence-sheet-375.png`), and is 38 px wider now; the pressed chip stays reachable by swiping the group, as before |
| 14 | Screenshots filed | ✔ `nunca-parar-375.png` — the occurrence sheet with the renamed chip |

Items 10, 11 and 13 were not re-run: no colour pair, no state and no code path changed, and one string does not
move the bundle measurably.
