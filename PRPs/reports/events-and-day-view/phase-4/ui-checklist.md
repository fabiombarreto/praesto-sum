# UI/UX review checklist — the Compromisso sheet, *Novo compromisso* on `/day`, the local row that opens it and the *Compromissos* group in search (unit 14, phase 4)

Written 2026-10-21 by the Implementer, and kept honest about which evidence is which. **Updated 2026-10-21 by the orchestrator
after the live pass** (`live-browser-pass.md`, numbered observations cited below as *LP n*; the pass was run in the Browser pane at
375 × 812 and 1280 × 800, two screenshots were taken): only the `owed to the live pass` marks changed, each replaced by a
citation, and what the pane could not show is named where it still stands:

- **What this record rests on.** Reading the code, `npm run check`, the three new pure suites, the targeted and the full
  suites, `npm run build`, the build's CSS and the invariant diffs. **The Implementer has no browser**, so it saw nothing
  rendered: no box was measured, no screenshot exists, and every clause that needs a rendered page is marked
  `owed to the live pass`. The live pass is written as an executable protocol,
  `PRPs/reports/events-and-day-view/phase-4/live-pass-protocol.md`; when the orchestrator runs it, its observations land
  in `live-browser-pass.md` beside this file and the `owed to the live pass` marks below are replaced by a citation of
  those numbered observations, nothing else changing. Whatever the pane cannot show (how the native date, time and the
  roughly 400-option zone select render on Android Chrome, keyboard overlap, the back gesture, contrast on a real panel,
  Lighthouse) stays `owed to the owner's device` and is phase 5's device proof.
- **Surfaces under review.** `CompromissoSheet` (new, a native `<dialog>` through the existing `Sheet`), `useEventSheet` (new
  glue shared by three screens), `LocalEventRow` (changed: the inert row became a `<button>` with a required `onOpen`),
  `ConfirmView` (one optional prop, `confirmDisabled`), `DayScreen` (changed: *Novo compromisso*, the sheet, the `Esc`
  gating), `TodayScreen`'s Agenda (changed: the local row opens the sheet, the never-stack gating, the stale-response guard
  of `refreshLocalEvents`, the `/` shortcut ignoring a focused `<select>`) and `SearchScreen` (changed: the *Compromissos*
  group, a second independent request, the body decision, the sheet, the `Esc` gating). No new token, primitive, colour,
  motion, origin, endpoint, DTO, table or migration.
- **Where a ✔ rests on a pure module**, the method names the suite that pins it (`test/event-edit.test.ts`,
  `test/event-sheet.test.ts`, `test/event-view.test.ts`, `test/day-view.test.ts`, `test/agenda-items.test.ts`; the full run
  is 2755 tests in 116 files, all passing).
