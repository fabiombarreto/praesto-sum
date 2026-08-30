# Device verification — unit 4 phase 4, "The day, whole"

- **Date:** 2026-08-29
- **Verified by:** the owner (this is his report; the implementer saw none of it)
- **Build:** working tree at `6c43e13`, served by `npm run dev` on the host at `http://127.0.0.1:5173`
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

## Guidelines review checklist

`CLAUDE.md` makes running the checklist mandatory on every interface change. It was **not run item by item** in this pass — the owner's report was a functional one, and pasting a ✔ against each checklist line on that basis would be inventing evidence. ✘

The checklist covers things a functional pass does not reach: contrast measurement on the new dashed-outline treatment against `--color-line-strong` (§4.3), the 48 px hit area and 8 px separation on the row link (§3.3), and reduced-motion behaviour on the collapse (§7.3). **This is the phase's largest open item**, and it is recorded rather than papered over.

## What this record does NOT establish

1. **Nothing at phone width.** The Android pass did not run.
2. **The accessibility obligations** guidelines §10 imposes on a tappable row that does not look interactive — the accessible name carrying both title and destination, the focus ring on the row link, DOM reading order — were implemented against the rules but not verified with a screen reader or keyboard-only pass.
3. **The partial-failure branch**, for the reason above.
4. **The review checklist**, for the reason above.

Recorded on 2026-08-29 by the implementer, from the owner's report, with every gap stated rather than smoothed.
