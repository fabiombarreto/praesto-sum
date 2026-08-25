# Today View and Filters

```
**Decision Gate**
- Active context: none (no .context.md in the repository)
- Activated criteria: planning; cross-cutting artifact (a PRD downstream stages consume); reuse of components (ChipGroup/Chip and Sheet get their second and third consumers); impact on shared UI (the Hoje screen every later unit plugs into); data contracts (the frozen Task read contract gains its reserved filter vocabulary); business rules for tasks (docs/domain/areas/tasks.md — FR-007, priority NULL semantics)
- Decisions found: ADR-0003, ADR-0004, ADR-0005, ADR-0008, ADR-0009, ADR-0010, ADR-0011, the unit-2 contract freeze, and the owner's scope round of 2026-08-23 —
  - Frozen Task read contract (unit 2, 2026-08-15) — ordering is produced by the API and must NOT be re-derived in a client; paging is `limit`-only with a hard cap of 500 and an invalid limit rejected, not clamped; adding a field or a filter is backward-compatible, renaming one is not; `from`, `to` and `priority` are RESERVED in `docs/api-reference.md` for this unit
  - ADR-0003 — one canonical copy in D1, no offline write queue: filtering is a read, and a filtered read still needs the network
  - ADR-0008 — `tdd: true`; the decidable half (the API filters, the partition, the chip→query mapping) is authored test-first, the React glue is verified by hand
  - ADR-0009 — visible copy in pt-BR; identifiers, keys, comments and tests stay English
  - ADR-0010 / ADR-0011 — tokens.css is machine truth; owned shadcn-style components over Base UI; native `<dialog>` for sheets
  - ADR-0004 / ADR-0005 — one installable PWA, React 19 SPA, one Worker, exact pins, no incidental dependency
  - Owner, 2026-08-23 (this PRD's scope round): groups in the client and filters on the API; chips *Abertas · Para hoje · Alta prioridade* + *Filtros…*; filters reset on a cold start; no search; the header count keeps its meaning; the two-pane desktop deferred with a trigger; no bulk *Reagendar para hoje*; `missed` rows untouched; grounding done inline without research subagents
- Applicable anti-patterns: hand-duplicated entity types; weakening tests to force green; Portuguese in artifacts (carve-out); version ranges; glossary synonym drift; offline write queue —
  - Hand-duplicated entity types — `TaskDto` stays the only Task type; the grouping and filter modules take and return `TaskDto`
  - Weakening tests to force green — the existing list-route tests are extended, never loosened; the no-filter case is asserted to be unchanged
  - Portuguese in artifacts — carve-out applies: only UI string values are pt-BR (group names, chip labels, sheet labels); module, function and test names stay English
  - Version ranges — no new dependency is added by this unit
  - Glossary synonym drift — overdue → *atrasada*, open → *aberta*, done → *concluída*, missed → *não concluída*, priority → *prioridade* (alta / normal / baixa)
  - Offline write queue — none; a filter change is a read that fails honestly behind the existing banner
- Applicable architectural rules: `src/shared` stays DOM-free, dependency-free and clock-free; types flow schema → dto → `src/shared/api.ts`; one Worker serves everything; tokens.css is the only style scale; one screen plus sheets, never stacked; UI verification stays manual —
  - `src/shared` is DOM-free and reads no clock: `groupTasks` and the filter mapping take `today` as an argument, exactly as `taskMetaLine` and `formatHeaderDate` already do
  - Ordering stays in SQL; the client partitions the ordered array and asserts the partition is stable
  - One screen plus sheets (layout standard §1/§3): the filter sheet is a second `<dialog>`, and two sheets are never open at once
  - UI verification stays manual (testing strategy); the browser-pane Tier A / Tier B checklist of guidelines §12.6 is the record
- Result: PROCEED
```

## Problem Statement

The owner opens Praesto several times a day and gets one flat list. The API
already answers "what is urgent" — overdue, then today, then future ascending,
then undated — but the screen throws that structure away: `TodayScreen` splits
the response into open and closed and renders one undifferentiated column
(`src/app/components/TodayScreen.tsx:84-85`). Answering "what is today?" means
reading every row and doing the date arithmetic in his head, and FR-007's other
half — filtering by status, dates and priority — does not exist at all, on
either side of the wire. The design pass gave the screen its anatomy and left
this content out by design: layout standard §6 lists unit 3 against "this
anatomy as is: groups, chip row, filter sheet".

## Evidence

