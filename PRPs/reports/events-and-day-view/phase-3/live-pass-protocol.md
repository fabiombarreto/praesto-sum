# Live-pass protocol — unit 14 `events-and-day-view`, phase 3 (the range function and the day)

This is the executable protocol for the verification that three manual acceptance criteria of the phase need
(PRD AC-23, AC-24, AC-25; plan AC-A6, AC-A7, AC-A8). The Implementer has no browser, so it wrote this document and did
not run it. The orchestrator (or the owner) runs it in the browser pane — Chromium at 375 x 812 and at 1280 x 800,
dark — and records the outcome as `PRPs/reports/events-and-day-view/phase-3/live-browser-pass.md`, in the format of
`PRPs/reports/life-areas/phase-4/live-browser-pass.md`: a short preamble saying how it was run, a `Measured` table,
`Observed behaviour` as numbered items, and the findings that need a change. The marks that
`PRPs/reports/events-and-day-view/phase-3/ui-checklist.md` leaves as `owed to the live pass` are then replaced by a
citation of those numbered observations, and nothing else in that file changes.

**Rules of the pass.** Dark theme only. Every number is read from the DOM (`getBoundingClientRect`,
`getComputedStyle`, `scrollWidth`) or from the network panel, never estimated. Say plainly when the pane did not
render a frame: no screenshot is claimed that was not taken (guidelines §12.6). When a clause cannot be observed, write
`not observed` and why; do not guess.

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

The `window.fetch` wrapper below is installed **in the page** and lives until the page reloads. Install it after
the page has loaded and navigate inside the app (the header date, the arrows, *Hoje*) rather than by typing an address;
when an address has to be loaded directly (AC-24 deep link, reload), install the wrapper again afterwards.

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
  ['POST /api/tasks', { title: 'Tarefa de hoje', scheduledDate: today }],
  ['POST /api/tasks', { title: 'Tarefa com prazo amanhã', deadline: plus(today, 1) }],
  ['POST /api/tasks', { title: 'Tarefa da terça', scheduledDate: nextTuesday }],
];
console.log(JSON.stringify({ today, tomorrow: plus(today, 1), dayAfter: plus(today, 2), nextMonday, nextTuesday }));
for (const [route, body] of rows) console.log(route + ' ' + JSON.stringify(body));
"
```

Then, for each printed `POST …` line:
`curl -s -X POST "$BASE/api/<events|tasks>" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '<body>'`.
Expect `201`. The run is meant to hold:

| Fixture | Where it shows |
|---|---|
| *Dentista* timed 09:30–10:30 today | *Hoje* Agenda; `/day/<today>` as `09:30–10:30` |
| *Feriado* all-day today | *Hoje* Agenda first; `/day/<today>` in the all-day section as `dia todo` |
| *Plantão* timed 23:00 tomorrow to 01:00 the day after | `/day/<tomorrow>` as `23:00–01:00`; `/day/<dayAfter>` as `até 01:00` |
| *Retiro* all-day, next Monday through next Tuesday (stored end = the Wednesday) | `/day/<nextMonday>` and `/day/<nextTuesday>`, all-day section; absent on the Wednesday |
| *Reunião de terça* timed 10:00–11:00 next Tuesday | `/day/<nextTuesday>` only; absent from today's Agenda |
| *Tarefa de hoje* (`scheduledDate` today), *Tarefa com prazo amanhã*, *Tarefa da terça* | the Tasks section of the matching day only |

**The Google stub.** The local server has no Google connection, so `GET /api/google/events` is stubbed in the page. Paste
this once per page load (it can also make any other path answer 500 through `failPaths`, and delays responses by the
`from` day for the stale-response check):

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
    // e.g. ["/api/events"], ["/api/tasks?"] or ["/api/tasks/<id>/complete"]
    failPaths: [],
    // { "<from day>": milliseconds } — delays any /api response whose `from` equals the key
    delays: {},
    log: [],
    googleRows: [
      row("g-standup", "Daily (Google)", { dateTime: at(today, 14, 0), timeZone: SP }, { dateTime: at(today, 14, 30), timeZone: SP }),
      row("g-allday", "Aniversário (Google)", { date: today }, { date: today }),
      row("g-untitled", null, { dateTime: at(today, 17, 45), timeZone: SP }, { dateTime: at(today, 18, 15), timeZone: SP }),
    ],
  });
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.origin);
    state.log.push(url.pathname + url.search);
    const wait = state.delays[url.searchParams.get("from") ?? ""];
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    if (url.pathname === "/api/google/events") {
      const window_ = { timeMin: "stub", timeMax: "stub" };
      if (state.google === "ready") return json(200, { events: state.googleRows, failedCalendars: [], window: window_ });
      if (state.google === "partial") return json(200, { events: state.googleRows, failedCalendars: ["work@example.com"], window: window_ });
      if (state.google === "not_connected") return json(409, { error: "unavailable", reason: "not_connected" });
      if (state.google === "invalid_grant") return json(409, { error: "unavailable", reason: "invalid_grant" });
      return json(502, { error: "unavailable", reason: "http_502" });
    }
    if (state.failPaths.some((prefix) => (url.pathname + url.search).startsWith(prefix))) return json(500, { error: "boom" });
    return realFetch(input, init);
  };
  return "stub installed";
})();
```

