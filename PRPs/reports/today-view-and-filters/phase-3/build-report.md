# Phase 3 build report — quick filters and the filter sheet

Date: 2026-08-24 · Plan: `PRPs/plans/completed/today-view-and-filters-phase-3-quick-filters-and-the-filter-sheet.plan.md` · PRD: `PRPs/prds/today-view-and-filters.prd.md` AC-11, AC-13, AC-14, AC-15, AC-16, AC-17.

The browser pass for the last phase of unit 3, run in the owner's own Chrome
against the real app with real rows in the local D1 — the step `/relay-execute`
has no place for, inserted by hand between implement and test.

## What the pass proved

Every claim below was read from the live DOM or the live network timings, not
inferred from source.

| Claim (AC) | Evidence |
|---|---|
| Chip row, order and size (AC-11) | *Abertas* · *Para hoje* · *Alta prioridade* · *Filtros…*, each **48 px** tall, in the order the code, the microcopy table and §2.3 all now agree on |
| Pressed state is not colour alone | The pressed chip carries fill **+ weight + a leading check glyph** (visible in the screenshot) |
| One request per tap (AC-A3) | Tapping *Alta prioridade* added **exactly 1** entry to `performance.getEntriesByType('resource')` for `/api/tasks`, with search `?priority=high` |
| Badge and accessible name (AC-11) | Header button `aria-label="Filtros"` at zero active, `"Filtros (1 ativo)"` at one, `"Filtros (2 ativos)"` at two; the badge renders the **number as text**, never a bare dot |
| **The round trip, both directions (AC-13)** | Pressed *Alta prioridade* in the row → opened the sheet → ***Alta* was selected there.** Then chose *Baixa* in the sheet → **the row's chip released** (`aria-pressed="false"`) and the request became `?priority=low`. This is the one claim that proves the two surfaces are views of ONE state |
| Sheet shape (AC-15) | Title *Filtros*; `:modal` true (so `showModal()`); groups *Status* and *Prioridade*; status chips *Abertas · Concluídas · Não concluídas*; priority chips *Alta · Normal · Baixa*; two `input[type=date]` whose `.labels[0]` resolve to real *De* / *Até* elements — labels, not placeholders; **no *Aplicar* button** |
| Light dismiss, and only here (AC-A6) | The filter dialog carries `closedby="any"`; the detail dialog carries **no `closedby`** at all, keeping `showModal()`'s `closerequest` default. The editor's dismiss contract is untouched |
| Sheets never stack (AC-A9) | With the detail open, `document.querySelectorAll('dialog[open]').length === 1` and the header's filter button is inert behind the modal |
| Filtered empty (AC-14) | Filtering to `?status=missed` (zero rows) rendered exactly *Nenhuma tarefa com esse filtro.* with a *Limpar filtros* action and no group sections |
| Clearing restores (AC-14) | *Limpar filtros* produced a **bare `/api/tasks` with no query at all** — `toQuery(EMPTY_FILTER) === ""` proven end to end — restored all four groups, dropped the badge and reset the accessible name to plain *Filtros* |
| **Cold start resets the filter (AC-16)** | With all three chips active, a full reload restored: no chip pressed, no badge, `aria-label` back to *Filtros*, and a first request carrying **no query**. `localStorage` held only the two `praesto.today.collapsed.*` keys and the URL had no search string — the filter is in React and nowhere else |
| **And the asymmetry that makes it structural** | In the same reading, *Sem data* came back **expanded** because its collapse state HAD been persisted earlier in the session. Filter gone, collapse kept — layout standard §2.3 visible in one screen |

## The defect this pass caught

**`Filtros (1 ativos)`** — plural agreement broken at one. Found by reading the
accessible name at each count rather than only at three.

It is worth naming why this mattered rather than treating it as a typo. The
screen already gets this right one line away: the task count reads *1 restante* /
*6 restantes* / *nenhuma restante*, because `formatRemaining` special-cases each.
Guidelines §9.4 requires exactly that discipline. The filter label was written
straight from the approved microcopy row, which itself said *Filtros (N ativos)*
— so the defect was in the **approved copy**, not only in the code, and fixing
only the component would have left the table telling the next person to
reintroduce it.

