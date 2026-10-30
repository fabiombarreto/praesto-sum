# Live browser pass — unit 14 `events-and-day-view`, phase 4 (the Compromisso sheet and search results)

Run 2026-10-21 by the `/relay-execute` orchestrator, following `live-pass-protocol.md`, in the Browser pane (Chromium,
dark — the app has no light theme) at **375 × 812** (everything except the last block) and **1280 × 800** (the
measurements block).

**How it was run.** `npm run dev -- --host 127.0.0.1 --port 5180 --strictPort` from this worktree, with a throwaway
`API_BEARER_TOKEN` written into the worktree's `.dev.vars` (generated for the run, never shown in any report; the dev build
hands it to the client, so the gate never appeared). The local D1 held synthetic rows only, created through the real
`POST /api/events` and `POST /api/tasks` (all 201): seven commitments (*Dentista* 09:30–10:30 today, *Feriado* all-day
today, *Plantão* 23:00 tomorrow to 01:00 the day after, *Retiro* all-day next Monday–Tuesday, *Reunião de terça* 10:00–11:00
next Tuesday, *Consulta dentista* with the description *levar exames da consulta* in three days at 15:00, *Reunião* in
four days at 11:00) and three Tasks (*Tarefa de hoje*, *Tarefa com prazo amanhã*, *Consultar o dentista*).
`GET /api/google/events` was stubbed **in the page** with the protocol's `window.fetch` wrapper (two Google rows today:
*Daily (Google)* at 14:00 and the all-day *Aniversário (Google)*), so no Google call was made; the same wrapper made
`/api/events` writes fail (`failMethods`, `failMode`), answered 404 for a chosen id (`notFoundIds`) and delayed responses.
Browser-driven edits set field values through the native value setter plus an `input`/`change` event (what React
listens to); `Escape` and `/` were sent as real key presses through the pane's keyboard. Afterwards every fixture was
deleted through `DELETE` (204 each, the commitments created in the pass included), the dev server and its `workerd`
child were stopped, `.dev.vars` was restored byte-identical from the backup (`cmp`), and the backup and the token file
were deleted. Every number below is read from the DOM (`getBoundingClientRect`, `scrollWidth`, `getComputedStyle`) or from
the wrapper's own request log (`method`, `path`, `body` as the page sent them). **Two screenshots were taken** (the sheet
open on *Hoje* at 375 px, and the sheet scrolled over `/day` at 375 px; both rendered correctly); no other is claimed
(guidelines §12.6). The pane's clock was 14:22–14:31 in `America/Sao_Paulo` (17:22–17:31 UTC), Wednesday 2026-10-21;
*in3Days* is 2026-10-24.

**Harness caveat, recorded because it nearly produced a false finding.** The pane does not tick CSS transitions without a
painted frame. My first measurement of the open sheet's rectangle read `translate: 0px 100%` (the dialog below the
viewport, `top` 812) for a sheet that had been open for a minute; after a screenshot forced a frame, `translate` was `0px`
and the dialog sat at `top` 81, `bottom` 812. Widths, heights and gaps are unaffected by `translate`; every vertical
position cited below was read after a frame. A second caveat: a lone `slice(0, 140)` of a confirmation's `innerText` once
cut the *Excluir* label off and looked like a vanished button; re-read at full length the button was there at 0.1, 0.4, 1
and 3 s after the 404.

## Measured

