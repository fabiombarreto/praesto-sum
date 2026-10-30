# Live browser pass — unit 14 `events-and-day-view`, phase 3 (the range function and the day)

Run 2026-10-19 by the `/relay-execute` orchestrator, following `live-pass-protocol.md`, in the Browser pane (Chromium,
dark — the app has no light theme) at **375 × 812** and **1280 × 800**.

**How it was run.** `npm run dev -- --host 127.0.0.1 --port 5180 --strictPort` from this worktree, with a throwaway
`API_BEARER_TOKEN` written into the worktree's `.dev.vars` (generated for the run, never shown in any report; the dev build
hands it to the client, chore C17, so the gate never appeared). The local D1 held synthetic rows only, created through the
real `POST /api/events` and `POST /api/tasks` (all 201): five commitments (*Dentista* 09:30–10:30 today, *Feriado* all-day
today, *Plantão* 23:00 tomorrow to 01:00 the day after, *Retiro* all-day next Monday–Tuesday, *Reunião de terça* 10:00–11:00
next Tuesday) and three Tasks (today, tomorrow's deadline, next Tuesday). `GET /api/google/events` was stubbed **in the
page** with the protocol's `window.fetch` wrapper (three Google rows today: a 14:00 timed one, an all-day one, an untitled
17:45 one), so no Google call was made. Afterwards every fixture was deleted through `DELETE` (204 each), the dev server and
its `workerd` child were stopped, `.dev.vars` was restored byte-identical from the backup (`cmp`), and the backup and the
token file were deleted. Every number below is read from the DOM (`getBoundingClientRect`, `scrollWidth`,
`getComputedStyle`) or from the page's own request log. **No screenshot was taken and none is claimed** (guidelines
§12.6). *Hoje* is the header title of `/`; the day numbers below are in `America/Sao_Paulo`, Monday 2026-10-19.

**Harness caveat, recorded because it cost a run.** My first sweep of the Google states on a populated day navigated to
the *same* path with `pushState`, which does not remount the screen and so does not refetch; those readings were
discarded and redone after first moving to another day. Only the redone readings are cited.

## Measured

| Surface | Measure | Result |
|---|---|---|
| *Hoje* header, 375 px | date button | **59 × 48** at x 73; text `seg., 19/10 — abrir o dia` |
| *Hoje* header, 375 px | the other controls | *Filtros* 48 × 48 (x 228); *Pesquisar* **36** × 48 (x 288); *Configurações* **36** × 48 (x 337) |
| *Hoje* header on the unit-13 baseline (`main`, port 5173, 375 px) | the same controls | *Filtros* 48 × 48 (x 228); *Pesquisar* 36 × 48 (x 288); *Configurações* 36 × 48 (x 337) — **identical x and widths**, so the date button moved nothing, and the 36 px width is not new (finding F1) |
| *Hoje* and `/day`, 375 px | horizontal overflow | `scrollWidth` 375 = `clientWidth` 375 on both |
| `/day/2026-10-19`, 375 px | every control | *Voltar* 48 × 48 (16, 24); *Dia anterior* 48 × 48 (16, 80); *Próximo dia* 48 × 48 (311, 80); the Google rows 343 × 64; the Task title button 215 × 48; the pencil 48 × 48 |
| `/day/2026-10-20`, 375 px | the *Hoje* control | **67 × 48** at x 154, y 80 — between the arrows (right edge of *Dia anterior* 64, left edge of *Próximo dia* 311): about **90 px** of gap on each side |
| `/day`, 375 px | the WIDEST time label `23:00–01:00` | the time `<span>`: **80 px** wide (`min-w-20`), 18 px high (one line), `scrollWidth` ≤ `clientWidth` (no overflow) |
| `/day`, 375 px | `até 01:00` | same 80 px column, one line, no overflow |
| `/day`, 375 px | row heights | 64 px for the local, the Google and the Task rows of the populated day; 80 px for the Task row that carries the extra *até amanhã* meta line |
| `/day/2027-09-30`, 375 px (longest heading, other year) | `<h1>` | `quinta-feira, 30 de setembro de 2027`: **283 × 60** (two lines), `scrollWidth` 283 = `clientWidth` 283 (not clipped); *Voltar* unmoved (x 16, w 48); `document.title` = `<heading> · Praesto Sum` |
| `/day/2026-10-19`, 1280 px | shell | `main` **640** wide, no overflow (1280 = 1280); rows 608 × 64; the smallest control height 48 and no control narrower than 48 |
| *Hoje* Agenda, Google rows | the time `<span>` class | exactly `w-14 flex-none font-data text-t1 text-muted tabular-nums` on every row (local and Google) |
| `/day` rows | the time `<span>` class | `min-w-20 flex-none whitespace-nowrap font-data text-t1 text-muted tabular-nums` |
| The page's request log | origins | every entry a same-origin `/api/…` path: `/api/life-areas`, `/api/tasks…`, `/api/google/events…` (stubbed), `/api/events?from=…&to=…`, `/api/reminders`, `/api/series/adherence` |

