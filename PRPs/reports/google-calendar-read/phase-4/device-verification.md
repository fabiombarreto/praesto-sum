# Device verification — unit 4 phase 4, "The day, whole"

- **Date:** 2026-08-29 (PC) and **2026-08-30** (Android, against production)
- **Verified by:** the owner (this is his report; the implementer saw none of it)
- **Build:** the owner's pass ran against `6c43e13` on the host dev server. **Deployed to production 2026-08-30** as Version `820a8d73` so the phone pass can happen at all — the earlier instruction to test on Android was impossible while the change was local, and the owner said so
- **Outcome:** the owner reported both passes ran and everything worked

> **How to read this record.** Both owner reports were summaries — *"fiz os testes, tudo funcionando corretamente"* (PC) and *"fiz o teste no android. tudo funcionando"* (phone) — not per-item dictations. Rows marked ✔ are covered by that report. Rows marked ✘ or *not covered* are NOT things he said failed; they are things this record cannot honestly claim, and each says why. Writing ✔ across the board would have made the document useless as evidence exactly where evidence matters most.

## Devices

| Device | Status | Note |
|---|---|---|
| Windows PC | ✔ verified | The owner's own browser against the local dev server |
| **Android phone** | ✔ **verified 2026-08-30** | Against production `820a8d73`, not against a tunnel to the dev server — so what he exercised is byte-for-byte what ships. **This closes the gap the roadmap has tracked since unit 3.** The owner was asked to look at five specific things and reported them all working; they are listed below rather than left as "tudo funcionando" |

### What the phone pass was asked to look at

Named before he ran it, so the report answers a question rather than being read back into one.

| Asked | Why it was the thing to ask |
|---|---|
| The *Agenda* fits at 375 px without overflowing | §2.4's leading time column plus the two-line title clamp have the least room here; this is item 12's viewport half |
| Event rows and task rows are the **same height** | The 64 px fix (`b4076df`). It doubled as a check that the service worker had actually taken the new build — a stale SW would have shown the 56 px rows |
| Tapping an event opens Google Calendar | The row's only affordance, and the one AC-A8 cannot assert from the DOM |
| The back gesture does not leave the app | Item 12's Android-specific half |
| The bottom safe area is clear of the gesture bar | Item 12's safe-area half |

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
| 12 | Checked at 375 px and 1280 px; safe areas, keyboard overlap, back gesture on the phone | ✔ **375 px, safe areas and the back gesture** verified on the phone 2026-08-30. 1280 px is covered by the PC pass. *Keyboard overlap was not exercised* — this phase adds no input to the agenda, so there is nothing new for a keyboard to overlap; the capture field it could overlap is unit 3's and unchanged |
| 13 | Build size read against §11; Lighthouse on the phone | ⚠ **size read, Lighthouse not run.** Measured on the deployed build (see below). Every size budget passes with room. **No Lighthouse run exists**, so §11's LCP/INP/CLS and the ≥ 90 score are unverified for this phase |
| 14 | Screenshots filed, or the reason none exists written down | ✘ **none exist.** The browser pane sits at the token gate — it keeps storage separate from the owner's own browser — so the implementer never saw the rendered screen. Recorded here as the reason, per the item's own escape clause |

### §11 budget, measured on the deployed build

Numbers from `dist/client/` for `index-CibhDwkB.js` — the exact hash production serves, verified by fetching the shell.

| Measure | Budget | Measured | |
|---|---|---|---|
| First-load JavaScript | ≤ 170 KB gzip | **93.5 KB** (app 91.3 + workbox-window 2.2) | ✔ 45 % of budget |
| First-load CSS | ≤ 30 KB gzip | **5.9 KB** | ✔ |
| Fonts | ≤ 2 WOFF2, ≤ 100 KB together | **68.4 KB** — Inter var 47.1 + Unbounded 800 21.3 | ✔ |
| Precache total | ≤ 1 MB | **412.5 KB** across 16 distinct URLs | ✔ |
| LCP · INP · CLS · Lighthouse ≥ 90 | see §11 | — | ✘ **not run** |

Two things surfaced while measuring, both recorded rather than quietly fixed:

1. **§11's font row was stale and this phase would have failed it.** It read *"one WOFF2, ≤ 100 KB"* while §5.3 reads *"at most two … ≤ 100 KB together"*. ADR-0010 made that amendment **conditional** on a measurement — step 2.8 measured 70 KB on 2026-08-20, §5.3 was amended, and the §11 table was left behind. Two files have shipped since A5. Corrected in the guidelines with a History row; the table above is scored against the corrected rule.
2. **The precache manifest lists 25 entries for 16 URLs.** Nine (fonts, icons, favicon, manifest) appear twice — `includeAssets` overlapping `globPatterns`. Both copies carry an **identical revision**, so Workbox dedupes on install and the phone downloads each once: 412.5 KB, not the 499.8 KB a naive sum gives. No runtime cost, so no fix here — noted so the next person reading the manifest does not mistake it for a real duplicate download.

### Where the checklist stands

| | Items |
|---|---|
| ✔ closed | 1, 2 (defect found → fixed), 3, 4, 6, 7, 8, 9, 10, 11 (3 of 4 — see AC-A8), **12** |
| ⚠ partial | **5** — no keyboard pass; **13** — sizes measured, Lighthouse not run |
| ✘ open | **14** — no screenshots; the reason is written down, which the item's own escape clause allows |

Guidelines: *"One ✘ without a recorded, conscious exception means the change is not done."* Item 14 is the only ✘ and it takes the escape clause explicitly. **Tier A is clean, and its one failure was fixed rather than excused.**

The two ⚠ are named as this phase's debt rather than folded into a ✔:

- **Keyboard (5).** `EventRow` is a native `<a>`, so focus ring and Enter come from the platform, and nothing custom overrides them. Not exercised. Low risk, honestly unverified.
- **Lighthouse (13).** The sizes that predict it all pass with wide margins, but a score is not a size. §11 asks for a real device run recorded under `PRPs/reports/`; that run does not exist for this phase.

## What this record does NOT establish

The phone pass closed the largest of these; four remain, and none of them is a thing the owner said failed.

1. **The accessibility obligations** guidelines §10 imposes on a tappable row that does not look interactive — the accessible name carrying both title and destination, the focus ring on the row link, DOM reading order — were implemented against the rules but verified by reading the source, not with a screen reader or a keyboard-only pass. A phone pass does not reach these.
2. **The partial-failure branch**, for the reason given in the AC-A8 table: it cannot be staged against the real Google on demand. It rests on the code review of Task 7 and on two route tests.
3. **Lighthouse and the field metrics** §11 asks for on the real device. Every size budget passes with margin, which predicts but does not measure them.
4. **No screenshots exist.** The reason is recorded above, as item 14 allows — but a reason is not an image, and nobody can audit this phase's pixels from this file.

Whether `ALL_DAY_LABEL` should read **"dia todo"** is still the owner's to confirm; it is flagged as pending in `src/shared/format.ts`. Neither pass reported on it, most likely because no all-day event fell on either day.

Recorded 2026-08-29 and extended 2026-08-30 by the implementer, from the owner's two reports, with every gap stated rather than smoothed.
