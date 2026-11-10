# Live-pass protocol — unit 14 `events-and-day-view`, phase 4 (the Compromisso sheet and search results)

This is the executable protocol for the verification that three manual acceptance criteria of the phase need
(PRD AC-28, AC-29, AC-30; plan AC-A6, AC-A7, AC-A8, AC-A9). The Implementer has no browser, so it wrote this document and
did not run it. The orchestrator (or the owner) runs it in the browser pane — Chromium at 375 x 812 and at 1280 x 800,
dark — and records the outcome as `PRPs/reports/events-and-day-view/phase-4/live-browser-pass.md`, in the format of
`PRPs/reports/events-and-day-view/phase-3/live-browser-pass.md`: a short preamble saying how it was run, a `Measured`
table, `Observed behaviour` as numbered items, and the findings that need a change. The marks that
`PRPs/reports/events-and-day-view/phase-4/ui-checklist.md` leaves as `owed to the live pass` are then replaced by a
citation of those numbered observations, and nothing else in that file changes.

**Rules of the pass.** Dark theme only. Every number is read from the DOM (`getBoundingClientRect`,
`getComputedStyle`, `scrollWidth`) or from the request log, never estimated. Say plainly when the pane did not render a
frame: no screenshot is claimed that was not taken (guidelines §12.6). When a clause cannot be observed, write
`not observed` and why; do not guess. Where an item says "read the request body in the log", the body is the JSON the
page sent, not what the server stored.

## Setup

Everything runs from the worktree of the branch under test, against a local D1 that holds synthetic rows only. Never a
production token, never production data, never the owner's secrets.

1. **Back up and patch the token.** Copy `.dev.vars` to a file outside the repository (for example under the session
   scratchpad), then replace only the `API_BEARER_TOKEN` line of `.dev.vars` with a throwaway value generated for the
   run (`node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"`). Do not print the
   other lines of the file. Setup background: the "Setup step by step" section of
   `documentation/40-engineering/dev-environment.md`, and the preamble of the life-areas
   `live-browser-pass.md`.
2. **Migrate the local database** if the worktree has never run: `npm run db:migrate`.
3. **Start the dev server** from the worktree: `npm run dev -- --host 127.0.0.1 --port 5180`. It serves the SPA, the API
   and a local D1 in one process. Open `http://127.0.0.1:5180/` in the pane and paste the throwaway token at the
   token gate once.
4. **Set the viewport** with an explicit `{ width, height }` (375 x 812 first, 1280 x 800 later); the `desktop` preset may
   silently not apply.
5. **Afterwards, always:** stop the dev server and any leftover Windows child process (`workerd`), restore `.dev.vars`
   byte-identical from the backup (compare with `cmp`), and delete the backup if it sits anywhere inside the repository.
   The local D1 under `.wrangler/state/` is git-ignored and may stay.

The `window.fetch` wrapper below is installed **in the page** and lives until the page reloads. Install it after the
page has loaded and navigate inside the app (the header date, the arrows, *Hoje*, the search icon) rather than by typing
an address; when an address has to be loaded directly (a reload, `/day/<date>`), install the wrapper again afterwards.

**The wrapper.** It is the phase-3 stub (Google rows for `GET /api/google/events`, `failPaths`, response `delays`), extended
so that a write to `/api/events` can be made to fail on demand and so that every request is logged with its method and
body:

```js
(() => {
  const realFetch = window.fetch.bind(window);
  const SP = "America/Sao_Paulo";
  const dayOf = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: SP, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = dayOf(new Date());
  const at = (day, h, min) => { const [y, m, d] = day.split("-").map(Number); return Date.UTC(y, m - 1, d, h + 3, min); }; // milliseconds
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const row = (id, title, start, end) => ({ id, calendarId: "primary", title, allDay: "date" in start, start, end, location: null, hasGuests: false, htmlLink: "https://calendar.google.com/" });
  const state = (window.__stub = {
    // "ready" | "partial" | "not_connected" | "invalid_grant" | "502"
    google: "ready",
    // Any request whose path (with its query) starts with one of these answers 500,
    // e.g. ["/api/events?q="] fails only the commitments search, ["/api/tasks?"] only the Task list
    failPaths: [],
    // Writes to /api/events (and /api/events/<id>) whose method is listed here fail:
    // ["POST"], ["PATCH"], ["DELETE"] or any mix. How they fail is failMode.
    failMethods: [],
    // "500" answers { error: "boom" } with status 500; "network" throws TypeError("Failed to fetch"),
    // which is what a dropped connection looks like to the page.
    failMode: "500",
    // Event ids that answer 404 to PATCH and DELETE, as if another device had deleted them first.
    notFoundIds: [],
    // { "<from day>": milliseconds } — delays the RESPONSE of any /api request whose `from` equals the key,
    // AFTER the server answered, so the page receives an older answer late (the stale-response check).
    delays: {},
    // Every request the page made: { method, path, body }.
    log: [],
    googleRows: [
      row("g-standup", "Daily (Google)", { dateTime: at(today, 14, 0), timeZone: SP }, { dateTime: at(today, 14, 30), timeZone: SP }),
      row("g-allday", "Aniversário (Google)", { date: today }, { date: today }),
    ],
  });
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.origin);
    const method = String(init?.method ?? (typeof input === "string" ? "GET" : input.method) ?? "GET").toUpperCase();
    const path = url.pathname + url.search;
    state.log.push({ method, path, body: typeof init?.body === "string" ? init.body : null });
    if (url.pathname === "/api/google/events") {
      const window_ = { timeMin: "stub", timeMax: "stub" };
      if (state.google === "ready") return json(200, { events: state.googleRows, failedCalendars: [], window: window_ });
      if (state.google === "partial") return json(200, { events: state.googleRows, failedCalendars: ["work@example.com"], window: window_ });
      if (state.google === "not_connected") return json(409, { error: "unavailable", reason: "not_connected" });
      if (state.google === "invalid_grant") return json(409, { error: "unavailable", reason: "invalid_grant" });
      return json(502, { error: "unavailable", reason: "http_502" });
    }
    const isEventWrite = url.pathname.startsWith("/api/events") && ["POST", "PATCH", "DELETE"].includes(method);
    if (isEventWrite && state.failMethods.includes(method)) {
      if (state.failMode === "network") throw new TypeError("Failed to fetch");
      return json(500, { error: "boom" });
    }
    const eventId = url.pathname.match(/^\/api\/events\/([^/]+)$/)?.[1];
    if (eventId !== undefined && ["PATCH", "DELETE"].includes(method) && state.notFoundIds.includes(eventId)) {
      return json(404, { error: "Compromisso não encontrado" });
    }
    if (state.failPaths.some((prefix) => path.startsWith(prefix))) return json(500, { error: "boom" });
    const response = await realFetch(input, init);
    const wait = state.delays[url.searchParams.get("from") ?? ""];
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    return response;
  };
  return "stub installed";
})();
```

Switch behaviour at any time (`window.__stub.failMethods = ["PATCH"]`, `window.__stub.failMode = "network"`,
`window.__stub.notFoundIds = ["<id>"]`, `window.__stub.failPaths = ["/api/events?q="]`); the next request uses it. Clear
it by setting the list back to `[]`. Read the log with `window.__stub.log.slice(-10)`. To list the requests of one step,
note `window.__stub.log.length` first and slice from it afterwards.

## Fixtures

Create everything through the real routes, with the throwaway token (`$TOKEN`) and `BASE=http://127.0.0.1:5180`.
`America/Sao_Paulo` has been UTC−03:00 with no daylight saving since 2019, so the epoch seconds of a wall-clock moment
are `Date.UTC(y, m - 1, d, h + 3, min) / 1000`. The script below prints the exact JSON bodies for today's date; copy
each printed line into a request.