| Surface | Measure | Result |
|---|---|---|
| The sheet, existing all-day commitment, 375 px | every `button`, `input`, `select`, `textarea` | none under 48 px tall or wide: *Fechar* 48 × 48, *Dia inteiro* chip 114 × 48, *Cancelar* 169 × 48, *Salvar* 167 × 48, *Excluir* 112 × 48, the text inputs 343 × 48 (the all-day sheet has the *Dia* input at 343 wide); **no pair of controls closer than 8 px** |
| The sheet, timed commitment, 375 px | date + time inputs side by side | *Dia* **207** × 48 and *Hora* **128** × 48 in a 343 px fieldset (207 + 8 + 128 = 343); fieldset `scrollWidth` 343 = `clientWidth` 343 |
| The sheet, 375 px | height against `90dvh` | dialog **731 px** = 0.9 × 812; `scrollHeight` 954 > `clientHeight` 731, `overflow-y: auto`; at `scrollTop` 223 *Salvar* sits at y 668–716, inside the viewport (reachable); `scrollWidth` 375 = 375 |
| The sheet, 375 px | `document.documentElement` and `main` | 375 = 375 on both, on `/day` with the sheet open and closed |
| `/day/2026-10-21`, 375 px | every control | *Voltar* 48 × 48 (16, 24); *Dia anterior* 48 × 48 (16, 80); *Próximo dia* 48 × 48 (311, 80); ***Novo compromisso* 210 × 48 at (16, 144)**; rows 343 × 64 (local button and Google anchors); Task title button 215 × 48; pencil 48 × 48; **no pair closer than 8 px**; the only 1 × 1 boxes are two off-screen focus sentinels of the Task rows |
| *Novo compromisso* | the screen's primary action | buttons painted with the accent `rgb(245, 165, 36)` on `/day`: exactly one, *Novo compromisso*; it is above the failures block and the first child of `main` |
| *Fuso horário*, 375 px and 1280 px | options | **418** `<option>` elements; first two for a commitment in `America/Sao_Paulo`: `America/Sao_Paulo`, `Africa/Abidjan`; for one stored in `America/New_York`: `America/Sao_Paulo`, `America/New_York`, `Africa/Abidjan`; no duplicate; `UTC` is **not** in this Chromium's list (the code adds it only for a commitment stored in `UTC`) |
| The sheet, 1280 px | dialog box | **560 × 720** at x 360 (centred), height = 0.9 × 800; `scrollHeight` 938 (existing) / 895 (new) > 720, scrolls internally; `scrollWidth` 545 (+15 px scrollbar) = `clientWidth` 545 |
| The sheet, 1280 px | inputs | *Dia* **377** × 48 beside *Hora* **128** × 48; text inputs 513 × 48; fieldsets `scrollWidth` 513 = `clientWidth` 513; `document.documentElement` 1280 = 1280 |
| Search, 375 px | widest label `24/10/2026 · 15:00` | the time `<span>` **127 px** wide, 18 px high (one line), `scrollWidth` 127 = `clientWidth` 127; the title column beside it **150 px** |
| Search, 375 px | a *Compromissos* row | **64 px** tall `<button>` with a `solid` border; the group is the first `<section>` of the results |
| *Hoje* Agenda, 375 px | rows | local `<button>` 64 px with `solid` border; Google `<a target="_blank">` 64 px with `dashed` border; both unchanged in height from phase 3 |
| The wrapper's request log, all screens | origins | every entry a same-origin `/api/…` path; `GET /api/google/events` appeared only for *Hoje* and `/day`, **never during a search** |

## Observed behaviour

**AC-28 — the sheet**

1. **Prefilled, another day.** On `/day/2026-10-24`, *Novo compromisso* opened a sheet titled *Novo compromisso* with *Início*
   *Dia* `2026-10-24`, *Hora* `09:00`, *Fim* empty, *Fuso horário* `America/Sao_Paulo`, *Título*, *Local* and *Descrição*
   empty. **Today** (`/day/2026-10-21`, clock 14:31:08) the *Hora* was **`15:00`** and the status line read *Termina em
   21/10/2026 às 16:00.*
2. **Field order and focus.** The DOM order of labels and buttons was *Fechar*, *Título*, *Dia inteiro*, *Início* (*Dia*,
   *Hora*), *Fim* (*Dia*, *Hora*), *Fuso horário*, *Local*, *Descrição*, *Cancelar*, *Salvar*; *Excluir* is absent for a new
   commitment and last (after *Salvar*) for an existing one. On open `document.activeElement` is the `<dialog>`; no field
   has focus. The tabbable list in DOM order: *Fechar*, title, *Dia inteiro*, start day, start time, end day, end time,
   zone, location, description, *Cancelar*, *Salvar*.
3. **The resolved end.** With *Fim* empty: *Termina em 24/10/2026 às 10:00.* (start 09:00 + 1 h). Only an end day
   (25/10): *Termina em 25/10/2026 às 09:00.* Only an end time (12:30): *Termina em 24/10/2026 às 12:30.* Both given: no line.
