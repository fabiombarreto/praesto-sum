# QA support report — life-areas (unit 13)

Generated 2026-10-13 by `/relay-qa-report` in PRD mode, from `PRPs/prds/life-areas.prd.md` (APPROVED, phases 1 to 4 `complete`). Worktree `.worktrees/life-areas`, branch `feature/life-areas`, **nothing committed, nothing deployed**.

## How to read this report

- `automated` — a real test file asserts the case (path cited, every one resolved with `test -f`). `manual` — a human must exercise it. `none` — neither exists.
- **Grounding.** There is no feature-level `PRPs/reports/life-areas/record.json`. The latest attempt record is `PRPs/reports/life-areas/phase-4/attempts/test-2/record.json`: run `12558650-a464-4f1c-ab39-17fc1014d23e`, tier `unit`, framework `vitest`, **1719 passed / 0 failed / 0 skipped / 89 files**, `failures: []`. An empty `failures[]` names no test, so the automated-coverage column comes from searching the test files; each cited `describe` was read in place, not guessed.
- There is no browser tier in this project (rejected, see `CLAUDE.md`), so every screen behaviour is `manual`; where the decision was extracted into a pure function, that function's test is cited as the automated half.
- `Manual status` is `pending` for every entry: this is a first generation and **no human has run any manual step**. The live browser pass (`phase-4/live-browser-pass.md`) was a Chromium pane emulating 375 and 1280 px against a local worker with synthetic rows; it is evidence, not a manual pass by the owner, and nothing was seen on his phone.
- Cases `G-1` to `G-6` are not PRD ACs: they are behaviours the phases found, fixed or left open, so a tester does not have to read the close-out to know about them.

## Summary table

| # | Case | Risk | Coverage | Automated test path | Manual |
|---|------|------|----------|---------------------|--------|
| AC-1 | Create and list an area | High | automated | `test/life-areas-routes.test.ts` | `pending` |
| AC-2 | Name rules (blank, 40, duplicate) | High | automated | `test/life-areas-routes.test.ts` | `pending` |
| AC-3 | Limit of 12 | Medium | automated | `test/life-areas-routes.test.ts` | `pending` |
| AC-4 | Rename keeps the id and the items | High | automated | `test/life-areas-routes.test.ts` | `pending` |
| AC-5 | Delete unassigns, never deletes | Critical | automated | `test/life-areas-routes.test.ts` | `pending` |
| AC-6 | List shape, order and counts | Medium | automated | `test/life-areas-routes.test.ts` | `pending` |
| AC-7 | Bearer gate on every area route | Critical | automated | `test/life-areas-routes.test.ts` | `pending` |
| AC-8 | Task create validates the area | High | automated | `test/life-areas-task-routes.test.ts` | `pending` |
| AC-9 | Task edit carries the area | High | automated | `test/task-update.test.ts` | `pending` |
| AC-10 | Series carries the area | High | automated | `test/life-areas-series.test.ts` | `pending` |
| AC-11 | The `lifeAreaId` list filter | High | automated | `test/life-areas-task-routes.test.ts` | `pending` |
| AC-12 | Shared helpers | Medium | automated | `test/life-areas.test.ts` | `pending` |
| AC-13 | Filter dimension | High | automated | `test/task-filter.test.ts` | `pending` |
| AC-14 | Capture inherits the filter | Medium | automated | `test/life-area-assign.test.ts` | `pending` |
| AC-15 | Area name on the row | Medium | automated | `test/format.test.ts` | `pending` |
| AC-16 | Occurrence save plan | High | automated | `test/series-edit.test.ts` | `pending` |
| AC-17 | Export carries the area | Critical | automated | `test/life-areas-export.test.ts` | `pending` |
| AC-18 | Restore drill on a production snapshot | Critical | manual | — (script run) | `pending` |
| AC-19 | The *Áreas* screen | High | manual | `test/life-areas-list.test.ts` (pure half) | `pending` |
| AC-20 | The Task sheet *Área* group | High | manual | `test/life-area-assign.test.ts` (pure half) | `pending` |
| AC-21 | The filter sheet *Área* group | High | manual | `test/life-area-assign.test.ts` (pure half) | `pending` |
| AC-22 | Degraded states | Medium | manual | `test/life-area-assign.test.ts` (pure half) | `pending` |
| AC-23 | Invariants | High | automated | `npm run check` and `npm test` | `pending` |
| AC-24 | Device proof | Critical | manual | — | `pending` |
| AC-25 | Documentation synced | Medium | manual | `test/docs-consistency.test.ts` (partial) | `pending` |
| G-1 | The foreground refetch keeps the area filter | High | manual | — | `pending` |
| G-2 | Clearing the applied chip keeps focus | Medium | manual | — | `pending` |
| G-3 | A 40-character name at 375 px | Low | manual | — | `pending` |
| G-4 | An area deleted while it is the filter | Medium | manual | `test/life-area-assign.test.ts` (pure half) | `pending` |
| G-5 | Filter sheet with no areas or a failed request | Medium | manual | `test/life-area-assign.test.ts` (pure half) | `pending` |
| G-6 | *Período* "Até" overflows the filter sheet (pre-existing) | Low | none | — | `pending` |