```bash
node --input-type=module -e "
const tz = 'America/Sao_Paulo';
const fmt = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const plus = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const at = (day, h, min) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d, h + 3, min) / 1000; };
const today = fmt(Date.now());
const weekday = new Date(today + 'T12:00:00Z').getUTCDay(); // 0 = Sunday
const nextMonday = plus(today, ((8 - weekday) % 7) || 7);
const nextTuesday = plus(nextMonday, 1);
const rows = [
  ['POST /api/events', { title: 'Dentista', startAt: at(today, 9, 30), endAt: at(today, 10, 30) }],
  ['POST /api/events', { title: 'Feriado', allDay: true, startDate: today, endDate: plus(today, 1) }],
  ['POST /api/events', { title: 'Plantão', startAt: at(plus(today, 1), 23, 0), endAt: at(plus(today, 2), 1, 0) }],
  ['POST /api/events', { title: 'Retiro', allDay: true, startDate: nextMonday, endDate: plus(nextMonday, 2) }],
  ['POST /api/events', { title: 'Reunião de terça', startAt: at(nextTuesday, 10, 0), endAt: at(nextTuesday, 11, 0) }],
  ['POST /api/events', { title: 'Consulta dentista', description: 'levar exames da consulta', startAt: at(plus(today, 3), 15, 0), endAt: at(plus(today, 3), 16, 0) }],
  ['POST /api/events', { title: 'Reunião', startAt: at(plus(today, 4), 11, 0), endAt: at(plus(today, 4), 12, 0) }],
  ['POST /api/tasks', { title: 'Tarefa de hoje', scheduledDate: today }],
  ['POST /api/tasks', { title: 'Tarefa com prazo amanhã', deadline: plus(today, 1) }],
  ['POST /api/tasks', { title: 'Consultar o dentista', scheduledDate: today }],
];
console.log(JSON.stringify({ today, tomorrow: plus(today, 1), dayAfter: plus(today, 2), in3Days: plus(today, 3), in4Days: plus(today, 4), nextMonday, nextTuesday }));
for (const [route, body] of rows) console.log(route + ' ' + JSON.stringify(body));
"
```

Then, for each printed `POST …` line:
`curl -s -X POST "$BASE/api/<events|tasks>" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '<body>'`.
Expect `201`. The run is meant to hold:

| Fixture | Where it shows |
|---|---|
| *Dentista* timed 09:30–10:30 today, *Feriado* all-day today | *Hoje* Agenda (expand the group first) and `/day/<today>` |
| *Plantão* timed 23:00 tomorrow to 01:00 the day after | `/day/<tomorrow>` and `/day/<dayAfter>` |
| *Retiro* all-day, next Monday through next Tuesday; *Reunião de terça* next Tuesday 10:00–11:00 | `/day/<nextMonday>`, `/day/<nextTuesday>` |
| *Consulta dentista* (description *levar exames da consulta*) in three days at 15:00, *Reunião* in four days at 11:00 | search: two words, a word that appears only in a description, a word shared with a Task title |
| *Tarefa de hoje*, *Tarefa com prazo amanhã*, *Consultar o dentista* | the Task side of search and the `/day` Tasks section |

The Google stub serves two rows today (*Daily (Google)* and *Aniversário (Google)*): they must never appear in search.

## AC-28

The sheet, from `/day/<date>` and from *Hoje*'s Agenda. 375 x 812 unless a line says otherwise. Install the wrapper first.

1. **Prefilled, on a day that is not today.** Open `/day/<in3Days>` (reach it with the arrows or the header date and the
   stepper; reload and reinstall the wrapper if you load it by address) and tap *Novo compromisso*: a sheet titled
   *Novo compromisso* opens, *Início* *Dia* holds that date, *Hora* holds `09:00`, *Fim* is empty, *Fuso horário* reads
   `America/Sao_Paulo`, *Título*, *Local* and *Descrição* are empty. Record the values of every field.
2. **Prefilled, today.** On `/day/<today>` the *Hora* is the next full hour after the clock: record the pane's clock
   (`new Date()` in the page) and the value (14:00 and 14:30 give 15:00, 06:30 gives 07:00, 23:10 gives 23:00).
3. **Field order in the DOM.** Run
   `[...document.querySelectorAll("dialog[open] label, dialog[open] legend, dialog[open] [aria-label='Dia inteiro'], dialog[open] button")].map((el) => el.getAttribute("aria-label") || el.textContent.trim())`
   and record the order. It must read *Título*, *Dia inteiro*, *Início* (with its *Dia* and *Hora*), *Fim* (with its *Dia* and
   *Hora*), *Fuso horário*, *Local*, *Descrição*, *Cancelar*, *Salvar* (the sheet's *Fechar* button comes first, and
   *Excluir* is absent for a new commitment). No field has focus when the sheet opens (the dialog itself does).
4. **The resolved end.** With *Fim* empty a status line reads `Termina em dd/MM/aaaa às HH:mm.` (start plus one hour; record
   the text). Type only an end *Dia*: the line reads that day with the start's time. Type only an end *Hora*: the start's
   day with that time. Fill both: the line disappears.