4. **Dia inteiro.** On: both *Hora* inputs gone, *Fim* keeps its *Dia*, the line reads *Termina em 24/10/2026.* (no time).
   Off again: the times come back (*Início* `09:00`, *Fim* empty) and the line *Termina em 24/10/2026 às 10:00.*
5. **An end before the start.** *Fim* 24/10 08:00 against *Início* 24/10 09:00: *O fim não pode ser antes do início.* appears at
   once as a `role="alert"` (`#event-sheet-end-error`) after *Fim*, before any *Salvar*, and the *Termina em* line is gone.
   *Salvar* sent **0** requests (log length unchanged). Fixing the end (10:00) removed the reason.
6. **A blank title, a missing day, a missing time.** No reason showed while tapping around with the title empty. After
   *Salvar*: *Informe o título.* as a `role="alert"` (`#event-sheet-title-error`), nothing sent. Clearing the start *Dia* then
   *Salvar*: *Informe o dia de início.*; clearing the start *Hora* (the native input accepts an empty value) then *Salvar*:
   *Informe a hora de início.*; 0 requests each time. The title reason stays until the title is typed.
7. **Create.** A timed commitment: one `POST /api/events` with `{"title":"Teste criado","allDay":false,"timezone":"America/Sao_Paulo","startAt":1792843200,"endAt":1792846800}`
   — **neither `startDate` nor `endDate`** — then `GET /api/events?from=2026-10-24&to=2026-10-24`; the sheet closed and the
   day listed `09:00–10:00 Teste criado` without a reload. An all-day one with a last day of the 27th: `{"title":"Dia todo teste","allDay":true,"timezone":"America/Sao_Paulo","startDate":"2026-10-24","endDate":"2026-10-28"}` — **the exclusive 28th**, no instants.
8. **Open and edit, on *Hoje* and on `/day`.** On *Hoje* (Agenda expanded) a local row is a `<button>`; tapping *Dentista*
   opened the sheet filled (title `Dentista`, `2026-10-21`, `09:30`–`10:30`, `America/Sao_Paulo`). The patches sent, read from
   the log: title only → `{"title":"Dentista (edit)"}`; start 09:30→10:00 → `{"startAt":1792587600,"endAt":1792589400}` (**both**,
   the end kept at 10:30); end only → 11:00 → `{"endAt":1792591200}` (**alone**); zone only → `America/New_York` →
   `{"timezone":"America/New_York","startAt":1792591200,"endAt":1792594800}` (the instants moved with the unchanged wall
   clock); location set → `{"location":"Clínica"}`; location cleared → `{"location":null}`; *Dia inteiro* on →
   `{"allDay":true,"startDate":"2026-10-21","endDate":"2026-10-22"}` (no `timezone`, no instants); *Dia inteiro* off →
   `{"allDay":false,"startAt":1792587600,"endAt":1792587600}` (see finding F1). After each, a `GET /api/events?from=…&to=…`
   followed and the list showed the change without a reload. **Saving with no change closed the sheet and sent no request.**
9. **Excluir.** An existing commitment's sheet has *Excluir* (112 × 48) after *Salvar*. It opened, inside the sheet, a view
   titled *Excluir este compromisso?* with *Não dá para desfazer.*, buttons *Fechar*, *Cancelar*, *Excluir* in that order, and
   `document.activeElement` = *Cancelar*. *Cancelar* returned to the form with the unsaved edit (`Teste criado X`) intact.
   The confirming *Excluir* sent `DELETE /api/events/<id>` then the day's `GET`; the sheet closed and the row was gone.
10. **Esc and Back.** With the sheet open on `/day/2026-10-24`, a real `Escape` closed the sheet and left `location.pathname`
    at `/day/2026-10-24`; a second `Escape` with no sheet left the day (`/day/2026-10-23`). With a **new** sheet open,
    `history.back()` closed it and landed on `/day/2026-10-23`: no stale sheet over another date. The same `Escape`
    behaviour held on `/search` (item 20).