- Roadmap unit 3's exit signal, unchanged since the table was written: *"The owner answers 'what's today?' without scrolling the whole list and without touching a filter"* (`documentation/50-planning/roadmap.md:56`).
- FR-007 is a **Must**, accepted: *"The owner can list Tasks and filter them by completion status, dates and priority"* (`documentation/20-requirements/functional-requirements.md:40`).
- The screen has no grouping today: `open` and `closed` are the only two buckets, and `closed` is rendered as the *Concluídas* section (`src/app/components/TodayScreen.tsx:84-85` and its list region).
- The API has no date or priority filter today: the list route validates only `status` and `limit` (`src/worker/routes/tasks.ts:41-57`).
- The names are already reserved for this unit, not free: *"`status` is implemented. Unit 3 will add `from`, `to` and `priority` — those names are reserved here so unit 3 extends this vocabulary rather than inventing a competing one"* (`docs/api-reference.md:38-41`).
- The four groups, their order, their counts and the collapse trap are already decided: *"**Atrasadas** first (collapsible…) → **Hoje** (never collapsible…) → **Próximas** (collapsed by default) → **Sem data** (collapsed by default)… counts stay visible when collapsed — the 'my tasks vanished' trap"* (`documentation/40-engineering/ui-layout-standard.md`, §2.5).
- The filtered empty state and its copy are already approved: *Nenhuma tarefa com esse filtro.* + *Limpar filtros* (`documentation/10-product/visual-identity.md`, microcopy table; layout standard §2.7).
- The primitives exist and are unused for this purpose: `ChipGroup`/`Chip` over Base UI with 48 px hit areas and a leading check (`src/app/components/ui/Chip.tsx`), and `Sheet` on a native `<dialog>` (`src/app/components/ui/Sheet.tsx`).
- **A rule that does not survive contact with the domain:** layout standard §2.3 offers *Com hora* as a quick-filter chip. A Task has no time of day — `deadline` and `scheduledDate` are calendar days (`YYYY-MM-DD`), enforced by `tasks_single_date_chk`; time-of-day arrives with Event in unit 14. The chip is replaced by *Para hoje* and §2.3 is amended in place, dated, per the maintenance map's own row for a UI rule that proves wrong when a screen is built.

## Proposed Solution

Split the work exactly where the frozen contract already draws the line. **The
API decides which Tasks and in what order:** the list route gains the three
reserved filter parameters (`from`, `to`, `priority`), applied in the `WHERE`
clause so the existing urgency ordering and the `limit` cap still operate over
the filtered set. **The client decides how the answer is chunked:** a pure
`groupTasks(tasks, today)` in `src/shared` partitions the API-ordered array into
*Atrasadas · Hoje · Próximas · Sem data* (plus the existing *Concluídas*)
without re-sorting anything — a stable partition, asserted by a test, so the
contract's most load-bearing guarantee is preserved by construction rather than
by good intentions. On top of that, the chip row and the filter sheet of the
layout standard drive **one** filter state (chips are shortcuts into the same
state the sheet edits, never a second parallel one), that state maps to the
query string through another pure module, and it resets on a cold start. The
alternative — grouping on the API — was rejected: it would put a presentation
concern into a contract eleven later units inherit, and the ordering it would
group by is already there.

## Key Hypothesis

We believe that grouping the API-ordered list into *Atrasadas · Hoje · Próximas
· Sem data*, with counts that stay visible when a group is collapsed, will let
the owner answer "what is today?" in the first screenful — before any filter is
touched — and that the FR-007 filters, kept one tap away in a chip row and a
sheet, will cover the narrower questions without competing with that first
answer.

We'll know we're right when, for a full week, the owner opens the app in the
morning and reads only the first two groups to know his day, and the filters
stay unused for the answer the groups already give.

## What We're NOT Building