---

## API — areas

### AC-1 — Create and list an area

- **Risk level:** High
- **Required state:** no Life Areas; a valid bearer token
- **Coverage:** automated
- **Automated test path:** `test/life-areas-routes.test.ts` — `Life areas — create and list (PRD AC-1)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. With `npm run dev` running, `POST /api/life-areas` with `{ "name": "  Casa " }`.
  2. Expect 201, `lifeArea.name` equal to `Casa`, `description` `null`, `id` a UUID.
  3. `GET /api/life-areas` and expect exactly that one area.

### AC-2 — Name rules (blank, longer than 40, duplicate)

- **Risk level:** High
- **Required state:** one area named `Saúde`
- **Coverage:** automated
- **Automated test path:** `test/life-areas-routes.test.ts` — `name rules on create` and `name rules on rename (PRD AC-2)`; screen-side: `test/life-areas-list.test.ts` — `checkLifeAreaName`; copy: `test/life-areas-view.test.ts` — `lifeAreaNameProblemMessage`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Create with a blank name and with 41 characters; expect 400 naming `name`.
  2. Create `saude`, `SAÚDE` and ` Saude `; expect 409 naming `name` each time.
  3. Rename another area to `saude`; expect 409. Confirm `GET /api/life-areas` is unchanged.

### AC-3 — At most twelve areas

- **Risk level:** Medium
- **Required state:** 12 areas
- **Coverage:** automated
- **Automated test path:** `test/life-areas-routes.test.ts` — `at most twelve (PRD AC-3)`; screen: `test/life-areas-list.test.ts` — `canCreateLifeArea`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Create a 13th area; expect 409 and still 12 in the list.
  2. Delete one and repeat the create; expect 201.

### AC-4 — Rename keeps the id and the items

- **Risk level:** High
- **Required state:** area `Casa` with at least two Tasks assigned
- **Coverage:** automated
- **Automated test path:** `test/life-areas-routes.test.ts` — `Life areas — rename (PRD AC-4)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `PATCH /api/life-areas/<id>` with `{ "name": "Lar" }`; expect 200 and the same `id`.
  2. `GET /api/tasks?lifeAreaId=<id>` and expect the same Tasks as before.
  3. Rename `Lar` to `lar` (its own name, other case) and expect 200; rename to another area's name and expect 409; an unknown id answers 404.

### AC-5 — Delete unassigns, it never deletes an item

- **Risk level:** Critical
- **Required state:** area A holding one open Task, one `done` Task and one series with its open occurrence
- **Coverage:** automated
- **Automated test path:** `test/life-areas-routes.test.ts` — `delete unassigns, it never deletes an item (PRD AC-5)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Note the id, title, status and dates of the two Tasks and the series.
  2. `DELETE /api/life-areas/<A>`; expect 204.
  3. Read the same rows back: `lifeAreaId` is `null` on all of them and nothing else changed; none was deleted.
  4. `DELETE` an unknown id and expect 404.

### AC-6 — List shape, order and counts

- **Risk level:** Medium
- **Required state:** areas `Trabalho`, `Casa`, `Ética`; open Tasks in some, others with no area
- **Coverage:** automated
- **Automated test path:** `test/life-areas-routes.test.ts` — `list shape, order and counts (PRD AC-6)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `GET /api/life-areas`.
  2. Expect the order `Casa`, `Ética`, `Trabalho`, each with `openTaskCount`, `taskCount` and `seriesCount`, and `noArea.openTaskCount` equal to the area-less open Tasks.

### AC-7 — The bearer gate on every area route

