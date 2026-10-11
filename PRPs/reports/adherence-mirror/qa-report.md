# QA support report — Adherence Mirror (unit 11)

Source: `PRPs/prds/adherence-mirror.prd.md` (APPROVED 2026-10-04), AC-1..AC-20, plus gap cases from the
code reviews and the orchestrator's live browser pass. Generated 2026-10-04 by `/relay-qa-report`.

## How to read this report

- `automated` means a real test file asserts the case; `manual` means a human must exercise it; `none` means
  neither — those entries are listed on purpose, not hidden.
- **Test paths are branch-relative.** Every cited file was checked with `test -f` inside the worktree
  `.worktrees/adherence-mirror/` (branch `feature/adherence-mirror`), where they exist **uncommitted**. They do
  not yet exist on `main`.
- No `record.json` exists for this feature: the suite was run by hand (`npm test`, 76/76 files, 1260/1260
  tests, GREEN after phase 3) because `.claude/settings.json` is absent. Coverage below is inferred from the
  test files' `describe`/`it` names — it is not grounded in a Test Runner record.
- The orchestrator already ran a live browser pass on the screen (375 px, dark, local fixtures) and recorded it
  in `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md`. That pass is **evidence, not your approval**:
  every manual status below is still `pending` until you exercise it yourself.

## Local fixture (for every manual case that needs data)

Run from `.worktrees/adherence-mirror/` against the **local** D1 only (`--local`), then start the dev server
with the `praesto-worktree-adherence` launch config (port 5176). Assumes today is 2026-10-04 in
`America/Sao_Paulo`; shift the dates if you test on another day.

1. `npx wrangler d1 migrations apply praesto-db --local`
2. Insert three series: *Academia* (weekly, active) with rows `done 13/09`, `missed 20/09`, `missed 27/09`,
   `open 04/10`; *Ler 20 páginas* (daily, active) with `missed 01/10`, `done 02/10`, `done 03/10`, `open 04/10`;
   *Água ao acordar* (daily, **ended**) with `missed 28/09`, `29/09`, `30/09`; plus one one-off Task.
   (The exact SQL used in the live pass is reproduced in the phase-3 checklist's fixture line; any equivalent
   rows work — only `series_id`, `occurrence_date`, `status` and the series `status`/`timezone` matter.)

## Summary table

| # | Case | Risk | Coverage | Automated test path | Manual |
|---|------|------|----------|---------------------|--------|
| AC-1 | Counts come from closed rows only | High | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-2 | Streak counts trailing dones | High | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-3 | A miss resets the streak | High | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-4 | Streak follows occurrence date, not completion time | Medium | automated | `test/adherence.test.ts` | — |
| AC-5 | Skipped cycles do not interfere | Medium | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-6 | Detached occurrences count | Medium | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-7 | 30-day window edges | High | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-8 | Empty history gives zeros, no NaN | Medium | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-9 | Ranking order and tie-breaks | High | automated | `test/adherence.test.ts` | `pass (by hand)` |
| AC-10 | Purity of `adherence.ts`; `recurrence.ts` unchanged | Medium | automated + manual | `test/adherence.test.ts` | `pass` |
| AC-11 | Endpoint shape and bearer gate | Critical | automated | `test/adherence-endpoint.test.ts` | `pass (by hand)` |
| AC-12 | `today` per series time zone | High | automated | `test/adherence-endpoint.test.ts` | — |
| AC-13 | `/adherence` is not read as an id | High | automated | `test/adherence-endpoint.test.ts` | `pass (by hand)` |
| AC-14 | Endpoint is read-only | Critical | automated | `test/adherence-endpoint.test.ts` | `pass (by hand)` |
| AC-15 | *Hoje* line appears at ≥ 2 misses and opens the route | High | automated + manual | `test/adherence-line.test.ts` | `pass` |
| AC-16 | *Hoje* line absent, no reserved space | High | automated + manual | `test/adherence-line.test.ts` | `pass` |
| AC-17 | A failed fetch never blanks *Hoje*; route shows inline error | Critical | manual | — | `pass` |
| AC-18 | *Aderência* route content and order | High | automated + manual | `test/adherence-view.test.ts`, `test/app-route.test.ts` | `pass` |
| AC-19 | pt-BR copy, "não concluída" vocabulary, UI checklist recorded | Medium | automated + manual | `test/adherence-line.test.ts`, `test/adherence-view.test.ts` | `pass` |
| AC-20 | Device proof against a same-day production export | Critical | manual | — | `pending (device)` |
| G-1 | Invalid series time zone in the database | Medium | none | — | `pass (fixed)` |
| G-2 | Out-of-order responses on rapid refresh | Low | none | — | `pass (fixed)` |
| G-3 | Shell grid is 14 px too wide while the *Agenda indisponível* banner shows (pre-existing) | Low | none | — | `confirmed (pre-existing)` |
| G-4 | Route data swapped for the error state when a background refresh fails | Low | none | — | `pass (fixed)` |
| G-5 | Entry card on *Configurações* opens the route; `Esc` / *Voltar* return | Medium | manual | — | `pass` |