- **Text search** — FR-040 is unit 8 `text-search`; not even the header search icon lands here (there would be nothing behind it).
- **Life Area filters** — FR-008 is unit 13; the area dot and the area chip of layout standard §6 wait for it.
- **A `missed` group** — nothing produces `missed` rows until unit 10 `missed-sweep`; `missed` Tasks keep today's behaviour (inside *Concluídas*, meta line *não concluída*). Unit 10/11 owns where they go.
- **The *Reagendar para hoje* header action** on *Atrasadas* (layout standard §2.5) — it is a bulk write with its own confirmation and undo semantics; deferred with a row in Open Questions.
- **The ≥ 840 px two-pane desktop** (layout standard §5) — deferred a second time, deliberately and with a trigger (see Open Questions); the 640 px column cap already ships, so the PC is simple, not broken.
- **Filter persistence across a cold start** — layout standard §2.3: a narrowing filter never survives a cold start silently. Group collapse state does persist; the filter does not.
- **A *Com hora* chip** — a Task carries no time of day (see Evidence).
- **Any paging change** — no cursor; `limit` keeps its behaviour and its 500 cap. The revisit trigger of the frozen contract is unchanged.
- **Client-side filtering as a network optimisation** — the filter is a read against the API like every other read; nothing is filtered out of a stale local copy.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| The owner answers "what's today?" without scrolling the whole list and without touching a filter | 7 consecutive days | The owner's own report, recorded in the roadmap's Delivery history when the unit ships (the roadmap's exit signal for unit 3) |
| Requests per screen load | exactly 1 `GET /api/tasks` | DevTools Network panel on *Hoje*, unfiltered and filtered |
| The API's ordering survives grouping | the four buckets concatenated equal the response's open Tasks in the same relative order, for every fixture | Automated test on `groupTasks` (AC-7) |
| Quality gate | `npm test` and `npm run check` green; test count not below the 313 of 2026-08-23; no test weakened | Run locally at the end of every phase |
| Production build against guidelines §11 | JS ≤ 170 KB gzip · CSS ≤ 30 KB gzip · precache ≤ 1 MB | `vite build` size report at the end of every phase |

## Acceptance Criteria (test scenarios)

Each criterion carries a tag: **[auto]** — authored test-first in Vitest (the
`worker` project for routes, plain modules for `src/shared`), per
`docs/context/methodology.md`; **[manual]** — verified in the browser pane or on
the device and recorded against the guidelines' review checklist, which is the
methodology's `EXISTING_COVERAGE_SUFFICIENT` path, not a gap; **[static]** —
read from the build output or a grep in the plan's validation commands.

**Dates in the route criteria are relative, and that is load-bearing.** The
list route reads the wall clock (`today = todayIn(new Date())`), so every
fixture date below is written as an offset from the server's own today and
must be derived at run time from `todayIn` — the `dayOffset()` discipline
`test/task-list-contract.test.ts:29-34` already established, so the suite
asserts the overdue/today/future boundary instead of a calendar it happened to
be written on. The opposite holds for AC-7: `groupTasks` takes `today` as an
argument and reads no clock, so a fixed date there is deterministic by
construction and must NOT be made relative.

- **AC-1 filter-from:** [auto] Given Tasks A (`deadline` = today - 3), B (`scheduledDate` = today + 1), C (`deadline` = today + 3) and D (no date), when `GET /api/tasks?from=<today+1>` is called, then the response carries exactly B then C (both future, ascending) and A and D are absent — `from` is inclusive and compares against `coalesce(deadline, scheduled_date)`, and a Task with no date is never inside a date range.
- **AC-2 filter-to:** [auto] Given the same four Tasks, when `GET /api/tasks?to=<today+1>` is called, then the response carries exactly A then B — A first because it is overdue and B is future, the urgency buckets unchanged — and C and D are absent.
- **AC-3 filter-range:** [auto] Given the same four Tasks, when `GET /api/tasks?from=<today+1>&to=<today+1>` is called, then exactly B comes back; and when `GET /api/tasks?from=<today+3>&to=<today-3>` is called (an inverted range), then the response is `200` with `{ tasks: [] }` — a well-formed request describing an empty interval is answered, never rejected.
- **AC-4 filter-date-validation:** [auto] Given `?from=2026-8-1`, `?to=2026-02-31` or `?from=ontem`, when the list route is called, then each answers `400` with a message naming the offending parameter (`from must be a calendar date (YYYY-MM-DD)`), through the same `isCalendarDate` gate the create route uses (`src/shared/api.ts:113`) — never a `500`, never silently ignored.
- **AC-5 filter-priority:** [auto] Given Tasks with `priority` `high`, `normal`, `low` and `null`, when `?priority=high` is called, then only the `high` Task returns; `?priority=low` returns only the `low` one; **`?priority=normal` returns BOTH the `normal` Task and the `null` one** (an unset priority means "not set" and sorts as normal — `docs/domain/areas/tasks.md:15`); and `?priority=urgent` answers `400` with `Unknown priority: urgent`.
- **AC-6 filters-compose:** [auto] Given at least three open `high` Tasks dated today or earlier plus other Tasks, when `GET /api/tasks?status=open&priority=high&to=<today>&limit=2` is called, then exactly two Tasks return and they are the FIRST TWO of the *ordered filtered* set (overdue before today) — filtering happens in the `WHERE` clause, before the ordering and before the limit; and when no filter parameter is supplied at all, the response is identical to the current contract (same rows, same order), asserted by the existing list tests passing unchanged.
- **AC-7 group-partition:** [auto] Given `groupTasks(tasks, "2026-08-23")` in `src/shared/task-groups.ts` (no DOM globals, no dependencies, no clock read — `today` is an argument), when it is called with a list in API order, then it returns `{ overdue, today, upcoming, undated, closed }` where an open Task lands in `overdue` when `deadline ?? scheduledDate < today`, in `today` when equal, in `upcoming` when greater and in `undated` when both are `null`, every Task whose `status !== "open"` lands in `closed` regardless of its dates, and `[...overdue, ...today, ...upcoming, ...undated]` equals the input's open Tasks in exactly the same relative order — the partition never re-sorts.
- **AC-8 group-headers:** [manual] Given a list holding all four kinds, when the screen renders, then the groups appear top to bottom as *Atrasadas → Hoje → Próximas → Sem data* with *Concluídas* below them, each group header is ≥ 40 px and carries its pt-BR name plus its count, the rows inside each group keep the order the API returned, and each row keeps the anatomy of layout standard §2.6 unchanged.
- **AC-9 group-collapse:** [manual] Given the group headers, when they are used, then *Atrasadas* is collapsible and expanded by default, *Hoje* has no collapse control at all, *Próximas* and *Sem data* are collapsed by default, every count stays visible while its group is collapsed, each group's state survives a reload (the existing `praesto.today.doneCollapsed` key keeps its name and meaning for *Concluídas*; the new groups get their own keys, so the owner's current preference is not migrated or lost), and a `localStorage` denial degrades to the default without throwing — the guarded read/write of `src/app/components/TodayScreen.tsx:42-56` reused, not re-invented.
- **AC-10 empty-groups-omitted:** [manual] Given a list with no overdue Tasks, when the screen renders, then no *Atrasadas* header appears at all — an empty group is omitted, never rendered as an empty region; and given zero Tasks with no filter active, the list region still shows *Nada para hoje. Bora capturar a primeira?* with the *Nova tarefa* CTA that focuses the capture field.
- **AC-11 header-count-and-badge:** [manual] Given the header, when the list renders, then the count reads *N restantes* over the open Tasks of the currently visible set (*nenhuma restante* at zero, *1 restante* at one), and a 48 px icon button with the accessible name *Filtros* sits to its right carrying a numeric badge equal to the number of active filter dimensions (status, priority, period) and no badge at all when none is active.
- **AC-12 chips-map-to-query:** [auto] Given `src/shared/task-filter.ts` (pure, `today` as an argument), when *Abertas*, *Para hoje* and *Alta prioridade* are toggled on an empty filter, then the state becomes `{ status: "open" }`, `{ to: today }` and `{ priority: "high" }` respectively; toggling the same chip again clears exactly its own dimension and nothing else; all three active produce ONE query string carrying `status=open&to=<today>&priority=high`; and an empty filter produces a query string with no filter parameter at all.
- **AC-13 chips-and-sheet-share-one-state:** [manual] Given *Alta prioridade* pressed in the chip row, when the filter sheet is opened, then its *Prioridade* group shows *Alta* selected; and when *Baixa* is chosen there and the sheet closes, then the *Alta prioridade* chip is no longer pressed and the list shows low-priority Tasks — the chips are shortcuts into the same filter state the sheet edits, never a second parallel state.
- **AC-14 filtered-empty:** [manual] Given at least one active filter and a response with zero Tasks, when the list region renders, then it shows *Nenhuma tarefa com esse filtro.* with a *Limpar filtros* action, and activating it clears every dimension, drops the badge and re-renders the full grouped list.
- **AC-15 filter-sheet:** [manual, device] Given the *Filtros…* chip or the header filter icon, when it is activated, then a native `<dialog>` opens with `showModal()` carrying *Status*, *Prioridade* and *Período* (two native `<input type="date">`, *De* and *Até*), it light-dismisses (`closedby="any"` — the one surface layout standard §3 allows it on, never the editor), `Esc` and the Android back gesture close it, focus returns to the opener, a change applies immediately with no *Aplicar* button, and it is never open at the same time as the detail sheet.
- **AC-16 cold-start-resets-filters:** [manual] Given every filter dimension active, when the app is reloaded (a cold start), then no chip is pressed, the header carries no badge, and the first `GET /api/tasks` carries no filter parameter — a narrowing filter never survives a cold start (layout standard §2.3) — while the group collapse state, by contrast, does survive.
- **AC-17 checklist-and-gates:** [static + artifact] Given the end of each phase, when its record under `PRPs/reports/today-view-and-filters/phase-N/` is read, then it carries the guidelines' Tier A ✔/✘ result for the change and, for the phases that touch the screen, the Tier B result (contrast pairs, simulated states, 375 px and 1280 px, the `vite build` report), with screenshots filed or the written reason none exists, and `npm test` + `npm run check` green.