- **Risk level:** Critical
- **Required state:** none
- **Coverage:** automated
- **Automated test path:** `test/life-areas-routes.test.ts` — `every route stays behind the bearer gate (PRD AC-7)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Call each of `GET`, `POST`, `PATCH`, `DELETE` on `/api/life-areas` with no `Authorization` header and again with a wrong token.
  2. Expect 401 every time and no row read or written.

---

## API — Tasks and series

### AC-8 — Task create validates the area

- **Risk level:** High
- **Required state:** area A exists
- **Coverage:** automated
- **Automated test path:** `test/life-areas-task-routes.test.ts` — `Task create — the area is validated (PRD AC-8)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `POST /api/tasks` with `lifeAreaId` A; expect 201 and the Task carries A.
  2. With an id that matches no area; expect 400 naming `lifeAreaId` and no Task created.
  3. With the key absent and with `null`; expect `lifeAreaId` `null`.

### AC-9 — Task edit carries the area

- **Risk level:** High
- **Required state:** one one-off Task; one occurrence of a series
- **Coverage:** automated
- **Automated test path:** `test/task-update.test.ts` — `Task update — lifeAreaId is editable and validated (life-areas.prd.md AC-9)`; sheet side: `test/task-edit.test.ts` — `buildTaskPatch sends the area only when the owner chose a different one`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `PATCH /api/tasks/<one-off>` with `{ "lifeAreaId": A }`: 200, area set; with `null`: cleared; with an unknown id: 400.
  2. `PATCH` the occurrence the same way: it becomes `detached` (ADR-0006) and its series' own `lifeAreaId` is unchanged.
  3. Confirm `status`, `seriesId`, `detached` and a typo key are still 400.

### AC-10 — Series carries the area

- **Risk level:** High
- **Required state:** area A and area B; one series with an open occurrence; one detached open occurrence of another series
- **Coverage:** automated
- **Automated test path:** `test/life-areas-series.test.ts` — `Series create` and `Series patch` blocks (PRD AC-10)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `POST /api/series` with `lifeAreaId` A; expect the series and its first occurrence to carry A.
  2. Complete that occurrence; expect the spawned successor to carry A.
  3. `PATCH /api/series/<id>` with `{ "lifeAreaId": B }`: the series and its open non-detached occurrence carry B, the detached one keeps its own, `done` and `missed` rows keep theirs.
  4. An unknown id on create or patch answers 400 and changes nothing.

### AC-11 — The `lifeAreaId` list filter

- **Risk level:** High
- **Required state:** Tasks in areas A and B and in none; one A Task open with the word `consulta` in its title
- **Coverage:** automated
- **Automated test path:** `test/life-areas-task-routes.test.ts` — `the lifeAreaId filter`, `composes as an AND with the other filters`, `without lifeAreaId the response is the frozen one (PRD AC-11)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `GET /api/tasks?lifeAreaId=A`: only A's Tasks, of every status.
  2. `?lifeAreaId=none`: only the area-less ones.
  3. `?lifeAreaId=A&status=open&q=consulta`: only A's open Tasks holding that word.
  4. An id matching no area is 200 with an empty list; `?lifeAreaId=` (empty) is 400 naming `lifeAreaId`; with no parameter the response is byte-identical to before.
- **Known gap:** PRD AC-11 also says `test/task-list-contract.test.ts` is "extended, not loosened". That file does not mention `lifeAreaId` (0 occurrences); the byte-identical clause is asserted by `life-areas-task-routes.test.ts` instead. The contract file was not loosened, and was not extended either.

### AC-12 — Shared helpers

- **Risk level:** Medium
- **Required state:** none
- **Coverage:** automated
- **Automated test path:** `test/life-areas.test.ts` — the four `AC-12` blocks (limits, validation, duplicate key, pt-BR comparator)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Run `npx vitest run test/life-areas.test.ts` and expect it green.
  2. In a REPL, `lifeAreaNameKey("Saúde")`, `("SAUDE")` and `(" saude ")` are equal and `("Casa")` differs from `("Casas")`.

---

## Client — pure decisions

### AC-13 — Filter dimension

- **Risk level:** High
- **Required state:** none
- **Coverage:** automated
- **Automated test path:** `test/task-filter.test.ts` — `toQuery — lifeAreaId`, `activeCount — the area counts once`, `isChipActive and toggleChip — the area rides along untouched (life-areas PRD AC-13)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Run `npx vitest run test/task-filter.test.ts` and expect it green.
  2. In the app, apply an area and read the request in the network panel: `lifeAreaId=<id>` is the last parameter.

### AC-14 — Capture inherits the filter