11. **Drafts.** A title edited without saving, closed with *Cancelar*, was still there on reopening the same commitment
    (`Dia todo EDITADO`); *Salvar* sent `{"title":"Dia todo EDITADO"}`; afterwards the stored value was shown. A new
    commitment's `Rascunho X`, closed with *Fechar*, was there on reopening the same day, **empty** (and prefilled
    `2026-10-25` `09:00`) on the next day, and restored (`Rascunho X`) after returning to the first day.
12. **A Google row stays a link.** On *Hoje*'s Agenda and on `/day` the Google rows are `<a target="_blank">`, `dashed`
    border, 64 px, never a `<button>`; they were not tapped (they would open Google). The collapsed Agenda header still shows
    name and count only (*Agenda 4* with two local and two Google rows).
13. **`/` and the zone select (*Hoje*).** With *Fuso horário* focused inside an open sheet, a real `/` press left the path at `/`,
    the sheet open and the focus on the select. After closing the sheet, `/` with nothing focused opened `/search`.
14. **No stale repaint (*Hoje*).** With `delays` set for `from=2026-10-21` and a `visibilitychange`, a slow `GET /api/events` was
    started; 0.5 s later `delays` was cleared and *Dentista (edit)* was deleted from its sheet (`DELETE`, then a quick `GET`). At
    3.0 s and at 7.5 s from the start the Agenda listed *Feriado*, *Aniversário (Google)* and *Daily (Google)* — the deleted
    commitment never came back. (The wrapper reads its delay once the server answers, tens of milliseconds after dispatch,
    well before the 0.5 s at which it was cleared; the slow response itself was not timed.)
15. **Never two sheets.** On *Hoje* with the *Feriado* sheet open, the address `/tasks/<id>` (pushed and a `popstate` fired)
    left exactly one dialog open, *Tarefa de hoje*; the *Feriado* dialog was closed-looking (`open` false). When the Task sheet
    was closed the *Feriado* sheet **reappeared**: the Compromisso sheet is hidden, not discarded, while a Task sheet is open,
    the same gating `FilterSheet` and `ReminderSheet` use. (The `history.back()` I issued before closing left the Task sheet on
    screen for a moment at `/`; I drove that route by hand with `pushState`, which the app's own navigation does not,
    so I do not claim it as a finding.)

**AC-29 — search**

16. **Two words.** `consulta dentista` sent one `GET /api/tasks?q=consulta+dentista` and one `GET /api/events?q=consulta%20dentista`;
    a *Compromissos* group appeared **first in the DOM** with count 1 and the row `24/10/2026 · 15:00 · Consulta dentista`;
    a *Hoje* Task group with count 1 (the Task *Consultar o dentista*) followed.
17. **Description, accent, all-day.** `exames` found *Consulta dentista* through its description (count 1). `reuniao` (no
    accent) found *Reunião de terça* (`27/10/2026 · 10:00`) and *Reunião* (`25/10/2026 · 11:00`) (count 2). `feriado` found
    the row `21/10/2026 · dia todo`.
18. **Open and edit.** Tapping the row opened the sheet filled; changing the title to `Outra coisa` and *Salvar* sent the
    `PATCH {"title":"Outra coisa"}` and `GET /api/events?q=consulta%20dentista` again, and the row left the group (the
    Task group stayed); the query `outra` then showed `Outra coisa`, and changing it back removed it from `outra` (the
    screen read *Nenhuma tarefa encontrada para “outra”.*) and `consulta dentista` showed it again.
19. **No Google event, ever.** `Daily`, `Aniversário` and `google` each read *Nenhuma tarefa encontrada para “…”.* (the Google
    rows are stubbed today); no `/api/google/…` request was logged while searching.
20. **The floor.** One character sent **0** requests and the hint *Digite pelo menos 2 letras para buscar.* showed; clearing
    the field removed both groups and any failure line. **Esc:** with a sheet open from search, `Escape` closed the sheet and
    the screen stayed on `/search`; a second `Escape` returned to `/`.
21. **No match.** `consultar` (a word only a Task holds) rendered **no** *Compromissos* group (no empty header) and the Task
    group; `zzzz` read *Nenhuma tarefa encontrada para “zzzz”.* after both requests had answered.