## Open Questions

- [ ] **The ≥ 840 px two-pane desktop** (layout standard §5) — deferred by the owner on 2026-08-23, for the second time and now with a named trigger: revisit when unit 4 `google-calendar-read` puts the agenda stack on the same screen, or earlier if the owner reports the PC feeling cramped. Recorded so a third silent deferral is not possible.
- [ ] **The *Reagendar para hoje* header action** on *Atrasadas* — out of scope here; it needs its own decision on the write shape (N `PATCH`es versus a bulk route) and on undo. Which unit adopts it is undecided.
- [ ] **Where `missed` rows group** once unit 10 produces them — inside *Concluídas* (today's behaviour, kept) or a group of their own. Unit 10/11 decides with real data.
- [x] **Two doors to one sheet** — **resolved 2026-08-24 by the owner, on seeing the built row rather than after the week of use this question proposed.** The trailing *Filtros…* chip is cut; the header's filter button survives and keeps the badge, exactly as this question said it should. Layout standard §2.3 amended in place, dated, with a History row; the microcopy table records the retired label.
- [ ] `TBD - needs validation`: whether *Para hoje* earns its place in the chip row once the groups exist, since *Atrasadas* + *Hoje* already answer the same question visually.

---

## Users & Context

**Primary User**
- **Who:** The owner — the single user (CON-002) — on an installed PWA on his Android phone (one thumb, morning, sunlight and night) and on his Windows PC (CON-007).
- **Current behavior:** Opens *Hoje* and reads the whole list top to bottom, doing the date arithmetic himself; there is no way to narrow it.
- **Trigger:** The morning cold open, and every re-open through the day after something is captured or completed.
- **Success state:** The first screenful answers the day — what is late, what is due today, and how many of each. Everything else is collapsed or one tap away.

**Job to Be Done**
When I open the assistant in the morning, I want the day's real work separated
from everything else, so I can start on it without reading the whole list or
building a filter first.

**Non-Users**
Nobody else. There is exactly one user (CON-002); no sharing, no roles, no
multi-tenancy — the filters are personal, transient state, not a saved-view
feature.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | The four groups in the fixed order, with counts that stay visible when collapsed | This alone meets the unit's exit signal — the question is answered without touching a filter |
| Must | `from`, `to` and `priority` on `GET /api/tasks`, composing with `status` and `limit` | FR-007's other half, and the vocabulary the frozen contract reserved for this unit |
| Must | Collapse state per group, persisted, degrading safely when storage is denied | Layout standard §2.5; the "my tasks vanished" trap is a data-trust problem, not a nicety |
| Must | The chip row (*Abertas · Para hoje · Alta prioridade* + *Filtros…*) and the filter sheet | Layout standard §2.3 and §3; the sheet carries the full FR-007 vocabulary the chips do not |
| Must | Filtered empty state and the filter badge | Layout standard §2.7 and §2.1; a narrowing filter must always name itself |
| Must | Filters reset on a cold start | Layout standard §2.3, explicitly |
| Should | `priority=normal` matching unset priorities | The domain rule is already written down; without it the filter lies about most of the real table |
| Should | Empty groups omitted rather than rendered empty | Design principle 4; four empty headers on a quiet day is noise |
| Could | Remembering the sheet's date range within the session (never across a cold start) | Convenience only; drop it if the phase runs long |
| Won't | Search, Life Area filters, a `missed` group, bulk *Reagendar para hoje*, the two-pane desktop, filter persistence across cold starts, a *Com hora* chip | Each owned by another unit or explicitly refused above |

### Microcopy added by this unit

Strings already in the approved table of
`documentation/10-product/visual-identity.md` are used verbatim (*Nenhuma
tarefa com esse filtro.* / *Limpar filtros*, *Nada para hoje.*, *Concluídas*,
the header count, the row meta line). The rows below are new, approved by the
owner on 2026-08-23 in this PRD's scope round, and are added to the identity
doc's table **before** they enter code — in the phase that first renders them.

| Where | Copy |
|---|---|
| Group headers | **Atrasadas** · **Hoje** · **Próximas** · **Sem data** — each followed by its count |
| Quick-filter chips | *Abertas* · *Para hoje* · *Alta prioridade* · *Filtros…* |
| Filter icon (accessible name) | *Filtros* · with filters active, *Filtros (N ativos)* |
| Filter sheet | title *Filtros* · labels *Status · Prioridade · Período* · status chips *Abertas · Concluídas · Não concluídas* · priority chips *Alta · Normal · Baixa* · date labels *De* / *Até* · *Limpar filtros* · close button *Fechar* |

### MVP Scope

Phases 1 and 2 alone satisfy the unit's exit signal: the API keeps its promise
and the screen answers the day without a filter being touched. Phase 3
completes FR-007. If the ~1 h/day budget (CON-003) runs short, phase 3 is the
one that can slip a week without the unit being useless — the reverse is not
true.

### User Flow

Cold open → the header shows *Hoje*, the date and *N restantes* → the list
region shows *Atrasadas* (expanded, with its count) then *Hoje* (never
collapsible), with *Próximas* and *Sem data* collapsed below and *Concluídas*
last. The day is answered in that first screenful. Narrowing is one tap on a
chip (or two into the sheet), always reversible by *Limpar filtros*, and gone on
the next cold start.

---

## Technical Approach

**Feasibility:** HIGH — no new dependency, no migration, no new screen. The
route already computes `coalesce(deadline, scheduled_date)` and `today`; the
chip and sheet primitives already exist; the pure-module-plus-glue pattern is
the one this project has used four times.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first
ordering — the test pair (test-writer/test-reviewer) produces the initial test
suite from the Acceptance Criteria above, before the Implementer runs.

The split follows the methodology's own rule: the decidable half (the three
route filters, `groupTasks`, the chip→query mapping) is authored test-first in
Vitest; the React glue (which group is collapsed, which chip is pressed, the
sheet's open state) is verified by hand in the browser pane and on the device,
recorded per the review checklist.

### Architecture Notes

- **Grouping is a partition, never a sort.** `groupTasks` walks the array once and appends to four buckets in encounter order; the ordering guarantee of the frozen contract is preserved by construction, and AC-7 asserts the concatenation identity so a later refactor cannot quietly break it.
- **Filters live in SQL, next to the ordering.** `from`/`to` compare against the same `coalesce(deadline, scheduled_date)` expression the ordering already uses (`src/worker/routes/tasks.ts:60`), added to the `WHERE` clause so ordering-then-limit still operates over the filtered set. Undated rows fall out of any date range because a `NULL` comparison is never true — that is the wanted semantic, and it is asserted (AC-1) rather than inherited by accident.
- **`priority=normal` must also match `NULL`.** `NULL` means "not set" and sorts as normal (`src/shared/api.ts:33`, `docs/domain/areas/tasks.md:15`). A naive `eq(tasks.priority, "normal")` would hide most of the real table.
- **Validation reuses the existing gates** — `isTaskStatus`, `isTaskPriority`, `isCalendarDate` (`src/shared/api.ts:102-117`) — so the filter vocabulary rejects at the boundary with a `400`, consistent with `limit`'s reject-don't-clamp rule.
- **Two pure modules, both `today`-as-argument:** `src/shared/task-groups.ts` (the partition) and `src/shared/task-filter.ts` (the filter state, `toQuery`, `activeCount`, chip toggling). They read no clock and touch no DOM, exactly like `src/shared/format.ts` and `src/shared/dates.ts`. The client's `today` comes from `todayIn(new Date())` in `PRAESTO_TIMEZONE` — the same zone the route uses — so a `to=<today>` chip and the server agree on which day it is.
- **`listTasks` grows a filter argument.** `src/app/api.ts:90` currently takes `(status?, limit?)`; it takes the filter object instead and builds the query string from `toQuery`. It has exactly one caller today, so the signature change is contained.
- **`Sheet` gains an opt-in light dismiss.** The component deliberately leaves `closedby` at its `showModal()` default because it hosts an editor (`src/app/components/ui/Sheet.tsx:14-15`). The filter sheet is the one surface layout standard §3 allows light dismiss on, so `Sheet` takes an optional prop and the detail sheet's behaviour stays unchanged.
- **Never stack sheets.** Opening the filter sheet while the detail is open is unreachable by construction — the chip row is not rendered under an open dialog, and both sheets are owned by the same screen component.
- **One request per state change.** A chip toggle produces one `GET /api/tasks`; the previous list stays on screen and the busy indicator obeys the 300–500 ms delay of guidelines §8.
- **Performance:** the list keeps `content-visibility: auto` (§12.4); grouping adds four headers, not a second pass over the data.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| One network round trip per chip tap feels slow, or fails offline | M | The previous list stays rendered; the indicator waits 300–500 ms (§8); offline, the existing banner already says reads are all that work |
| A narrowing filter reads as lost data | M | Counts stay visible when collapsed, the header badge names how many dimensions are active, the filtered empty state names the cause and offers *Limpar filtros*, and the state resets on a cold start |
| `from`/`to` silently dropping undated Tasks | M | Specified in AC-1 and asserted by a test, not left to SQL `NULL` semantics discovered later |
| `localStorage` denied breaks a collapse toggle | L | The guarded read/write already shipped for *Concluídas* is reused verbatim |
| The group set drifts from layout standard §2.5 during implementation | L | The order, the collapse defaults and the count rule are in AC-8/AC-9 verbatim; any real divergence amends the standard in place, dated, per the maintenance map |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | List filters on the API | `from`, `to` and `priority` on `GET /api/tasks`, validated at the boundary, applied in the `WHERE` clause before ordering and `limit`; `priority=normal` matches unset; the no-filter response proved unchanged; `docs/api-reference.md` moved from "reserved" to "implemented" | complete | - | - | PRPs/plans/today-view-and-filters-phase-1-list-filters-on-the-api.plan.md |
| 2 | Grouping and the grouped list | `src/shared/task-groups.ts` authored test-first, then the four groups on screen with counts, collapse defaults and per-group persistence, empty groups omitted, *Concluídas* unchanged. The unit's exit signal is met here | complete | no | 1 | PRPs/plans/today-view-and-filters-phase-2-grouping-and-the-grouped-list.plan.md |
| 3 | Quick filters and the filter sheet | `src/shared/task-filter.ts` authored test-first, then the chip row, the filter sheet on a light-dismissable `<dialog>`, the header filter icon with its badge, the filtered empty state and the cold-start reset | complete | no | 2 | PRPs/plans/today-view-and-filters-phase-3-quick-filters-and-the-filter-sheet.plan.md |

#### Phase-status lifecycle

This table IS relay's canonical phase-state machine (`docs/decisions.md`,
2026-05-04) — there is no separate state file. Every row starts at `pending`
and advances through exactly five states, in order, never skipping backwards:

| Status | Meaning | Written by |
|--------|---------|------------|
| `pending` | No plan yet. The only state from which a row is actionable. | Authored here |
| `in-progress` | A DRAFT plan exists and the `PRP Plan` cell points at it. | `plan-writer` Step 5.1 back-fill |
| `implemented` | Code written and code-review APPROVED; tests not yet settled. | `/relay-implement` D8 Mutation c |
| `tested` | Test suite ran GREEN *and* post-green review confirmed the green was not obtained by weakening tests. | `/relay-execute` Step A.5.3 |
| `complete` | The orchestrator drove the phase end to end. | `/relay-execute` Step A.6.0 |

**No row here will read `complete`, and that is correct.** This unit is driven
phase by phase with the individual relay commands, not by `/relay-execute`,
precisely because the browser-pane verification has to sit *between* implement
and test — a step the orchestrator has no place for. A hand-invoked run
legitimately stops at `tested`; the evidence `complete` would have stood for is
filed per phase under `PRPs/reports/today-view-and-filters/`. This is the same
path the `ui-design-pass` PRD took and recorded.

### Phase Details

**Phase 1: List filters on the API**
- **Goal:** The contract's reserved filter vocabulary exists, is tested, and composes with everything already frozen.
- **Scope:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6. `src/worker/routes/tasks.ts` (the list handler only); the validators reused from `src/shared/api.ts`; `docs/api-reference.md` updated in the same session (the "Filter vocabulary" paragraph and the Implemented row), plus the frozen-contract section of `documentation/30-architecture/architecture-overview.md` if its wording needs to follow.
- **Success signal:** The new route tests are RED for the right reason before the implementation and GREEN after; the pre-existing list tests pass **unchanged**, which is what proves the no-filter contract did not move; `npm run check` green.

