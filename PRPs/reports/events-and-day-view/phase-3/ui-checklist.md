# UI/UX review checklist — the range function and the day: `/day/AAAA-MM-DD`, local commitments in the Agenda, the header date (unit 14, phase 3)

Written 2026-10-19 by the Implementer, and kept honest about which evidence is which:

- **What this record rests on.** Reading the code, `npm run check`, the targeted and the full suites, `npm run build` and
  the invariant diffs. **The Implementer has no browser**, so it saw nothing rendered: no box was measured, no screenshot
  exists, and every clause that needs a rendered page is marked `owed to the live pass`. The live pass is written as
  an executable protocol, `PRPs/reports/events-and-day-view/phase-3/live-pass-protocol.md`; when the orchestrator runs
  it, its observations land in `live-browser-pass.md` beside this file and the `owed to the live pass` marks below are
  replaced by a citation of those numbered observations, nothing else changing. Whatever the pane cannot show
  (contrast on a real panel, safe areas, the Android back gesture, keyboard overlap, Lighthouse) stays
  `owed to the owner's device` and is phase 5's device proof.
- **Surfaces under review.** `DayScreen` (new route screen), `LocalEventRow` (new), the changed `EventRow` (optional
  `timeLabel` and `wideTime`; default markup byte-identical), the changed *Hoje* header (the date is now a button) and the
  changed Agenda region of `TodayScreen` (local commitments beside Google's, fed by `agendaItemsForToday`). No new token,
  primitive, colour, motion, origin, endpoint, DTO, table or migration.
- **Where a ✔ rests on a pure module**, the method names the suite that pins it (`test/day-range.test.ts`,
  `test/day-view.test.ts`, `test/agenda-items.test.ts`, `test/day-item-local.test.ts`, `test/day-groups-local.test.ts`,
  `test/app-route.test.ts`; the full run is 2413 tests in 113 files, all passing).
- **New visible strings — approved by the owner on 2026-10-21** (PRD Decisions Log D-V; plan Notes D3-10; the plan's Decision Gate says every string
  is quoted, which is not true of these): `Dia anterior`, `Próximo dia` (aria-labels; *Anterior/Próximo* are the
  guidelines' canonical verbs), `Navegar entre dias` (aria-label of the stepper), ` — abrir o dia` (screen-reader suffix of
  the header date button), the range label `HH:mm–HH:mm` (en dash, no spaces), the continuation label `até HH:mm`, and the
  section labels `Dia inteiro`, `Compromissos`, `Tarefas`. From the PRD or reused as they are: `Nada neste dia.`, `Hoje`,
  `Voltar`, `Tentar de novo`, `dia todo`, the offline banner, *Nada na agenda hoje.*, the partial line and the three Google
  failure strings, and the generic request-failure sentences.

## Tier A — every interface change

1. ✔ — method: static inspection. `DayScreen` has no `primary` button: its controls are *Voltar*, the two arrows, the
   ghost *Hoje* (only when another date is shown), the secondary *Tentar de novo* (only after a failed read) and the
   Task rows that already exist on *Hoje*. The header date is the existing text turned into a control, not a new element
   beside it; *Hoje* keeps the capture deck as its one primary action. `LocalEventRow` carries no control at all.
2. ✔ — static inspection, then measured in the live pass (`live-browser-pass.md`, Measured, and O18): every `Button` on the new screen is `size-12` or `min-h-12`; the stepper
   row is `justify-between` with `gap-2`, so the arrows sit at the two ends and *Hoje* between them (arithmetically about
   86 px from each neighbour at 375 px, not measured); the header date button is `min-h-12` tall and as wide as its text
   with no padding, so its width and its 12 px gap to the title are measurements the protocol asks for ("Measurements",
   the *Hoje* header rows). The local row is not tappable, so it has no hit area to size.
3. ✔ — method: static inspection. Local, Google and Task rows differ by outline style (solid or dashed), ground (filled
   `surface-1`, transparent, filled `surface-2` with relief), glyph (`CalendarDays` or `Calendar` or a checkbox) and the
   leading time column, never by colour alone; neither event row uses `text-accent` or `text-live` (grep clean); a failed
   read is a sentence in text, not a colour; the header date reads as a control by its underline, not by its colour.
4. ✔ — method: static inspection and the pinned pure copy. Visible copy is pt-BR, sentence case, with infinitive or
   canonical-verb buttons (*Voltar*, *Hoje*, *Tentar de novo*; the arrows are named *Dia anterior* and *Próximo dia*),
   dates and times from `Intl` with `pt-BR`/`America/Sao_Paulo` (`formatDayHeading`, `formatDayItemTime`, pinned in
   `test/day-view.test.ts`), and no count is shown that could be zero (the one count is *Agenda · N*, rendered only above
   zero). The new strings are listed in the preamble and pending the owner; `até HH:mm` and the `–` range are the plan's
   own wording (D3-10).
5. ✔ for what was observed (`live-browser-pass.md` O20: `Esc` leaves the day) and static inspection otherwise; Tab order, the visible ring on the date button and `Esc` during an inline edit were not observed in the pane and stay `owed to the owner's device`: every control is a native `<button>`; `Esc` calls `back()` unless the
   keystroke was already claimed (`event.defaultPrevented`, which the inline title editor sets); `:focus-visible` is the
   global rule of `styles.css`; `DayScreen` opens no dialog, so there is no opener to return focus to, and the stepper
   buttons keep focus while the screen stays mounted. Tab order, a visible ring on the date button and `Esc` while an
   inline edit is open are the protocol's AC-24 items 2 and 10.
6. ✔ — method: static inspection. Icon-only controls carry `aria-label` (*Voltar*, *Dia anterior*, *Próximo dia*); the
   text controls (*Hoje*, *Tentar de novo*) have visible text; the header date button's accessible name begins with the
   visible date (WCAG 2.5.3) and ends with the screen-reader suffix; the stepper is a `<nav>` with a name, the sections are
   named regions, the heading is the one `<h1>` and `aria-live="polite"` so a step is announced, `document.title` is
   `<heading> · Praesto Sum`, and `DayScreen` has no input of its own (the inline title editor is `TaskRow`'s, labelled).
   `lang` is untouched.
7. ✔ — method: static inspection and the build. Only existing tokens and utilities: `bg-surface-1`, `border-line`,
   `text-muted`, `text-faint`, `text-ink`, `text-overdue`, `rounded-card`, `font-data`, `tabular-nums`, plus `min-w-20`,
   `whitespace-nowrap` and `underline-offset-4`, all confirmed in the built CSS (`min-w-20` resolves to
   `calc(var(--spacing) * 20)`, 80 px). No inline `style`, no literal colour, no new motion, no `uppercase` or
   `text-transform` (grep clean); nothing animates here, so reduced motion has nothing to honour beyond the Task rows'
   existing completion animation.
8. ✘ — recorded, conscious exception. Completing a Task on `/day` is a reversible action that guidelines §8 wants confirmed
   by a toast with *Desfazer*. The plan (Task 9) prescribes `SearchScreen`'s server-first pattern and no toast on this
   screen, and `/day` has no toast slot in its grid; the completed Task leaves the list after the server answers and can
   be reopened from *Hoje*'s *Concluídas* group. Flagged for the owner, who decides whether `/day` should gain the toast
   slot (a layout change beyond this phase). No irreversible action exists on the screen; a failed write is an inline,
   persistent line.
9. ✔ — method: static inspection. Every request goes through `request()` in `src/app/api.ts` to a same-origin `/api/...`
   path (`/api/events`, `/api/tasks`, `/api/google/events`, `/api/life-areas`); `DayScreen`, the rows and the header
   contain no `fetch(`, no absolute URL and no third-party script (grep clean). A Google row's link is a navigation to
   Google Calendar the owner chooses, not a request the page makes. The network log of the live pass is an additional
   check (protocol, "Measurements", last row).

## Tier B — a changed screen

10. owed to the owner's device — contrast was not measured by anyone. No new colour pair is introduced: the local row's
    time is `text-muted` and its glyph `text-faint` on `surface-1`, the Google row's pair is unchanged, the failure
    lines use `text-overdue` on the screen ground exactly as `AdherenceScreen` does.
11. ✔ for the states observed in the live pass (O6, O7, O17, O19, O22, O23: a Google outage in each of its four forms, a failed commitments read, a failed Task read, an empty day, a stale response after rapid stepping); a failed Task write, offline and the loading state on its own were not observed and stay `owed to the owner's device`. The states `/day` and the Agenda can reach, as simulated per the protocol: loading
    (a delayed source), a Google outage in each of its four forms (`not_connected`, `invalid_grant`, 502, partial), a
    failed commitments read, a failed Task read, a failed Task write, offline, an empty day, an empty Agenda, a
    stale response after rapid stepping. The decision table behind them is pinned by `test/agenda-items.test.ts`
    (`decideAgendaNotice` returns the empty text in exactly one combination out of every one).
12. ✔ — measured in the live pass (`live-browser-pass.md`, Measured): the widest label `23:00–01:00` is 80 px wide on one line, the longest heading wraps to two lines without clipping or moving *Voltar*, the header date button is 59 × 48; not observed: `até HH:mm` and `dia todo` in the narrow 56 px column on *Hoje* (no multi-day fixture there). Original clause: 375 px and 1280 px, with the widest time label measured (`HH:mm–HH:mm`, about 79 px at 12 px mono
    against the 80 px minimum column the wide rows use; computed, not measured) and the narrow 56 px column on *Hoje* (where `até HH:mm` and
    `dia todo` may wrap onto two lines inside the 64 px row), the longest heading wrapping without pushing *Voltar*, and
    the header date button's box. Safe areas, keyboard overlap, `overscroll-behavior` and the Android back gesture across
    the visited days: `owed to the owner's device`.
13. ✔ — method: `npm run build`, 2026-10-19, read against §11. First-load JavaScript `index-B2zR9fFp.js` 390.99 kB,
    **117.72 kB gzip** (budget <= 170 KB gzip). First-load CSS `index-CRoK0eJM.css` 26.87 kB, **6.36 kB gzip** (budget
    <= 30 KB gzip). Precache **25 entries, 506.54 KiB** (budget <= 1 MB). Against the last record (life-areas phase 4:
    114.35 kB, 6.33 kB, 494.99 KiB) that is +3.37 kB JS gzip, +0.03 kB CSS gzip and +11.55 KiB precache (not attributed:
    it spans this phase's screens and the shared modules they import). Fonts unchanged. The dev-token guard passed
    (`check-dev-token-absent`: 17 text files scanned). Lighthouse on the phone: owed to the owner's device.
14. owed to the owner's device — no screenshot was taken and none exists (no browser here, and the pane is not to be
    trusted for screenshots, guidelines §12.6); the live pass records numbers and observed behaviour, and the device
    photos are the artefact to ask for.

Result: one ✘ with a recorded exception (item 8). Nothing rendered was observed by the Implementer; the orchestrator's live pass of 2026-10-19 (`live-browser-pass.md`) closed items 2 and 12 and the observed parts of items 5 and 11; items 10, 12 (phone half), 14 and the unobserved parts of items 5 and 11 stay with the owner's device.

## AC-23 walk

One line per clause of PRD AC-23 (`PRPs/prds/events-and-day-view.prd.md`, line 93). "Decidable half" means the pure module
the clause depends on is pinned by a passing test; "observed" cites `live-browser-pass.md` (run 2026-10-19).

- **Given one local commitment and one Google event today, *Agenda · 2* counts both** — decidable half ✔ (method:
  `agendaItemsForToday` returns both kinds and `TaskGroup`'s count is its length, `test/agenda-items.test.ts`). Observed: live pass O1.
- **Collapsed, it names the next one** — **not delivered by this phase, on purpose.** Unit 4 shipped a collapsed Agenda of
  name and count only (`TaskGroup`), and building the line now would change the Google-only look this very AC requires to stay
  exactly as it is; the discrepancy is recorded in the plan's Notes and in the layout standard (§2 item 4). Protocol AC-23
  item 9 only records that the collapsed header shows name and count.
- **Expanded, it lists all-day first and then by time** — decidable half ✔ (method: `test/agenda-items.test.ts`, "puts all-day
  rows first, then timed rows by start, local before Google on a tie"). Observed: live pass O2.
- **The local row is solid and has no checkbox** — static inspection ✔ (`LocalEventRow`: solid `border-line` on `bg-surface-1`,
  no completion control). Observed: live pass O3 (the tap itself was not performed; the row has no interactive element).
- **The local row opens its sheet on tap** — **not delivered by this phase, on purpose.** The Compromisso sheet is phase 4
  (PRD AC-28); a tappable row that does nothing is dishonest, so the row is inert, with no button, link, role, pointer or hover
  treatment (plan decision D3-5). Protocol item 4 records that it does nothing.
- **The Google row keeps its dashed read-only look and opens in Google** — static inspection ✔: `EventRow` only gained the
  optional `timeLabel` and `wideTime`; its default class strings and markup are byte-identical (the time column class is
  `w-14 flex-none font-data text-t1 text-muted tabular-nums` exactly). Observed: live pass O3 and O5.
- **With no local commitments, a Google-only day looks exactly as it does today** — decidable half ✔ (method:
  `test/agenda.test.ts` passes unmodified against the rewritten `agendaForToday`, and `decideAgendaNotice` reproduces today's
  notices byte for byte, `test/agenda-items.test.ts`). One deliberate difference, recorded in plan decision D3-3: a
  multi-day or overnight Google event now also appears on its later days, where the old start-day-only rule showed it once.
  Observed against the contract (class string, text, height): live pass O5; the comparison against a second worktree of the merge base was not run.
- **With Google down, the explicit unit-4 notice shows and local commitments still list** — decidable half ✔ (method:
  `decideAgendaNotice` speaks for `failed` and `partial` whatever the row count and the other sources, pinned for every
  combination). Observed: live pass O6 and O7.

## AC-24 walk

One line per clause of PRD AC-24 (line 94).

- **The header shows the date** — decidable half ✔ (`formatDayHeading`, `test/day-view.test.ts`). Observed: live pass O11.
- **‹ and › step one day each, and Android back returns through the visited days** — decidable half ✔ (`adjacentDays`,
  crossing month, year and leap boundaries; `test/day-view.test.ts`); each step is `navigate(dayRouteOf(...))`, which pushes
  a real history entry (`useRoute.navigate`), static inspection ✔. Observed: live pass O12 (a month boundary was not stepped in the pane); the Android back
  gesture itself: owed to the owner's device.
- **An all-day strip comes first, then timed commitments chronologically with start and end** — decidable half ✔
  (`itemsInRange` order, `splitDayItems`, `formatDayItemTime`'s `HH:mm–HH:mm` and `até HH:mm`; `test/day-range.test.ts`,
  `test/day-view.test.ts`). Observed: live pass O13 and O14.
- **Open Tasks dated that day come last as rows without a time that open the Task on tap** — decidable half ✔ (a Task is
  placed on `deadline` or else `scheduledDate`, closed and undated Tasks are absent, Tasks sort last). The tap navigates to
  `/tasks/<id>`, the notification deep link, so the Task opens in its sheet over *Hoje*; static inspection ✔. Observed: live pass O15 (opening the Task and returning with back; completing a Task from the day and the failed-write line were not observed).
- **The three sources are visibly distinct** — static inspection ✔ (item 3 above). Observed: live pass O16.
- **A day with nothing reads *Nada neste dia.*** — decidable half ✔ (`DAY_VIEW_EMPTY`; `decideAgendaNotice` returns it only when
  Google, the commitments and the Tasks have all answered and there are no rows). Observed: live pass O17.
- **A *Hoje* control returns to today when another date is shown** — decidable half ✔ (`showTodayControl`,
  `test/day-view.test.ts`); the control calls `navigate("today")`. Observed: live pass O18.

## AC-25 walk

One line per clause of PRD AC-25 (line 95).

- **A commitment created for next Tuesday is listed on that Tuesday's `/day` and absent from *Hoje*'s Agenda today** — decidable
  half ✔ (method: `itemsInRange` lists it on its own day only, `test/day-range.test.ts`, "a future day"; `agendaItemsForToday`
  keeps only today, `test/agenda-items.test.ts`, "only today"; the request path `eventsRangePath`, `test/day-view.test.ts`).
  Observed: live pass O21.
- **Given Google fails or answers partially, `/day` shows the explicit notice, still lists local commitments and Tasks, and
  never reads as a free day** — decidable half ✔ (method: `decideAgendaNotice`, pinned for every state, row count and
  other-source combination, `test/agenda-items.test.ts`). The screen also renders a failed commitments or Task read as a
  `role="alert"` line with *Tentar de novo*, which is the same rule applied to the other two sources. Observed: live pass O22 and O23 (the still-loading state on its own and offline were not observed).

## Plan deviations

One addition beyond the text of the APPROVED plan, reviewed and kept on purpose. The plan was not edited.

- **`wideTime` / `min-w-20` / `timeColumnClassName` (plan Task 8).** Task 8 describes only an optional `timeLabel` on
  `EventRow` and a `LocalEventRow` with the fixed `w-14` time column. The diff also adds a `wideTime` prop on both rows, an
  exported `timeColumnClassName(wide)` in `EventRow.tsx` (shared so the two rows cannot drift) and a `min-w-20
  whitespace-nowrap` column that `DayScreen` selects by passing `wideTime`.
- **Why.** The plan reviewer's advisory `R-COH-OTHER-INTERNAL-CONTRADICTION` (the second one, plan line 475) noted that the
  `/day` label `HH:mm–HH:mm` (11 monospace glyphs, about 79 px at 12 px) cannot fit the fixed 56 px column and would wrap at
  the dash, and asked for the column to widen for range labels. The Implementer may not edit the plan, so the widening
  is an advisory-driven addition recorded here and in the comments at `timeColumnClassName` and the `wideTime` props.
- **Scope.** Additive. With `wideTime` absent the markup is byte-identical to the plan and to the old Google row (the time
  column class is `w-14 flex-none font-data text-t1 text-muted tabular-nums` exactly), so *Hoje*'s Google-only Agenda is
  unchanged. Only `DayScreen` passes `wideTime`. No new token, colour or primitive; `min-w-20` and `whitespace-nowrap` are
  existing utilities (item 7). The 80 px width is computed, not measured: the live pass measures it (item 12).

## Gate

- Level 1 `npm run check` (types for the Worker, `tsc -b` including `test/`, ESLint, Prettier): exit 0.
- Level 2 targeted suites `day-range day-item day-groups task-groups agenda app-route day-view format`: 12 files,
  435 tests, exit 0. Full suite: 113 files, 2413 tests, exit 0.
- Level 3 `npm run build`: exit 0 (sizes in item 13). Invariant checks: `src/shared/dates.ts`, `src/shared/recurrence.ts` and
  `src/shared/adherence.ts` byte-identical to `4231ee8`; the six existing suites (`day-groups`, `day-item`, `day-item-event`,
  `agenda`, `task-groups`, `format`) unmodified against `4231ee8`; `test/app-route.test.ts` additive only (no removed or
  changed line); no `CompromissoSheet`, `createEvent`, `updateEvent` or `deleteEvent` under `src/app`.
- No test file, `vitest.config.ts`, `test/event-fixtures.ts` or `test/day-fixtures.ts` was created, edited or deleted by the
  Implementer; `git diff` of `test/` against the approved suite's tree is empty.
- `scripts/check-mirror-inventory.mjs` still fails on the same two lines it failed on before this phase (`src/app/api.ts`,
  the `body.reminders` line, which moved a few lines down because of two added imports, and `src/shared/export.ts`
  `reminders`); it is neither relied on nor fixed here (plan Notes).
