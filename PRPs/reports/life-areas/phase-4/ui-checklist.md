# UI/UX review checklist — filter and close-out: the *Área* group, the applied chip, the capture seam (unit 13, phase 4)

Written 2026-10-12 by the Implementer in two passes, and kept honest about which evidence is which:

- **Attempt 1** ran by reading the code and running the check, the suite, the build and the restore
  drill. No browser, no screenshot. Every rendered clause was marked pending or owed.
- **The orchestrator's live pass** (same day) exercised the screens in the browser pane (Chromium
  emulating 375 x 812 and 1280 x 800, `vite dev`, a throwaway token, synthetic local rows). Its
  numbers and observations are in `PRPs/reports/life-areas/phase-4/live-browser-pass.md`, and this
  record cites that file for every item it moves out of "pending". Nothing here claims an
  observation that file does not contain.
- **Attempt 2** (this revision) fixed the two findings of that pass in `FilterChips.tsx` and
  re-ran Level 1 to 3. The Implementer has **no browser**, so it could not see the fixes; the
  orchestrator did, in a **second look** in the pane the same day (appended to
  `live-browser-pass.md`, "Second look"): both fixes behave as intended. Nothing was run on the
  owner's phone: contrast on a real panel, safe areas, keyboard overlap, the Android back gesture,
  Lighthouse and screenshots stay `owed to the owner's device`.
- **Attempt 3** changed records and documentation only (no source or test file) so that this
  record, `close-out.md`, `chip-overflow-measurement.md`, the roadmap and the domain docs agree
  with the completed measurement and the second look, and replaced the earlier wording that left
  a re-check for a later look, which stopped being true once that look had run, with "not recorded
  by either pass" where a state is still unseen. It re-ran Level 1 to 3; no ✔ below was added or
  removed.

Change under review: the *Área* single-choice group in `FilterSheet` (between *Prioridade* and
*Período*, wrapping, *Sem área* first, absent with no areas or a failed request), the applied area
chip at the head of the quick-filter row in `FilterChips` (a toggle; tapping it clears only the
area; its visible label is capped at 10 rem and, when the chip is toggled off, focus moves to the
first quick chip), the `lifeAreaId` dimension of `TaskFilter`, the pure `decideAreaFilterChip`, the
one capture seam in `TodayScreen.submitCapture` now reading `filter.lifeAreaId`, and the foreground
refetch reading the current filter through a ref. No new token, primitive, origin, endpoint, table
or migration; `Chip.tsx`, `SearchScreen.tsx` and `TaskSheet.tsx` are untouched (`Chip.tsx` is
byte-identical to the phase-4 base tree).

Where a ✔ rests on the pure modules, the method names the suite that pins it
(`test/task-filter.test.ts`, `test/life-area-assign.test.ts`; the full suite is 1719 tests in 89
files, all passing, re-run on 2026-10-12 after attempt 2, up from the 1693 phase 3 recorded).

Three things a reader of this record should know:

- **A defect that predates this unit was found during this phase's grounding and fixed here.**
  *Hoje*'s `visibilitychange` effect is registered once with an empty dependency array, so its
  `refresh()` closed over the first render's `filter` (`EMPTY_FILTER`). Since unit 3 a return to the
  foreground has therefore replaced a filtered list with the unfiltered one while the chips went on
  saying filtered. It now calls `refreshRef.current()`, a ref to the latest render's `refresh` (the
  idiom `useConnectivity` uses for `onOnline`). **Observed after the fix, in the pane** (live pass,
  "AC-21 / foreground refetch"): with *Casa* applied, a dispatched `visibilitychange` produced
  `GET /api/tasks?lifeAreaId=<id>`, the filtered query, alongside the four other refreshes.