**Phase 2: Grouping and the grouped list**
- **Goal:** The screen answers "what is today?" in its first screenful, without a filter being touched — the unit's exit signal.
- **Scope:** AC-7, AC-8, AC-9, AC-10, and AC-17 for this phase. `src/shared/task-groups.ts` authored test-first; `TodayScreen` renders the four groups plus *Concluídas*; a group-header component under `src/app/components/`; the collapse persistence extended per group with the existing guarded helpers; the new group-name microcopy added to `documentation/10-product/visual-identity.md` before it enters code.
- **Success signal:** Tier A ✔ on the change and Tier B ✔ for *Hoje* (375 px and 1280 px, contrast pairs recorded, empty/offline states simulated) filed under `PRPs/reports/today-view-and-filters/phase-2/`; the four buckets proved to be a stable partition by test; `npm test` and `npm run check` green.

**Phase 3: Quick filters and the filter sheet**
- **Goal:** FR-007's filter half is reachable in one tap and never lies about what it is hiding.
- **Scope:** AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, and AC-17 for this phase. `src/shared/task-filter.ts` authored test-first; the chip row over the existing `ChipGroup`/`Chip`; the filter sheet reusing `Sheet` with the new opt-in light dismiss; the header filter icon with its badge; the filtered empty state; `listTasks` taking the filter; the chip and sheet microcopy added to the identity table first; layout standard §2.3 amended in place (dated) to replace *Com hora* with *Para hoje*, with a History row.
- **Success signal:** Tier A ✔ and Tier B ✔ for the sheet and the chip row, the back gesture verified on the Android device, the cold-start reset verified by a reload, and the filtered empty state read against the approved copy; `npm test` and `npm run check` green.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Where grouping happens | In the client, as a pure stable partition over the API-ordered array | Group on the API (a `group` field or a grouped payload); group inline in the component | The frozen contract forbids re-deriving *order* in a client — a partition does not re-order — and it keeps a presentation concern out of a contract eleven units inherit. A pure module is also the only half of this that the existing test tiers can cover |
| Where filtering happens | On the API, under the reserved `from` / `to` / `priority` names | Filter the already-loaded array in the client | `docs/api-reference.md` reserved exactly these names for this unit; the roadmap's delivery discipline is API-first; and the worker tier is the only real automated tier this project has |
| Quick-filter chips in the MVP | *Abertas · Para hoje · Alta prioridade* + *Filtros…* | The layout standard's literal *Abertas · Alta prioridade · Com hora*; two chips only | *Com hora* is not expressible for a Task (calendar days, no time of day); *Para hoje* replaces it and answers the unit's own question. The standard is amended in place, dated |
| Filter persistence | Session only — every dimension resets on a cold start | Persist like the collapse state, relying on the badge to disclose it | Layout standard §2.3: a narrowing filter never survives a cold start silently. The badge is a disclosure, not a licence |
| Group collapse persistence | Persisted per group, with the existing `praesto.today.doneCollapsed` key kept as is | One combined key; no persistence at all | Layout standard §2.5 requires it; keeping the existing key avoids a migration over the owner's real preference |
| Header count | Unchanged in meaning: *N restantes* over the visible open set, plus a badge on the filter icon | Per-group counts in the header; a ratio or a progress bar | §2.1 already puts the honest mirror in the group counts and forbids a progress bar; two counting systems in one header is the element that does not pay rent |
| Search | Out — not even the header icon | Ship the icon now, wire it in unit 8 | FR-040 is unit 8; an icon with nothing behind it is a promise the screen cannot keep |
| Bulk *Reagendar para hoje* | Out, recorded as an Open Question | Ship it with the *Atrasadas* group as the standard sketches | It is a bulk write with its own confirmation and undo design; alone it would consume the unit's 4-day floor |
| `missed` Tasks | Untouched — they stay in *Concluídas* with the *não concluída* meta line | Give them their own group now | Nothing produces `missed` rows until unit 10; a group with no data is a guess, and unit 10/11 will have the real shape |
| ≥ 840 px two-pane desktop | Deferred again — with a named trigger (unit 4, or the owner reporting the PC feels cramped) | Build it in this unit; defer it silently again | The exit signal is a phone-shaped question and the 640 px cap already ships. The failure mode to avoid was an unrecorded third deferral, not the deferral itself |
| Research grounding | Done inline in this session; no research subagent dispatched | Dispatch `research-web` + `research-codebase` per the Writer protocol | The owner's standing instruction in this session is that no agent runs without an explicit request. The codebase grounding was done by direct reads (cited below); the market half is inherited from the A3 research that produced the layout standard, and the gap is declared rather than fabricated |