22. **A failing commitments search.** With `failPaths = ["/api/events?q="]`: a query that matches a Task listed the Task group and
    a `role="alert"` line *O servidor recusou a operação (código 500). Tente de novo.* with its own *Tentar de novo*, and
    **not** *Nenhuma tarefa encontrada…*; a query that matches nothing showed the alert and *Tentar de novo* and still not
    *Nenhuma tarefa encontrada…*; clearing the failure and pressing *Tentar de novo* sent both requests again
    (`/api/tasks?q=zzzz`, `/api/events?q=zzzz`) and the screen read *Nenhuma tarefa encontrada para “zzzz”.*
23. **A failing Task search.** With `failPaths = ["/api/tasks?"]` the same alert and *Tentar de novo* showed, **no** commitment was
    listed beside it though one matched, and *Tentar de novo* sent both requests again and restored both groups.

**AC-30 — offline and failures**

24. **Offline** (the `offline` window event only; the pane has no network-panel toggle I could drive, so *which of the two
    moved the state* is: only the event). On `/day`: *Novo compromisso* disabled. A sheet opened offline: *Salvar* and
    *Excluir* disabled, *Cancelar*, *Fechar* and *Dia inteiro* enabled, and the banner *Sem conexão. Dá para ler, mas não para
    salvar por enquanto.* inside the sheet. With the confirmation open and the connection then dropped: the view showed the
    banner, *Cancelar* enabled and *Excluir* **disabled**; *Fechar* closed it. Local rows still open the sheet to read while
    offline. Back online (`online` event), everything was enabled again.
25. **A failed save stays inline.** With `failMethods = ["POST"]`, *Salvar* of a new commitment kept the sheet open with the title
    intact, showed one `role="alert"` *O servidor recusou a operação (código 500). Tente de novo.*, and **no** `[role=status]`
    toast appeared; the alert was still there **10.5 s later** and after an edit to *Descrição*; clearing the failure and pressing
    *Salvar* succeeded (the row listed, the sheet closed). A network failure on an edit (`failMode = "network"`,
    `failMethods = ["PATCH"]`): *Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.*, sheet open,
    draft intact; clearing it and retrying succeeded.
26. **Deleted elsewhere.** With `notFoundIds = [<id>]`, an edit's *Salvar* kept the sheet open with *Este compromisso não existe
    mais. A lista foi atualizada.* and the log showed `PATCH` then a refetch `GET /api/events?from=2026-10-24&to=2026-10-24`;
    a confirmed *Excluir* did the same inside the confirmation (`DELETE`, then the refetch), with *Cancelar* and *Excluir*
    still present.
27. **A failed delete stays inline.** With `failMethods = ["DELETE"]` the confirmation stayed with a `role="alert"` *O servidor
    recusou a operação (código 500). Tente de novo.*, no toast; *Cancelar* returned to the form; after clearing the failure
    the confirmed *Excluir* succeeded (`DELETE`, `GET`, the row gone).
28. **Capture is not disabled.** On *Hoje* a failed `PATCH` kept the sheet open with the same alert, the capture input
    `placeholder="O que precisa ser feito?"` stayed **enabled**, and no offline banner appeared.
29. **Focus.** Programmatically focusing *Novo compromisso* or a row and opening the sheet, then *Cancelar* or *Fechar*, returned
    focus to that same button.

## Findings

**F1 — Turning *Dia inteiro* off on an all-day commitment saves a zero-length commitment (decision made by the plan; owner's
call).** An all-day commitment shown with its last day set, switched to timed, seeds the start *Hora* `09:00` and leaves the end
*Hora* empty while the end *Dia* keeps the inclusive last day. The plan (AC-A2) fills the missing end part from the start, so the
stored commitment has `startAt` = `endAt` (observed: `{"allDay":false,"startAt":1792587600,"endAt":1792587600}`) and the
status line says so (*Termina em … às 09:00.*, item 3). The owner sees it before saving, but a default of +1 h would be kinder.
Related to plan decision D4-8 (the end does not follow the start). **No change made;** it is a one-line decision for
`event-edit.ts` if the owner wants it, and a reopen trigger for the device proof.