Switch behaviour at any time with `window.__stub.google = "not_connected"` (and so on); the next load of a screen uses it.
`window.__stub.log` lists every request the page made, which is also how the "no request to another origin"
measurement is double-checked (every entry must be a same-origin `/api/…` path).

## AC-23

On *Hoje* (`/`), 375 x 812, with the stub on `ready`. Reload the screen's data by dispatching
`document.dispatchEvent(new Event("visibilitychange"))` after setting the stub. The handlers refetch only when
`document.visibilityState` is `"visible"`; if the pane reports `hidden`, first run
`Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })`.

1. **Counted together.** With *Dentista* (local), *Feriado* (local, all-day) and the three stubbed Google rows today,
   the group reads *Agenda · 5*. The plan's own case is one local and one Google row: delete the other rows (or trim
   `window.__stub.googleRows` and delete a local Event through `DELETE /api/events/<id>`) until exactly one of each
   remains, and record that it reads *Agenda · 2*. Record the count of every case you set up.
2. **Order.** Expand the group (it is collapsed by default; record that). Rows read all-day first, then ascending
   by time; a local row before a Google row at the same time. Record the visible order and each time label.
3. **Solid versus dashed.** The local rows have a solid border and the filled ground, no checkbox, no `<a>`, no
   `<button>` and no `tabindex` (query `li` children). The Google rows keep the dashed border, the `Calendar` glyph and
   their link (`<a target="_blank">`). Record the computed `border-style` of each.
4. **Inert, as designed.** Tap a local row and record that nothing happens (no sheet, no navigation, no pressed or
   hover treatment). This is intentional in this phase (plan decision D3-5); the Compromisso sheet is phase 4 (PRD AC-28).
5. **A Google-only day is unchanged.** Remove the local rows (delete them through `DELETE /api/events/<id>` or read
   a day with none) and record, for the same stubbed payload, the Google rows' time `<span>` class attribute
   (must read exactly `w-14 flex-none font-data text-t1 text-muted tabular-nums`), the time text of each row (must equal
   `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })` of the stub's
   start, and `dia todo` for the all-day row), the row's class attribute and height (64 px), and the group header
   (name and count only when collapsed). For the strongest comparison, serve the merge base `4231ee8` from a second
   scratch worktree on another port and record the same four readings there.
6. **Google down, local rows still listed.** Set `window.__stub.google = "not_connected"`, dispatch
   `visibilitychange`: the notice *Google não conectado.* shows as a `role="status"` line, the top banner of *Hoje*
   (*Agenda indisponível.*) is unchanged, and the local rows are still listed with their count. Repeat for
   `invalid_grant` (*A conexão com o Google expirou. Reconecte para ver a agenda.*), `502` (*Não foi possível carregar a
   agenda agora. Tente novamente mais tarde.*) and `partial` (*Um calendário não respondeu — a agenda pode estar
   incompleta.*).