- **Risk level:** Medium
- **Required state:** an area A; the *Hoje* screen
- **Coverage:** automated
- **Automated test path:** `test/life-area-assign.test.ts` — `captureAreaFields — what area a captured Task takes from the area filter (PRD AC-14)`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Apply area A in the filter sheet and capture `marcar consulta`; the request body has `lifeAreaId` A and the Task shows the area on its row.
  2. Apply *Sem área* and capture; the body carries `lifeAreaId: null`.
  3. Clear the filter and capture; the body has no `lifeAreaId` key.
- **Observed so far:** the A-body was seen once in the browser pane (`phase-4/live-browser-pass.md`); the *Sem área* and no-filter bodies were not recorded by either pass.

### AC-15 — The area name closes an open Task's row

- **Risk level:** Medium
- **Required state:** an open Task in `Casa` with a deadline and `alta` priority; one with neither; one with no area; a `done` and a `missed` Task in an area
- **Coverage:** automated
- **Automated test path:** `test/format.test.ts` — `taskMetaLine — the area name closes an open Task's line`, `no area name leaves today's line untouched`, `closed rows never show the area`; `test/life-area-assign.test.ts` — `lifeAreaNameOf`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Open *Hoje*; the dated Task reads `até seg., 18/08 · alta · Casa`, and the bare one just `Casa`.
  2. Confirm a Task with no area reads exactly as before and has no *Sem área* marker.
  3. Confirm a concluded and a not-concluded row keep their old text.

### AC-16 — Occurrence save plan

- **Risk level:** High
- **Required state:** an occurrence of an active series; two areas
- **Coverage:** automated
- **Automated test path:** `test/series-edit.test.ts` — `planSeriesOccurrenceSave — the area follows Aplicar a`, `an unchanged area is never sent`, `a detached occurrence's own area is not the series'`, `buildUpdateSeriesTemplate — the area is a template field`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Open the occurrence's sheet, change only the area, *Aplicar a* = *Toda a série*, save; the series PATCH carries `lifeAreaId` and no Task PATCH is sent.
  2. Repeat with *Só esta ocorrência*; the Task PATCH carries it and the occurrence is detached.
  3. Save without touching the area; neither request carries it.

---

## Export and restore

### AC-17 — Export carries the area

- **Risk level:** Critical
- **Required state:** an area, a Task and a series assigned to it
- **Coverage:** automated
- **Automated test path:** `test/life-areas-export.test.ts` — `GET /api/export — an assigned area travels with its items (PRD AC-17)`; guard: `test/export-completeness.test.ts`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `GET /api/export`.
  2. `tables.life_areas` holds the area field for field; the Task and series rows carry its id; `formatVersion` is still 1.
  3. Run `npx vitest run test/export-completeness.test.ts` and expect it green with no manifest change.

### AC-18 — Restore drill on a production snapshot

- **Risk level:** Critical
- **Required state:** a **production** snapshot holding at least one `life_areas` row and one assigned Task
- **Coverage:** manual
- **Automated test path:** — (the drill is a script, `scripts/restore-drill.mjs`; `test/restore-values.test.ts` covers only the value helpers and does not mention `life_areas`)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Pull a real snapshot with `scripts/pull-export-snapshot.mjs` (needs the production credential; owner-only).
  2. Run `scripts/restore-drill.mjs` against it; expect `restore-drill: PASS`, equal row counts and every field of every row identical, `life_areas` included.
  3. Record the result under `PRPs/reports/life-areas/`.
- **Status today:** the drill passed on a **synthetic** fixture only (`PRPs/reports/life-areas/c6-restore-drill.md`, `c6-drill-output.txt`). The AC as worded is **not met**.

---

## Screens (manual by the PRD)

### AC-19 — The *Áreas* screen

- **Risk level:** High
- **Required state:** three areas with Tasks, some open Tasks with no area; a second run with zero areas
- **Coverage:** manual
- **Automated test path:** `test/life-areas-list.test.ts`, `test/life-areas-view.test.ts` (reducer and copy), `test/app-route.test.ts` — `routeFromPath — the life-areas route` (the pure half)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Open *Configurações*, then *Áreas*; expect `/settings/life-areas`, areas alphabetical with open counts and a read-only *Sem área* row.
  2. Add one, rename one in place, delete one; the delete asks once, repeats the verb and says how many Tarefas and séries lose the area.
  3. Press Esc and use the back gesture; both return to *Configurações*.
  4. With no area, the empty state invites the first one; make the request fail and expect an inline persistent error with *Tentar de novo*.
  5. Every control is at least 48 px and the copy is pt-BR.