Both were fixed: the component now agrees in number, and the table row now states
the rule (*Filtros (1 ativo)* / *Filtros (N ativos)* — singular at one, like *1
restante*) instead of a single broken example. Re-verified live over HMR:
`"Filtros (1 ativo)"` at one, `"Filtros (2 ativos)"` at two.

## Tier A — every interface change

| # | Check | Result |
|---|---|---|
| 1 | One primary action; nothing added "just in case" | ✔ the deck's *Adicionar* remains the only primary; chips and the filter icon are narrowing controls |
| 2 | Tappables ≥ 48 × 48 px | ✔ every chip 48 px tall; header filter button exactly 48 × 48 |
| 3 | No meaning by colour alone | ✔ pressed chips carry fill + weight + a check glyph; the badge is a number, not a dot |
| 4 | pt-BR, sentence case, infinitive buttons | ✔ every string matches the approved table — after the plural fix above |
| 5 | Tab / Enter / Esc, focus visible, focus returns | ✔ `Esc` closes the filter sheet; `showModal()` returns focus to the opener natively |
| 6 | Icon-only controls have `aria-label`; labels are real | ✔ the filter icon names its state; both date inputs resolve `.labels[0]` to real `<label>` elements |
| 7 | Tokens only | ✔ no literal introduced (plan Tasks 5–7 grep for it) |
| 8 | Destructive actions per §8 | ✔ (n/a) this phase adds none |
| 9 | No request to another origin | ✔ every `/api/tasks` entry is same-origin; no foreign origin appears |

## Tier B — once per shipped screen

- **Contrast:** unchanged from phase 2's measured pass — this phase introduces no new colour token; chips, sheet and badge all draw on `accent` / `surface-2` / `ink` / `muted`, whose six pairs were measured at 5.10:1 to 14.07:1 against targets of 3:1 and 4.5:1.
- **States simulated:** unfiltered, one filter, two filters, three filters, a filter matching zero rows, cleared, and a reload. The offline and failed-request states were not re-simulated — this phase changes no request path beyond adding a query string, and both were covered by the A5 Tier B pass.
- **Widths:** the 1920 px case is real and clean. The 375 px case remains a forced-column proxy for the reason phase 2 recorded — `resize_window` reports success while `window.innerWidth` stays 1920 — and the chip row's own `overflow-x: auto` is what §2.3 asks for at narrow widths.
- **Build against §11:** JS ~93 KB gzip (budget 170), CSS ~6 KB gzip (budget 30), precache 408 KiB (budget 1 MB).
- **Screenshot:** taken and shown in session — the chip row with *Abertas* pressed, the amber badge reading `1` on the header filter icon, and *Concluídas* correctly absent because `status=open` excludes it. `save_to_disk` timed out against the renderer again, as in phase 2, so the capture lives in the transcript rather than as a file.

## Not verified here

- **The phone.** No device pass. The Android back gesture closing the filter sheet is specifically a device check — `Sheet`'s own header comment records that the `history.pushState` fallback is specified but unbuilt, and that is the fix if the gesture fails there.
- **A real 375 px viewport** — see above.
- **`prefers-reduced-motion`** — this phase adds no animation.

## A finding outside this phase's scope, recorded rather than dropped

The code-reviewer, re-running the suite across attempts, hit **2 failures in
`test/task-list-contract.test.ts`** — a file this phase does not touch — and
diagnosed a concrete mechanism rather than stopping at "flaky": that file's
`beforeEach` deletes all Tasks, but when a test exceeds its 5 000 ms timeout its
in-flight `create()` calls are **not cancelled**, so their rows can land after the
*next* test's cleanup and inflate its `list()` read. The observed pairing — a bare
timeout immediately followed by a row-count inflation in the next test — fits that
mechanism exactly.

It is not caused by this unit and not fixable inside it (the file belongs to unit
2's frozen-contract suite, and R-X forbids touching it here). Both the reviewer
and a later full run reached 369/369 clean on an idle machine, so nothing here is
being closed on a red suite — but a suite that is only reliably green when the
machine is idle is a real liability once CI exists. Filed as its own task rather
than buried in this report.
