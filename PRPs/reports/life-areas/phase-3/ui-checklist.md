# UI/UX review checklist — assign and show: the *Área* group, the row's area name, capture seam (unit 13, phase 3)

Run 2026-10-12 by the Implementer, **by reading the code and running the check, the suite and the
build only**. No browser pane, no dev server and no device were used: no screenshot was taken and
nothing below claims a live pass. Items that need a rendered DOM are marked
`pending live check (orchestrator browser pass)`; items that need the owner's phone are marked
`owed to the owner's device`. No item is ✔ from imagination.

> **Addendum, 2026-10-12 (the body below is unchanged and is what phase 3 knew).** The orchestrator's
> browser-pane pass of phase 4 (`PRPs/reports/life-areas/phase-4/live-browser-pass.md`) then
> exercised this phase's surfaces at 375 px: the Task sheet's *Área* group of 12 chips is 343 px
> against 343 with every chip 48 px high and no overflow of the sheet's region, a 40-character name
> wraps inside the row, and a 500 from the areas request leaves the group absent with no banner.
> Item 12's ✘ is retired by that measurement (`phase-4/chip-overflow-measurement.md`,
> `Decision: keep Chip as is`). The device items stay owed to the owner's phone, and the items the
> pane pass did not record stay unobserved.

Change under review: the *Área* single-choice group in `TaskSheet` (after *Prioridade*, wrapping,
*Sem área* first), its zero-areas line and *Criar áreas* button, the *Aplicar a* label that now
names the area, the area name at the end of an open Task's meta line on *Hoje* and in search, the
`useLifeAreas` hook (the areas in their own atom, absent on failure), `ChipGroup`'s opt-in `wrap`,
and the one capture seam in `TodayScreen`. No new token, primitive, origin, endpoint, table or
migration; `TaskFilter`, `FilterSheet` and `FilterChips` are untouched.

Where a ✔ rests on the pure modules, the method names the suite that pins it
(`test/life-area-assign.test.ts`, `test/task-edit.test.ts`, `test/series-edit.test.ts`,
`test/format.test.ts`; the six pure-logic suites around this phase passed together, 292 tests, and
the whole suite is 1693 tests in 89 files, all passing, on 2026-10-12).

Two decisions the plan left to this phase and that a reader of the row should know:

- `TaskRow` adds the single Tailwind class `break-words` to the meta span **only** when it shows an
  area name, so an unbroken 40-character name wraps inside the text column instead of running under
  the pencil. With no name the class string is byte-identical to today's.
- The area name inherits the meta span's colour: on an overdue Task it reads in the overdue token
  together with the date phrase and the priority word, exactly as the priority word already does.
  The plan keeps "the same class string and the same `overdue` rule"; no new pair is introduced.

## Tier A — every interface change

1. ✔ — method: static inspection. The sheet's one primary action is still *Salvar*; the *Área*
   group adds chips and, with no areas, one `secondary` *Criar áreas*; the row gains text only.
   Live look: pending live check (orchestrator browser pass).
2. pending live check (orchestrator browser pass) — by construction: `Chip` is `min-h-12 min-w-12`
   and `ChipGroup` keeps `gap-2` (8 px, on both axes under `flex-wrap`); *Criar áreas* is the owned
   `Button` (`min-h-12`) in a `gap-2` column under its line; the row's text button keeps
   `min-h-12 flex-1`. Not measured in the DOM box model. The width exception is item 12.
3. ✔ — method: static inspection. The area name is text on the row, never a colour or a dot; the
   selected area chip carries `Chip`'s leading check, the fill and the heavier weight; a missing
   name is absence, not a colour; the zero-areas state is a sentence, not an icon.
4. ✔ — method: static inspection plus `test/life-area-assign.test.ts` and `test/format.test.ts`.
   Visible strings are pt-BR and sentence case: *Área*, *Sem área* (the existing `NO_AREA_LABEL`),
   `Você ainda não criou nenhuma área.` (addresses the owner as "você"), *Criar áreas* (the §9.1
   canonical *Criar* with its object), `Aplicar título, descrição, prioridade e área a` (visible
   text and accessible name identical). No `categoria` (the Level 2 grep is clean). No "Sem área"
   marker on an area-less row: `TaskRow` renders a name only when `taskMetaParts` carries one, and
   the literal does not appear in the row. The new copy is the plan's proposal, pending the owner
   (guidelines §9 records the voice as pending); each string is a literal in `TaskSheet.tsx`.