---

## Phase 1 — Pure adherence (`src/shared/adherence.ts`)

### AC-1 — Counts come from closed rows only

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "computeSeriesAdherence — counts (AC-1)" › "counts done and closed from closed rows; the open row counts in neither"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the local fixture, open *Configurações → Aderência*.
  2. Expect *Academia* to read `1 de 3 feitas` (the open 04/10 row is not counted).

### AC-2 — Streak counts trailing dones

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "computeSeriesAdherence — current streak (AC-2..AC-6)" › "counts trailing consecutive dones after the last miss (AC-2)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the local fixture, open *Aderência*.
  2. Expect *Ler 20 páginas* to read `Sequência atual: 2`.

### AC-3 — A miss resets the streak

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "is 0 when the latest closed row is missed (AC-3)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the local fixture, open *Aderência*.
  2. Expect *Academia* (latest closed row `missed 27/09`) to read `Sem sequência`.

### AC-4 — Streak follows occurrence date, not completion time

- **Risk level:** Medium
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "follows occurrence date order, not the order rows are supplied (AC-4)" and "is not affected by when a row was completed, only by its occurrence date (AC-4)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand; rely on the automated tests.

### AC-5 — Skipped cycles do not interfere

- **Risk level:** Medium
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "is not interrupted by a skipped cycle that left no row (AC-5)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. On a series with two done occurrences, delete the open occurrence (a skip) and complete the successor.
  2. Open *Aderência*; expect the streak to continue (3), not reset.

### AC-6 — Detached occurrences count

- **Risk level:** Medium
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "counts a detached done row toward done, closed and the streak (AC-6)"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Edit one occurrence with *Só esta ocorrência* (detaches it), then complete it.
  2. Open *Aderência*; expect it counted in *N de M feitas* and the streak.

### AC-7 — 30-day window edges

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "computeSeriesAdherence — recent misses window (AC-7)": "lists missed dates in [today-30, today) newest first", "includes the day exactly 30 days before today and excludes 31 days before", "excludes a miss dated today (the window ends yesterday)", "measures the window from the supplied today, across a year boundary"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the local fixture, open *Aderência*.
  2. Expect *Academia* to list `Não concluídas em 27/09, 20/09` (newest first).

### AC-8 — Empty history gives zeros, no NaN

- **Risk level:** Medium
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "computeSeriesAdherence — empty history (AC-8)" › "returns zeros and an empty list when only an open occurrence exists, with no NaN"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Create a brand-new recurring Task.
  2. Open *Aderência*; expect `Nenhuma ocorrência concluída ainda` and `Sem sequência`, never `NaN` or `0 de 0`.

### AC-9 — Ranking order and tie-breaks

- **Risk level:** High
- **Required state:** none (pure function)
- **Coverage:** automated
- **Automated test path:** `test/adherence.test.ts` — "rankAdherence (AC-9)" (6 cases, including the title and id tie-breaks); the screen's own order is `test/adherence-line.test.ts` — "orderByMisses"
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the local fixture, open *Aderência*.
  2. Expect *Academia* (2 misses) above *Ler 20 páginas* (1 miss) in the first section.

### AC-10 — Purity of `adherence.ts`; `recurrence.ts` unchanged

- **Risk level:** Medium
- **Required state:** none
- **Coverage:** automated + manual (behavioural half automated; the import and diff half is a manual check)
- **Automated test path:** `test/adherence.test.ts` — "computeSeriesAdherence — purity (AC-10, behavioural half)"
- **Manual status:** `pass` (2026-10-06)
- **Manual step-by-step:**
  1. In `.worktrees/adherence-mirror/`, run `grep -nE "^import|Date\.now|new Date\(\)" src/shared/adherence.ts` and expect no output.
  2. Run `git diff main -- src/shared/recurrence.ts` and expect no output.