---

## Research Summary

**Market Context**

Declared gap, not a silent one: the `research-web` subagent was **not**
dispatched (the owner's standing instruction for this session). The market
question this unit would have asked — how single-user task apps present "today"
— was already researched and settled inside owner-validated documents, so the
context is inherited rather than absent: layout standard §2.5's group set, order
and collapse defaults come from activity A3's three-lens research over Things,
Reminders, Google Tasks and Microsoft To Do
(`PRPs/reports/layout-standard/01-research-evidence.md`), which is also the
source of "no major app shows undated items on Today" and of the "my tasks
vanished" collapse trap. Nothing in this PRD rests on an un-sourced market
claim.

**Technical Context**

Gathered by direct reads of the repository in this session:

- `src/worker/routes/tasks.ts:41-77` — the list handler: `status` validated with `isTaskStatus`, `limit` rejected-not-clamped against `MAX_TASK_LIMIT`, `today = todayIn(new Date())`, `dueDate = coalesce(deadline, scheduled_date)`, `urgencyBucket` as a SQL `CASE`, and `.orderBy(...).limit(...)` — the ordering is already in the query, before the limit, which is exactly where the new `WHERE` clauses must sit.
- `src/shared/api.ts:102-117` — `isTaskStatus`, `isTaskPriority` and `isCalendarDate` already exist and are the gates the new parameters reuse; `MAX_TASK_LIMIT` and the `priority: null` semantics (`:33`) are declared here.
- `src/app/components/TodayScreen.tsx:84-85` — the only grouping today is `open` / `closed`; the list region below renders `closed` as the *Concluídas* section with the chevron-and-count pattern the new group headers mirror.
- `src/app/components/TodayScreen.tsx:40-56` — `DONE_COLLAPSED_KEY` plus the guarded `readDoneCollapsed` / `writeDoneCollapsed` pair: the exact degradation behaviour AC-9 asks the new per-group keys to reuse.
- `src/app/components/TodayScreen.tsx:99-108` — `refresh()` calls `listTasks()` with no arguments and is already re-run on `visibilitychange`, on reconnect and after every mutation; a filter change is one more caller of the same path.
- `src/app/api.ts:90-98` — `listTasks(status?, limit?)` builds its query with `URLSearchParams`; one caller, so growing it into a filter object is contained.
- `src/app/components/ui/Chip.tsx:11-45` — `ChipGroup` (Base UI `ToggleGroup`, `multiple`, horizontal scroll, `gap-2`) and `Chip` (48 px min height, pill, pressed state by fill + weight + a leading check, never colour alone) already satisfy §2.3's chip requirements.
- `src/app/components/ui/Sheet.tsx:14-15, 54, 68-80` — native `<dialog>` with `showModal()`, `closedby` deliberately left at `closerequest` for the editor, and both `close` and `cancel` mirrored into state; the filter sheet needs the opt-in light dismiss without disturbing that.
- `src/shared/format.ts:121-155` and `src/shared/dates.ts:30-37` — `taskMetaLine(task, today)` already renders *atrasada · venceu …* per row and `todayIn(now, timeZone)` already produces the local day in `PRAESTO_TIMEZONE`; both take their time input as an argument, which is the shape the two new pure modules follow.
- `docs/api-reference.md:38-41` — the reserved filter vocabulary, verbatim, and the paging revisit trigger this unit does not touch.

---

*Generated: 2026-08-23*
*Approved: 2026-08-23*
*Status: APPROVED*