5. pending live check (orchestrator browser pass) — by construction: the chips are Base UI toggles
   (native buttons) inside the existing `<dialog>` sheet, so Tab and Space work and `Esc` closes it
   with focus returned to the opener, as for *Prioridade*; *Criar áreas* is a native button that
   routes to `/settings/life-areas`, where `Esc` goes back (phase 2). None of it exercised with
   real key presses.
6. ✔ — method: static inspection. The group has a visible `Área` paragraph and the same
   `aria-label` on its `ChipGroup`; the *Aplicar a* paragraph and its `aria-label` carry the one
   literal; the icon-only controls are unchanged; `<title>` and `lang` are untouched.
7. ✔ — method: static inspection. Only token classes (`font-data`, `font-text`, `text-t1`,
   `text-t2`, `font-semibold`, `text-muted`, `text-overdue`, `gap-2`, `px-4`, `py-1`) plus the plain
   utilities `flex`, `flex-wrap`, `flex-col`, `items-start` and `break-words`; no inline `style`,
   literal colour, size or duration; nothing new moves, so reduced motion has nothing to honour.
8. ✔ — method: static inspection plus `test/series-edit.test.ts`. No destructive action is added.
   *Aplicar a* keeps *Toda a série* as its default (`useSeriesSheet`), and the pure plan never
   sends an unchosen or unchanged area, so an ordinary re-save does not detach an occurrence.
9. ✔ — method: static inspection. The only new request is `fetchLifeAreas()` →
   same-origin `GET /api/life-areas`, through `request<T>()`; neither new file contains `fetch(`
   or a URL. A failed request ends in `setLifeAreas(null)` and triggers no other request. Not
   observed in DevTools Network (pending live check).

## Tier B — a changed screen

10. owed to the owner's device — contrast was not re-measured; no new colour pair is introduced
    (the name uses the meta span's existing `text-muted` and, when overdue, `text-overdue` on
    `bg-surface-2`; the chips and the secondary button are existing primitives). Note for the
    device: on an overdue Task the whole line, the name included, reads in the overdue colour.
11. pending live check (orchestrator browser pass) — states to simulate: the areas request blocked
    (Tasks list, no names, no group, no banner, no toast), zero areas (line and *Criar áreas*),
    slow areas (Tasks first, names after), offline, an area deleted from another tab (a 400 on
    *Salvar* shows under *Salvar* and the list refetches on return) and a series occurrence under
    both *Aplicar a* choices. By construction each is wired: `useLifeAreas` is its own atom, only
    the newest request writes, a 401 routes to the token gate, any other failure is `null`
    (`decideAreaGroup(null)` is `hidden`, never `empty`); the refresh on return to the foreground
    is wired on both screens and the refresh on reconnect on *Hoje*. Recorded, not hidden:
    *Criar áreas* leaves the screen, which unmounts the sheet, so its unsaved edits are lost; the
    button exists only while he has no areas.
12. ✘ exception (conscious, recorded, not fixed here) — `Chip` is `flex-none whitespace-nowrap` and
    the plan forbids changing it, so one chip wider than the row can overflow. By static reasoning,
    at 375 px: the dialog content is 343 px (`px-4` on the sheet) and the group's own `px-4` leaves
    311 px; a name near the 40-character limit is about 7-8 px per character at 14 px Inter medium
    (about 280-320 px) plus 26 px of chip chrome and 20 px for the pressed check, so the worst case
    can exceed the row by tens of pixels and make the sheet scroll sideways. This is an estimate,
    not a measurement. The twelve-area wrap itself is by construction (`flex flex-wrap gap-2`),
    and a long name on the row wraps (`break-words`, `min-h-16`). Remaining live half: pending
    live check (orchestrator browser pass) at 375 px and 1280 px; safe areas, keyboard overlap and
    the Android back gesture: owed to the owner's device.
13. ✔ — method: `npm run build`, 2026-10-12, read against §11:
    - First-load JavaScript: `index-BuzdFonD.js` 378.01 kB, **113.88 kB gzip** (budget <= 170 KB
      gzip; 113.18 kB at phase 2, +0.70 kB).
    - First-load CSS: `index-CsL4MAHQ.css` 26.56 kB, **6.30 kB gzip** (budget <= 30 KB gzip; the
      same file as phase 2: every class this phase uses was already compiled).
    - Precache: **25 entries, 493.55 KiB** (budget <= 1 MB; 491.13 KiB at phase 2).
    Lighthouse on the phone: owed to the owner's device.
