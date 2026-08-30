# Device verification — unit 4 phase 4, "The day, whole"

- **Date:** 2026-08-29
- **Verified by:** the owner (this is his report; the implementer saw none of it)
- **Build:** the owner's pass ran against `6c43e13` on the host dev server. **Deployed to production 2026-08-30** as Version `820a8d73` so the phone pass can happen at all — the earlier instruction to test on Android was impossible while the change was local, and the owner said so
- **Outcome:** the owner reported the checks ran and everything worked

> **How to read this record.** The owner's report was a summary — *"fiz os testes, tudo funcionando corretamente"* — not a per-item dictation. Rows marked ✔ are covered by that report. Rows marked ✘ or *not covered* are NOT things he said failed; they are things this record cannot honestly claim, and each says why. Writing ✔ across the board would have made the document useless as evidence exactly where evidence matters most.

## Devices

| Device | Status | Note |
|---|---|---|
| Windows PC | ✔ verified | The owner's own browser against the local dev server |
| **Android phone** | ✘ **not covered** | Confirmed with the owner on 2026-08-29: this pass did not run on the phone. **The gap the roadmap has tracked since unit 3 stays open**, and this phase did not close it. The Agenda group is untested at phone width, where §2.4's leading time column and the two-line title clamp have the least room |

## The four AC-A8 conditions

The point of AC-A8 is that these must never be the same pixels. A screen showing fewer commitments than exist is worse than one showing none, because the owner cannot tell.

| Condition | Status | Note |
|---|---|---|
| **sem eventos** hoje | ✔ covered by the owner's report | Renders *Nada na agenda hoje.* rather than an absent region |
| **rede cortada** | ✔ covered by the owner's report | The offline banner takes precedence over the agenda banner — one condition explains the other, so saying both would say it twice |
| **token revogado** | ✔ covered by the owner's report | *A conexão com o Google expirou. Reconecte para ver a agenda.* — distinct from the transient-failure sentence |
| **falha parcial** per calendar | ✘ **not verifiable on a device** | Named as a limit in the APPROVED plan before implementation, not discovered afterwards: a per-calendar failure cannot be staged on demand against the real Google. Its correctness rests on the code review of Task 7's diff and on the two route tests in `test/google-calendar-routes.test.ts` that assert the healthy events are returned AND the failed calendar is named |

## The behaviour a defect would have hidden

The grounding pass predicted that routing a Google failure through `useConnectivity` would disable Task capture app-wide, because `server-unreachable` gates every write. `refreshEvents()` therefore never calls `report(...)`.

| Check | Status |
|---|---|
| Task capture and completion keep working while Google is failing | ✔ covered by the owner's report |
| A successful Google fetch does not clear the offline banner while `/api/tasks` is still failing | ✘ not separately reported — the inverse direction of the same guard, and no one exercised it in isolation |

## Layout standard §2.4 conformance

| Rule | Status |
|---|---|
| One *Agenda* group, first in the list, above *Atrasadas* | ✔ |
| Today's events only — nothing from days 2–7 of the API window | ✔ |
| Ordered by start instant, not by calendar | ✔ |
| No checkbox; no edit, complete or delete affordance | ✔ |
| Leading time column, dashed outline, never the accent colour | ✔ |
| An untitled event reads *(sem título)* | ✔ |
| Tapping opens Google Calendar | ✔ |
| Collapse state persists across a reload | ✔ |

## Guidelines review checklist — run 2026-08-30

Run against the source and the computed token values, item by item. **It found a real defect on its first pass**, which is the argument for running it rather than declaring it.

**Tier A**

| # | Item | |
|---|---|---|
| 1 | One primary action; nothing "just in case" | ✔ The agenda adds no control. Its only affordance is outward |
| 2 | Tappable ≥ 48 × 48 px, ≥ 8 px apart | ✘ **→ fixed.** `EventRow` was `min-h-14` (56 px). It passed 48 px, so nothing failed — but `--row-min` is 64 px and `TaskRow` is 64 px, and the two kinds sit adjacent in one list, where an 8 px mismatch reads as misalignment rather than as distinction. Now 64 px (`b4076df`) |
| 3 | No meaning by colour alone | ✔ Three cues carry "external": the dashed outline, the leading time column, and the absent completion control |
| 4 | pt-BR, sentence case, zero special-cased | ✔ Zero is *Nada na agenda hoje.*; the partial-failure line special-cases one calendar against many |
| 5 | Tab / Enter / Esc, visible focus, focus returns | ⚠ **partial.** The row is a native `<a>`, so it inherits the global `:focus-visible` ring and activates on Enter. **Not exercised with a keyboard.** Note the standing gap the guidelines already carry: an anchor does not activate on Space, and item 5 asks for Space while Tier A item 5 does not |
| 6 | Icon-only controls labelled; decorative icons hidden | ✔ Both new icons are `aria-hidden="true"`; the destination is appended to the row's accessible name via `sr-only`, never replacing the title |
| 7 | Tokens only; durations from the bands; reduced motion | ✔ No literal colour or size in `EventRow`. It adds no animation — the collapse is `TaskGroup`'s existing transition, unchanged |
| 8 | Destructive actions follow §8 | ✔ n/a — this phase adds nothing destructive |
| 9 | No request to another origin | ✔ Every `fetch` is same-origin `/api/*`. The row LINKS to Google, which is navigation the owner initiates, not a request the page makes |

**Tier B**

| # | Item | |
|---|---|---|
| 10 | Contrast measured and recorded | ✔ Computed from `tokens.css` by WCAG 2.2 relative luminance: title 16.82:1, time column 7.24:1, untitled fallback 7.24:1 (all ≥ 4.5), calendar glyph 5.21:1 and the **dashed outline 3.22:1** (both ≥ 3.0). The outline is the tightest pair and the one that matters most — it is the sole carrier of "external" for a reader who resolves contrast poorly |
| 11 | The §8 states the screen can reach were simulated and read right | ✔ three of four (see the AC-A8 table above); the partial-calendar failure cannot be staged |
| 12 | Checked at 375 px and 1280 px; safe areas, keyboard overlap, back gesture on the phone | ✘ **open.** Not checked at 375 px, and nothing on the phone. This is the same gap as the Android row above |
| 13 | Build size read against §11; Lighthouse on the phone | ✘ **open.** The bundle was built and deployed but the size report was not read against the §11 budget, and no Lighthouse run exists |
| 14 | Screenshots filed, or the reason none exists written down | ✘ **none exist.** The browser pane sits at the token gate — it keeps storage separate from the owner's own browser — so the implementer never saw the rendered screen. Recorded here as the reason, per the item's own escape clause |

**Open ✘ items: 12, 13, 14, and the ⚠ on 5.** Guidelines: *"One ✘ without a recorded, conscious exception means the change is not done."* Items 12 and 13 need the phone; 14 has its reason written down as the item allows; 5 needs a keyboard pass. **Tier A is otherwise clean, and its one ✘ was fixed rather than excused.**

## What this record does NOT establish

1. **Nothing at phone width.** The Android pass did not run.
2. **The accessibility obligations** guidelines §10 imposes on a tappable row that does not look interactive — the accessible name carrying both title and destination, the focus ring on the row link, DOM reading order — were implemented against the rules but not verified with a screen reader or keyboard-only pass.
3. **The partial-failure branch**, for the reason above.
4. **The review checklist**, for the reason above.

Recorded on 2026-08-29 by the implementer, from the owner's report, with every gap stated rather than smoothed.
