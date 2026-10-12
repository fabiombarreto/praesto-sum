# Life Areas

```
**Decision Gate**
- Active context: none
- Activated criteria: before any planning (a PRD that downstream plan, test and implement stages consume); domain rules for life areas and tasks (a Task or series may belong to one Life Area; the series template carries it); a new API surface and a change to a frozen wire contract (`GET /api/tasks`, `PATCH /api/tasks/:id`); shared UI (row, filter sheet, Task sheet, settings); export and restore (FR-042, chore C6)
- Decisions found: ADR-0006 / [2026-08-03] Recurrence: shared rule, per-entity instantiation — the series template carries the Life Area, a detached occurrence stops following it, closed rows are a permanent record; [2026-08-03] MVP scope frozen — FR-008 is unit 13; resolved 2026-08-03 (`docs/domain/areas/life-areas.md`) — an item MAY exist without an area, no default area is stored, no area is pre-created, growth is data not remodeling; ADR-0009 (visible copy pt-BR, everything else English); ADR-0003 (one Worker, D1, export binding, no sync engine); ADR-0007 (closed mirror inventory — Life Areas never leave Praesto); ADR-0014 (a Task without a date can repeat); [2026-08-29] an APPROVED PRD's phase table may only grow with a dated amendment note
- Applicable anti-patterns: Hand-duplicated entity types (the new wire shapes live once in `src/shared/api.ts`, mapped in `src/worker/dto.ts`); Glossary synonym drift (Life Area in code and docs, never category/module/domain/section; the owner-facing word is *área*); Mirroring Tasks, Reminders or Life Areas to Google; Portuguese in artifacts (copy pt-BR, code, tests and docs English); Editing accepted ADRs (append-only); Weakening tests to force green
- Applicable architectural rules: one Worker serves everything, no second service; types flow `src/worker/db/schema.ts` → `src/worker/dto.ts` → `src/shared/api.ts`; migrations only by drizzle-kit + wrangler (this unit adds none); every `/api/*` route behind the bearer gate; `src/shared/` carries no DOM or Worker globals; `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay unchanged; the export completeness guard fails if a table is not dumped; UI changes run the `ui-ux-guidelines.md` review checklist; roadmap rule 2 (one `in-progress` unit) is knowingly excepted, see the Decisions Log
- Result: PROCEED
```

## Problem Statement

The owner's *Hoje* screen mixes every domain of his life — home, health, work, money — in one list, and there is no
way to say "show me only Casa" or to see which domain a Task belongs to. The data model was built for it from the
first migration (a `life_areas` table and a `life_area_id` on Tasks and on Recurrence Series) but nothing writes or
reads it: no route, no screen, and the one write path that touches it silently accepts any id. The cost of leaving
it is that the list keeps growing as one undifferentiated pile, and the only workaround — a word in the title that
text search can find — finds words, not domains.

## Evidence

- `documentation/20-requirements/functional-requirements.md:41` — FR-008 (Could, accepted): "A Task can be assigned
  to a Life Area." Traceability (`:119`) assigns it to unit 13 `life-areas`.
- `documentation/50-planning/roadmap.md:66` — unit 13's own outcome (the owner creates the areas that make sense
  to him, assigns Tasks and series to them and filters by area) and its exit signal, verbatim: "The owner filtered
  by an area *he* created and kept using that filter for a week — if he does not, the unit is reverted and this
  row becomes `dropped`".
- `src/worker/db/schema.ts:27-45`, `:102`, `:171` — `life_areas` (name unique and non-blank, optional description),
  `recurrence_series.life_area_id` and `tasks.life_area_id`, both `ON DELETE SET NULL`, in migration `0000`. Nothing
  reads or writes them from the app: there is no `/api/life-areas` and no client wrapper.
- `src/shared/api.ts:241-253` — `PATCH /api/tasks/:id` rejects `lifeAreaId` on purpose with the comment "unit 13
  owns it", and `test/task-update.test.ts:363` pins the 400. `POST /api/tasks` (`src/worker/routes/tasks.ts:181`)
  and the series routes (`src/worker/routes/series.ts:149`, `:365-373`) accept it without checking the area exists.
- `src/worker/successor.ts:74` — a spawned successor already copies `series.lifeAreaId`; the series template
  carries the area (`documentation/30-architecture/domain-model.md:75`).
- `documentation/40-engineering/ui-layout-standard.md:66` — the layout standard already reserves "area dot in the
  row metadata and an area filter chip" for this unit.
- Assumption — needs validation through the owner's own use: the docs hold no first-person quote from the owner
  about this pain (FR-008 is a Could). The roadmap's exit signal, with its revert clause, is the validation.

## Proposed Solution

The owner creates a short list of Life Areas of his own on a *Configurações → Áreas* screen — name only — and
assigns a Task or a recurring series to at most one of them from the Task sheet. *Hoje* then gains one more filter,
*Área*, in the existing filter sheet: pick an area or *Sem área* and the list shows only those items, composed with
the status, priority, period and search filters that already exist. Deleting an area never deletes an item — the
items become *Sem área* — and nothing in capture changes: no area is ever required. The unit adds no migration and
no column: the table, the foreign keys, the index and the export already exist, which also makes the unit cheap to
revert if the owner does not keep using the filter. This route was chosen over tags (many-to-many, a new table, a
new filter model) and over coloured areas (a migration plus a categorical palette in the visual identity) because
the roadmap's own exit signal can revert the unit within a week.

## Key Hypothesis

We believe a single-choice area filter over areas the owner names himself will let him look at one domain of his
life at a time on *Hoje* for the owner, the single user of Praesto Sum.
We'll know we're right when, in the week after deploy, he has created at least one area himself, assigned at least
three Tasks or series to it, and reports using the *Área* filter on at least three different days.

## What We're NOT Building

- **Colour, icon or description in the UI** — colour needs a migration, a categorical palette in the identity
  (ADR-0010) and a contrast measurement for a unit that can be reverted in a week; WCAG 1.4.1 requires the name to
  be shown anyway. `description` stays in the schema and the export, unexposed. Reopen trigger: he asks for colour
  after a week of use.
- **Archiving an area** — needs a column, a migration and a filtered read everywhere; deletion plus the weekly
  snapshot is the safety net in this version.
- **Several areas per item (tags)** — a join table, a migration, an export entry and a different filter model; an
  area is a domain of life, not a label.
- **Sub-areas, projects, goals, shared areas** — no hierarchy and no collaborators (ADR-0003).
- **Reordering areas by hand** — alphabetical (pt-BR collation) is predictable and needs no column.
- **A group-by-area view on *Hoje*** — the six date groups stay; area is a filter, not a second grouping axis.
  *Sem área* is a filter value, not a new group.
- **An area filter in search** — unit 8's exit signal is finding a Task "without choosing a filter first"; the
  API already composes `lifeAreaId` with `q`, so adding a control later is cheap.
- **An area on the *Aderência* route** — `SeriesAdherenceDto` and the adherence view stay untouched; the area is
  visible in the series' own sheet.
- **An area on Events or Reminders** — Events arrive in unit 14 and take the area then; a Reminder belongs to its
  Task.
- **Persisting the area filter across a cold start** — layout standard §2.3: a narrowing filter never survives a
  cold start silently.
- **Bulk assignment, area-based notifications, mirroring areas to Google** — ADR-0007's mirror inventory is closed.
- **Rewriting closed occurrences when a series' area changes** — `done` and `missed` rows are the permanent record
  (ADR-0006); a new area applies from the open occurrence on.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Areas the owner created himself and items assigned | ≥ 1 area, ≥ 3 Tasks or series assigned within the week after deploy | production export (`tables.life_areas`, `lifeAreaId` on Tasks and series) or `GET /api/life-areas` |
| Days the *Área* filter was used | ≥ 3 different days in the week after deploy | the owner's own report, recorded in Delivery history with AC-24 — no telemetry is added (CON-005) |
| Items lost when an area is deleted | 0 Task or series rows deleted | automated test (AC-5) |
| Unknown area ids on a write reaching the foreign key | 0 writes answered 500; all answered 400 | automated tests (AC-8, AC-9, AC-10) |
| Frozen list contract | `GET /api/tasks` without `lifeAreaId` is byte-identical to today | contract test (AC-11) |
| Cost of reverting the unit | 0 migration files added, 0 existing columns changed | diff check (AC-23) |
| Restore of `life_areas` | counts and every field identical on a snapshot with real areas | chore C6 drill (AC-18) |

## Acceptance Criteria (test scenarios)

- **AC-1 Create and list:** Given no Life Areas, when `POST /api/life-areas` carries `{ "name": "  Casa " }`, then
  the response is 201 with a `lifeArea` whose `name` is `Casa` (trimmed), `description` is `null` and `id` is a
  UUID; and `GET /api/life-areas` then lists exactly that area.
- **AC-2 Name rules:** Given an area named `Saúde`, when a create or a rename carries a name that is blank or
  whitespace-only, longer than 40 characters, or equal to an existing one ignoring case and diacritics (`saude`,
  `SAÚDE`, ` Saude `), then the first two are answered 400 naming `name`, the duplicate is answered 409 naming
  `name`, and no row is written or changed.
- **AC-3 Limit:** Given 12 areas, when a 13th is created, then 409 and there are still 12; when one is deleted
  and the create is repeated, then it succeeds.
- **AC-4 Rename:** Given area `Casa` with Tasks assigned, when `PATCH /api/life-areas/:id` carries `{ "name":
  "Lar" }`, then 200, the `id` is unchanged and `GET /api/tasks?lifeAreaId=<id>` returns the same Tasks as before;
  renaming `Casa` to `casa` (its own name, other case) is accepted; renaming to another area's name is 409 (AC-2);
  an unknown id is 404.
- **AC-5 Delete unassigns:** Given area A holding two Tasks (one open, one `done`) and one series with its open
  occurrence, when `DELETE /api/life-areas/:id` is called, then 204, the area row is gone, those Tasks, that
  occurrence and that series have `lifeAreaId` `null`, no Task or series row is deleted and none of their title,
  status or dates changed; a `DELETE` of an unknown id is 404.
- **AC-6 List shape:** Given areas `Trabalho`, `Casa` and `Ética`, open Tasks assigned to some and unassigned
  others, when `GET /api/life-areas` is called, then 200 with `lifeAreas` ordered `Casa`, `Ética`, `Trabalho`
  (pt-BR collation, not bytewise), each carrying `openTaskCount` (open Tasks only), `taskCount` (Tasks of every
  status) and `seriesCount` (its Recurrence Series), and a `noArea.openTaskCount` equal to the number of open
  Tasks with no area.
- **AC-7 Bearer gate:** Given no `Authorization` header or a wrong token, when any `/api/life-areas` route is
  called, then 401 and nothing is read or written.
- **AC-8 Task create validates the area:** Given area A exists, when `POST /api/tasks` carries `lifeAreaId` A, then
  201 and the Task carries A; given an id that matches no area, then 400 naming `lifeAreaId` and no Task is
  created; given the key absent or `null`, then `lifeAreaId` is `null` exactly as today.
- **AC-9 Task edit carries the area:** Given a one-off Task, when `PATCH /api/tasks/:id` carries `{ "lifeAreaId":
  A }`, then 200 and the area is set; `{ "lifeAreaId": null }` clears it; an unknown id is 400; `lifeAreaId` is in
  `EDITABLE_TASK_FIELDS` while every other non-editable key (`status`, `seriesId`, `detached`, a typo) is still
  400. Given an occurrence of a series, then the same PATCH sets `detached` (ADR-0006 unchanged) and leaves the
  series' own `lifeAreaId` untouched.
- **AC-10 Series carries the area:** Given `POST /api/series` with `lifeAreaId` A, then the series and its first
  occurrence carry A, and the successor spawned when that occurrence is completed carries A too. Given `PATCH
  /api/series/:id` carries `{ "lifeAreaId": B }`, then the series and its open non-detached occurrence carry B, a
  detached open occurrence keeps its own, and `done` and `missed` rows keep the area they had. An unknown id on
  create or patch is 400 and nothing changes.
- **AC-11 List filter:** Given Tasks in areas A, B and in none, when `GET /api/tasks?lifeAreaId=A` is called, then
  only A's Tasks come back, of every status; `lifeAreaId=none` returns only the area-less ones; composed with
  `status`, `priority`, `from`/`to` and `q` it is an AND (`?lifeAreaId=A&status=open&q=consulta` returns only A's
  open Tasks holding that word in title or description); an id matching no area is 200 with an empty list; an
  empty `lifeAreaId=` is 400 naming `lifeAreaId`; without the parameter the response is byte-identical to today's.
  The frozen contract in `docs/api-reference.md` is amended and `test/task-list-contract.test.ts` extended, not
  loosened.
- **AC-12 Shared helpers:** Given `lifeAreaNameKey` in `src/shared/life-areas.ts`, when called with `Saúde`,
  `SAUDE` and ` saude `, then all three keys are equal and `lifeAreaNameKey("Casa")` differs from
  `lifeAreaNameKey("Casas")`; the area comparator orders `Ética` before `Saúde` and `casa` before `Trabalho`;
  `LIFE_AREA_NAME_MAX` is 40 and `LIFE_AREA_LIMIT` is 12; `validateLifeAreaName` returns an error code for a blank
  and for an over-length name and none for a valid one.
- **AC-13 Filter dimension:** Given `EMPTY_FILTER`, when `toQuery` and `activeCount` are applied, then
  `lifeAreaId` is `null`, `toQuery` emits nothing for it and `activeCount` is unchanged; given `lifeAreaId: "A"`,
  when `toQuery` runs, then it emits `lifeAreaId=A`, and given `"none"` it emits `lifeAreaId=none`; `activeCount`
  counts it as one active filter; the parameters already emitted keep their order and `isChipActive` and
  `toggleChip` behave exactly as before.
- **AC-14 Capture inherits the filter:** Given the *Hoje* filter has `lifeAreaId` A, when the owner captures
  `marcar consulta`, then the create request carries `lifeAreaId` A; given the filter is `none` it carries `null`;
  given no area filter it carries no `lifeAreaId` key at all. The decision is a pure function tested without the
  DOM.
- **AC-15 Row text:** Given an open Task whose area is `Casa`, when its meta line is built, then it ends with
  `Casa` after the date and priority phrases (`até seg., 18/08 · alta · Casa`), and with neither date nor priority
  it is just `Casa`; the name is present whether or not that area is the active filter; a Task with no area gets
  exactly the line it gets today, and `done` and `missed` rows keep today's text.
- **AC-16 Occurrence save plan:** Given an occurrence of an active series, when the owner changes only the area and
  *Aplicar a* is *Toda a série*, then `planSeriesOccurrenceSave` sends `lifeAreaId` to the series PATCH and
  nothing to the Task PATCH; when it is *Só esta ocorrência*, it sends it to the Task PATCH and the occurrence is
  detached; when the area is unchanged neither request carries it. The function is pure and tested without the
  DOM.
- **AC-17 Export carries it:** Given an area and a Task and a series assigned to it, when `GET /api/export` is
  called, then `tables.life_areas` holds the area field for field, the Task and series rows carry its id in
  `lifeAreaId`, `formatVersion` is still 1 and the completeness guard passes with no manifest change.
- **AC-18 Restore drill:** Given a production snapshot holding at least one `life_areas` row and one assigned
  Task, when `scripts/restore-drill.mjs` rebuilds it, then the row counts match and every field of every row is
  identical, `life_areas` included; the result is recorded under `PRPs/reports/life-areas/`.
- **AC-19 Áreas screen (manual):** Given *Configurações*, when the owner opens *Áreas*, then `/settings/life-areas`
  lists his areas alphabetically with their open counts and a read-only *Sem área* row with its count; he can add
  one, rename one in place and delete one; delete asks once, repeats the verb and says how many Tarefas and séries
  lose the area; Esc and the back gesture return to *Configurações*; with no area the empty state invites the
  first one; a failed request is an inline persistent error with *Tentar de novo*; every control is at least 48
  px and the copy is pt-BR.
- **AC-20 Task sheet (manual):** Given the sheet of a one-off Task and at least one area, when it opens, then an
  *Área* single-choice group (*Sem área* and the areas) sits after the priority; saving persists the choice; on a
  series occurrence the choice follows *Aplicar a* as AC-16 plans it; with no areas the group is replaced by one
  line and a button that opens *Áreas*; nothing is mandatory, a Task saves with no area.
- **AC-21 Filter sheet (manual):** Given at least one area, when the owner opens the filter sheet, then an *Área*
  group offers *Sem área* and each area; picking one filters *Hoje* at once, raises the header badge and appears as
  a selected chip with *Limpar filtros*; killing and reopening the app starts unfiltered; given that area was
  deleted from another device, then after the refetch the list reads *Nenhuma tarefa com esse filtro.* with
  *Limpar filtros*; with no areas, or when the areas request fails, the group is absent.
- **AC-22 Degraded states (manual):** Given the areas request fails or is slow, when *Hoje* loads, then Tasks list
  normally, rows show no area name, the Task sheet offers no *Área* group and no banner or toast appears; given an
  area-less open Task and no area filter, its row carries no "Sem área" marker.
- **AC-23 Invariants:** Given the unit's complete diff against `main`, when it is inspected and `npm run check` and
  `npm test` are run, then `src/shared/recurrence.ts` and `src/shared/adherence.ts` are byte-identical to `main`,
  no file was added under `migrations/`, no test was removed, skipped or loosened (`test/task-update.test.ts`'s
  pinned 400 for `lifeAreaId` is replaced by AC-9's intended behaviour), both commands pass, and the UI/UX review
  checklist ✔/✘ is recorded in the phase report.
- **AC-24 Device proof:** Given the unit deployed to production, when the owner, on his phone, creates an area he
  chose himself, assigns an existing Task to it and filters *Hoje* by it, then only that area's Tasks are listed
  and *Sem área* lists the rest; the observation is recorded in `PRPs/reports/life-areas/device-proof.md`.
- **AC-25 Documentation synced:** Given the unit's phases complete, when `documentation/` and `docs/` are
  inspected, then FR-008 names Tasks and recurrence series; the glossary and `domain-model.md` describe a Life
  Area as a named grouping the owner creates, with *Sem área* as the pt-BR copy of the implicit "Unsorted"
  grouping; `ui-layout-standard.md` §2.6 and §6 carry a dated amendment replacing the "area dot" with the area
  name; `docs/api-reference.md` documents `/api/life-areas` and `lifeAreaId` on `GET /api/tasks`; the derived
  `docs/` area files agree with `documentation/`; and the roadmap row records `shipped` or `dropped` with the
  date and the reason.

## Open Questions

- [ ] **Does the glossary's reading of Life Area need to change?** The glossary calls it "a domain of personal life
  … (e.g. Calendar, Tasks now; others later) — the top-level unit of scope", while this unit treats it as a named
  grouping the owner creates ("Casa", "Saúde"). `domain-model.md:84` already reads "a named domain of the owner's
  personal life that groups Tasks and Events". Proposed: phase 4 amends the glossary to that wording and notes that
  Calendar and Tasks are product capabilities, not Life Area records. The owner decides at that phase.
- [ ] **Closed rows keep the old area.** Re-assigning a series from *Casa* to *Saúde* leaves its past `done` and
  `missed` rows under *Casa*. Confirm after the first real re-assignment of a series with history; the alternative
  (re-stamping every closed row) was rejected as a bulk write over the permanent record.
- [ ] **An area edit on one occurrence detaches it** (ADR-0006, unchanged). Observe whether *Só esta ocorrência*
  for an area alone surprises the owner; the default of *Toda a série* is what keeps it rare.
- [ ] **The 12-area limit** rests on weak evidence (anecdotal sprawl reports; Todoist's 5-project free-plan cap).
  Strike it if the owner finds it arbitrary — it is one constant.
- [ ] **Re-selecting the filter after every cold start** is the cost of layout standard §2.3's rule. Reopen if the
  owner reports it as a nuisance in the first week.
- [ ] **Chore C6 after unit 12's migration `0006`** is still open and independent of this unit; both runs can use
  the same snapshot.

---

## Users & Context

**Primary User**
- **Who:** the owner — the single user of Praesto Sum, on an Android phone and a Windows PC.
- **Current behavior:** every Task lives in one list; to focus on a domain he scans for it or types a word into
  search.
- **Trigger:** opening *Hoje* with a mixed list and wanting only one part of his life in view.
- **Success state:** two taps and the list shows one area; a Task he captures while looking at an area lands in
  that area.

**Job to Be Done**
When *Hoje* mixes every part of my life, I want to see only one area of it, so I can decide what to do next
without the noise of the others.

**Non-Users**
Anyone else (single-user system, ADR-0003) — there is no sharing, no team and no shared area; and the capture
flow itself, which stays area-free and zero-friction.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `/api/life-areas` create, list, rename, delete — name rules, limit, ordering, counts | The unit's whole premise: the owner defines the areas |
| Must | Assign an area on Task and series create and edit, with the area validated | The write path exists today unvalidated and the Task PATCH refuses it |
| Must | `lifeAreaId` list filter (`<id>` or `none`) composing with the existing filters | The exit signal is filtering by area |
| Must | *Áreas* screen under *Configurações* | Where the owner creates his areas |
| Must | *Área* in the Task sheet, following *Aplicar a* on a series occurrence | Where he assigns; keeps ADR-0006's detach rule honest |
| Must | *Área* group in the filter sheet, applied chip, *Sem área* | The owner-facing half of the exit signal |
| Must | Deleting an area unassigns its items and loses nothing | Capture must never be punished by a taxonomy choice |
| Should | Capture inherits the active area filter | Otherwise a captured Task vanishes from the view he is looking at |
| Should | Area name on the row | The cue must not depend on which filter is active |
| Should | Restore drill on a snapshot with real areas | `life_areas` has never been exercised by chore C6 |
| Won't | Create an area from inside the Task sheet | Saves a trip; deferred, creation lives in one place (D-G) |
| Won't | Colour, icon, description in the UI, archive, tags, sub-areas, group-by-area, reorder | See What We're NOT Building |

### MVP Scope

Phases 1–4 below: the API with validation and the filter, the *Áreas* screen, assigning and showing the area, and
the filter with its close-out. No migration.

### User Flow

The owner opens *Configurações → Áreas*, adds *Casa* and *Saúde* → on a Task's sheet he picks *Casa* and saves →
on *Hoje* he opens the filter sheet, picks *Casa* → the list shows only *Casa* (and the header badge says one
filter is active) → he captures "comprar pão" and it lands in *Casa* → *Limpar filtros* returns the whole list;
*Sem área* shows what has no area yet.

---

## Technical Approach

**Feasibility:** HIGH — the table, the foreign keys, the index, the export entry and the series-to-occurrence copy
already exist; the new surface is one route, one pure module, one validation helper, one filter dimension and
three UI blocks, with no migration.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair
(test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the
Implementer runs. AC-19 to AC-22 and AC-24 are the manual/UI half and produce no test file, per the methodology's
"UI stays manually verified" line; their decidable logic (AC-13 to AC-16) is extracted into `src/shared` and
tested first. AC-18 is a script run and AC-25 an inspection of the documentation; neither is a test file.

### Architecture Notes

- **Pure core in `src/shared/life-areas.ts`:** `LIFE_AREA_NAME_MAX`, `LIFE_AREA_LIMIT`, `validateLifeAreaName`,
  `lifeAreaNameKey` (built on `normalizeSearchText` from `src/shared/search.ts`) and the pt-BR comparator
  (`Intl.Collator`). No DOM, no Worker imports; used by the route and by the screen so the two cannot drift.
- **Wire:** `LifeAreaDto` keeps the export's field-for-field shape, unchanged. The list response is a new type in
  `src/shared/api.ts` — `lifeAreas` with `openTaskCount`, `taskCount` and `seriesCount` (the last two feed the
  delete confirmation), plus `noArea.openTaskCount` — mapped in `src/worker/dto.ts`. `UpdateTaskInput` and `EDITABLE_TASK_FIELDS` gain `lifeAreaId`; `CreateTaskInput` and the
  series inputs already carry it.
- **Routes:** a new `src/worker/routes/life-areas.ts` mounted behind the bearer gate. One shared existence check is
  called from the Task routes (`POST`, `PATCH`) and the series routes (`POST`, `PATCH`) and answers 400 naming
  `lifeAreaId`, so an unknown id never reaches the foreign key.
- **Uniqueness:** enforced in the route by `lifeAreaNameKey` (case- and diacritic-insensitive, 409). The existing
  `life_areas_name_unq` index is bytewise and stays as the backstop; changing it to a `NOCASE` index would be a
  migration and is not needed.
- **Delete:** the outcome (items unassigned, none deleted) is pinned by AC-5. `ON DELETE SET NULL` does it; whether
  the route also nulls explicitly in the same `db.batch` is the plan's choice, because no test covers the foreign
  key today.
- **List filter:** `lifeAreaId` is validated with the other parameters before the query (`src/worker/routes/
  tasks.ts:56-97`) and is one more clause in the AND (`eq(tasks.lifeAreaId, id)` or `isNull`), served by the
  existing `tasks_life_area_idx`. An id matching no area is an ordinary empty result, not an error.
- **Series:** the template already carries the area and the successor already copies it. `planSeriesOccurrenceSave`
  (`src/shared/series-edit.ts`) gains `lifeAreaId` among its template fields so *Aplicar a* routes it. The series
  PATCH already updates the template and only the open non-detached occurrence (`src/worker/routes/series.ts`).
  `src/shared/recurrence.ts` and `src/shared/adherence.ts` are not touched.
- **UI:** `AppRoute` gains `life-areas` ↔ `/settings/life-areas` (`src/shared/app-route.ts`); a `LifeAreasScreen`
  and an entry card in `SettingsScreen` mirror the Aderência route and `AdherenceEntryCard`; list state is a
  reducer in `src/shared` following `google-settings.ts`, with `ConfirmView` for the delete. `TaskDraft`
  (`src/shared/task-edit.ts`) gains `lifeAreaId`; `TaskFilter` (`src/shared/task-filter.ts`) gains `lifeAreaId`;
  `FilterSheet` gains an *Área* `ChipGroup`; `taskMetaLine` takes the area name; `CaptureDeck` takes the area from
  a pure function of the filter. `TodayScreen` loads the areas beside the Tasks and degrades to absence on failure.
- **Export and restore:** unchanged code. `life_areas` is already first in `EXPORTED_TABLE_NAMES`
  (`src/worker/db/export-manifest.ts:15`), so the restore drill inserts parents before children. The drill is run,
  not modified.
- **UI/UX checklist (mandatory):** every change under `src/app/` runs `documentation/40-engineering/
  ui-ux-guidelines.md`'s review checklist; the ✔/✘ result is recorded in each phase report, including 48 px targets
  and the 375 px layout of up to twelve chips plus *Sem área* in both sheets.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Re-assigning an occurrence's area detaches it from its series (ADR-0006) | M | Area goes through *Aplicar a*, default *Toda a série*; AC-9, AC-16 |
| An unknown area id reaches the foreign key and answers 500 | M | Existence check on every write path; AC-8, AC-9, AC-10 |
| `ON DELETE SET NULL` is not enforced where the tests run, leaving a dangling id | L | AC-5 pins the outcome; the route nulls explicitly in the same batch if the test shows the foreign key is not enough |
| Twelve areas plus *Sem área* overflow a sheet at 375 px | M | Chips wrap inside the sheet's scroll region; the limit exists for this; checklist items 2 and 12 |
| The frozen list contract regresses for callers that send no `lifeAreaId` | L | AC-11 requires a byte-identical response; contract test extended |
| `life_areas` has never been restored by the drill, so the restore of real areas is unproven | M | Chore C6 on a snapshot with real areas before the unit closes; AC-18 |
| Two devices hold different area lists or a stale filter | L | *Hoje* refetches on `visibilitychange`; an unmatched id is an empty list with *Limpar filtros* (AC-21) |
| The owner does not keep using the filter | M | The roadmap's revert clause applies; the unit adds no migration, so reverting is removing routes and UI |

---

## Implementation Phases

| # | Phase | Description | Status | Repo | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|------|----------|---------|----------|
| 1 | Areas API and the filter | `src/shared/life-areas.ts`, `/api/life-areas` create/list/rename/delete, existence validation on Task and series writes, `lifeAreaId` on `PATCH /api/tasks/:id`, the `lifeAreaId` list filter, `docs/api-reference.md`, export test (AC-1..AC-12, AC-17) | pending | - | - | - | - |
| 2 | The Áreas screen | `/settings/life-areas` route, entry card in *Configurações*, create/rename/delete with the counted confirmation, list reducer, client wrappers (AC-19) | pending | - | - | 1 | - |
| 3 | Assign and show | *Área* in the Task sheet with *Aplicar a*, capture inherits the active area, area name on the row, zero-areas and failure states (AC-14, AC-15, AC-16, AC-20, AC-22) | pending | - | - | 2 | - |
| 4 | Filter and close-out | `TaskFilter.lifeAreaId`, the *Área* group in the filter sheet and the applied chip, UI/UX checklist, docs sync, chore C6 on a snapshot with areas, device proof (AC-13, AC-18, AC-21, AC-23, AC-24, AC-25) | pending | - | - | 3 | - |

### Phase Details

**Phase 1: Areas API and the filter**
- **Goal:** the owner's areas exist as data, and the API refuses a bad area before it reaches the database.
- **Scope:** the pure module; the route and its DTOs; the shared existence check on the four write paths; `lifeAreaId`
  in `EDITABLE_TASK_FIELDS`; the list filter; the contract documentation; the export test with an assigned area.
- **Success signal:** AC-1..AC-12 and AC-17 green; `GET /api/tasks` without the parameter byte-identical.

**Phase 2: The Áreas screen**
- **Goal:** the owner can create, rename and delete his areas on his phone.
- **Scope:** route and entry card, the screen with its states (loading, empty, error, offline), the delete
  confirmation that names the count, client wrappers, the checklist for this screen.
- **Success signal:** AC-19 recorded; Esc and the back gesture verified; checklist ✔/✘ filed.

**Phase 3: Assign and show**
- **Goal:** an item can carry an area and shows it.
- **Scope:** the *Área* group in the Task sheet; `planSeriesOccurrenceSave` routing; the capture inheritance; the
  row's meta text; the zero-areas line; the degraded state when the areas request fails.
- **Success signal:** AC-14, AC-15, AC-16 green; AC-20 and AC-22 recorded.

**Phase 4: Filter and close-out**
- **Goal:** the exit signal's action exists and the unit is observed working.
- **Scope:** the filter dimension and its sheet group and applied chip; docs (`ui-layout-standard.md` §2.6/§6
  amendment, glossary, domain-model, FR-008, `docs/api-reference.md`, tasks and life-areas area docs, roadmap);
  chore C6 on a real snapshot with areas; `device-proof.md`.
- **Success signal:** AC-13 and AC-23 green; AC-18, AC-21 and AC-25 recorded; AC-24 observed on the owner's device.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| D-A — Roadmap rule 2 | Unit 13 opens while unit 12 `repeated-miss-nudge` is still `in-progress` (v0.12.0 deployed, AC-17 device proof owed); recorded as a conscious exception in Delivery history | Wait for AC-17 | Unit 11 did the same over unit 10; the two units touch disjoint files (cron and series internals versus areas, filter and settings); the owner's device proof is the only thing unit 12 waits on. Confirmed by the owner in the authoring round of 2026-10-11 |
| D-B — Vocabulary | The owner-facing label is *Sem área*, the pt-BR copy (ADR-0009) for the implicit "Unsorted" grouping of the docs; no default area is stored; "Life Area" in code and docs | A stored "Unsorted" area; "Sem categoria" | The domain model already says no default area is stored; the glossary bars "category"; *Sem data* sets the naming pattern on *Hoje* |
| D-C — Exit signal | The roadmap's wording is kept verbatim (see Evidence), including its revert clause; the metrics above operationalise "a week" as at least three different days of use; the unit adds no migration so reverting means removing routes and UI | Soften the signal to "created an area" | The signal is the test of whether the feature earns its place; a cheap revert is what makes accepting it honest |
| D-D — What it covers | Tasks and recurrence series (FR-008 names only Tasks; the roadmap row and `domain-model.md:75` include series) | Tasks only | The series template already carries the area and the successor already copies it; leaving series out would make the filter silently lose every recurring item. FR-008's text is amended in phase 4 |
| D-E — Cardinality | Zero or one area per item | Several areas (tags) | An area is a domain of life; one FK column exists; capture never forces a choice. Known cost (OmniFocus users): an item that fits two places must pick one — tags would be a join table, a migration and a new filter model |
| D-F — Attributes | Name only; `description` stays in schema and export, unexposed; no colour, icon or archive flag | Add `color`, `icon`, `archived`, `sort_order` | Colour needs a migration, a categorical palette (ADR-0010) and a contrast measurement for a unit that may be reverted; WCAG 1.4.1 requires the name beside any colour anyway (Todoist keeps colour optional, Apple makes it a choice). The layout standard's "area dot" is amended by a dated note in phase 4. Reopen trigger: the owner asks for colour |
| D-G — Where areas are managed | Only on *Configurações → Áreas* (`/settings/life-areas`); creation is not offered inside the Task sheet | Inline "Nova área" in the sheet | One place to learn and test; mirrors the Aderência route; the sheet stays a Task form |
| D-H — Name rules | Trimmed, 1 to 40 characters, unique by `lifeAreaNameKey` (case- and diacritic-insensitive), 409 on a duplicate | A `NOCASE` unique index | The existing index is bytewise, so `casa` and `Casa` would coexist; changing the index is a migration. The route check plus the unchanged index as backstop needs none |
| D-I — Limit and order | At most 12 areas; alphabetical by pt-BR collation; no manual order | No limit; creation order; a `sort_order` column | Bounds the sheets at 375 px and the sprawl failure mode; alphabetical is predictable and needs no column. The limit is weakly evidenced and is one constant (Open Questions) |
| D-J — Deleting an area | A real delete; items become *Sem área*; the confirmation repeats the verb and names how many Tarefas and séries lose the area; no archive | Archive; block while items are assigned; cascade | Things trashes an Area's children, which is destructive here; archive costs a column, a migration and filtered reads. The FK already says `SET NULL`; the weekly snapshot (FR-043) is the safety net. Not undoable in the app, said in the confirmation |
| D-K — Series and occurrences | The series template carries the area; on an occurrence the choice follows *Aplicar a* (*Toda a série* default, *Só esta ocorrência* detaches); closed rows keep the area they had | Re-stamp every closed row; make the area never detach | Same semantics as title, description and priority; `done` and `missed` rows are the permanent record (ADR-0006); bulk-writing history for a classification was rejected |
| D-L — Writes | An unknown area id is 400 on Task and series create and edit; `PATCH /api/tasks/:id` accepts `lifeAreaId`, so the pinned 400 test is replaced by the intended behaviour | Keep refusing it on the Task PATCH and route one-off assignments through a new endpoint | A one-off Task has no other way to change area; the guard comment says "unit 13 owns it". The test is updated, never weakened |
| D-M — Capture | While an area filter is active a captured Task takes that area (`none` → no area); with no filter, no area and no picker on the deck | Never assign from capture | Otherwise the Task vanishes from the very list the owner is looking at; the deck itself stays zero-friction (vision principle 5) |
| D-N — Filter | Single-choice *Área* group in the filter sheet (all, one area, *Sem área*), AND with the others, shown as an applied chip, not persisted across a cold start; API `lifeAreaId=<id>` or `none`, an unmatched id is an empty list | A quick chip per area; a multi-select; persisting the choice | Layout standard §2.3 fixes the quick row and forbids silent narrowing; one door per room (the owner cut the duplicate *Filtros…* chip). The API param composes with `q` for free |
| D-O — *Sem área* | A filter value plus a read-only count row on the *Áreas* screen; not a stored area and not a grouping axis on *Hoje* | Group by area inside the date groups | Area × date groups multiplies headers; the six date groups are the shipped, measured anatomy |
| D-P — Search and adherence | Search shows the area on rows but has no area control; *Aderência* is untouched | An area filter in search; an area on `SeriesAdherenceDto` | Unit 8's signal is "without choosing a filter first"; adherence is per series and its DTO and pure functions stay frozen. Both are cheap to reopen |
| D-Q — Row and sheet | The area name as text in the meta line of an open Task whenever set, also under its own filter (`done` and `missed` rows keep today's text); the sheet uses the existing single-choice `ChipGroup` | Hide the name under the filter; a native select | Everdo regressed by hiding the per-item cue under a filter; the chip group is the shipped pattern and the limit bounds it |
| D-R — Export, restore, migration | No schema or manifest change; `formatVersion` stays 1; chore C6 runs on a snapshot with real areas before the unit closes; no migration | Add columns now | Nothing in this unit needs a column; the roadmap lists unit 13 as a C6 trigger and `life_areas` has never been exercised by it |
| D-S — ADR | ADR-0015 records D-E, D-F, D-J and D-K, written with the owner's approval of this PRD; glossary, domain-model, FR-008 and the layout standard are amended in phase 4 | Write the ADR in phase 1 | The choices are non-obvious and owner-validated now; the amendments describe behaviour that exists only after the phases |
| D-T — Phases | Four phases, API-first and test-first (ADR-0008) | One large phase | Each phase leaves something observable: data, a screen, an assigned item, a filter |

## Research Summary

**Market Context**

Evidence is thin and partly anecdotal; gaps are listed rather than filled.

- Things: deleting an Area trashes its to-dos and projects rather than sending them to Inbox (scripting guide, not
  the UI help) — https://culturedcode.com/things/support/articles/4562654/
- Todoist: archiving is reversible and keeps tasks, comments and reminders; a project without a colour shows gray;
  what delete does to tasks is not documented; free plan caps active projects at 5, labels uncapped —
  https://todoist.com/help/articles/115005780689 and https://todoist.com/help/articles/usage-limits-in-todoist
- Apple Reminders: deleting a list moves its reminders to Recently Deleted for 30 days; colour and icon are
  choices — https://support.apple.com/en-gb/guide/reminders/remna83c9566/mac
- PARA: an Area that is no longer active is archived, not deleted — https://fortelabs.com/blog/para/
- OmniFocus users call single-container areas restrictive and use tags for multi-context items —
  https://discourse.omnigroup.com/t/whats-the-difference-between-areas-of-focus-and-tags/39211
- Everdo: hiding the per-item area marker under an area filter made area items indistinguishable from unassigned
  ones; the developers opened a ticket — https://forum.everdo.net/t/area-filter-and-tag-filter-in-inbox-confusing/2204
- WCAG 1.4.1 (Level A): colour cannot be the only visual means of conveying information —
  https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html
- **Gaps:** no source found on whether recurring occurrences inherit the container, on filter persistence across
  sessions, on chip row versus sidebar for a Today view, or on whether colour helps a small personal list; the
  delete semantics of TickTick, Google Tasks and Microsoft To Do were not confirmed. Decisions D-K and D-N on those
  points are judgment, not evidence.

**Technical Context**

- Schema: `src/worker/db/schema.ts:27-45` (`life_areas`, unique name, non-blank CHECK, no colour/icon/archive/order),
  `:102` and `:171` (nullable FKs, `ON DELETE SET NULL`), `:209` (`tasks_life_area_idx`); `recurrence_series` has no
  area index. Created in `migrations/0000_neat_the_fallen.sql`; `0001` and `0005` only rebuilt the tables.
- Wire: `src/shared/api.ts:35` (`TaskDto.lifeAreaId`), `:77-86` (`LifeAreaDto`, export only), `:211-218`, `:233-253`
  (`UpdateTaskInput`, `EDITABLE_TASK_FIELDS` without `lifeAreaId`), `:338`, `:355`, `:414` (series inputs);
  `src/worker/dto.ts:40`, `:110`.
- Routes: `src/worker/routes/tasks.ts:56-97` (pre-DB parameter validation), `:111-127` (AND of clauses, `q` last),
  `:181` (unvalidated create); `src/worker/routes/series.ts:149`, `:189`, `:203`, `:365-373`, `:508-515`;
  `src/worker/successor.ts:74`, `:112`.
- Client: `src/shared/task-filter.ts` (`TaskFilter`, `toQuery`, `activeCount`), `src/shared/series-edit.ts:345-372`
  (`planSeriesOccurrenceSave`, `TEMPLATE_TASK_FIELDS`), `src/shared/format.ts:132` (`taskMetaLine`),
  `src/app/components/FilterSheet.tsx`, `TaskSheet.tsx`, `CaptureDeck.tsx`, `SearchScreen.tsx:106`,
  `src/shared/app-route.ts`, `SettingsScreen.tsx`, `AdherenceEntryCard.tsx`, `src/shared/google-settings.ts` (the
  list-management precedent).
- Export and restore: `src/worker/db/export-manifest.ts:15-21`, `src/shared/export.ts:31-72`,
  `test/export.test.ts`, `test/export-completeness.test.ts`, `scripts/restore-drill.mjs` (inserts tables in
  snapshot order), `documentation/50-planning/roadmap.md` chore C6 (lists unit 13 as a trigger; `life_areas` has
  been empty in every snapshot so far).
- Tests that move: `test/task-update.test.ts:363` (pinned 400), `test/task-list-contract.test.ts`,
  `test/task-list-filters.test.ts`, `test/series.test.ts`, `test/series-edit.test.ts`, `test/export.test.ts`.
- Docs: `documentation/40-engineering/ui-layout-standard.md:29`, `:33`, `:66`; `docs/domain/areas/life-areas.md`;
  `documentation/30-architecture/domain-model.md:82-96`; `documentation/10-product/glossary.md:21`.

---

*Generated: 2026-10-11*
*Approved: 2026-10-11*
*Status: APPROVED*