## Observed behaviour

*Hoje* (AC-23)

1. **Counted together.** With two local commitments (*Feriado*, *Dentista*) and the three stubbed Google rows today the group reads **Agenda · 5**; it is collapsed by default (`aria-expanded="false"`). The plan's one-of-each case (*Agenda · 2*) was not set up separately; the count is the length of the merged list and is pinned by `test/agenda-items.test.ts`.
2. **Order.** Expanded: `dia todo` *Feriado* (local), `dia todo` *Aniversário (Google)*, `09:30` *Dentista*, `14:00` *Daily (Google)*, `17:45` *(sem título)* — all-day first, then ascending, and the local all-day row before the Google all-day row.
3. **Solid versus dashed.** The local rows: `border-style` solid, no `<a>`, no `<button>`, no checkbox, no `tabindex`. The Google rows: dashed, each with its `<a>` (*— Abrir no Google Calendar*), no checkbox. All five rows 64 px.
4. **Inert.** Structurally inert (no interactive element in the local rows). The tap itself was **not performed**, so "nothing happens on tap" is inferred from the DOM, not observed.
5. **A Google row is unchanged.** The time column class is exactly the unit-4 string (Measured), the texts are `dia todo`, `14:00`, `17:45` and `(sem título)`, the height 64 px. The comparison against a second worktree of the merge base was **not run**; the evidence is the class string, text and height against the contract.
6. **Google down, local rows still listed.** With the stub on `not_connected`, `invalid_grant`, `502` the group reads **Agenda · 2** (the two local rows) and a `role="status"` line shows, respectively, *Google não conectado.*, *A conexão com o Google expirou. Reconecte para ver a agenda.* and *Não foi possível carregar a agenda agora. Tente novamente mais tarde.*, beside the unchanged top line *Agenda indisponível. Suas tarefas estão aqui; os compromissos do Google não carregaram.*; on `partial` the group reads **Agenda · 5** with *Um calendário não respondeu — a agenda pode estar incompleta.* `Nada na agenda hoje.` never showed.
7. **A failed commitments read is never a free day.** With `/api/events` answering 500 and Google `ready`: the line *O servidor recusou a operação (código 500). Tente de novo.* shows, the group reads **Agenda · 3** (the Google rows), *Nada na agenda hoje.* is absent, no offline banner. Back to normal the next refetch (**Agenda · 5**, no status line).
8. **The empty day on *Hoje* (`Nada na agenda hoje.`)** — **not observed**.
9. **Collapsed header.** `Agenda5` (name and count only); the "next event" line does not exist, as documented in the plan's Notes.
10. **The header date.** A button, text `seg., 19/10 — abrir o dia`, 59 × 48; tapping it opened `/day/2026-10-19` (title `segunda-feira, 19 de outubro · Praesto Sum`). The other header controls did not move (Measured, baseline).

`/day` (AC-24)