7. **A failed commitments request is never a free day.** Set `window.__stub.failPaths = ["/api/events"]`, then dispatch
   `visibilitychange`: the Agenda region shows the failure message of the commitments request (*O servidor recusou a
   operação (código 500). Tente de novo.*) and **does not** show *Nada na agenda hoje.* even with Google `ready` and no
   Google rows. Record the exact text. The Task list and the header are unaffected and the offline banner does not
   appear (the failure is kept out of the connectivity reducer).
8. **The empty day.** With every source `ready` and nothing today, *Nada na agenda hoje.* shows (the unit-4 text).
9. **Collapsed header.** Collapsed, the group header shows its name and count only. The "next event" line the layout
   standard §2.4 and the PRD AC-23 word describe was never built by unit 4 and is not built here (plan Notes);
   record that it is absent and nothing more.
10. **The header date.** The date beside *Hoje* is a button named `qua., 20/08 — abrir o dia` style (visible date first);
    tapping it opens `/day/<today>`. Record its bounding box (it must be at least 48 px tall) and that the header's
    other controls did not move (compare their boxes with a reading from the merge base, or with 48 x 48 and the 12 px
    gap rule).

## AC-24

On `/day/<date>`, reached from the header date and by address (`http://127.0.0.1:5180/day/<date>`, which needs the
stub installed again after the load), 375 x 812.

1. **Heading.** The `<h1>` is the pt-BR long date (`terça-feira, 20 de outubro` style, the year only when it is not the
   current one) and `document.title` is `<heading> · Praesto Sum`.
2. **Stepping.** The *Dia anterior* and *Próximo dia* buttons step one day each; after each tap record
   `location.pathname` and `history.length` (it grows by one per step). `history.back()` then returns through the
   visited days in reverse. A step across a month boundary lands on the right date.
3. **Order of the sections.** All-day section first (`aria-label="Dia inteiro"`), then timed commitments
   (`"Compromissos"`), then the Tasks (`"Tarefas"`); a section with no rows is absent. Record the DOM order.
4. **Time labels.** Timed rows read `HH:mm–HH:mm` with an en dash and no spaces; all-day rows read `dia todo`; on
   `/day/<tomorrow>` *Plantão* reads `23:00–01:00` and on `/day/<dayAfter>` it reads `até 01:00`, in the owner's zone.
5. **Tasks last, time-less.** The open Tasks dated the day come last, as ordinary Task rows (checkbox, title, pencil), and
   an undated Task or a closed Task is absent. Tap a Task row's title: the Task opens in its sheet over *Hoje* at
   `/tasks/<id>`; close it and press back (or `history.back()`): the day returns. Complete a Task from the day: it
   leaves the list after the server answers; set `window.__stub.failPaths = ["/api/tasks/<id>/complete"]`, try to
   complete another Task and confirm the failure line is inline and persistent (no toast) and the Task stays.
6. **Three sources visibly distinct.** Local solid with its glyph, Google dashed with its link, Task as on *Hoje*;
   record the three rows' computed `border-style`, background and the presence of a checkbox.
7. **An empty day.** A day with nothing reads *Nada neste dia.* (and only once all three requests answered; with
   the stub on `ready`). Record the text.
8. **The *Hoje* control.** Hidden on today's date, present on any other date; tapping it returns to *Hoje*. Record its
   box (48 px tall) and the 8 px gap to the arrows.
9. **Rapid stepping never paints a stale day.** Set `window.__stub.delays = { "<D>": 3000 }` for a day `D`, open `/day/<D>`
   and, before it answers, press *Próximo dia* twice quickly. After 5 s the screen must show the content of the day it
   is on (heading and rows), never the content of `D`. Record the heading, the rows and the requests in the log.
10. **`Esc`** leaves the day (pops one history entry) and, while a Task's title is being edited inline, `Esc` cancels the
    edit only and does not leave.

## AC-25