- **New visible strings (ADR-0009) — approved by the owner on 2026-10-27 (PRD D-W) and added to the microcopy table of `documentation/10-product/visual-identity.md`.** Fixed by the PRD: *Novo compromisso*, *Título*, *Dia
  inteiro*, *Início*, *Fim*, *Fuso horário*, *Local*, *Descrição*, *Cancelar*, *Salvar*, *Excluir* and the search group
  *Compromissos*. Reused as they are: *Dia*, *Não dá para desfazer.*, *Sem conexão.* with *Dá para ler, mas não para salvar por
  enquanto.*, *Tentar de novo*, *dia todo*, and the generic request-failure sentences. New: **`Hora`** (the label of the time
  inputs); **`Excluir este compromisso?`** (the confirmation's title, the verb repeated); **`Termina em dd/MM/aaaa às
  HH:mm.`** and **`Termina em dd/MM/aaaa.`** (the resolved end); **`Informe o título.`**; **`Use no máximo N
  caracteres.`** (defensive: `maxLength` prevents it); **`Informe o dia de início.`**; **`Informe a hora de início.`**; **`O fim
  não pode ser antes do início.`**; **`Este compromisso não existe mais. A lista foi atualizada.`**; and the search row's
  label **`dd/MM/aaaa · HH:mm`** (or `dd/MM/aaaa · dia todo`). The option text of *Fuso horário* is the IANA identifier and is
  not copy. The Implementer added **no string beyond this list**. The search field's placeholder (*Pesquisar tarefas…*), its
  `aria-label` and the empty sentence (*Nenhuma tarefa encontrada para “…”.*) still say *tarefas* on purpose: a copy question
  for the owner (the plan proposes *Pesquisar tarefas e compromissos…* and *Nada encontrado para “…”.*).
- **Additions beyond the plan's text, none of which adds a string.** (1) The offline `Banner` shows above both views of the
  sheet, the form and the delete confirmation, not only the form: a confirmation whose *Excluir* is disabled with no reason
  on screen would be a silent refusal. (2) A `-mx-4 mb-2` wrapper lets that banner span the sheet's width like the page
  banners do. (3) The three text fields (the title and location inputs, the description textarea) carry `aria-invalid` and
  `aria-describedby` to their reason, and the two fieldsets (*Início*, *Fim*) carry `aria-describedby` only (WCAG 3.3.1),
  which the plan did not ask for. (4) When the commitments search fails, its stale rows are cleared so they never
  sit beside the failure line. (5) The hook's save and delete also return when `busy` or offline, beside the disabled
  buttons. (6) The two search requests share the debounce effect's one `AbortController`.

## Tier A — every interface change

1. ✔ — method: static inspection. `/day` now has exactly one `primary` button, *Novo compromisso* (`Plus` glyph and visible
   text, first child of `<main>`, `self-start`); its other controls are *Voltar* and the two arrows (`icon`), the ghost *Hoje*
   (only when another date is shown) and the secondary *Tentar de novo* (only after a failed read). The sheet's one primary is
   *Salvar*; *Cancelar* is secondary and *Excluir* a distant ghost; the confirmation has two secondaries. *Hoje* keeps the
   capture deck as its one primary action and search gains none. Nothing was added "just in case": no success toast, no
   second door to the sheet, no duration shortcut.
2. ✔ — method: static inspection and the live pass (LP *Measured*, 375 px and 1280 px). Static inspection says every control meets the rule by construction: `Button` is `min-h-12`
   (`icon` is `size-12`), `Chip` is `min-h-12 min-w-12`, every `input`, the `select` and the `textarea` are `min-h-12` (the
   textarea `min-h-24`), the local row is `min-h-16` and is the whole hit area, the field stack uses `gap-4` (16 px) and
   the *Cancelar*/*Salvar* pair and the date and time inputs `gap-2` (8 px). The width of the 128 px (`w-32`) time input
   beside a flexible date input, and the real gaps, were read: every `button`, `input`, `select` and `textarea` of the sheet and of
   `/day` is at least 48 × 48 (the only 1 × 1 boxes are two off-screen focus sentinels of the Task rows), no pair of controls is
   closer than 8 px, *Dia* 207 + 8 + *Hora* 128 fill the 343 px fieldset exactly with no overflow, and *Novo compromisso* is 210 × 48.
3. ✔ — method: static inspection. A reason is a sentence in text (`role="alert"`) under its field, never a red border alone;
   the *Dia inteiro* chip's on-state is fill, weight and a leading check, never colour alone; the local row differs from the
   Google row by outline style, ground, glyph and the leading column (unchanged from phase 3); offline is the banner's icon
   and text; a failed request is a sentence. `text-overdue` colours only the reason text that also says what is wrong.
4. ✔ — method: static inspection and the pinned pure copy. Every sentence a function chooses lives in `src/shared/event-view.ts`
   and is pinned in Portuguese by `test/event-view.test.ts` (the draft reasons, the resolved-end line, the 404 sentence,
   the search label, the group and button names); the literals in the components (*Hora*, *Excluir este compromisso?*, the
   field labels) are pt-BR, sentence case, with infinitive buttons (*Salvar*, *Excluir*, *Cancelar*, *Tentar de novo*) and the
   verb repeated in the confirmation. Dates read `dd/MM/aaaa` and times `HH:mm` (24 h): the day parts come from `Intl`
   (`instantToWallClock`) and are only reordered by `formatDay`, which assembles the pt-BR numeric date from the `YYYY-MM-DD`
   string so no zone can move a day (plan Task 3). No count is shown that could be zero: *Compromissos · N* renders above zero
   only (`TaskGroup`). The new strings are listed in the preamble for the owner.
5. ✔ — method: static inspection and the live pass (LP 2, 10, 13, 20, 29); **the visible focus ring after a key press and a real
   `Tab` walk were not observed** (owed to the owner's device). What is in the code: every control is a native `<button>`, `<input>`, `<select>` or `<textarea>`;
   `Sheet` is a `<dialog>` opened with `showModal()` and mirrors both `close` and `cancel`, so `Esc` and the back gesture close it
   and focus returns to the opener natively; `ConfirmView` focuses *Cancelar* programmatically; `DayScreen` and `SearchScreen`
   stop their window `Esc` handler from also leaving the screen while the sheet is open (`eventSheet.isOpen`), and *Hoje* has
   no `Esc` handler; `:focus-visible` is the global rule. Tab order, the visible ring, `Esc` leaving nothing behind and focus
   returning to the row or to *Novo compromisso* are the protocol's AC-28 items 11 and 14 and AC-30 item 7. Observed: the dialog
   takes focus on open (no field focused), the tabbable order is *Fechar*, title, *Dia inteiro*, the four date/time inputs, zone,
   location, description, *Cancelar*, *Salvar*; a real `Escape` closed only the sheet on `/day` and on `/search` and a second one left
   the screen; a real `/` from the focused zone select neither left the screen nor closed the sheet; closing returned focus to the
   row or to *Novo compromisso*.
6. ✔ — method: static inspection. Every field has a visible `<label htmlFor>` (the *Início* and *Fim* groups are
   `<fieldset>` with a `<legend>` and a *Dia* and a *Hora* label each, the zone is a labelled `<select>`); the *Dia inteiro* chip
   group carries `aria-label="Dia inteiro"` beside its visible text; the only icon-only control is the sheet's existing
   *Fechar*; the row's accessible name is its visible time and title (no `aria-label`, which would silence them); each reason
   is wired with `aria-describedby`/`aria-invalid`. `<title>` and `lang` are untouched.
7. ✔ — method: static inspection and the build. Only existing tokens and utilities: the field classes are `TaskSheet`'s
   (`rounded-control border-line-strong bg-surface-1 shadow-field text-ink`), the labels `font-data text-t1 font-semibold
   text-muted`, the reasons `text-overdue`; the few spacing utilities not already used by a neighbour (`w-32`, `-mx-4`,
   `min-h-24`) are confirmed in the built CSS and resolve through `var(--spacing)`. A grep over the new and changed app files
   finds no inline `style`, no literal colour, no `uppercase` or `text-transform` and no new motion; the dialog's own
   transition and the chip's are the existing ones, so reduced motion has nothing new to honour.
8. ✔ — method: static inspection. *Excluir* is irreversible, so it asks once and repeats the verb: *Excluir este
   compromisso?* with *Não dá para desfazer.*, *Cancelar* focused and the destructive button second and neutral
   (`ConfirmView`, `secondary` with a `Trash2` glyph); it never appears for a new commitment (`request-delete` is refused by
   the reducer). No reversible destructive action exists on these surfaces. **No success toast** is shown for a saved or
   deleted commitment (plan decision D4-6): the sheet closing and the list changing are the confirmation, and `/day` and
   search have no toast slot; the PRD forbids a toast REPLACING a failure reason, and a failure is always an inline,
   persistent line. Flagged for the owner (plan Notes) whether *Hoje* should toast.
9. ✔ — method: static inspection. The new requests (`createEvent`, `updateEvent`, `deleteEvent`, `searchEvents`) are one-liners
   over `request()` to a same-origin `/api/events…` path; the sheet, the hook and the rows contain no `fetch(`, no absolute
   URL and no third-party script (grep clean); the Google rows' links are navigations the owner chooses, not requests the page
   makes. The request log of the live pass is an additional check (protocol, "Measurements", last row).

## Tier B — a changed screen

10. owed to the owner's device — contrast was not measured by anyone. No new colour pair is introduced: the sheet reuses the
    Task sheet's pairs (labels `text-muted` and fields `text-ink` on `surface-1`, reasons `text-overdue`), the search row is the
    local row of phase 3, and the resolved-end line is `text-muted`.
11. ✔ — method: the live pass (LP 5, 6, 14, 22–28) and the pinned tables. The states the three surfaces can reach, as simulated per the protocol (AC-28 items 6 to 9, AC-29
    items 6 to 9, AC-30): a blank or invalid draft, an end before the start, offline, a failed save, delete and search, a
    network `TypeError`, a deleted-elsewhere commitment (404), a stale refetch, an empty search, a failed commitments search
    over a Task match. The decision tables behind them are pinned by test: `decideSearchBody` (of 256 input combinations exactly
    one says nothing was found, `test/event-view.test.ts`), `eventWriteFailure` (404 is the only stale-list status, the server's
    text is never shown), `eventDraftErrors` and the reducer's no-op identities (`test/event-edit.test.ts`,
    `test/event-sheet.test.ts`). Observed: blank/invalid draft, end before start, offline, failed save (500 and network), failed delete,
    404 on edit and on delete, a stale refetch that did not repaint, an empty search, and a failed commitments search over a Task
    match all behaved as the plan says; none showed a toast.
12. ✔ — method: the live pass (LP *Measured*, 375 px and 1280 px) for the pane half. The 375 px and 1280 px readings (the time and date inputs side by side without horizontal overflow,
    the dialog's height against `90dvh` and its internal scroll, the widest search label on one line, the number of
    *Fuso horário* options); the phone-only half (safe areas, keyboard overlap and the visual viewport with the sheet open,
    `overscroll-behavior`, the back gesture closing the sheet, how the native pickers behave inside a `<dialog>`) is phase 5's
    device proof and **stays owed to the owner's device**. Read: the time and date inputs sit side by side with no overflow at both
    widths (fieldsets 343 = 343 and 513 = 513), the dialog is 731 px at 375 × 812 and 720 px at 1280 × 800 (= 90dvh) with an
    internal scroll and *Salvar* reachable, the widest search label (127 px, one line) leaves the title 150 px, and *Fuso
    horário* has 418 options headed by `America/Sao_Paulo`.
13. ✔ — method: `npm run build`, 2026-10-21, read against §11. First-load JavaScript `index-DEGf7eQf.js` 408.83 kB, **122.40 kB
    gzip** (budget <= 170 KB gzip). First-load CSS `index-hbM-BQId.css` 26.96 kB, **6.38 kB gzip** (budget <= 30 KB gzip).
    Precache **25 entries, 524.04 KiB** (budget <= 1 MB). Against the last record (phase 3: 117.72 kB, 6.36 kB, 506.54 KiB) that
    is +4.68 kB JS gzip, +0.02 kB CSS gzip and +17.50 KiB precache, which is the sheet, the hook and the three pure modules.
    Fonts unchanged. The dev-token guard passed (`check-dev-token-absent`: 17 text files scanned). Lighthouse on the phone:
    owed to the owner's device.
14. owed to the owner's device — the Implementer took no screenshot; the live pass took two in the pane (the sheet open over
    *Hoje*, and scrolled over `/day`, both rendered correctly at 375 px), which is not a device photo (guidelines §12.6); the device
    photos are the artefact to ask for.

Result: no ✘. Items 2, 5, 11 and 12 are marked ✔ from the orchestrator's live pass (with the caveats named in each); items 10, 12
(phone half), 5 (focus ring), 13 (Lighthouse) and 14 stay with the owner's device. The ✘ of phase 3's item 8 (no toast slot on `/day`)
is unchanged and still the owner's call.

## AC-28 walk

One line per clause of PRD AC-28 (`PRPs/prds/events-and-day-view.prd.md`, line 98). "Decidable half" means the pure module the
clause depends on is pinned by a passing test; "observed" names the protocol item that will cite `live-browser-pass.md`.

- **Tapping *Novo compromisso* on `/day` opens a sheet prefilled with that date, a start of 09:00 or the next full hour when the
  date is today** — decidable half ✔ (method: `newEventDraft`, including 14:00 and 14:30 giving 15:00, 06:30 giving 07:00 and
  23:10 giving 23:00, `test/event-edit.test.ts`; one kept draft per DAY, `open-new`, `test/event-sheet.test.ts`). Observed ✔: LP 1
  (`2026-10-24`, `09:00`; today at 14:31 the *Hora* was `15:00`).
- **In order *Título*, *Dia inteiro*, *Início* and *Fim* (date and time), *Fuso horário* (a native select, `America/Sao_Paulo`
  first), *Local*, *Descrição*, *Cancelar* and *Salvar*** — decidable half ✔ for the zone choices (`timeZoneChoices`,
  `test/event-edit.test.ts`); the field order is the JSX order, static inspection ✔. Observed ✔: LP 2 (DOM order *Fechar*, *Título*, *Dia inteiro*, *Início*, *Fim*, *Fuso horário*, *Local*,
  *Descrição*, *Cancelar*, *Salvar*; 418 options, `America/Sao_Paulo` first); how the native select renders on Android: owed to the owner's device.
- **Leaving the end empty shows the resolved end** — decidable half ✔ (`draftEndPreview` and `formatDraftEnd`, including the DST
  gap and overlap, `test/event-edit.test.ts`, `test/event-view.test.ts`). The sheet renders it as a `role="status"` line right
  after *Fim*. Observed ✔: LP 3 (*Termina em 24/10/2026 às 10:00.*, with only a day or only a time given too).
- **All-day hides the times** — decidable half ✔ (an all-day draft ignores its time fields in `eventDraftErrors`,
  `buildCreateEventInput` and `buildEventPatch`); the sheet renders no *Hora* input while `allDay` is on, static inspection ✔.
  Observed ✔: LP 4 (no *Hora* input, *Fim* keeps its *Dia*, *Termina em 24/10/2026.*).
- **An end before the start shows an inline reason** — decidable half ✔ (`eventDraftErrors` yields `end_before_start`;
  `eventDraftErrorMessage` says *O fim não pode ser antes do início.*); the sheet shows it live, before any *Salvar*, and every
  other reason only after an attempt, static inspection ✔. Observed ✔: LP 5 and 6 (the alert at once, 0 requests on *Salvar*; the other reasons only after *Salvar*).
- **Tapping a local commitment opens the same sheet filled** — decidable half ✔ (`eventDraftFromEvent` reads the wall clock in the
  Event's own zone, `open` restores a kept draft and refuses a Google row, `test/event-edit.test.ts`, `test/event-sheet.test.ts`);
  `LocalEventRow` is now a `<button>` wired to `eventSheet.openEvent` on `/day`, on *Hoje*'s Agenda and in search, static
  inspection ✔. **This delivers the clause the amended AC-23 left for this phase ("opens its sheet on tap"); plan decision D3-5
  and the "inert" clauses of the phase-3 checklist are superseded by it.** Observed ✔: LP 8 and 12 (the sheet opened filled from *Hoje*'s Agenda and from `/day`; the Google rows stay
  `<a target="_blank">`).
- **With *Excluir* behind an irreversible confirmation that repeats the verb** — decidable half ✔ (`request-delete` only for an
  edit target in the form view, `cancel-delete` back to the form, `test/event-sheet.test.ts`); *Excluir este compromisso?*,
  *Cancelar* focused, *Excluir* second, static inspection ✔ (item 8). Observed ✔: LP 9 (*Cancelar* focused, *Excluir* second, the draft intact after *Cancelar*, `DELETE` then the row gone).
- **Esc and the back gesture close it** — static inspection ✔ (the native dialog's `close` and `cancel` are mirrored; `DayScreen`
  and `SearchScreen` do not also leave the screen while `eventSheet.isOpen`). Observed ✔: LP 10 (real `Escape` closes only the sheet; `history.back()` closes it); the
  Android back gesture: owed to the owner's device.
- **A closed sheet keeps its unsaved draft in memory** — decidable half ✔ (`close` keeps every draft by reference, `open` and
  `open-new` restore it untouched, `saved` and `deleted` drop only their own, `test/event-sheet.test.ts`). Observed ✔: LP 11 (the
  unsaved edit survived *Cancelar*; the new draft survived on its day, was empty on the next day, and came back on return).

## AC-29 walk

One line per clause of PRD AC-29 (line 99).

- **Given at least one matching commitment, typing two words lists a *Compromissos* group with date and time** — decidable half ✔
  (the request path `eventsSearchPath` trims and encodes into `q`, with no range; the row label `formatEventSearchWhen` reads
  `dd/MM/aaaa · HH:mm` in the owner's zone and `dd/MM/aaaa · dia todo` for an all-day one, `test/event-view.test.ts`); the
  matching itself is the route's, delivered and tested in phase 2 (PRD AC-17). Observed ✔: LP 16 and 17 (`consulta dentista`, `exames`, `reuniao`, `feriado`).
- **A local row opens the sheet** — static inspection ✔ (`LocalEventRow` `onOpen` to `eventSheet.openEvent`; an accepted write
  re-runs `GET /api/events?q=` so the group shows the change). Observed ✔: LP 18 (the edit re-ran `GET /api/events?q=` and the row left the group).
- **No Google event ever appears** — static inspection ✔: the screen's only commitments request is `searchEvents`, whose route
  returns stored Events only (Google events are not stored), and the Google fetchers are not imported by the search screen.
  Observed ✔: LP 19 (no Google row matched `Daily`, `Aniversário` or `google`; no `/api/google` request while searching).
- **With no match the group is absent** — decidable half ✔ (`TaskGroup` renders nothing at a count of zero; `decideSearchBody`
  says *nothing found* only when both requests answered and both are empty, and never while the commitments request is
  unanswered or failed, `test/event-view.test.ts`). A one-character query sends no request (the existing `shouldSearch` floor
  gates both requests and the effect clears both atoms), and a failed commitments search shows its own `role="alert"` line and
  retry without turning a Task result into an error, static inspection ✔. Observed ✔: LP 20 to 23 (0 requests at one character; no empty *Compromissos* header; the failure line and *Tentar de novo*
  never beside *Nenhuma tarefa encontrada…*; a failing Task search shows the Task failure line only).

## AC-30 walk

One line per clause of PRD AC-30 (line 100).

- **Offline disables writes, with the unit-1 hint** — static inspection ✔: *Novo compromisso* is `disabled={!writable}`, the
  sheet's *Salvar* and *Excluir* and the confirmation's *Excluir* (`ConfirmView`'s new `confirmDisabled`) are disabled, *Cancelar*
  and *Fechar* are not, and the sheet carries the existing banner words *Sem conexão.* *Dá para ler, mas não para salvar por
  enquanto.* (a native `showModal()` makes the page behind inert, so the screen's own banner cannot be read). Observed ✔: LP 24 (the `offline` event only; the pane's own Offline toggle was not driven).
- **A failed save keeps the sheet open with an inline, persistent reason, and no toast replaces it** — decidable half ✔
  (`eventWriteFailure`: 404 says the commitment is gone and marks the list stale, every other cause uses the generic classifier's
  sentence, and the server's own text, which carries a field marker meant for tools, is never shown, `test/event-view.test.ts`);
  `useEventSheet` dispatches `saved` only after the request succeeds, keeps the draft, renders the reason under *Salvar* or the
  confirmation until the next attempt, and neither toasts nor reports to the connectivity reducer (grep clean), static inspection
  ✔. Observed ✔: LP 25 to 28 (500, network and 404 on save; 500 and 404 on delete; the alert survived 10.5 s and a field edit; no
  toast; capture stayed enabled).
- **Every control is at least 48 px** — ✔ (item 2: static inspection, then measured in the live pass at 375 px and 1280 px).
- **The copy is pt-BR** — ✔ (item 4; the sentences a function chooses are pinned in Portuguese).
- **The ✔/✘ for each screen touched is recorded** — ✔ this file: `CompromissoSheet`, `ConfirmView`, `LocalEventRow`, `DayScreen`,
  *Hoje*'s Agenda and `SearchScreen` (Tier A items 1 to 9 for all of them; Tier B because the sheet is a new surface and three
  screens changed).

## Gate

- Level 1 `npm run check` (types for the Worker, `tsc -b` including `test/`, ESLint, Prettier): exit 0.
- Level 2 targeted suites `event-edit event-sheet event-view day-view agenda day-range task-edit task-sheet`: 9 files, 577
  tests, exit 0. Full suite: 116 files, 2755 tests, exit 0 (the three new suites are 342 tests: 220, 66 and 56; the baseline
  was 113 files and 2413 tests).
- Level 3 `npm run build`: exit 0 (sizes in item 13). The `docs` project (`source-invariants`, `event-api-inspection`,
  `event-migration-additive`, `docs-consistency`, `push-send-library-verdict`): 5 files, 129 tests, exit 0. Invariant checks: `src/shared/dates.ts`,
  `src/shared/recurrence.ts` and `src/shared/adherence.ts` byte-identical to `HEAD`; `src/shared/events.ts` and
  `src/shared/event-hash.ts` unchanged against the index; no migration, schema, endpoint, DTO, token or Google file touched;
  no `documentation/`, `docs/` or `PRPs/` file written other than the two reports of this directory.
- No test file, `vitest.config.ts`, `test/event-fixtures.ts` or `test/day-fixtures.ts` was created, edited or deleted by the
  Implementer; `git diff` of `test/` against the approved suite's tree is empty, and no existing suite was modified.
- `scripts/check-mirror-inventory.mjs` still fails on the same two lines it failed on before this phase (`src/app/api.ts`, the
  `body.reminders` line, which moved a few lines down because of the added imports, and `src/shared/export.ts` `reminders`); it
  is neither relied on nor fixed here (plan Notes).

## Hand-off to phase 5

What AC-34 must amend now that the sheet exists, none of it touched by this phase:

- `documentation/40-engineering/ui-layout-standard.md` **§2 item 4**: the local rows are no longer inert ("until the Compromisso
  sheet ships" is now true); tapping a local row opens the Compromisso sheet, and the Google rows are unchanged.
- **§2 item 11** (the Day route): add *Novo compromisso*, the screen's one primary action, as the first element of the body,
  disabled offline.
- **§3**: describe the Compromisso sheet beside the Task sheet. Field order *Título*, *Dia inteiro* (a chip), *Início* and *Fim*
  (each a *Dia* and, unless all-day, a *Hora*), the resolved-end line, *Fuso horário* (a native select, the owner's zone first),
  *Local*, *Descrição*, then *Cancelar* / *Salvar* and, for an existing commitment only, a distant *Excluir* that opens the
  irreversible confirmation *Excluir este compromisso?*; the offline banner inside the sheet; one draft kept per commitment and
  per day; no light dismiss; no success toast.
- **§5**: `Esc` closes the Compromisso sheet and does not also leave `/day` or search; the `/` accelerator ignores a focused
  `<select>` as well as a text field.
- **§6**'s unit-14 row: the Compromisso sheet and *Novo compromisso* are no longer "not described here yet"; add the row for the
  *Compromissos* group in search (first in the results).
- The layout standard's History gets the phase-4 row; the glossary entry for *Compromisso*; `domain-model.md`;
  `docs/domain/areas/events.md`; FR-020 to FR-023 and FR-040 traceability; the roadmap row.
- `docs/context/architecture.md`: the sentences that say `LocalEventRow` "has no control, role or pointer styling of any kind,
  inert on purpose" and that the Agenda row is inert, and "`SearchScreen` shows no commitments yet", are now false; the
  `src/shared/` row gains `event-edit.ts`, `event-sheet.ts` and `event-view.ts`, and the `src/app/` row `CompromissoSheet`,
  `useEventSheet` and the four client wrappers. `docs/api-reference.md` is unchanged (no endpoint was added).
- Facts phase 5 can rely on: the search group is *Compromissos*, first in the DOM; a new commitment's draft is kept per day;
  the end does not follow the start (D4-8, reopen trigger: the owner reports it at the device proof); the zone select lists the
  runtime's whole IANA set with the owner's zone first (D4-3, reopen trigger: the device finds it unwieldy); a patch decides
  its time keys from the wall clock, so changing the zone alone moves a timed commitment's instants (D4-4).
- Known edge, unreachable from the sheet itself: an Event stored across the autumn clock change whose end wall-clock text is
  earlier than its start text (for example 01:50 EDT to 01:10 EST) re-resolves its end to the first 01:10 under the RFC 5545
  rule, so the untouched draft reads *O fim não pode ser antes do início.* and cannot be saved until the end is edited.