11. **Heading.** `<h1>` `segunda-feira, 19 de outubro`; `document.title` `segunda-feira, 19 de outubro · Praesto Sum`; the year appears only for another year (`…de 2027`).
12. **Stepping.** *Próximo dia* twice: `/day/2026-10-20` then `/day/2026-10-21`; `history.length` went 3 → 4 → 5; one `history.back()` returned to `/day/2026-10-20`. A step across a month boundary was **not stepped** in the pane (pinned by `adjacentDays` in `test/day-view.test.ts`).
13. **Sections.** DOM order `Dia inteiro`, `Compromissos`, `Tarefas`; a section with no rows is absent (`/day/2026-10-21` has only `Compromissos`; `/day/2026-10-26` only `Dia inteiro`).
14. **Time labels.** `09:30–10:30`, `14:00–14:30`, `17:45–18:15` (en dash, no spaces), `dia todo` for the all-day rows; *Plantão* reads `23:00–01:00` on 2026-10-20 and `até 01:00` on 2026-10-21; the Task with a deadline tomorrow shows its existing *até amanhã* meta.
15. **Tasks last, and opening one.** The open Task dated the day came last. Tapping its title opened `/tasks/<id>` with the Task sheet over *Hoje* (the field held the title); one `history.back()` closed the sheet and returned to `/day/2026-10-19`. **Not observed:** completing a Task from the day, and the inline failure line of a failed write.
16. **Three sources visibly distinct.** Local rows solid, Google rows dashed with a link, the Task row with its checkbox and pencil. The background colours were not read.
17. **An empty day.** `/day/2026-10-22` and `/day/2026-10-28` read *Nada neste dia.* (a `role="status"` line) once the three sources had answered.
18. **The *Hoje* control.** Absent on `/day/2026-10-19` (today), present on the other dates, 67 × 48, between the arrows (Measured).
19. **Rapid stepping never paints a stale day.** With the 2026-10-20 responses delayed 3 s, opening that day and pressing *Próximo dia* twice at once, then waiting 5.5 s: the screen showed `quinta-feira, 22 de outubro`, *Nada neste dia.*, no rows; the log shows the delayed 2026-10-20 requests completing without painting.
20. **`Esc`.** From `/day/2026-10-19` it left the day for the previous history entry (`/`). `Esc` while an inline title edit is open was **not observed**.

AC-25

21. **A future day.** *Retiro* is listed on 2026-10-26 and 2026-10-27 and absent on 2026-10-28; *Reunião de terça* (10:00–11:00) only on 2026-10-27, with *Retiro* first and the *Tarefas* section present; neither is in *Hoje*'s Agenda today (it counted only today's two local rows).
22. **Google failing on `/day`.** On the populated day, the stub on `not_connected`, `invalid_grant`, `502` and `partial` each showed the matching unit-4 line as `role="status"`, the local commitments and the Task stayed listed, and *Nada neste dia.* never showed. On the empty day 2026-10-22 with `not_connected`: *Google não conectado.* and no *Nada neste dia.*
23. **A failed commitments or Tasks read.** With `/api/events` failing the day showed the `role="alert"` line *O servidor recusou a operação (código 500). Tente de novo.* and a *Tentar de novo* button, the Google rows stayed, *Nada neste dia.* was absent; with the failure cleared and the button pressed, **only** `/api/events?from=2026-10-19&to=2026-10-19` was re-requested and the line went away. The same for a failing `/api/tasks?…`: the alert and the button, the other rows stayed, and the retry re-requested only `/api/tasks?status=open&from=2026-10-19&to=2026-10-19`.
24. **Still loading** — not observed on its own (O19 only shows that a delayed source does not paint a stale day).
25. **Offline** — **not observed**: the pane offers no offline switch here. The banner and the disabled controls are owed to the owner's device.

## Findings

- **F1 — pre-existing, not introduced by this phase.** On *Hoje* at 375 px *Pesquisar* and *Configurações* measure **36 × 48**, below the project's 48 × 48 rule (guidelines §3). The unit-13 baseline on port 5173 has exactly the same boxes, so this predates unit 14. It is a candidate for the Backlog, not for this unit.
- **F2.** Nothing in this pass contradicts the plan's two documented non-deliveries: the collapsed Agenda does not name the next event (O9) and the local row is inert (O3).
- **F3.** The dev server's React StrictMode double-fires effects, so each screen's requests appear twice in the log (for example `/api/events?from=2026-10-20…`); that is a development-mode artefact, not a defect.

## What the pane cannot show — still owed to the owner's device (phase 5)

Contrast on a real panel, safe areas, the Android back gesture across the visited days, keyboard overlap on the inline
title edit, `overscroll-behavior`, Lighthouse on the phone, the offline banner, a failed Task write and completing a Task
from the day, the focus ring on the header date button, and whether the date in the header is discoverable enough as the
door to the day view (the PRD's open question).