1. **A future day.** *Reunião de terça* appears on `/day/<nextTuesday>` (with *Retiro* first, as all-day), is absent
   from `/day/<today>` and from *Hoje*'s Agenda today. *Retiro* appears on `/day/<nextMonday>` and `/day/<nextTuesday>`
   and not on the Wednesday.
2. **Google failing or partial.** On a day with a local commitment and a Task, set the stub to each of
   `not_connected`, `invalid_grant`, `502` and `partial` and reload the day: the matching unit-4 notice shows as a
   `role="status"` line, the local commitment and the Task are still listed, and *Nada neste dia.* is not shown. Repeat
   on an empty day with the stub failing: the notice shows and *Nada neste dia.* does not.
3. **A failed commitments or Tasks request.** With `window.__stub.failPaths = ["/api/events"]` (and, separately,
   `["/api/tasks?"]`, which fails the day's Task list but not a Task write) the day shows the request's failure message as a `role="alert"` line and a *Tentar de
   novo* button, still lists what loaded, and never shows *Nada neste dia.*. Set `failPaths = []` and press *Tentar de novo*:
   the failed source reloads, the line goes away, and only the failed sources were re-requested (check the log).
4. **Still loading.** While a delayed source has not answered, *Nada neste dia.* is not shown.
5. **Offline.** In the pane's network panel set Offline: the banner *Sem conexão. Dá para ler, mas não para salvar por
   enquanto.* shows on `/day`, Task rows are not completable, and nothing offers a write that will not happen.

## Measurements

Measure at 375 x 812 and again at 1280 x 800 (the column caps at 640 px). Fill one row per reading in
`live-browser-pass.md`. Use `getBoundingClientRect` on every `button`, `a` and `input`:

```js
[...document.querySelectorAll("button, a, input")].map((el) => {
  const r = el.getBoundingClientRect();
  return { name: el.getAttribute("aria-label") || el.textContent.trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
});
```

| Surface | Measure | Result |
|---|---|---|
| `/day/<date>`, every control | width and height each at least 48; gap to the nearest neighbour at least 8 px | |
| `/day/<date>`, the stepper row | *Dia anterior* and *Próximo dia* at the row's two ends; *Hoje* between them when shown; gaps | |
| *Hoje* header at 375 px | the date button's box (height at least 48, width, left/right gap to the title and to the remaining count); the filter, search and settings buttons unchanged at 48 x 48 | |
| *Hoje* header at 375 px | no horizontal overflow (`document.documentElement.scrollWidth` against `clientWidth`) | |
| `/day/<date>` at 375 px and at 1280 px | no horizontal overflow of the shell or of `main` | |
| The longest heading, `quarta-feira, 30 de setembro de 2026` style (open `/day/2026-09-30` while another year is current) | the `<h1>` is not clipped (its `scrollWidth` does not exceed its `clientWidth`) and may wrap to a second line without pushing the *Voltar* button | |
| The WIDEST time label on `/day`: `HH:mm–HH:mm` (for example `23:59–00:30` or `22:00–23:30`) | the time `<span>` box width; the label on one line (`scrollWidth` = `clientWidth`, height of one line); the title column beside it still at least two characters wide at 375 px | |
| The narrowest label on `/day`: `até 01:00` and `dia todo` | inside the same time column, on one line | |
| The same labels on *Hoje* (narrow 56 px column): `até 01:00` and `dia todo` | record whether they wrap to two lines inside the 64 px row and that the row height stays 64 px | |
| Every row on `/day` | height at least 64 px; the local and the Google row the same height | |
| Network panel / `window.__stub.log` | no request to another origin during any screen | |

**What the pane cannot show — owed to the owner's device (phase 5's device proof):** contrast measured on a real panel
(guidelines §4.3), safe areas, the Android back gesture across the visited days, keyboard overlap on the inline title
edit, `overscroll-behavior`, Lighthouse on the phone, and whether the date in the header is discoverable enough as
the door to the day view (PRD Open Question; asked at the device proof). If the pane does not display, say so and measure
the DOM; do not claim a screenshot.