---

## Phase 2 — Adherence endpoint (`GET /api/series/adherence`)

### AC-11 — Endpoint shape and bearer gate

- **Risk level:** Critical
- **Required state:** two recurrence series with closed rows
- **Coverage:** automated
- **Automated test path:** `test/adherence-endpoint.test.ts` — "AC-11 / AC-A1 Shape and auth" (401 without token, 401 with a wrong token, 200 shape, ranking omits zero-miss series, task-kind only)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. `curl -i http://localhost:5176/api/series/adherence` and expect `401`.
  2. Repeat with the local dev token in `Authorization: Bearer …` and expect `200` with `{ series: [...], ranking: [...] }`.

### AC-12 — `today` per series time zone

- **Risk level:** High
- **Required state:** one series in `America/Sao_Paulo`, one in `UTC`, each with a miss on 2026-09-30
- **Coverage:** automated
- **Automated test path:** `test/adherence-endpoint.test.ts` — "AC-12 / AC-A2 `today` per series time zone" (both cases, injected `now`)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Not practical by hand (needs a controlled clock); rely on the automated tests.

### AC-13 — `/adherence` is not read as an id

- **Risk level:** High
- **Required state:** at least one series
- **Coverage:** automated
- **Automated test path:** `test/adherence-endpoint.test.ts` — "AC-13 / AC-A3 Route ordering" (adherence payload, plus `GET /api/series/:id` still works)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. With the token, `GET /api/series/adherence` and expect the adherence payload, not `404 Série não encontrada`.

### AC-14 — Endpoint is read-only

- **Risk level:** Critical
- **Required state:** series and occurrence rows
- **Coverage:** automated
- **Automated test path:** `test/adherence-endpoint.test.ts` — "AC-14 / AC-A4 Read-only" (via HTTP and via `loadSeriesAdherence` directly, `updated_at` included)
- **Manual status:** — (no manual test needed)
- **Manual step-by-step:**
  1. Export the data, call the endpoint several times, export again, and diff the two exports: expect them identical.

---

## Phase 3 — The screen

### AC-15 — *Hoje* line appears at ≥ 2 misses and opens the route

- **Risk level:** High
- **Required state:** the local fixture (*Academia* active with 2 misses in the window)
- **Coverage:** automated + manual (show/text decision automated; placement and tap manual)
- **Automated test path:** `test/adherence-line.test.ts` — "decideAdherenceLine - show or hide (AC-15, AC-16)" and "decideAdherenceLine - the text (AC-15)" (singular/plural `+N`, newest-miss tie-break)
- **Manual status:** `pass` (2026-10-06)
- **Manual step-by-step:**
  1. With the fixture, open *Hoje* at phone width.
  2. Directly below the chip row, expect one plain-text line: `Academia · 2 não concluídas em 30 dias` (no `+N`, because *Ler* has 1 miss and *Água* is ended).
  3. Tap it; expect the *Aderência* route (`/settings/adherence`).

### AC-16 — *Hoje* line absent, no reserved space