- **Open for the owner:** *Você ainda não criou nenhuma área.* and *Criar áreas* are proposed copy, not confirmed.

### AC-20 — The Task sheet *Área* group

- **Risk level:** High
- **Required state:** at least one area; a one-off Task and an occurrence of a series; a second run with no areas
- **Coverage:** manual
- **Automated test path:** `test/life-area-assign.test.ts` — `decideAreaGroup`, `areaChoiceValue and lifeAreaIdFromChoice`; `test/task-edit.test.ts` — `effectiveLifeAreaId`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Open a one-off Task's sheet; an *Área* group (*Sem área* and the areas) sits after the priority.
  2. Choose an area and save; reopen and confirm it persisted.
  3. On a series occurrence, confirm the choice follows *Aplicar a* (AC-16).
  4. With no areas, the group is replaced by one line and a button that opens *Áreas*.
  5. Save a Task with no area; nothing is mandatory.
- **Open for the owner:** the group label *Área* and *Aplicar título, descrição, prioridade e área a* are proposed copy.

### AC-21 — The filter sheet *Área* group

- **Risk level:** High
- **Required state:** at least one area; the app in the foreground on *Hoje*
- **Coverage:** manual
- **Automated test path:** `test/life-area-assign.test.ts` — `decideAreaFilterChip — whether the applied area chip shows and what names it (PRD AC-21)`; `test/task-filter.test.ts`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Open the filter sheet; an *Área* group offers *Sem área* and each area.
  2. Pick one; *Hoje* filters at once, the header badge rises and a selected chip appears with *Limpar filtros*.
  3. Kill the app and reopen it; it starts unfiltered.
  4. With the area applied, delete it from another device and bring the app to the foreground; the list reads *Nenhuma tarefa com esse filtro.* with *Limpar filtros*.
  5. With no areas, or with the areas request failing, the group is absent.
- **Observed so far:** the group, the badge, the leading chip, the foreground refetch and the deleted-area empty state were seen in the browser pane; the cold start (step 3) is owed to the owner's device.

### AC-22 — Degraded states

- **Risk level:** Medium
- **Required state:** the areas request made to fail (DevTools network block of `/api/life-areas`); an area-less open Task
- **Coverage:** manual
- **Automated test path:** `test/life-area-assign.test.ts` — `lifeAreaNameOf`, `decideAreaGroup`; `test/format.test.ts` — `no area name leaves today's line untouched`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Block `/api/life-areas`, then load *Hoje*.
  2. Tasks list normally and no row shows an area name.
  3. The Task sheet offers no *Área* group and no banner or toast appears.
  4. With the request healthy and no area filter, an area-less open Task's row carries no *Sem área* marker.

---

## Invariants, proof and documents

### AC-23 — Invariants

- **Risk level:** High
- **Required state:** the worktree at the unit's complete diff against `main`
- **Coverage:** automated
- **Automated test path:** `npm run check` and `npm test` (1719 tests, 89 files, 0 failed in the latest record); inspection record `PRPs/reports/life-areas/phase-4/close-out.md`
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. `git diff --quiet f06d56f -- src/shared/recurrence.ts src/shared/adherence.ts` exits 0.
  2. `git diff --name-only f06d56f -- migrations` is empty and so is `git ls-files --others --exclude-standard -- migrations`.
  3. `git diff --diff-filter=D --name-only f06d56f -- test` is empty and the added test lines carry no `.skip`, `.only` or `.todo`.
  4. Run `npm run check` and `npm test`; both exit 0.
  5. Confirm the UI/UX ✔/✘ list in `phase-4/ui-checklist.md` has no ✘.

### AC-24 — Device proof

- **Risk level:** Critical
- **Required state:** unit 13 **deployed** to production (it is not); the owner on his phone
- **Coverage:** manual
- **Automated test path:** — (none; owner-gated)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Deploy, then on the phone create an area he chose himself.
  2. Assign an existing Task to it and filter *Hoje* by it; only that area's Tasks are listed and *Sem área* lists the rest.
  3. Record the observation in `PRPs/reports/life-areas/device-proof.md` (today `Status: OWED`, empty).
- **Status today:** this is the exit signal and the only thing that moves the unit to `shipped`; the reversal clause (a week of use or the unit becomes `dropped`) applies.

### AC-25 — Documentation synced