14. owed to the owner's device — no screenshot was taken and none exists: no browser pane or device
    was available to the Implementer.

Result: one ✘, item 12, recorded above as a conscious exception. Pending (orchestrator browser
pass): items 2, 5, 11 and the live half of 1, 9 and 12. Owed to the owner's device: 10, 12 (phone
half), 14, Lighthouse and the back gesture.

## AC-20 walk

One line per clause of PRD AC-20 (`PRPs/prds/life-areas.prd.md`, lines 181-184). "Decidable half"
means the pure module the clause depends on is pinned by a passing test; the rendered half is never
✔ here.

- **An *Área* single-choice group (*Sem área* and the areas) sits after the priority** — decidable
  half ✔ (method: `decideAreaGroup` `choices` in pt-BR order, `areaChoiceValue`,
  `lifeAreaIdFromChoice`; `test/life-area-assign.test.ts` passes). Placement directly after
  *Prioridade* and the wrap are by static inspection of `TaskSheet.tsx`. Rendered: pending live
  check (orchestrator browser pass).
- **Saving persists the choice** — decidable half ✔ (method: `buildTaskPatch` sets, changes and
  clears the area and never sends an unchosen or unchanged one, `test/task-edit.test.ts`; the PATCH
  contract is phase 1's route suites). The save against a real database: pending live check
  (orchestrator browser pass).
- **On a series occurrence the choice follows *Aplicar a* as AC-16 plans it** — decidable half ✔
  (method: `planSeriesOccurrenceSave` under both choices, an unchanged area, a detached occurrence
  and a rule edit, `test/series-edit.test.ts`). The label and the two chips as rendered: pending
  live check (orchestrator browser pass).
- **With no areas the group is replaced by one line and a button that opens *Áreas*** — decidable
  half ✔ (method: `decideAreaGroup([])` is `empty`, `null` is `hidden`). The line, *Criar áreas*
  and both entries (`App.tsx` threads `onOpenLifeAreas` to *Hoje* and to search) by static
  inspection. Navigation and the button as rendered: pending live check (orchestrator browser
  pass).
- **Nothing is mandatory; a Task saves with no area** — decidable half ✔ (method: a draft with no
  area choice produces a patch with no area key, `test/task-edit.test.ts`; *Salvar* is not gated on
  the area, static inspection). The save as rendered: pending live check (orchestrator browser
  pass).
- **AC-14's observable half (a capture inside a filtered view lands in that area)** — not
  observable until phase 4 adds the filter dimension. This phase ships the pure decision
  (`captureAreaFields`, pinned in `test/life-area-assign.test.ts`) and one documented seam in
  `TodayScreen.submitCapture` that reads no filter, so today's create request is unchanged. Not
  claimed.

## AC-22 walk

One line per clause of PRD AC-22 (`PRPs/prds/life-areas.prd.md`, lines 190-192).

- **Given the areas request fails or is slow, Tasks list normally** — by construction: the Task
  fetch and `useLifeAreas` are separate atoms and the Task list never waits for the areas. pending
  live check (orchestrator browser pass) with the request blocked in DevTools.
- **Rows show no area name** — decidable half ✔ (method: `lifeAreaNameOf(null, id)` is `null`;
  `taskMetaLine` with a `null` name returns today's line, `test/life-area-assign.test.ts` and
  `test/format.test.ts`). Rendered: pending live check (orchestrator browser pass).
- **The Task sheet offers no *Área* group** — decidable half ✔ (method: `decideAreaGroup(null)` is
  `hidden`, never the zero-areas line). Rendered: pending live check (orchestrator browser pass).
- **No banner or toast appears** — by construction: the Level 2 grep proves `useLifeAreas.ts`
  contains none of `showToast`, `useToast`, `report(` or `useConnectivity`, and no error state is
  set. Observed: pending live check (orchestrator browser pass).
- **An area-less open Task with no area filter carries no "Sem área" marker** — decidable half ✔
  (method: the row's `areaName` is `null` for a `null` area id and `TaskRow` renders a name only
  when one is present; `test/format.test.ts` "no area name leaves today's line untouched"). The
  literal `Sem área` does not appear in `TaskRow.tsx`. Rendered: pending live check (orchestrator
  browser pass).