**F2 — A re-tap within about 0.4 s of closing a sheet was swallowed once (not investigated).** A scripted `Cancelar` followed
by a tap on the same row 0.4 s later did not open the sheet in one run; with 0.7 s or more it opened every time (over twenty
reopenings), and a second probe with gaps of 50–450 ms was inconsistent. The `Sheet` primitive transitions `translate` over 0.3 s
(`display allow-discrete`), which is the likeliest cause, and the primitive is shared with `TaskSheet`; I did **not**
compare against the Task sheet, so I do not claim it is pre-existing. A finger cannot re-tap that fast; listed so the device
proof can watch for it.

**F3 — No success toast anywhere (D4-6), by design.** Saves, edits and deletes close the sheet and show the result in the list;
there is no *Desfazer* on `/day`. The phase-3 ✘ in checklist item 8 stands and is the owner's call.

## Not observed (owed)

- **The pane's own Offline toggle** (only the `offline` event was dispatched, item 24).
- **The visible focus ring** after a key press and a real `Tab` walk (only the tabbable order and focus return were read).
- **`Esc` while a Task title is edited inline** on `/day` (phase-3 clause, unchanged).
- **A Task row opened from the *Hoje* group of a search result** (the Task group was collapsed in the readings); the Task
  sheet's own behaviour is unchanged code.
- **A month boundary on `/day`** (phase-3 clause) and **the narrow-column wrap of `até HH:mm`** (phase-3).
- **The owner's device:** how the native date, time and the 418-option zone `<select>` render and scroll on Android Chrome,
  keyboard overlap and the visual viewport with the sheet open, the Android back gesture closing the sheet and leaving the
  screen, contrast on a real panel, safe areas, `overscroll-behavior`, Lighthouse — phase 5's device proof.

## Owner decisions on these findings (2026-10-27)

Recorded as D-W in the PRD's Decisions Log; this section only points at the outcome so the finding and its resolution live
together.

- **F1 — decided and built.** "Vamos adicionar 1 hora nesse caso": a timed end that has only the start's own day is now the
  start plus one hour (`resolveDraftTimes` in `src/shared/event-edit.ts`), so switching *Dia inteiro* off on a single-day
  commitment no longer saves a zero-length one; an end time the owner typed is always kept. Built test-first (five cases in
  `test/event-edit.test.ts`, red before the change) and seen live: the same all-day commitment, switched to timed, showed
  *Termina em 27/10/2026 às 10:00.* for a 09:00 start and sent `endAt` = `startAt` + 3600.
- **F2 — recorded as an attention point and possible debt, not fixed** (roadmap Backlog). The cause is no longer a guess. A
  later probe, with the pane in front, instrumented `HTMLDialogElement.close`/`showModal` with stack traces and the `close`
  event: after *Cancelar* at 0 ms, `close()` ran at 200 ms (the `Sheet.tsx` effect), the re-tap's `showModal()` at 319 ms, and
  only then the `close` event of the FIRST `close()` at 371 ms; `Sheet` mirrors it into `onOpenChange(false)`, so a second
  `close()` ran at 430 ms and shut the sheet that had just reopened. A scripted sweep (3 trials per gap) swallowed the reopen at 0, 20,
  60 and most 120 ms gaps and never from 200 ms up. The measurement was made in a pane that may throttle tasks, so the real window
  on a device is probably narrower (unproven there); the logic defect is in the shared primitive, so every sheet has it.
  **Then fixed, the same day, at the owner's request:** `shouldMirrorDialogClose` (`src/shared/dialog-events.ts`, 8 cases in
  `test/dialog-events.test.ts`, built test-first) makes `Sheet.tsx` report a `close` event only while the dialog is closed and every
  `cancel`; the same sweep then reopened the Compromisso sheet 12 of 12 times at gaps of 0, 20, 60 and 120 ms and the Task sheet 8 of 8,
  and a real `Escape` and the *Fechar* button still close it, with a reopen working after both.
- **F3 — no success toast: kept** (D4-6 stands). Phase 3's item 8 (no *Desfazer* on `/day`) keeps its recorded exception.
- **The strings listed in the phase-4 checklist preamble: approved**, and added to the microcopy table of
  `documentation/10-product/visual-identity.md`. The search field's *tarefas* copy stays as it is, noted as an attention point.
