# UI/UX review checklist — the *Aderência* route and the *Hoje* line (unit 11, phase 3)

Run 2026-10-04 by the Implementer, **by reading the code and running the check, the suite
and the build only**. No browser pane and no device were used: no screenshot was taken and
nothing below claims a live pass. Items a rendered screen is needed for are marked
`pending live check (orchestrator browser pass)`; items for the owner's phone are marked
`owed to the owner's device`. No item is ✔ from imagination.

Change under review: new `AdherenceScreen` (`/settings/adherence`), new stateless
`AdherenceEntryCard` on *Configurações*, and one conditional plain-text line below the chip
row on *Hoje* (`TodayScreen`), fed by an isolated `fetchAdherence`. No new token, primitive
or origin.

## Tier A — every interface change

1. ✔ — method: static inspection. The route screen is read-only with only *Voltar* and the
   failure retry; the entry card has one primary *Abrir*; the *Hoje* line is one plain
   button and adds no second action. Live look: pending live check (orchestrator browser pass).
2. pending live check (orchestrator browser pass) — by construction: the line is
   `min-h-12 w-full`, *Voltar* is the owned 48 px icon button, *Abrir* and *Tentar de novo*
   use the owned `Button` (`min-h-12`). Not measured in the DOM box model.
3. ✔ — method: static inspection. Every row carries text (counts, streak, dates); the
   failure line is text with `role="alert"`; no state is colour-only.
4. ✔ — method: static inspection. Visible strings are pt-BR, sentence case, infinitive
   *Abrir* / *Tentar de novo*, zero special-cased in `formatDoneOfClosed`
   (*Nenhuma ocorrência concluída ainda*), dates as `dd/mm`, vocabulary *não concluída*
   (grep for falha / falhando / pulada and for a percentage sign is clean).
5. pending live check (orchestrator browser pass) — native `<button>`s so Tab / Enter /
   Space work by construction and `Esc` -> `back()` is wired in `AdherenceScreen`; focus
   ring and focus return not exercised.
6. ✔ — method: static inspection. *Voltar* has `aria-label`, the sections have
   `aria-label` and a real `<h2>`, one `<h1>` *Aderência*, `<title>` set to
   `Aderência · Praesto Sum`, `lang` untouched. No input exists on the screen.
7. ✔ — method: static inspection. Only token classes (`bg-surface-1`, `text-ink`,
   `text-muted`, `text-overdue`, `rounded-card`, `text-t2`/`t3`/`t4`, `font-text`,
   `font-data`); no literal colour, size or duration; no animation added.
8. ✔ — method: static inspection. No destructive action exists; the screen is read-only.
9. ✔ — method: static inspection. The only request is `fetchAdherence` to the same-origin
   `/api/series/adherence`; no new import of a remote resource. Not observed in DevTools
   Network (pending live check).

## Tier B — a new route and a new line on a shipped screen

10. owed to the owner's device — contrast was not re-measured; no new colour pair is
    introduced (`text-muted`/`text-ink` on `bg-surface-1`/`bg-bg` already ship).
11. pending live check (orchestrator browser pass) — states to simulate: empty fixture
    (*Nenhuma tarefa repetida ainda.*), failed request on the route (inline `role="alert"`
    + *Tentar de novo*), failed request on *Hoje* (line simply absent, Task list / agenda
    / Reminders unchanged), qualifying active series, non-qualifying series, ended-only
    qualifying series (no line). By construction: `refreshAdherence` never calls
    `report(`, never toasts, sets the atom to `null` on failure, and the chip row and
    the line share one grid cell so an absent line reserves no space (the shell's
    `grid-rows-[auto_auto_auto_1fr_auto_auto]` is unchanged).
12. owed to the owner's device — 375 px / 1280 px layout, safe areas, overscroll and back
    gesture on the phone. The 375 px and column-cap look is also pending the orchestrator's
    browser pass.
13. ✔ — method: `npm run build`, 2026-10-04, read against §11:
    - First-load JavaScript: `index-BD1-Bpsu.js` 361.48 kB, **109.71 kB gzip** (budget
      <= 170 KB gzip).
    - First-load CSS: `index-DSEljgxd.css` 26.35 kB, **6.25 kB gzip** (budget <= 30 KB gzip).
    - Precache: **25 entries, 477.21 KiB** (budget <= 1 MB).
    Lighthouse on the phone: owed to the owner's device.