- **The applied chip leaves the DOM when it is cleared** — and the live pass found what that did:
  with the keyboard, focus on the chip and Space, the chip disappeared and **focus fell to `<body>`**.
  Fixed in attempt 2 (item 5) and **re-observed fixed in the second look**: focus lands on
  *Abertas*, inside the row, by keyboard and by pointer tap.
- **A long area name pushed the quick chips off-screen at 375 px** — the live pass measured it
  (item 12). Fixed in attempt 2 at the call site; `Chip.tsx` stays as is. **Re-measured in the
  second look:** the applied chip is 206 px, 48 px high, *Abertas* fully on screen.

## Tier A — every interface change

1. ✔ — method: static inspection, plus the live pass's enumeration of the surfaces. The filter
   sheet's one secondary action is still *Limpar filtros*; the *Área* group adds chips only (no
   button); the quick row gains at most one `Chip`, itself a toggle, and the Level 2 grep proves no
   *Limpar filtros* or other non-toggle was added to `FilterChips.tsx` outside comments. Live: the
   pass listed the quick row as the applied chip plus *Abertas*, *Para hoje* and *Alta prioridade*
   and the sheet's group as *Sem área* plus 12 areas (`live-browser-pass.md`, "Measured"); it
   recorded nothing else in either.
2. ✔ — method: the live pass's box measurements, for what it measured. Every chip of the filter
   sheet's *Área* group and of the Task sheet's is 48 px high at 375 px (the filter sheet's also at
   1280 px); the *Áreas*
   screen's 25 controls are none under 48 x 48; in the quick row with the 40-character area
   applied the neighbours are 8 px apart (before the cap: applied chip 16 → 357, *Abertas* from
   365, *Para hoje* from 452, *Alta prioridade* from 548, each starting 8 px after the previous
   one's right edge; after it, in the second look: 16 → 222, then 230, 317 and 413, the same 8 px).
   Not separately recorded: the vertical gap between wrapped rows in the sheet (`gap-2` on both
   axes under `flex-wrap`, by construction). The capped applied chip of attempt 2 keeps `Chip`'s
   `min-h-12` and a single line; its measured height and the new geometry are item 12's re-check,
   recorded there (48 px high in the second look).
3. ✔ — method: static inspection and the live pass. The applied chip carries `Chip`'s leading
   check, its fill and its heavier weight (the pressed state), never a colour alone: the pass
   measured the pressed 40-character chip 21 px wider than the unpressed one (320 → 341), which is
   the 16 px check, its 4 px gap and the weight change; the badge is a number (the pass read
   `Filtros (1 ativo)`); an area the loaded list does not hold reads as the text *Área*, not as a
   missing chip (the pass read the neutral label with the area deleted).
4. ✔ — method: static inspection plus `test/life-areas-view.test.ts` for `NO_AREA_LABEL`, and the
   strings the pass read on screen. Visible strings are pt-BR and sentence case: *Área* (group
   label and the neutral applied chip), *Sem área* (the existing `NO_AREA_LABEL`), *Limpar filtros*
   and *Nenhuma tarefa com esse filtro.* (existing, `EmptyState`; the pass read both after the
   area was deleted), and the *Áreas* screen's *Você já tem 12 áreas. Exclua uma para criar
   outra.* No `categoria` (the Level 2 grep is clean). The neutral *Área* for an area the list
   does not hold is this plan's proposal and is recorded as pending the owner in
   `PRPs/reports/life-areas/device-proof.md`; each string is a literal in its component.
5. ✔ — fix applied and **re-observed in the second look** (keyboard `Space` on the applied chip: focus
   lands on *Abertas*, inside the row, not `<body>`; pointer tap: same, with `:focus-visible` false
   and no outline). Observed in
   the pane (`live-browser-pass.md`, "Item 5"): `Esc` closes the filter sheet and focus returns
   to the *Filtros* button; `Esc` in the *Áreas* rename field closes the form, stays on the screen
   and returns focus to *Renomear <área>*; Space on the applied chip clears the area. **Found
   there:** the cleared chip left the DOM and focus fell to `<body>`. **Fix (attempt 2,
   `FilterChips.tsx`):** before it calls `onClearArea`, `handleValueChange` moves focus to the
   chip's next sibling, the first quick chip (*Abertas*), which stays mounted. The reason, as the
   code comment says: that keeps the keyboard user in the row he was operating, where the header's
   filter button would send him out of it. Glue only, no decidable logic added, no test. A pointer
   tap shows no new ring — confirmed in the second look. Tab traversal over the chips was not
   recorded by either pass.
6. ✔ — method: static inspection. The group has a visible `Área` paragraph and the same
   `aria-label` on its `ChipGroup`, like *Status* and *Prioridade*; the applied chip's accessible
   name is its text and its pressed state is exposed by the Base UI `Toggle` (`aria-pressed`) the
   other chips already use; the icon-only controls are unchanged; `<title>` and `lang` are
   untouched. Attempt 2's cap is CSS only (`max-w-40 truncate` on a `<span>` inside the chip), so
   the DOM text, and therefore the accessible name, is still the full area name; the span also
   carries `title={name}` for a pointer hover. **Seen in the second look:** the capped label is the
   full name in the DOM and in `title`. **Not inspected by either pass:** `aria-pressed` on the
   applied chip and the group's `aria-label`, which rest on the static reading above.
7. ✔ — method: static inspection and the build. Only classes already used by the sibling groups
   (`flex flex-col gap-1`, `m-0 font-data text-t1 font-semibold text-muted`), the existing
   `ChipGroup` and `Chip`, and, from attempt 2, two utilities on the applied chip's label:
   `max-w-40` (a step of the same spacing scale as `min-h-12`: `calc(var(--spacing) * 40)`, 10 rem)
   and `truncate`; both were confirmed in the built CSS. No inline `style`, literal colour, size
   or duration; `Chip.tsx` is unchanged; nothing new moves, so reduced motion has nothing to
   honour.
8. ✔ — method: static inspection. No destructive action is added: *Limpar filtros* and the applied
   chip only call `setFilter`, which changes view state and writes nothing; a capture is an
   ordinary create and is unchanged in how it is confirmed or undone. (The pass deleted an area
   through the API to simulate another device; that was the harness, not a control of this unit.)
9. ✔ — method: static inspection and the live pass, for what it recorded. No new request and no
   new endpoint: the area reaches the server only as `lifeAreaId` on the existing same-origin
   `GET /api/tasks?...` through `listTasks(filter)` and `toQuery(filter)` (`src/app/api.ts`), and
   as `lifeAreaId` on the existing `POST /api/tasks` body through `captureAreaFields`. Observed in
   the pane: `GET /api/tasks?lifeAreaId=<id>` on the foreground return with an area applied, and
   `POST /api/tasks {"title":"…","lifeAreaId":"<id>"}` for a capture with the area applied. **Not
   recorded by either pass** (still unseen): that picking an area in the sheet issues exactly one
   `GET`, and the request bodies of a capture under *Sem área* and under no filter (see "AC-14
   observable half"). `toQuery` never emits an empty value, so the server's 400 for
   an empty `lifeAreaId=` cannot be produced by the sheet.

## Tier B — a changed screen

10. owed to the owner's device — contrast was not re-measured; no new colour pair is introduced
    (the applied chip and the group's selected chip use the existing pressed `Chip` tokens,
    `bg-accent` / `text-on-accent`, and the label paragraph the existing `text-muted` on the sheet
    surface).
11. ✔ for what the passes exercised, the rest not recorded by either pass — states, per
    `live-browser-pass.md`: **observed** — the areas request answering 500 (after a foreground
    refetch no row named an area, the Task sheet offered no *Área* group and no "nenhuma área"
    line, and no toast or banner appeared); an area deleted "on another device" followed by a
    foreground return (the applied chip read the neutral *Área*, the badge still read `Filtros
    (1 ativo)`, the list read *Nenhuma tarefa com esse filtro.* with *Limpar filtros*, the Tasks
    that had the area were unassigned and none deleted, and the refetch carried the filter); a
    capture with an area applied (see AC-14). **Not recorded by either pass:** zero areas (the filter
    sheet's group absent), the filter sheet's own *Área* group under the failed request (the pass
    watched the Task sheet; both are driven by the same `decideAreaGroup(null)` / `([])`, which
    `test/life-area-assign.test.ts` pins), offline, and the captures under *Sem área* and no
    filter. Recorded, not hidden: a capture made while the filter holds a deleted area's id is
    refused by the server under the capture field with the input kept (FR-045) until he taps
    *Limpar filtros*, which is the way out on screen.
12. ✔ — method: the orchestrator's measurements (`live-browser-pass.md`,
    `chip-overflow-measurement.md`, `Decision: keep Chip as is`), replacing the static estimate and
    the exception phase 3 carried. At 375 px, with 12 areas and one of exactly 40 characters:
    - Filter sheet *Área* group (13 chips): `scrollWidth` 343 = `clientWidth` 343 unpressed; the
      40-character chip is 320 px wide unpressed and 341 pressed (right edge 369 of 375, so about
      10 to 14 px into the sheet's side padding, never clipped, nothing scrolls); every chip 48 px
      high.
    - Task sheet *Área* group (12 chips): 343 = 343, the `<dialog>` region 375 = 375, chips 48 px.
    - Filter sheet `<dialog>` region: `scrollWidth` 390 against `clientWidth` 375 — an overflow of
      15 px caused by the *Período* "Até" date input (right edge 390), **not by any chip**. It
      predates this unit and is not changed here; it is recorded in `live-browser-pass.md` for
      whoever next touches that sheet.
    - *Hoje* row of an occurrence whose area is the 40-character name: the meta line wraps on
      three lines (`break-words`), no overflow, the pencil stays 48 x 48.
    - *Áreas* screen: no horizontal overflow; at 12 areas the add form is replaced by the notice.
    - 1280 px, filter sheet: the dialog is centred and 560 px wide, the *Área* group
      `scrollWidth` = `clientWidth` = 528, chips 48 px high.
    - **Quick row (the finding, before the fix):** with the 40-character area applied the leading
      chip was 341 px (16 → 357) and *Abertas*, *Para hoje*, *Alta prioridade* started at 365, 452
      and 548 against a 375 px viewport: all three at or past the edge, reachable only by
      scrolling the row (`scrollWidth` 689). **Fix (attempt 2):** the applied chip's visible label
      is capped at 10 rem (`max-w-40 truncate`, one line, about 20 characters of that name, the
      rest an ellipsis), the chip keeps `Chip`'s `min-h-12`, and the full name stays as the chip's
      DOM text and as the `title`, and whole in the filter sheet. Expected geometry, **computed
      from the measured chrome and not measured**: chip about 207 px (a 160 px label plus 47 px of
      border, padding, check and gap), so *Abertas* about 231 → 310 fully on screen and *Para hoje*
      about 318 → 406 straddling the edge, *Alta prioridade* beyond it. All three cannot fit
      beside an applied chip at 375 px at any cap: the three quick chips alone end at 324 px (no
      area applied, measured), leaving 51 px; what the cap buys is that the first quick chip is
      reachable without scrolling and the second visibly peeks, so the row reads as scrollable.
      **Re-measured in the second look:** chip 206 px (the computed 207 was right), 48 px high;
      *Abertas* 230 → 309 fully on screen, *Para hoje* 317 → 405 straddling the 375 px edge,
      *Alta prioridade* 413 → 538 beyond; `title` carries the full name.
    - **Left to the owner:** at exactly 40 characters the pressed chip leaves the sheet's 16 px
      gutter by 10 to 14 px (the measurement's own wording: a limit case, `Decision: keep Chip as
      is`). Whether that is acceptable or the limit should come down is his call; its rendering on
      his device is owed.
    Safe areas, keyboard overlap and the Android back gesture: owed to the owner's device.
13. ✔ — method: `npm run build`, 2026-10-12 (after attempt 2), read against §11:
    - First-load JavaScript: `index-DsgzkdfW.js` 379.37 kB, **114.35 kB gzip** (budget <= 170 KB
      gzip; 113.88 kB at phase 3, +0.47 kB).
    - First-load CSS: `index-Y5Io2xpq.css` 26.67 kB, **6.33 kB gzip** (budget <= 30 KB gzip;
      26.56 kB / 6.30 kB at phase 3, +0.11 kB: the two utilities `max-w-40` and `truncate`).
    - Precache: **25 entries, 494.99 KiB** (budget <= 1 MB; 493.55 KiB at phase 3).
    - The dev-token guard passed (`check-dev-token-absent`: 17 text files scanned).
    Lighthouse on the phone: owed to the owner's device.
14. owed to the owner's device — no screenshot was taken and none exists: the live pass recorded
    numbers and observed behaviour, not images, and the pane is not to be trusted for screenshots
    (guidelines §12.6).

Result: no ✘ remains. Item 12's carried exception is retired by measurement. **Both fixes re-observed
in the second look:** item 5 (focus after clearing the applied chip) and the quick-row half of
item 12 (the capped label). **Still unseen in the pane** (recorded by neither pass): the zero-areas
group, the filter sheet's group under a failed request, offline, the *Sem área* and no-filter
capture bodies, one `GET` per pick, Tab traversal, and item 6's `aria-pressed` and `aria-label`.
**Owed to the owner's device:** 10, 12 (phone half), 14, Lighthouse, the cold start and the back
gesture. **Left to the owner as a decision:** the 10 to 14 px gutter breach of a 40-character name
(item 12).

## AC-21 walk

One line per clause of PRD AC-21 (`PRPs/prds/life-areas.prd.md`, lines 185-189). "Decidable half"
means the pure module the clause depends on is pinned by a passing test. "Observed" cites
`live-browser-pass.md`; a clause the pass did not record is not claimed.

- **The *Área* group offers *Sem área* and each area** — decidable half ✔ (method:
  `decideAreaGroup` returns `choices` as a pt-BR-sorted copy, `test/life-area-assign.test.ts`,
  phase 3). Observed: the group held 13 chips, *Sem área* plus 12 areas, wrapping, 48 px each. The
  placement between *Prioridade* and *Período* and the *Sem área* chip first are by static
  inspection of `FilterSheet.tsx`; the pass did not record the order.
- **Picking one filters *Hoje* at once** — decidable half ✔ (method: `toQuery` emits
  `lifeAreaId=<id>` last and `lifeAreaId=none` for *Sem área*, `test/task-filter.test.ts`; the
  server half is phase 1's route suites). Observed: with an area applied, the filtered query
  `GET /api/tasks?lifeAreaId=<id>` was issued on the foreground return. The request issued by the
  pick itself was not recorded separately by either pass.
- **It raises the header badge** — decidable half ✔ (method: `activeCount` counts the area once,
  `test/task-filter.test.ts`). Observed: the badge read `Filtros (1 ativo)` with the area as the
  one active filter (seen in the deleted-area state, so the area counts once even when the list
  no longer holds it).
- **It appears as a selected chip** — decidable half ✔ (method: `decideAreaFilterChip` returns
  `area` with the name, `no-area` for `"none"` and `unknown` for an id the list does not hold,
  `test/life-area-assign.test.ts`). Observed: a leading chip bearing the area's name, 341 px for
  the 40-character one, 21 px wider pressed than unpressed (the check), and the neutral *Área* for
  a deleted area. Its label is now capped (item 12), and the second look re-measured it: 206 px
  wide, 48 px high, the full name kept in the DOM and in `title`.
- **With *Limpar filtros*** — decidable half ✔ (method: `EMPTY_FILTER` carries `lifeAreaId: null`,
  pinned by the exact-shape case in `test/task-filter.test.ts`, so the existing
  `onChange(EMPTY_FILTER)` clears the area with every other dimension). Observed: the control is
  offered in the filtered-empty state; tapping it was not recorded. The row itself holds no
  *Limpar filtros* control; this follows the owner's 2026-08-24 cut and is flagged for him in
  `device-proof.md`.
- **Killing and reopening the app starts unfiltered** — by static inspection ✔: the filter is
  `useState<TaskFilter>(EMPTY_FILTER)` and the Level 2 grep proves none of `task-filter.ts`,
  `FilterSheet.tsx` or `FilterChips.tsx` touches `localStorage`, `sessionStorage` or `indexedDB`.
  A real cold start: owed to the owner's device (`device-proof.md`, step 6).
- **A deleted area reads *Nenhuma tarefa com esse filtro.* with *Limpar filtros* after the
  refetch** — decidable half ✔ (method: an id matching no area is a 200 with an empty list,
  `test/life-areas-task-routes.test.ts`; the filtered-empty state is driven by
  `activeCount(filter) > 0`, which counts the area). **Observed** in the pane: after the area was
  deleted through the API and the foreground refetch ran, the chip read *Área*, the badge still
  said `Filtros (1 ativo)`, and the list read *Nenhuma tarefa com esse filtro.* with *Limpar
  filtros*; the Tasks that had the area were unassigned, none deleted.
- **With no areas, or when the areas request fails, the group is absent** — decidable half ✔
  (method: `decideAreaGroup([])` is `empty` and `(null)` is `hidden`; the sheet renders the group
  only for `choices`, static inspection). Observed for the **Task** sheet under a 500 from
  `GET /api/life-areas` (no *Área* group, no "nenhuma área" line, no toast or banner). The filter
  sheet's group under the same failure, and with zero areas, were not recorded by either pass.

## AC-14 observable half

PRD AC-14's pure half was pinned in phase 3 (`captureAreaFields`,
`test/life-area-assign.test.ts`); this phase makes `submitCapture` pass `filter.lifeAreaId` to it, so
the half phase 3 could not observe is now wired. Three captures were to be observed as the
`POST /api/tasks` request body; the pass observed one.

- **An area filter is active** — expected body carries `lifeAreaId: "<that id>"`. Decidable half ✔
  (`captureAreaFields("<id>")` is `{ lifeAreaId: "<id>" }`). Wiring ✔ by static inspection and the
  Level 2 grep (`captureAreaFields(filter.lifeAreaId)` present, the constant-null seam gone).
  **Observed** in the pane: with *Casa* applied, capturing "teste captura na área filtrada" sent
  `POST /api/tasks {"title":"…","lifeAreaId":"<Casa id>"}`, and the Task appeared in *Sem data* (a
  collapsed group, count 1 → 2) with *Casa* as the area name on its row. Whether it is the same
  on the owner's device: owed (`device-proof.md`, step 5).
- ***Sem área* is active** — expected body carries `lifeAreaId: null` (`JSON.stringify` keeps an
  explicit `null`). Decidable half ✔ (`captureAreaFields("none")` is `{ lifeAreaId: null }`). The
  request body was not recorded by either pass.
- **No area filter** — expected body carries NO `lifeAreaId` key (`captureAreaFields(null)` is
  `{}`, so the request is byte-identical to the one sent before areas existed). Decidable half ✔.
  The request body was not recorded by either pass.
- **FR-045 is unchanged** — static inspection: `setTitle("")` is still sequenced after the awaited
  `createTask(...)`, so a failed save (including the 400 a stale area id would earn) keeps what the
  owner typed.