- **Risk level:** High
- **Required state:** no active series with ≥ 2 misses in the window (e.g. turn Academia's `27/09` row into `done`)
- **Coverage:** automated + manual
- **Automated test path:** `test/adherence-line.test.ts` — "is absent for an empty response", "is absent when the only active series has exactly one miss in the window", "is absent when the only qualifying series is ended"
- **Manual status:** `pass` (2026-10-06)
- **Manual step-by-step:**
  1. Change the data so no active series qualifies, then reopen *Hoje*.
  2. Expect no line and no blank gap: the first group starts right below the chip row.
  3. Confirm the ended *Água* series (3 misses) never produces a line.

### AC-17 — A failed fetch never blanks *Hoje*; route shows inline error

- **Risk level:** Critical
- **Required state:** the local fixture; a way to make `/api/series/adherence` fail (DevTools request blocking, or stop the network after the page loads)
- **Coverage:** manual (React fetch isolation; no component tests by project methodology)
- **Automated test path:** — (none; NOT_TEST_AUTHORABLE per the phase-3 suite manifest)
- **Manual status:** `pass` (2026-10-06)
- **Manual step-by-step:**
  1. Block `/api/series/adherence` in DevTools and reload *Hoje*.
  2. Expect the Task list, agenda and Reminders exactly as usual, with no line, no banner, no toast.
  3. Open *Configurações → Aderência*; expect an inline message (*Sem conexão com o servidor…*) and a *Tentar de novo* button.
  4. Unblock the request, tap *Tentar de novo*, and expect the list to load.

### AC-18 — *Aderência* route content and order

- **Risk level:** High
- **Required state:** the local fixture
- **Coverage:** automated + manual
- **Automated test path:** `test/adherence-view.test.ts` — "adherenceSections (AC-18)", "formatDoneOfClosed", "formatStreak", "formatMissDates"; `test/app-route.test.ts` — "routeFromPath — the adherence route", "pathOf — the adherence route", "routeFromPath and pathOf agree"
- **Manual status:** `pass` (2026-10-06)
- **Manual step-by-step:**
  1. Open *Configurações → Aderência*.
  2. Expect, in order: section *Com não concluídas nos últimos 30 dias* with *Academia* (`1 de 3 feitas · Sem sequência`, `Não concluídas em 27/09, 20/09`) then *Ler 20 páginas* (`2 de 3 feitas · Sequência atual: 2`, `Não concluída em 01/10`); then *Séries encerradas* with *Água ao acordar* (`0 de 3 feitas`, `30/09, 29/09, 28/09`).
  3. Expect no percentage, chart or progress bar anywhere.
  4. Reload on `/settings/adherence` and expect the same screen (deep link works).

### AC-19 — pt-BR copy, "não concluída" vocabulary, UI checklist recorded

- **Risk level:** Medium
- **Required state:** the local fixture
- **Coverage:** automated + manual
- **Automated test path:** `test/adherence-line.test.ts` — "never uses the forbidden vocabulary"; `test/adherence-view.test.ts` — "never uses the forbidden vocabulary or a percentage", "never emits a percentage sign"
- **Manual status:** `pass` (2026-10-06)
- **Manual step-by-step:**
  1. Read every string on *Hoje*'s line, the entry card and the *Aderência* route.
  2. Expect pt-BR throughout and never "falha", "falhando" or "pulada".
  3. Open `PRPs/reports/adherence-mirror/phase-3/ui-checklist.md` and confirm it has no unexplained ✘ before the merge.

### AC-20 — Device proof against a same-day production export

- **Risk level:** Critical
- **Required state:** production deployed with this unit; at least one real series with misses in the last 30 days (or confirm the correct absence)
- **Coverage:** manual (owner-observed by definition)
- **Automated test path:** — (none)
- **Manual status:** `pending` — owed to the owner's device
- **Manual step-by-step:**
  1. Follow `PRPs/reports/adherence-mirror/phase-3/device-proof.md`: take a same-day production export.
  2. On your phone, open *Hoje*: check the line (or its correct absence) against the export's rows.
  3. Open *Configurações → Aderência*: check every count, streak and date against the export.
  4. Record the observation in `device-proof.md` and the roadmap Delivery history.

---

## Gaps found by review and the live pass

### G-1 — Invalid series time zone in the database

- **Risk level:** Medium
- **Required state:** a `recurrence_series` row with an invalid `timezone` (e.g. `Mars/Olympus`)
- **Coverage:** none
- **Automated test path:** —
- **Manual status:** `pass` (2026-10-06) — was a 500 for the whole endpoint; fixed, re-verified by hand (200)
- **Manual step-by-step:**
  1. Locally, set one series' `timezone` to an invalid value.
  2. Call `GET /api/series/adherence`: the code-review advisory expects a `500` for the WHOLE endpoint (the *Hoje* line then silently disappears; the route shows its error).
  3. Decide whether to accept this (the app never writes an invalid zone) or guard it.

### G-2 — Out-of-order responses on rapid refresh

- **Risk level:** Low
- **Required state:** the local fixture; throttled network
- **Coverage:** none
- **Automated test path:** —
- **Manual status:** `pass` (2026-10-06) — was: a stale response landing last won; fixed, re-verified by hand
- **Manual step-by-step:**
  1. Throttle the network in DevTools, switch windows away and back several times quickly on *Hoje*.
  2. Expect the line to settle on the latest data; a stale response landing last would be the defect.

### G-3 — Shell grid is 14 px too wide while the *Agenda indisponível* banner shows (pre-existing)

- **Risk level:** Low
- **Required state:** Google not connected (the banner shows), phone width 375 px
- **Coverage:** none
- **Automated test path:** —
- **Manual status:** `confirmed` (2026-10-06) — pre-existing, shell 389 px vs 375 px, no horizontal scroll
- **Manual step-by-step:**
  1. At 375 px with the *Agenda indisponível* banner visible, check whether the banner text or right-hand header buttons look clipped.
  2. Not introduced by this unit (reproduced with the adherence line hidden); decide whether it deserves its own fix.

### G-4 — Route data swapped for the error state when a background refresh fails

- **Risk level:** Low
- **Required state:** *Aderência* open with data loaded
- **Coverage:** none
- **Automated test path:** —
- **Manual status:** `pass` (2026-10-06) — was: loaded list replaced by the error state; fixed, re-verified by hand
- **Manual step-by-step:**
  1. With *Aderência* loaded, block the endpoint, switch windows away and back.
  2. The advisory expects the loaded list to be replaced by the error message; decide whether keeping the stale data would be better.

### G-5 — Entry card on *Configurações* opens the route; `Esc` / *Voltar* return

- **Risk level:** Medium
- **Required state:** none
- **Coverage:** manual
- **Automated test path:** — (route mapping only: `test/app-route.test.ts`)
- **Manual status:** `pass` (2026-10-06)
- **Manual step-by-step:**
  1. Open *Configurações*; expect an *Aderência* card (*Veja quais tarefas repetidas você não concluiu.*) with *Abrir*.
  2. Tap *Abrir*; expect the route. Tap *Voltar*; expect to return.
  3. On desktop, press `Esc` on the route; expect to return to *Hoje*.


---

## Manual run — 2026-10-06

Run by hand (local D1, `praesto-worktree-adherence` on port 5176, 375 px, dark) from the worktree `.worktrees/adherence-mirror/`. Today was 2026-10-06, not 2026-10-04: the fixture rows keep their dates, so the open 04/10 rows show as *Atrasadas* (no effect on any case).

- **Passed by hand:** AC-1, 2, 3, 5, 6, 7, 8, 9 (API and screen), AC-10, 11, 13, 14 (hash of `/api/tasks` unchanged after 3 calls), AC-15, 16, 17, 18, 19 (UI checklist has no unexplained ✘), G-5. AC-4 and AC-12 stay automated only (not practical by hand).
- **AC-20:** still owed to the owner's device (`phase-3/device-proof.md`).
- **G-1 (fail):** `timezone = 'Mars/Olympus'` on one series makes `GET /api/series/adherence` return `500 Internal Server Error` for every series. The app never writes an invalid zone; accept or guard — owner decision.
- **G-2 (fail):** with the first request delayed 3 s and returning a stale payload, the second (fresh) response arrived first and the stale one landed last and replaced it (screen showed `1 de 3`, server `2 de 3`). Needs a request-sequence guard in the route fetch.
- **G-3:** reproduced (`header` right edge 389 px at a 375 px viewport, `scrollWidth` 375). Pre-existing, not from this unit.
- **G-4 (fail):** with data loaded on the route, a failed background refresh replaces the list with *Sem conexão com o servidor…*. Decide whether keeping the stale list is better.
- Fixture extras used and removed afterwards: `QA skip` (done 01/10, 02/10, 04/10 — streak 3 across the gap), `QA detached` (one detached done row), `QA nova` (only an open row — *Nenhuma ocorrência concluída ainda · Sem sequência*).

### Fixes applied on `feature/adherence-mirror` (2026-10-06)

- **G-1:** `todayForSeries` in `src/worker/routes/series.ts` falls back to `America/Sao_Paulo` when a series' zone cannot be resolved, so one bad row no longer hides every series. New test: `test/adherence-endpoint.test.ts` › "QA G-1 an unresolvable series time zone".
- **G-2:** `AdherenceScreen` and `TodayScreen` now ignore any response that is not from the newest request (a `useRef` request counter). No automated test (project methodology has no component tests); verified by hand with a delayed stale response.
- **G-4:** `AdherenceScreen` keeps the loaded list when a background refresh fails; the inline error and *Tentar de novo* still show when nothing was loaded yet (AC-17 unchanged).
- Validation: `npm run check` clean; `npm test` 76/76 files, 1261/1261 tests.