5. **Dia inteiro.** Turn *Dia inteiro* on: both *Hora* inputs disappear, *Fim* keeps its *Dia*, and the status line reads
   `Termina em dd/MM/aaaa.` (no time) while *Fim* is empty. Turn it off: the times come back with the values they had.
6. **An end before the start.** Set *Fim* before *Início* (for example the same day with an earlier *Hora*): the line
   *O fim não pode ser antes do início.* appears at once, as a `role="alert"` after *Fim*, before any press of *Salvar*, and the
   `Termina em` line is gone. Press *Salvar*: nothing is sent (compare `window.__stub.log.length` before and after). Fix the
   end: the reason disappears.
7. **A blank title.** With the title empty, no reason shows while you tap around. Press *Salvar*: *Informe o título.* shows
   after *Título* as a `role="alert"` and nothing is sent. Clear the start *Dia* and press *Salvar*: *Informe o dia de
   início.*; clear the start *Hora* with a day set: *Informe a hora de início.* (a native time input may refuse to
   stay empty; record what it does).
8. **Create.** Fill a title and *Salvar*: the log shows one `POST /api/events` whose body carries `title`, `allDay: false`,
   `timezone`, `startAt` and `endAt` and neither `startDate` nor `endDate`; the sheet closes; `GET /api/events?from=…&to=…`
   follows; the day lists the commitment without a reload. Create an all-day one the same way: the body carries
   `startDate` and the EXCLUSIVE `endDate` (a last day of the 27th is stored as the 28th) and no instants.
