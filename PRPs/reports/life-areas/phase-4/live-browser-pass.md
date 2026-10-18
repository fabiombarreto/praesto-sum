# Live browser pass — unit 13 `life-areas`, phases 2 to 4 (orchestrator, 2026-10-12)

Performed by the `/relay-execute` orchestrator in the browser pane, against `vite dev` (workerd + a local D1)
started from the worktree on `127.0.0.1:5180`, with a **throwaway test token the orchestrator generated** (the
worktree's `.dev.vars` was backed up, its `API_BEARER_TOKEN` line replaced for the run and the original restored
afterwards, byte-identical; the server was stopped). No production data, no owner token, no owner secret was
used or printed. The local D1 held synthetic rows: 12 areas, one of them a 40-character name, a handful of
Tasks and one series, all created through the real routes.

**What this is not:** a verification on the owner's phone. The pane is Chromium emulating 375 x 812 and
1280 x 800. Contrast on a real panel, safe areas, the Android back gesture, keyboard overlap and Lighthouse stay
`owed to the owner's device`.

One fixture caveat: the area names were posted from a Windows shell that mangled non-ASCII characters, so some
names in the fixture show a replacement glyph (`sa�de`). Widths were measured on those strings; accented letters
have essentially the same advance, so the numbers are representative, and no conclusion depends on the glyph.

## Measured (375 px, dark)

| Surface | Measure | Result |
|---|---|---|
| Filter sheet, *Área* group (13 chips: *Sem área* + 12 areas) | group `scrollWidth` / `clientWidth` | 343 / 343 unpressed — no overflow |
| | widest chip, the 40-character name, unpressed | 320 px wide, 48 px high, right edge 352 (viewport 375) |
| | same chip pressed (adds the check) | 341 px wide, right edge **369** (viewport 375, group border box ends at 359) |
| | group with the 40-character chip pressed | `scrollWidth` **357** / `clientWidth` 343 (the group is `overflow: visible`, so nothing is clipped and nothing scrolls) |
| | every chip height | 48 px |
| Filter sheet, `<dialog>` region | `scrollWidth` / `clientWidth` | 390 / 375 — overflow of 15 px, **caused by the *Período* "Até" date input (right edge 390), not by any chip**; pre-existing, not part of this unit |
| Task sheet, *Área* group (12 chips) | group `scrollWidth` / `clientWidth` | 343 / 343 — no overflow |
| | `<dialog>` region `scrollWidth` / `clientWidth` | 375 / 375 — none |
| | chip heights | 48 px |
| Quick row (`aria-label="Filtros rápidos"`), no area applied | chips | *Abertas*, *Para hoje*, *Alta prioridade* all within the first 324 px |
| Quick row, the 40-character area applied | applied chip | 341 px wide, 16 → 357 |
| | *Abertas* / *Para hoje* / *Alta prioridade* | left 365 / 452 / 548, right 444 / 540 / 673 — **all three are at or beyond the 375 px edge**, reachable only by scrolling the row (`scrollWidth` 689) |
| Hoje row of an occurrence whose area is the 40-character name | meta line | wraps on three lines inside the row (`break-words`), no overflow, the pencil stays at 48 x 48 |
| Áreas screen (`/settings/life-areas`) | every button/input | 25 controls, none under 48 x 48; `<title>` is `Áreas · Praesto Sum`; no horizontal overflow |
| Áreas screen at 12 areas | add form | replaced by the notice *Você já tem 12 áreas. Exclua uma para criar outra.* |
| 1280 px, filter sheet | dialog | centred, 560 px wide; *Área* group `scrollWidth` = `clientWidth` = 528; chips 48 px high |

## Observed behaviour

- **AC-21 / foreground refetch (plan Task 5, checklist item 11).** With *Casa* applied, dispatching
  `visibilitychange` produced `GET /api/tasks?lifeAreaId=<id>` (the filtered query), plus `/api/life-areas`,
  `/api/google/events`, `/api/reminders`, `/api/series/adherence`. The fix of the stale closure works.
- **AC-14 observable half.** With *Casa* applied, capturing "teste captura na área filtrada" sent
  `POST /api/tasks {"title":"…","lifeAreaId":"<Casa id>"}`; the Task appeared in *Sem data* (a collapsed group,
  count 1 → 2) with *Casa* as the area name on its row.
- **AC-21 stale filter.** After *Casa* was deleted through the API ("another device") and the foreground refetch ran,
  the applied chip read the neutral label *Área*, the header badge still said `Filtros (1 ativo)`, and the list read
  *Nenhuma tarefa com esse filtro.* with *Limpar filtros*. The Tasks that had *Casa* were unassigned, none deleted.
- **AC-22.** With `GET /api/life-areas` made to answer 500, after a foreground refetch: no row showed an area name,
  the Task sheet offered no *Área* group and no "nenhuma área" line, and no toast or banner appeared (the only
  alerts were the pre-existing Google ones).
- **Item 5, keyboard.** `Esc` closes the filter sheet and focus returns to the *Filtros* button. On the *Áreas*
  screen `Esc` inside the rename field closes the form without leaving the screen and focus returns to
  *Renomear <área>*.
- **Item 5, defect found.** Clearing the applied area chip with the keyboard (focus on it, `Space`) removes the
  chip from the DOM and **focus falls to `<body>`**: the keyboard user loses their place.

## Findings that need a change

1. **Focus lost after clearing the applied area chip** (above): move focus somewhere sensible when the chip that held it
   disappears.
2. **A long applied name pushes the quick chips off-screen at 375 px** (above): at the 40-character limit the leading
   chip is 341 px and the three standard chips start at the very edge. The filter is never invisible (badge,
   leading chip) and the row scrolls, but the quick row's job is lost for that case. The chip's label should be
   capped (the full name stays in the sheet and as the accessible name).

## Not changed, with the evidence

- `Chip.tsx` stays as is (see `chip-overflow-measurement.md`): the 40-character chip is fully visible at 375 px in
  both sheets, with no clipping and no scrolling; the filter sheet's region overflow is the *Período* input's.

## Second look — after the implementer's attempt 2 (orchestrator, same day, same method)

Same setup as above (throwaway token, local D1, `vite dev` on 127.0.0.1:5180, 375 px dark; the worktree's
`.dev.vars` backed up, patched for the run, restored byte-identical, server stopped). It re-checked the two fixes
the first pass asked for, in a rendered page this time.

| Check | Result |
|---|---|
| Applied chip with the 40-character name | 206 px wide (was 341), 48 px high, left 16 / right 222; its label is the full name in the DOM and in `title` |
| Quick chips beside it | *Abertas* 230 → 309 (fully on screen), *Para hoje* 317 → 405 (straddles the 375 px edge), *Alta prioridade* 413 → 538 (beyond); the row scrolls (`scrollWidth` 554). All three cannot fit beside an applied chip at any cap — the three quick chips alone end at 324 — so what the cap buys is the first chip reachable without scrolling and the second visibly peeking |
| Clearing the applied chip with the keyboard (focus on it, `Space`) | filter cleared (badge back to `Filtros`), **focus lands on *Abertas***, inside the row — no longer `<body>` |
| Clearing it with a pointer tap | filter cleared, focus on *Abertas*, `:focus-visible` is false and the outline is none — no stray ring after a tap |

Both findings are resolved. Still **not** observed by anyone: any of this on the owner's phone.