14. owed to the owner's device — no screenshot was taken and none exists: no browser pane
    or device was available to the Implementer.

Result: no ✘. Pending: items 2, 5, 11 and the live half of 1, 9 and 12 (orchestrator
browser pass); owed to the owner's device: 10, 12, 14 and Lighthouse.

## Orchestrator live browser pass — 2026-10-04

Run by `/relay-execute` in the built-in browser pane against the worktree's dev server
(`vite dev`, port 5176, local D1 seeded with fixtures), at **375 × 812, dark**. Screenshots
were attempted three times and the pane never rendered one, so **no screenshot exists** —
every result below comes from the DOM (`find`, computed styles, bounding boxes) and the
network log, not from a picture.

Fixtures: *Academia* (active, weekly, 1 done + 2 missed in the window), *Ler 20 páginas*
(active, daily, 1 missed + 2 done), *Água ao acordar* (**ended**, 3 missed), one one-off Task.

- **Item 1 (live half) ✔** — *Hoje* shows exactly one line, `Academia · 2 não concluídas em
  30 dias`, with no `+N` (Ler has 1 miss, Água is ended); one action. The route shows
  *Academia* and *Ler* under *Com não concluídas nos últimos 30 dias* in rank order and
  *Água* under *Séries encerradas*, each with `N de M feitas`, the streak and the miss dates
  (`1 de 3 feitas · Sem sequência` / `Não concluídas em 27/09, 20/09`; `2 de 3 feitas ·
  Sequência atual: 2` / `Não concluída em 01/10`; `0 de 3 feitas` / `30/09, 29/09, 28/09`) —
  matching the seeded rows exactly (AC-18). No `%`, no `<progress>`/`role=progressbar`.
- **Item 2 ✔** — measured: the *Hoje* line 48 px tall, *Voltar* 48 × 48, *Abrir* 311 × 48,
  *Tentar de novo* 149 × 48.
- **Item 5 ✔ (partial)** — `Esc` on the route returns to `/`; native buttons. Focus after
  return landed on the capture `INPUT`, not on the line that opened the route — acceptable
  (the route is a full screen, not a sheet), noted rather than ✘. Focus-ring look not
  observable without a screenshot.
- **Item 9 (live half) ✔** — every `/api/series/adherence` request is same-origin, 200. The
  only console errors are `GET /api/google/events → 409` (Google not connected in local dev;
  pre-existing, unrelated).
- **Item 11 ✔** — qualifying state above; **non-qualifying** (Academia's second miss turned
  into `done`) → no line and no reserved space (the chip-row cell has 1 child, 56 px — AC-16);
  **ended-only qualifying** (Água, 3 misses) never produces a line; **failed request on
  *Hoje*** (fetch to the endpoint forced to reject, then a `visibilitychange` refresh) → line
  absent, Task list / *Concluídas* intact, no `role=alert`, no toast, no banner (AC-17);
  **failed request on the route** → inline `role="alert"` *Sem conexão com o servidor. Nada
  se perdeu — tente de novo quando a conexão voltar.* + *Tentar de novo*, which recovered the
  list on retry. Empty fixture (*Nenhuma tarefa repetida ainda.*) not exercised live
  (covered by `adherence-view` tests only).
- **Item 12 (375 px half)** — no horizontal page scroll (`scrollWidth` 375). **Pre-existing
  finding, not this unit's:** with the *Agenda indisponível* banner showing, the shell's single
  grid column sizes to 389 px (the banner's min-content) and is clipped by `overflow-clip`, so
  every row is 14 px wider than the viewport; the header's last button still ends at 373 px.
  Reproduced with the adherence line hidden, so the line does not cause it. Phone half still
  owed to the owner's device.

Result after the live pass: **no ✘**. Still owed to the owner's device: items 10, 12 (phone),
14 (screenshots) and Lighthouse; AC-20 (`device-proof.md`) stays OWED.