9. **Open and edit.** Tap a local row on `/day` (and, separately, on *Hoje*: expand *Agenda* first, then tap a local row):
   the same sheet opens with every field filled (the times in the commitment's own zone). A title-only edit then *Salvar*
   sends a `PATCH /api/events/<id>` whose body is exactly `{"title": …}`; moving the start sends both `startAt` and `endAt`;
   moving only the end sends `endAt` alone; changing only the zone sends `timezone`, `startAt` and `endAt`; toggling *Dia
   inteiro* sends `allDay` and only the target shape's keys; clearing *Local* sends `"location": null`. After each, the list
   shows the change without a reload (on `/day`, on *Hoje*'s Agenda). Saving a commitment with no change closes the sheet and
   sends **no** request.
10. **Excluir.** In an existing commitment the distant ghost *Excluir* is present. It opens, inside the sheet, a confirmation
    titled `Excluir este compromisso?` with the line *Não dá para desfazer.*, *Cancelar* focused (record
    `document.activeElement`), and *Excluir* second. *Cancelar* returns to the form with the draft intact. *Excluir* sends
    `DELETE /api/events/<id>`, the sheet closes and the row is gone without a reload.
11. **Esc and the back gesture.** With the sheet open on `/day`, press `Esc`: the sheet closes and the screen **stays on
    `/day/<date>`** (`location.pathname` unchanged, `history.length` unchanged). Press `Esc` again with no sheet open: the day
    is left. Repeat on *Hoje*'s sheet (there is no `Esc` handler there).
12. **A closed sheet keeps its draft.** Edit a title without saving, close with *Cancelar*, reopen the same commitment: the
    edit is still there. Press *Salvar*: the draft is gone and a later reopen shows the stored values. For a new commitment:
    type a title, close, reopen *Novo compromisso* on the same day (the title is there), then open it on another day (it is
    empty and prefilled with THAT day).
13. **A Google row stays a link.** On `/day/<today>` and on *Hoje*'s Agenda the Google rows are `<a target="_blank">` rows,
    not `<button>`s, keep the dashed border and open Google Calendar; tapping one never opens the sheet.
14. **Back button with the sheet open.** On `/day/<date>` open the sheet, then press the desktop Back button
    (`history.back()`): the sheet is closed with the day it was opened for (no stale sheet over another date).
15. **The `/` shortcut and the zone select (*Hoje*).** Open a commitment on *Hoje*'s Agenda, focus *Fuso horário* and press
    `/`: the search screen does **not** open and the sheet stays. Close the sheet and press `/` with nothing focused: search
    opens (unchanged).
16. **No stale repaint (*Hoje*).** Set `window.__stub.delays = { "<today>": 4000 }` and dispatch
    `document.dispatchEvent(new Event("visibilitychange"))` (see the phase-3 protocol for forcing `visibilityState`). While
    that slow `GET /api/events?from=<today>&to=<today>` is in flight, delete a commitment from its sheet (clear `delays`
    first so the delete's own refetch is quick). After 6 s the deleted commitment must **not** be back in the Agenda.
    Record the log.
17. **Never two sheets.** On *Hoje*, with the Compromisso sheet open, open nothing else (the page behind is inert); open a Task
    from a notification-style address (`/tasks/<id>`) while it is closed and confirm only the Task sheet shows.

## AC-29

On `/search` (the header search icon), 375 x 812. Install the wrapper first (it persists across in-app navigation).

1. **Two words find a commitment.** Type `consulta dentista`: after the 300 ms debounce one `GET /api/tasks?q=…` and one
   `GET /api/events?q=consulta%20dentista` are sent; a *Compromissos* group appears **first in the DOM**, with its count,
   and its row reads `dd/MM/aaaa · HH:mm` (the date three days ahead, `15:00`) and the title. The *Consultar o dentista* Task
   is also found and renders in its own group as before.
2. **A description match.** Type `exames`: *Consulta dentista* is found through its description. Type `reuniao`
   (no accent): *Reunião* and *Reunião de terça* are found. Record the group count each time.
3. **The all-day label.** Type `feriado`: its row reads `dd/MM/aaaa · dia todo`.
4. **Open and edit.** Tap a commitment row: the Compromisso sheet opens filled. Change the title to something that no
   longer matches the query and *Salvar*: the group refreshes (the log shows a new `GET /api/events?q=…`) and the row is gone;
   change it back, and a delete removes the row too.
5. **No Google event, ever.** The stubbed *Daily (Google)* and *Aniversário (Google)* never appear in any query, and the log
   holds no request to `/api/google/…` while searching.
6. **The floor.** Type one character: no `/api/events` and no `/api/tasks` request is sent (compare the log length), the hint
   *Digite pelo menos 2 letras para buscar.* shows. Clear the field: both groups and any failure line go away.
7. **No match.** Type a word that only a Task title holds (`consultar`): no *Compromissos* group is rendered at all (not an
   empty header) and the Task groups render exactly as before. Type a word nothing holds (`zzzz`): *Nenhuma tarefa
   encontrada para “zzzz”.* shows, and only after both requests answered.
8. **A failing commitments search.** Set `window.__stub.failPaths = ["/api/events?q="]` and type a query that matches a
   Task: the Tasks are listed, a `role="alert"` line reads *O servidor recusou a operação (código 500). Tente de novo.*
   with its own *Tentar de novo*, and *Nenhuma tarefa encontrada…* does **not** show. Type a query that matches nothing while
   it is still failing: the failure line shows and *Nenhuma tarefa encontrada…* still does not. Clear `failPaths` and press
   *Tentar de novo*: the line goes away and the log shows both requests again.
9. **A failing Task search is unchanged.** Set `failPaths = ["/api/tasks?"]`: the Task failure line and its *Tentar de novo*
   show exactly as before (record the text), and a matching commitment is not shown beside it.
10. **Esc.** With the sheet open, `Esc` closes the sheet and the search stays; again with no sheet open, `Esc` leaves search.
11. **Order and rows.** The *Compromissos* group is the first `<section>` of the results; its rows are 64 px tall `<button>`s
    with the solid border; a Task row opens the Task sheet as before.

## AC-30

1. **Offline.** Dispatch `window.dispatchEvent(new Event("offline"))` and set the pane's network panel to Offline (record
   which of the two moved the connectivity state). On `/day/<date>` *Novo compromisso* is disabled. With a sheet already
   open (open it before going offline): *Salvar* and *Excluir* are disabled, the confirmation's *Excluir* is disabled while
   its *Cancelar* is enabled, the banner `Sem conexão.` with *Dá para ler, mas não para salvar por enquanto.* shows at the
   top of the sheet, and *Cancelar* and *Fechar* still close it. Back online, everything is enabled again. Repeat the
   *Novo compromisso*-less check on *Hoje*'s Agenda rows (they still open the sheet to read) and on search (the results
   region is empty while offline, as before).
2. **A failed save stays inline.** `window.__stub.failMethods = ["POST"]` and *Salvar* a new commitment: the sheet stays open
   with the draft intact, a `role="alert"` line under *Salvar* reads *O servidor recusou a operação (código 500). Tente de
   novo.*, and **no toast** appears anywhere. Clear `failMethods` and press *Salvar* again: it succeeds. Then
   `failMode = "network"`, `failMethods = ["PATCH"]` on an edit: the line reads *Sem conexão com o servidor. Nada se
   perdeu — tente de novo quando a conexão voltar.*, the sheet is still open and the draft intact; clear and retry:
   success. The error is persistent (it is still there after 10 s and after a field edit) and is cleared by the next attempt.
3. **A failed delete stays inline.** `failMethods = ["DELETE"]`, *Excluir*, confirm: the confirmation stays with the same
   kind of `role="alert"` line, *Cancelar* still works, no toast; retry after clearing succeeds.
4. **Deleted elsewhere.** `notFoundIds = ["<id>"]` for a commitment the sheet has open (or delete it with `curl` first),
   edit and *Salvar*: the line reads *Este compromisso não existe mais. A lista foi atualizada.*, the sheet stays open,
   and the log shows a refetch of the list right after the 404 (and the row is gone from the list behind). Do the same for
   a delete.
5. **Capture is not disabled.** After any failed commitments write on *Hoje*, the capture deck is still enabled (the failure
   was not reported to the connectivity reducer) and no offline banner appeared.
6. **Targets.** See the measurements below; every control in the sheet is at least 48 px and 8 px from its neighbours.
7. **A new sheet reachable by keyboard.** Tab through the sheet: every control is reached in DOM order, the focus ring is
   visible after the first key press, and closing returns focus to the element that opened it (the row or *Novo compromisso*).

## Measurements

Measure at 375 x 812 and again at 1280 x 800 (the column caps at 640 px; the sheet is a centred 560 px dialog from 640 px).
Fill one row per reading in `live-browser-pass.md`. Use `getBoundingClientRect` on every control:

```js
[...document.querySelectorAll("dialog[open] button, dialog[open] input, dialog[open] select, dialog[open] textarea, main button, main a")].map((el) => {
  const r = el.getBoundingClientRect();
  return { name: el.getAttribute("aria-label") || el.id || el.textContent.trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
});
```

| Surface | Measure | Result |
|---|---|---|
| The sheet at 375 px, new commitment and existing one | every `button`, `input`, `select` and `textarea` at least 48 px tall, the buttons and the chip at least 48 x 48; gap to the nearest neighbour at least 8 px | |
| `/day/<date>` at 375 px | every control at least 48 x 48 and 8 px apart, including the new primary button | |
| The primary *Novo compromisso* button | its box (height at least 48; it is `self-start`, as wide as its text and the glyph), its position above the failures block, and that it is the only `primary` button on the screen (query `button` elements with the accent background) | |
| The date and time inputs side by side in *Início* and in *Fim*, at 375 and at 1280 | the date input and the 128 px time input on one row, and no horizontal overflow: `scrollWidth` against `clientWidth` of the dialog, of each fieldset and of `document.documentElement` | |
| The sheet's height | the dialog's `getBoundingClientRect().height` against `0.9 * window.innerHeight` (`90dvh`), and that it scrolls internally (`scrollHeight` above `clientHeight`, `overflow-y: auto`) with the *Salvar* row reachable | |
| *Fuso horário* | the number of `<option>` elements, and the first two values (expected: `America/Sao_Paulo`, then the commitment's own zone when it differs, or the first zone of the runtime list) | |
| The widest search label at 375 px | the time `<span>` of a *Compromissos* row: its width, that it stays on one line (`scrollWidth` equals `clientWidth`, one line of height), and the width left to the title column beside it | |
| A *Compromissos* row in search and on `/day` | height at least 64 px; the same height as a Task row and a Google row | |
| Network panel / `window.__stub.log` | no request to another origin during any screen (every `path` begins with `/api/`) | |

**What the pane cannot show — owed to the owner's device (phase 5's device proof):** how the native date, time and the
roughly 400-option zone `<select>` render and scroll on Android Chrome, and whether that list is unwieldy there (the
recorded fallback is a short list with search); how the native pickers behave inside a `<dialog>`; keyboard overlap and the
visual viewport with the sheet open; the Android back gesture closing the sheet and, with no sheet, leaving the screen;
contrast measured on a real panel (guidelines §4.3); safe areas and `overscroll-behavior`; Lighthouse on the phone. If the pane
does not display, say so and measure the DOM; do not claim a screenshot.