- **Risk level:** Medium
- **Required state:** the worktree
- **Coverage:** manual
- **Automated test path:** `test/docs-consistency.test.ts` (partial: only that the derived docs' cited paths resolve)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Read FR-008 in `documentation/`: it names Tasks and recurrence series.
  2. Read the glossary and `domain-model.md`: a Life Area is a named grouping the owner creates, with *Sem área* as the pt-BR copy of the implicit "Unsorted".
  3. Read `ui-layout-standard.md` §2.3, §2.6 and §6: a dated amendment replaces the "area dot" with the area name.
  4. Confirm `docs/api-reference.md` documents `/api/life-areas` and `lifeAreaId` on `GET /api/tasks`, and the derived `docs/` area files agree.
  5. Confirm the roadmap row records `shipped` or `dropped`.
- **Status today:** the last clause is not met by design — the roadmap row says `in-progress` until AC-24. The glossary and domain-model wording are marked *Proposed*, awaiting the owner.

---

## Found in the phases (not PRD ACs)

### G-1 — The foreground refetch keeps the area filter

- **Risk level:** High
- **Required state:** an area applied on *Hoje*
- **Coverage:** manual
- **Automated test path:** — (glue in `TodayScreen.tsx`; a defect that predated the unit, fixed in phase 4 with a latest-callback ref)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Apply an area, switch to another tab or app and come back.
  2. In the network panel, `GET /api/tasks` carries `lifeAreaId=<id>`, and the list is still filtered.

### G-2 — Clearing the applied chip keeps keyboard focus

- **Risk level:** Medium
- **Required state:** an area applied; a hardware keyboard
- **Coverage:** manual
- **Automated test path:** — (focus handling, not a decision)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Tab to the applied area chip at the head of the quick row and press Space.
  2. The filter clears and focus lands on *Abertas*, not on the page body.
  3. Clear it with a tap instead; no stray focus ring remains.

### G-3 — A 40-character name at 375 px

- **Risk level:** Low
- **Required state:** an area with a 40-character name, on a 375 px wide viewport
- **Coverage:** manual
- **Automated test path:** — (layout)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Open the filter sheet; the chip is fully visible, never clipped; pressed, it leaves the 16 px gutter by about 10 to 14 px.
  2. Apply it; the applied chip is capped at 10 rem with an ellipsis and *Abertas* is fully on screen.
  3. Open a Task of that area; the row's meta line wraps inside the row.
- **Open for the owner:** whether the gutter breach is acceptable or the 40-character limit should come down (`PRPs/reports/life-areas/phase-4/chip-overflow-measurement.md`, `Decision: keep Chip as is`).

### G-4 — An area deleted while it is the active filter

- **Risk level:** Medium
- **Required state:** area A applied as the filter; A then deleted from another device or the API
- **Coverage:** manual
- **Automated test path:** `test/life-area-assign.test.ts` — `decideAreaFilterChip` (the `unknown` state)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. After the refetch, the applied chip reads the neutral label *Área* and the badge still counts it.
  2. The list is empty with *Nenhuma tarefa com esse filtro.* and *Limpar filtros*; the Tasks of A were unassigned, none deleted.
  3. Try to capture a Task in this state; the create answers 400 naming `lifeAreaId` (a known edge, documented in `docs/domain/areas/life-areas.md`).
  4. Press *Limpar filtros*; the list returns.

### G-5 — Filter sheet with no areas or a failed request

- **Risk level:** Medium
- **Required state:** zero areas; then the areas request failing
- **Coverage:** manual
- **Automated test path:** `test/life-area-assign.test.ts` — `decideAreaGroup` (the pure half)
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. With no areas, open the filter sheet; there is no *Área* group and no placeholder.
  2. With `/api/life-areas` blocked, open the sheet; same, and no toast or banner.
- **Not observed:** neither pass recorded these two cases for the filter sheet (the Task sheet's were recorded).

### G-6 — *Período* "Até" overflows the filter sheet (pre-existing)

- **Risk level:** Low
- **Required state:** the filter sheet on a 375 px wide viewport
- **Coverage:** none
- **Automated test path:** —
- **Manual status:** `pending`
- **Manual step-by-step:**
  1. Open the filter sheet at 375 px and scroll the dialog sideways.
  2. The *Período* "Até" date input is 15 px beyond the viewport (region 390 against 375); no chip causes it.
- **Not this unit's:** it predates unit 13 and is in no backlog row; it is listed so it is found once, not three times.
