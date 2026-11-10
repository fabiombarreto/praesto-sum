# Feature: The range function and the day (Phase 3 of events-and-day-view)

```
**Decision Gate**
- Active context: none
- Activated criteria: shared UI (a new route, a new screen, a changed Agenda region and a changed header on the owner's daily screen); a pure range function consumed by two screens now and by unit 16 later; domain rules for events (the Event joins the day) and tasks (dated open Tasks join the day view); an exhaustive-switch change in a shared bucketing function; a layout-standard amendment; no schema, migration, endpoint, DTO or export change
- Decisions found:
  - ADR-0016 / PRD D-J: `itemsInRange(sources, { from, to })` is THE one pure range function for local Events, Google Events and dated Tasks; Hoje's Agenda and the new `/day/AAAA-MM-DD` route call it; unit 16 reuses it with a week range.
  - ADR-0007: Google rows stay read-only; a Google failure is a short or unknown day, never a free one (unit 4's explicit-notice rule is reused, not reinvented).
  - ADR-0009: visible copy is pt-BR as string VALUES; identifiers, comments and tests stay English. Every new visible string below is quoted from the PRD or from an existing owner-approved string; none is invented.
  - ADR-0008 and `docs/context/methodology.md`: test-first for `src/shared`; React components stay manually verified, so the decidable logic is extracted and tested and only glue is verified in the browser pane and on the device.
  - ADR-0010 / ADR-0011: tokens only, owned components under `src/app/components/ui/`, no new token or colour.
  - ADR-0003: one Worker, no offline write queue; the day view reads over the network and surfaces failure inline.
  - PRD D-K and D-Q: Hoje keeps showing today only and the header date opens `/day`; the *Com hora* chip stays withdrawn (its amendment is phase 5).
  - Unit 4 owner decisions of 2026-08-28/29 (recorded in `PRPs/plans/completed/google-calendar-read-phase-4-the-day-whole.plan.md`): the Agenda group shows TODAY only, an untitled event reads *(sem título)*, Task filters do not apply to it, a Google row opens Google Calendar.
  - [2026-08-29] an APPROVED PRD's phase table may only grow with a dated amendment note: this plan adds no row and moves no work between phases.
- Applicable anti-patterns:
  - Hand-duplicated entity types: the day items WRAP `EventDto`, `CalendarEventDto` and `TaskDto` and never copy their fields.
  - Weakening tests to force green: `test/day-groups.test.ts`, `test/day-item.test.ts`, `test/day-item-event.test.ts`, `test/agenda.test.ts`, `test/task-groups.test.ts` and the existing assertions of `test/app-route.test.ts` stay unmodified.
  - Portuguese in artifacts: only string values are Portuguese; `Event` in code and docs, *Compromisso* only as pt-BR copy (glossary synonym drift).
  - Mirroring Tasks, Reminders or Life Areas to Google: Tasks join the day view as rows but nothing here writes to Google.
  - Offline write queue: none; a write on `/day` (completing a Task) waits for the server and fails inline.
  - Editing accepted ADRs: none is touched.
- Applicable architectural rules:
  - `src/shared/` carries no DOM globals, no Worker globals and no clock reads; `today` and every day are arguments.
  - Types flow schema, `dto.ts`, `src/shared/api.ts`: this phase adds no DTO and no endpoint.
  - `src/shared/dates.ts`, `src/shared/recurrence.ts` and `src/shared/adherence.ts` stay byte-identical to the merge base `4231ee8`.
  - The cron (`scheduled()`) and every `/api/*` route are untouched; every existing route still sits behind the bearer gate.
  - Every change under `src/app/` runs the `ui-ux-guidelines.md` review checklist and records the result under `PRPs/reports/events-and-day-view/phase-3/`.
  - Phase boundary: the Compromisso sheet, create/edit/delete, *Novo compromisso*, the *Compromissos* search group and offline write states are phase 4; the documentation sync other than the layout-standard amendment, the release and the device proof are phase 5.
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/events-and-day-view.prd.md` — Implementation Phases row 3: "The range function and the day" — Goal: one function feeds the day from three sources, and the owner can open any date — Success signal: AC-22 and AC-26 green; AC-23, AC-24 and AC-25 recorded; the checklist ✔/✘ filed.

## Summary

Phases 1 and 2 gave the owner's commitments a validated, stored, exported shape and an API, but no screen shows them. This phase adds the one pure range function `itemsInRange(sources, { from, to })` that turns local Events, Google Events and open dated Tasks into per-day items with no branch on how many sources it received; widens the day item with a `local` variant and rewrites the Task-oriented bucketing as an exhaustive switch so an event can never fall into `overdue`, `done` or `missed`; makes `agendaForToday` a thin caller of the new function; adds the `day/AAAA-MM-DD` route; and builds `DayScreen` (all-day items first, timed commitments with start and end, open Tasks of that day last, ‹ › stepping with real history entries, a *Hoje* control, *Nada neste dia.*, the unit-4 degraded-Google states). *Hoje*'s *Agenda* now lists local commitments beside Google's (counted together, solid rows, no checkbox, inert until phase 4 supplies the sheet), and the date in *Hoje*'s header becomes the door to `/day`. All decidable logic lands in `src/shared` and is tested first; the React glue is verified in the browser pane and recorded with the mandatory UI/UX checklist.

## User Story

```
As the owner of Praesto Sum
I want to open any date and see that day's commitments from Praesto and Google together with the Tasks dated that day, and see today's commitments in Hoje's Agenda
So that I can plan around a commitment without opening Google Calendar, and never mistake a failed fetch for a free day
```

## Problem Statement

The Event exists in D1 and behind `/api/events`, but nothing displays it. *Hoje* feeds the range function one source (Tasks) and shows Google through a separate `agendaForToday` path (`src/app/components/TodayScreen.tsx:296-301`, `:920`); `collectDayItems` groups Tasks relative to today and takes no `from`/`to`, so unit 16's "same range function" does not exist yet; a commitment dated next Tuesday would be fetched and invisible; and FR-023's "a given day" has no screen. Without this phase the commitments of phases 1 and 2 stay data the owner cannot see.

## Solution Statement

Add `src/shared/day-range.ts` (`itemsInRange`) as the single range function over `DayItemSource` lists, built on a `local` day-item variant and one adapter (`dayItemPlacement`) that normalises the seconds of `EventDto` and the milliseconds of `CalendarEventDto`; keep `collectDayItems` identical for Task-only input by making `bucketOf` an exhaustive switch; thin out `agendaForToday`; add the `day` route and `DayScreen`; feed *Hoje*'s Agenda from the same function through a new `agendaItemsForToday`; and extract the day screen's decisions (heading, stepping, *Hoje* control, time labels, section split, request paths, the Agenda notice rule) into tested pure modules. The Task-opening path reuses the existing `/tasks/<id>` deep link, so no second Task sheet is wired. This route was chosen over enriching only the Agenda because a future commitment would otherwise stay invisible until its day.

## Metadata

| Key | Value |
|---|---|
| Type | Feature (shared pure module + UI route) |
| Complexity | High — the largest phase of the unit: one pure function with a seconds/milliseconds seam, a widened union consumed by two screens, a new route, a new screen with three asynchronous sources, and a change to the owner's daily screen |
| Systems Affected | `src/shared/` (day-item, day-groups, day-range, agenda, app-route, day-view, format), `src/app/` (DayScreen, LocalEventRow, EventRow, TodayHeader, TodayScreen, SearchScreen, App, api client), `documentation/40-engineering/ui-layout-standard.md`, `PRPs/reports/events-and-day-view/phase-3/` |
| Dependencies | Phase 2 (`complete`): `GET /api/events?from&to` (at most 62 days), `EventDto` in epoch seconds, optional `from`/`to` (at most 31 days) on `GET /api/google/events`; phase 1: `isValidLocalDay`, `shiftLocalDay`, `displayEndDay` in `src/shared/events.ts` |
| Estimated Tasks | 14 |
| phase_type | feature |
| Source PRD line ref | `PRPs/prds/events-and-day-view.prd.md:212` (Implementation Phases row 3); Phase Details `:228-231`; AC-22..AC-26 at `:91-95` |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/events-and-day-view.prd.md` | 91-95, 182, 212, 228-231, 258-259, 265 | AC-22..AC-26, the range-function architecture note, row 3 and its Phase Details, decisions D-J, D-K and D-Q |
| P0 | `src/shared/day-groups.ts` | 31-64, 119-158 | `DayItemGroups`, `DayItemSource`, the if-ladder `bucketOf` to rewrite and `collectDayItems`, whose Task-only behaviour must not move |
| P0 | `src/shared/day-item.ts` | 26-119 | `DaySource`, `DayItemBase`, the two existing variants, `dayItemFromTask`, `assertNeverDaySource`, `dayItemFromEvent` (the Google day rule the new placement must agree with) |
| P0 | `src/shared/agenda.ts` | 36-66 | `localDayOf`, `startsAt` and `agendaForToday`, to become a thin caller |
| P0 | `test/agenda.test.ts` | 56-190 | The suite `agendaForToday` must keep passing unmodified; the tie case at `:150-159` pins ARRIVAL order, which is why `itemsInRange` ties are stable and not id-ordered |
| P0 | `test/day-groups.test.ts` | 29-71, 225-243 | The factories and the order-preserving split test the new range test mirrors; must stay unmodified |
| P0 | `src/shared/app-route.ts` | 25-78 | `AppRoute`, `taskRouteOf`/`taskIdFromRoute`, `routeFromPath`, `pathOf` |
| P0 | `test/app-route.test.ts` | 159-219 | The Task-route cases the day-route cases follow (trailing slash, bare path, extra segment, round trip) |
| P0 | `src/shared/events.ts` | 165-199 | `isValidLocalDay`, `shiftLocalDay`, `displayEndDay` (inclusive last day of an exclusive all-day end) |
| P0 | `src/shared/api.ts` | 195-284 | `EventMoment`, `CalendarEventDto` (milliseconds) and `EventDto` (seconds): the seam `dayItemPlacement` closes |
| P0 | `src/app/components/TodayScreen.tsx` | 118-142, 182-183, 286-351, 879-1009 | `AgendaState` and the Agenda copy to move, the isolated Google atoms, `refreshEvents`, the `renderDayItems` switch, the Agenda region and the banner slot |
| P0 | `src/app/components/EventRow.tsx` | 1-87 | The Google row the local row sits beside, and the optional `timeLabel` to add |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 40-45, 75-92, 93-104, 105-121, 146-168 | §3 targets, §8 states, §9 copy, §10 accessibility and the review checklist this phase must run and record |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 27-37, 51-52, 55-66, 68-72 | §2.1 header, §2.4 Agenda stack, §5 keyboard, §6 table and the History format to amend |
| P1 | `src/app/components/TodayHeader.tsx` | 1-72 | The date `<span>` that becomes the door to `/day` |
| P1 | `src/app/App.tsx` | 77-129 | The route chain, `navigate`/`back`, and how `TodayScreen` receives its callbacks |
| P1 | `src/app/hooks/useRoute.ts` | 34-93 | `navigate` always pushes; `back` pops only entries the app pushed |
| P1 | `src/app/components/AdherenceScreen.tsx` | 56-179 | The route-screen shell DayScreen copies (grid, header with *Voltar*, `Esc`, banner slot, inline failure) |
| P1 | `src/app/components/SearchScreen.tsx` | 222-253, 349-383 | The server-first complete/reopen/rename handlers and the second `renderDayItems` switch |
| P1 | `src/app/components/TaskRow.tsx` | 14-148 | The Task row `DayScreen` reuses unchanged |
| P1 | `src/shared/format.ts` | 39-57, 208-231 | `ALL_DAY_LABEL` (to export) and `formatEventTime`, whose output the Google time label must reproduce |
| P1 | `src/shared/google-failure-copy.ts` | 36-50 | `googleFailureMessage(reason)`, the unit-4 degraded copy reused on `/day` |
| P1 | `src/worker/routes/tasks.ts` | 29-62, 128-151 | `status=open&from=D&to=D` selects open Tasks whose `coalesce(deadline, scheduled_date)` is D, so `/day` needs no new Task endpoint |
| P1 | `src/app/api.ts` | 85-111, 240-242, 276-288 | `request<T>`, the one-liner wrapper idiom, `fetchGoogleEvents` |
| P1 | `src/shared/event-range.ts` | 16-89 | The server's range semantics (inclusive days, half-open instants) that `listEvents` relies on |
| P2 | `PRPs/reports/life-areas/phase-4/ui-checklist.md` | 57-134 | The record format of a Tier A/Tier B checklist with honest methods and "owed" marks |
| P2 | `PRPs/reports/life-areas/phase-4/live-browser-pass.md` | 1-86 | The format and the setup of an orchestrator live pass in the browser pane |
| P2 | `PRPs/plans/completed/google-calendar-read-phase-4-the-day-whole.plan.md` | 151-203 | Precedent for a UI phase whose acceptance is manual and whose decidable half is extracted |
| P2 | `tsconfig.base.json` | 1-23 | `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax` bind every new line |
| P2 | `docs/context/methodology.md` | 26-38, 40-64 | The UI-stays-manual split and the browser-API glue exemption |

## Patterns to Mirror

```ts
# SOURCE: src/shared/day-groups.ts:57-64
function bucketOf(item: DayItem, today: string): BucketKey {
  if (item.closed)
    return item.source === "task" && item.task.status === "missed" ? "missed" : "done";
  if (item.dueDate === null) return "undated";
  if (item.dueDate < today) return "overdue";
  if (item.dueDate === today) return "today";
  return "upcoming";
}
```

Copied by Task 2 (the Task branch keeps this ladder verbatim inside a `switch (item.source)`).

```ts
# SOURCE: src/shared/day-item.ts:106-119
export function dayItemFromEvent(event: CalendarEventDto): ExternalDayItem {
  const dueDate =
    "date" in event.start
      ? event.start.date
      : todayIn(new Date(event.start.dateTime), PRAESTO_TIMEZONE);

  return {
    source: "google",
    id: event.id,
    dueDate,
    closed: false,
    payload: event,
  };
}
```

Copied by Task 1 (`dayItemFromLocalEvent` follows the same shape and the same day rule) and by Task 3 (the placement's day-of-an-instant rule).

```ts
# SOURCE: src/shared/agenda.ts:58-66
export function agendaForToday(
  events: readonly CalendarEventDto[],
  today: string,
): CalendarEventDto[] {
  return events
    .filter((event) => localDayOf(event) === today)
    .slice()
    .sort((a, b) => startsAt(a) - startsAt(b));
}
```

Copied by Task 4 (the signature and the CalendarEventDto[] return stay; the body becomes a thin caller of `itemsInRange`) and Task 3 (all-day first, timed ascending, stable).

```ts
# SOURCE: src/shared/events.ts:188-199
export function shiftLocalDay(day: string, delta: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

/**
 * Turns a stored EXCLUSIVE all-day end into the inclusive last day shown to the
 * owner: Google stores `2026-10-28` for an Event that ends on the 27th (AC-2).
 */
export function displayEndDay(endDate: string): string {
  return shiftLocalDay(endDate, -1);
}
```

Copied by Task 3 (the covered days of an all-day item, local or Google) and Task 6 (`adjacentDays`).

```ts
# SOURCE: src/shared/app-route.ts:40-59
/** Builds the Task-linked route for a given Task id. */
export function taskRouteOf(taskId: string): AppRoute {
  return `task/${taskId}`;
}

/** Recovers the Task id from a Task-linked route, or `null` for every other route. */
export function taskIdFromRoute(route: AppRoute): string | null {
  if (!route.startsWith("task/")) return null;
  return route.slice("task/".length);
}

const TASK_PATH_PATTERN = /^\/tasks\/([^/]+)$/;

export function routeFromPath(pathname: string): AppRoute {
  const path = withoutTrailingSlash(pathname);
  const taskMatch = TASK_PATH_PATTERN.exec(path);
  if (taskMatch !== null) {
    const taskId = taskMatch[1];
    if (taskId !== undefined && taskId !== "") return taskRouteOf(taskId);
  }
```

Copied by Task 5 (`dayRouteOf`, `dayFromRoute`, a `DAY_PATH_PATTERN` branch and the `pathOf` branch).

```ts
# SOURCE: src/shared/format.ts:220-231
export function formatEventTime(moment: EventMoment): string {
  if ("date" in moment) return ALL_DAY_LABEL;

  // The owner's fixed zone, never the instant's own offset: the same moment
  // must read the same on the phone and the PC (ADR-0009's single-owner,
  // single-calendar assumption, and `PRAESTO_TIMEZONE`'s whole reason).
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: PRAESTO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(moment.dateTime));
}
```

Copied by Task 6 (`formatDayItemTime` produces exactly this string for a Google item that starts on the day).

```ts
# SOURCE: src/app/api.ts:286-288
export async function fetchGoogleEvents(): Promise<GoogleEventsDto> {
  return request<GoogleEventsDto>("/api/google/events");
}
```

Copied by Task 7 (the wrapper gains an optional range; with no argument the path stays this literal; `listEvents` follows the same one-liner idiom).

```tsx
# SOURCE: src/app/components/EventRow.tsx:32-42
  "flex min-h-16 items-center gap-3 rounded-card border border-dashed border-line-strong px-3 py-2";

export function EventRow({ event }: { event: CalendarEventDto }) {
  const time = formatEventTime(event.start);

  const content = (
    <>
      {/* Fixed width and tabular so the times line up down the column, which is
          the whole reason §2.4 asks for a leading column rather than inline. */}
      <span className="w-14 flex-none font-data text-t1 text-muted tabular-nums">{time}</span>
      <Calendar className="size-4 flex-none text-faint" aria-hidden="true" />
```

Copied by Task 8 (`LocalEventRow` matches this geometry with a solid outline; `EventRow` gains the optional `timeLabel`).

```tsx
# SOURCE: src/app/components/AdherenceScreen.tsx:126-146
  return (
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr] overflow-clip bg-bg"
    >
      <header className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
          <ArrowLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <img src="/brand/mark-flat.svg" alt="" className="size-5" />
          <span className="font-display text-t2 font-extrabold text-muted">praesto</span>
        </span>
        <h1 className="m-0 font-text text-t4 font-bold text-ink">Aderência</h1>
      </header>

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}
```

Copied by Task 9 (the shell, the header with *Voltar* and the always-render-a-slot banner row; DayScreen adds a stepper row and drops the wordmark span).

```ts
# SOURCE: src/app/components/SearchScreen.tsx:222-240
  async function complete(id: string): Promise<void> {
    try {
      await completeTask(id);
      await rerunSearch();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setSearchError(message);
    }
  }

  async function reopen(id: string): Promise<void> {
    try {
      await reopenTask(id);
      await rerunSearch();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setSearchError(message);
    }
  }
```

Copied by Task 9 (server-first complete/reopen/rename for the Task rows on `/day`, with the day's Task reload in place of `rerunSearch`).

```ts
# SOURCE: src/app/components/TodayScreen.tsx:333-351
  async function refreshEvents(): Promise<void> {
    try {
      const payload = await fetchGoogleEvents();
      setEvents(payload.events);
      setEventsState(
        payload.failedCalendars.length > 0
          ? { kind: "partial", failed: payload.failedCalendars.length }
          : { kind: "ready" },
      );
    } catch (cause) {
      // A 401 is the app's token, not Google's — route it like any other.
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setEvents(null);
      setEventsState({ kind: "failed", reason: cause instanceof ApiError ? cause.reason : null });
    }
  }
```

Copied by Task 11 (`refreshLocalEvents` is its sibling: its own atom, a 401 to the gate, any other failure kept out of the connectivity reducer) and by Task 9.

```tsx
# SOURCE: src/app/components/TodayHeader.tsx:38-42
    <header className="flex items-end gap-3 px-4 pt-6 pb-2">
      <h1 className="m-0 font-text text-t4 font-bold text-ink">Hoje</h1>
      <span className="pb-0.5 font-data text-t1 font-medium text-muted tabular-nums">
        {formatHeaderDate(now)}
      </span>
```

Copied by Task 10 (the date becomes a button that keeps the same text baseline and footprint).

```tsx
# SOURCE: src/app/App.tsx:97-111
  if (route === "adherence") {
    return <AdherenceScreen onUnauthorized={onUnauthorized} back={back} />;
  }
  if (route === "life-areas") {
    return <LifeAreasScreen onUnauthorized={onUnauthorized} back={back} />;
  }
  if (route === "search") {
    return (
      <SearchScreen
        onUnauthorized={onUnauthorized}
        back={back}
        onOpenLifeAreas={() => navigate("life-areas")}
      />
    );
  }
```

Copied by Task 10 (the day route joins this chain; `DayScreen` additionally receives `navigate`).

```ts
# SOURCE: src/worker/routes/tasks.ts:136-137
    from === undefined ? undefined : sql`${dueDate} >= ${from}`,
    to === undefined ? undefined : sql`${dueDate} <= ${to}`,
```

Read by Task 9 (why `listTasks({ ...EMPTY_FILTER, status: "open", from: day, to: day })` returns exactly the open Tasks dated that day, with undated Tasks never in range).

```md
# SOURCE: documentation/40-engineering/ui-layout-standard.md:70-71
| Date | What changed |
|---|---|
```

Copied by Task 12 (a new History row goes directly under this header, newest first).

```md
# SOURCE: PRPs/reports/life-areas/phase-4/live-browser-pass.md:18-21
## Measured (375 px, dark)

| Surface | Measure | Result |
|---|---|---|
```

Copied by Task 13 (the measurements table shape the protocol asks the live pass to fill).

```md
# SOURCE: PRPs/reports/life-areas/phase-4/ui-checklist.md:57-61
## Tier A — every interface change

1. ✔ — method: static inspection, plus the live pass's enumeration of the surfaces. The filter
   sheet's one secondary action is still *Limpar filtros*; the *Área* group adds chips only (no
   button); the quick row gains at most one `Chip`, itself a toggle, and the Level 2 grep proves no
```

Copied by Task 14 (the numbered item with a ✔/✘/owed mark and an honest "method:").

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/day-item.ts` | UPDATE | `local` in `DaySource`, `LocalDayItem` in the union, `dayItemFromLocalEvent` (Implementer file) |
| `src/shared/day-groups.ts` | UPDATE | `bucketOf` becomes an exhaustive `switch` over the source; `collectDayItems` behaviour for Tasks unchanged (Implementer file) |
| `src/shared/day-range.ts` | CREATE | `itemsInRange`, `dayItemPlacement` and the range types: the one range function (Implementer file) |
| `src/shared/agenda.ts` | UPDATE | `agendaForToday` becomes a thin caller; `agendaItemsForToday`, `AgendaState`, the Agenda copy and `decideAgendaNotice` move here from the screen (Implementer file) |
| `src/shared/app-route.ts` | UPDATE | `day/${string}` member, `dayRouteOf`, `dayFromRoute`, the `/day/AAAA-MM-DD` mapping both ways (Implementer file) |
| `src/shared/day-view.ts` | CREATE | The day screen's pure decisions: heading, adjacent days, *Hoje* control, time labels, section split, request paths, the empty text (Implementer file) |
| `src/shared/format.ts` | UPDATE | Export `ALL_DAY_LABEL` so the local and Google all-day label cannot drift; nothing else changes (Implementer file) |
| `src/app/api.ts` | UPDATE | `listEvents(range)`; `fetchGoogleEvents(range?)` (Implementer file) |
| `src/app/components/EventRow.tsx` | UPDATE | Optional `timeLabel` prop; absent means today's markup exactly (Implementer file) |
| `src/app/components/LocalEventRow.tsx` | CREATE | The solid, checkbox-less, inert row of a local commitment (Implementer file) |
| `src/app/components/DayScreen.tsx` | CREATE | The `/day/AAAA-MM-DD` screen (Implementer file) |
| `src/app/components/TodayHeader.tsx` | UPDATE | The date becomes a button with an `onOpenDay` callback (Implementer file) |
| `src/app/components/TodayScreen.tsx` | UPDATE | The `case "local"` branch, the `onOpenDay` prop, the local-events atom and the Agenda fed by `agendaItemsForToday` (Implementer file) |
| `src/app/components/SearchScreen.tsx` | UPDATE | The `case "local"` branch so the widened union still compiles (Implementer file) |
| `src/app/App.tsx` | UPDATE | The day route in the chain and the `onOpenDay` callback (Implementer file) |
| `documentation/40-engineering/ui-layout-standard.md` | UPDATE | The dated amendment for the new route, the header date and the Agenda stack (Implementer file) |
| `PRPs/reports/events-and-day-view/phase-3/live-pass-protocol.md` | CREATE | The executable protocol for the browser-pane pass that verifies AC-23, AC-24 and AC-25 (Implementer file) |
| `PRPs/reports/events-and-day-view/phase-3/ui-checklist.md` | CREATE | The recorded ✔/✘ of the UI/UX review checklist and the AC-23/24/25 walk (Implementer file) |

## NOT Building (Scope Limits)

- **The Compromisso sheet, *Novo compromisso*, create/edit/delete from the UI, draft and patch builders** — phase 4 (AC-27, AC-28). A local row is inert here: no button, no link, no pressed or hover treatment, so nothing invites a tap that does nothing. The identifiers `CompromissoSheet`, `createEvent`, `updateEvent` and `deleteEvent` must not appear under `src/app/`.
- **The *Compromissos* group in search and any search change** — phase 4 (AC-29). `SearchScreen` only gains the compile-time `case "local"`.
- **Offline-write and failed-save states for commitments** — phase 4 (AC-30). On `/day` only Task completion/rename writes exist, and they follow `SearchScreen`'s server-first pattern.
- **Documentation sync other than the layout-standard amendment** — phase 5 (AC-34): glossary, `domain-model.md`, `docs/domain/areas/events.md`, `architecture-overview.md`, `docs/context/architecture.md`, FR traceability, roadmap, and the statement that the *Com hora* chip stays withdrawn.
- **Release `v0.14.0`, chore C6, the remote migration and the device proof** — phase 5.
- **Tomorrow's commitments on *Hoje*, a week view, a time-grid, overlap warnings** — *Hoje* keeps showing today only (D-K); units 16 and later.
- **Showing the "next event" in the collapsed Agenda** — layout standard §2.4 says "collapsed to the next event + count", but the shipped Agenda collapses to name and count only (`src/app/components/TaskGroup.tsx:49`, unit 4); PRD AC-23 repeats the §2.4 wording. Adding it would change the Google-only look that AC-23 requires to stay exactly as today, so it is not built here and the discrepancy is recorded in Notes for the owner.
- **Closed Tasks on `/day`** — open Tasks only (PRD Open Question 1); *Concluídas* and *Não concluídas* stay *Hoje*'s business.
- **The event's own time zone on a row** — rows and day grouping use the owner's zone (Notes, D3-1); showing a differing zone beside the time belongs with the sheet.
- **A location line, guests, or any new field on the rows** — unit 4 deferred `location` on Google rows for the same reason; the rows show time and title.
- **A new endpoint, DTO, migration, table, token or colour** — none is needed.
- **Writing to Google, storing Google events, recurrence, reminders on Events, Task↔Event links, a Life Area on Events** — units 15, 17, 18, 20, 13.
- **Fixing `scripts/check-mirror-inventory.mjs`** — it already fails on `main` for two unrelated lines (`src/app/api.ts:184`, `src/shared/export.ts` `reminders`); this phase neither depends on it nor fixes it (phase 5).

## Step-by-Step Tasks

### Task 1: UPDATE `src/shared/day-item.ts` (and the two `renderDayItems` switches)

- **ACTION**: Widen the projection union with the `local` source. In `src/shared/day-item.ts`: `DaySource` becomes `"task" | "google" | "local"`; add `export interface LocalDayItem extends DayItemBase { source: "local"; event: EventDto }` (import `EventDto` as a type from `./api`; the whole DTO rides along as `event`, never copied); `DayItem = TaskDayItem | ExternalDayItem | LocalDayItem`; add `export function dayItemFromLocalEvent(event: EventDto): LocalDayItem` with `closed: false` always (an Event has no completion state) and `dueDate` = `event.startDate` verbatim for an all-day Event (no zone conversion), the owner-zone (`PRAESTO_TIMEZONE`) local day of `event.startAt` for a timed one (`startAt` is epoch SECONDS, so `todayIn(new Date(event.startAt * 1000), PRAESTO_TIMEZONE)`), and `null` only when the DTO lacks the start field its kind needs (the schema CHECK makes that unreachable, the type allows it). Update the module header and the `DaySource` comment so they no longer say unit 14 is still to come. Because the union grew, add the `local` case beside `google` in the two `renderDayItems` switches (`src/app/components/TodayScreen.tsx`, `src/app/components/SearchScreen.tsx`) as a combined `case "google": case "local":` that throws the same `Unhandled day item source: ${item.source}` error — neither screen feeds `collectDayItems` anything but Tasks, and the Agenda renders events in its own region (Task 11) — so `default: return assertNeverDaySource(item)` still narrows to `never` and `tsc` stays green. Implementer files: `day-item.ts`, `TodayScreen.tsx`, `SearchScreen.tsx` (no test file is touched; the pair authors `test/day-item-local.test.ts` for the projection). Delivers **AC-A2**.
- **MIRROR**: `src/shared/day-item.ts:106-119`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run day-item`

### Task 2: UPDATE `src/shared/day-groups.ts`

- **ACTION**: Rewrite `bucketOf` as an exhaustive `switch (item.source)` ending in `default: return assertNeverDaySource(item)` (import it from `./day-item`). `case "task"` keeps the current ladder VERBATIM (`closed` first: `missed` for a Task whose status is `missed`, else `done`; then `undated`, `overdue`, `today`, `upcoming`), so `collectDayItems` behaves identically for Task-only input. `case "google"` and `case "local"` share one rule that never reads `closed` and never yields `overdue`, `done` or `missed`: `dueDate === null` gives `undated`, `dueDate > today` gives `upcoming`, anything else gives `today`. Rationale for the comment above the switch: an Event has no completion state and is not late; no screen feeds `collectDayItems` an event (they reach the screens through `itemsInRange`), so this branch exists to make the function total and the failure mild, and a past-dated event landing in `today` is the accepted cost. Update the doc comment above `bucketOf`, which says an external item "reaches neither" by construction. Do not touch `mergeStable`, `isBefore`, `collectDayItems`, `DayItemGroups` or `DayItemSource`. Implementer file: `day-groups.ts` only; the existing `test/day-groups.test.ts` must pass unmodified and the pair authors the non-Task cases in `test/day-groups-local.test.ts`. Delivers **AC-A2** and, with Task 14's recorded diff checks, **AC-A11**.
- **MIRROR**: `src/shared/day-groups.ts:57-64`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run day-groups task-groups day-item`

### Task 3: CREATE `src/shared/day-range.ts`

- **ACTION**: The one range function. Exports: `interface DayRange { from: string; to: string }` (inclusive local days `YYYY-MM-DD`); `interface DayRangeEntry { day: string; items: DayItem[] }`; `type DayItemPlacement = { kind: "allDay"; firstDay: string; lastDay: string } | { kind: "timed"; startMs: number; endMs: number; firstDay: string; lastDay: string } | { kind: "task"; day: string }`; `function dayItemPlacement(item: DayItem): DayItemPlacement | null` — the single adapter between seconds (`EventDto`) and milliseconds (`CalendarEventDto`); and `function itemsInRange(sources: readonly DayItemSource[], range: DayRange): DayRangeEntry[]` (import `DayItemSource` as a TYPE from `./day-groups`). A "day" is always the owner's zone: a day of an instant is `todayIn(new Date(ms), PRAESTO_TIMEZONE)`. Placement rules, exhaustive over `item.source` with `assertNeverDaySource`: **local all-day** covers `startDate` through `displayEndDay(endDate)` inclusive (an `endDate` that is not after `startDate` covers just `startDate`); **local timed** covers the day of `startAt` through the day of `endAt - 1` second when `endAt > startAt` (so an Event ending exactly at 00:00 does not spill into the next day), else just the day of `startAt`; **Google all-day** (`"date" in start`) covers `start.date` through `displayEndDay(end.date)` when `end.date > start.date`, else just `start.date` (the existing fixtures carry `end == start`, and Google is reported to accept equal dates, so normalise defensively); **Google timed** covers the day of `start.dateTime` through the day of `end.dateTime - 1` ms when the end is a timed moment after the start, else just the start's day (a missing or mismatched end is read as the start; never throw); **Task** places on `item.dueDate` only when `!item.closed` and `dueDate !== null` — a closed or undated Task returns `null` and is skipped. `itemsInRange` returns one `DayRangeEntry` per day from `from` through `to` ascending (an inverted range, `from > to`, returns `[]`), listing each placed item on every day it covers that lies inside the range (clipped; items wholly outside are absent). Within a day the order is: all-day items (local and Google alike) in arrival order; then timed items ascending by `startMs`, ties in arrival order (a continuation of an earlier day sorts by its real start, which is before everything that starts on the day); then open Tasks in arrival order. "Arrival order" is the flattened order of `sources` then of each source's `items`, and the sort must be the stable `Array.prototype.sort` — NOT id-ordered, because `test/agenda.test.ts:150-159` pins arrival order for tied starts. Output items are the input `DayItem` references, never copies. One code path for zero, one, two or three sources: no read of `sources.length`, no branch on a source's `id`. No clock: no `Date.now()` and no `new Date()` with no argument (`new Date(<number>)` is fine). Imports types from `./api`, `./day-item` and `./day-groups`, and values from `./day-item` (`assertNeverDaySource`), `./dates` and `./events`. Splitting one source's items, order preserved, across two sources returns the same result as passing them together (the contiguous split `test/day-groups.test.ts:225-243` uses); an interleaved split is not claimed, because tied starts keep arrival order. Implementer file: `day-range.ts` only; the pair authors `test/day-range.test.ts` first. Delivers **AC-A1**.
- **MIRROR**: `src/shared/events.ts:188-199` for the inclusive-last-day arithmetic; `src/shared/agenda.ts:58-66` for the all-day-first, then-start, stable ordering contract.
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run day-range`

### Task 4: UPDATE `src/shared/agenda.ts`

- **ACTION**: Make the Agenda a caller of the range function and move its decidable bits out of the screen. Add `export function agendaItemsForToday(local: readonly EventDto[], google: readonly CalendarEventDto[], today: string): (LocalDayItem | ExternalDayItem)[]` — it builds two `DayItemSource`s (`{ id: "local", items: local.map(dayItemFromLocalEvent) }` first, `{ id: "google", items: google.map(dayItemFromEvent) }` second), calls `itemsInRange(sources, { from: today, to: today })`, and returns the single entry's items (an empty list when there is no entry), so all-day rows come first, then timed rows by start, local before Google on a tie. Rewrite `agendaForToday(events, today)` as a thin caller: `agendaItemsForToday([], events, today)` mapped to the Google payloads, keeping the exact signature and return type `CalendarEventDto[]` and the identity of the returned objects; delete the now-unused private `localDayOf` and `startsAt` (their comment asking that two derivations "both change" is obsolete — the day rule now lives only in `dayItemPlacement`). Move the screen's agenda state and copy here: `export type AgendaState = { kind: "loading" } | { kind: "ready" } | { kind: "partial"; failed: number } | { kind: "failed"; reason: string | null }` (same members and comments as `TodayScreen.tsx:118-124`), `export const AGENDA_EMPTY = "Nada na agenda hoje."`, `export function agendaPartialMessage(failed: number): string` returning byte-for-byte what `AGENDA.partial` returns today (`"Um calendário não respondeu — a agenda pode estar incompleta."` for 1, `` `${n} calendários não responderam — a agenda pode estar incompleta.` `` otherwise), and `export function decideAgendaNotice(input: { google: AgendaState; othersReady: boolean; rowCount: number; emptyText: string }): string | null` — `loading` returns `null`; `partial` returns `agendaPartialMessage(failed)` whatever the row count; `failed` returns `googleFailureMessage(reason)` (import from `./google-failure-copy`); `ready` returns `emptyText` only when `rowCount === 0` AND `othersReady`, else `null`. `othersReady` is `true` once every other source (local commitments, and Tasks on `/day`) has answered successfully, so an unanswered or failed source can never let a day read as free. Update the module header for the new role. Implementer file: `agenda.ts` only; the existing `test/agenda.test.ts` must pass unmodified and the pair authors `test/agenda-items.test.ts`. Delivers **AC-A3**.
- **MIRROR**: `src/shared/agenda.ts:58-66`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run agenda`

### Task 5: UPDATE `src/shared/app-route.ts`

- **ACTION**: Add the day route. `AppRoute` gains the member `` `day/${string}` ``; add `export function dayRouteOf(day: string): AppRoute` (`` `day/${day}` ``) and `export function dayFromRoute(route: AppRoute): string | null` (the date of a day route whose date passes `isValidLocalDay` from `./events`, else `null`, including for every non-day route). In `routeFromPath`, after the task match, add `const DAY_PATH_PATTERN = /^\/day\/(\d{4}-\d{2}-\d{2})$/` and return the day route only when the captured date passes `isValidLocalDay`; so `/day/2026-10-20` maps to `day/2026-10-20`, `/day/2026-10-20/` is accepted (the trailing-slash rule every route shares), and `/day/2026-02-30`, `/day/abc`, `/day`, `/day/` and `/day/2026-10-20/extra` fall through to `today`. In `pathOf`, add a `route.startsWith("day/")` branch returning `/day/<date>`, so `pathOf(routeFromPath("/day/2026-10-20"))` is `/day/2026-10-20`. Every existing branch and ordering stays byte-for-byte as it is; update the module header only if it enumerates the routes. Implementer file: `app-route.ts` only; the pair appends additive cases to `test/app-route.test.ts` (no existing assertion changes). Delivers **AC-A4**.
- **MIRROR**: `src/shared/app-route.ts:40-59`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run app-route`

### Task 6: CREATE `src/shared/day-view.ts` (and export `ALL_DAY_LABEL` from `src/shared/format.ts`)

- **ACTION**: The day screen's decidable half. In `src/shared/format.ts` change only `const ALL_DAY_LABEL = "dia todo"` to `export const ALL_DAY_LABEL = "dia todo"` (the label stays pending the owner's confirmation, as its comment says). Create `src/shared/day-view.ts` (pure: no DOM, no clock, `today` always an argument) exporting: `DAY_VIEW_EMPTY = "Nada neste dia."` (the PRD's copy); `formatDayHeading(day: string, today: string): string` — the pt-BR long date through `Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })` at UTC noon, with `year: "numeric"` added only when `day`'s year differs from `today`'s (`2026-10-20` read in 2026 is `terça-feira, 20 de outubro`; in 2027 it ends `de 2026`); `adjacentDays(day: string): { previous: string; next: string }` through `shiftLocalDay` (month and year boundaries cross correctly); `showTodayControl(day: string, today: string): boolean` (`day !== today`); `formatDayItemTime(item: ExternalDayItem | LocalDayItem, day: string, mode: "start" | "range"): string` over `dayItemPlacement`, in the owner's zone with the same `Intl.DateTimeFormat("pt-BR", { timeZone: PRAESTO_TIMEZONE, hour: "2-digit", minute: "2-digit" })` as `formatEventTime`: an all-day item reads `ALL_DAY_LABEL`; a timed item that begins on `day` reads `HH:mm` in `start` mode and `HH:mm–HH:mm` (U+2013, no spaces) in `range` mode when its end is after its start (`HH:mm` alone when not); a timed item that began on an earlier day reads `até HH:mm` of its end in both modes (e.g. 23:00 to 01:00 reads `23:00–01:00` on its first day and `até 01:00` on the second); for a Google item that begins on `day` the `start` result is exactly `formatEventTime(payload.start)`; `splitDayItems(items: readonly DayItem[]): { allDay: DayItem[]; timed: DayItem[]; tasks: DayItem[] }` by placement kind, relative order kept, unplaceable items dropped; `eventsRangePath(range: DayRange): string` returning `/api/events?from=<from>&to=<to>`; and `googleEventsPath(range?: DayRange): string` returning exactly `/api/google/events` with no argument and `/api/google/events?from=<from>&to=<to>` with one (so the unit-4 request stays byte-identical). Implementer files: `day-view.ts`, `format.ts` (one keyword); `test/format.test.ts` must pass unmodified and the pair authors `test/day-view.test.ts`. Delivers **AC-A5**.
- **MIRROR**: `src/shared/format.ts:220-231`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run day-view format`

### Task 7: UPDATE `src/app/api.ts`

- **ACTION**: Add the two client reads the screens need, as one-liners over `request<T>()` in the idiom of the sibling wrappers (no local types, no error re-mapping; a failure arrives as `ApiError`). `export async function listEvents(range: DayRange, signal?: AbortSignal): Promise<EventDto[]>` requests `eventsRangePath(range)` and returns `body.events` (import `EventsResponse` and `EventDto` from `../shared/api`, `DayRange` from `../shared/day-range`, the path builders from `../shared/day-view`); a `signal` is passed through only when defined (`exactOptionalPropertyTypes` forbids passing `undefined`), exactly as `listTasks` does. Change `fetchGoogleEvents` to `fetchGoogleEvents(range?: DayRange)` requesting `googleEventsPath(range)`; update its doc comment (it said narrowing is only the screen's job; it now also takes the day window `/day` needs). Do NOT add `createEvent`, `updateEvent` or `deleteEvent` (phase 4). This file is exempt glue under `docs/context/methodology.md`; the URL decisions it relies on are tested in `day-view`. Implementer file: `api.ts` only. Infrastructure for **AC-A7** and **AC-A8** (the requests behind `/day`), with the request shapes pinned by **AC-A5**.
- **MIRROR**: `src/app/api.ts:286-288`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/api.ts; npx prettier --check src/app/api.ts`

### Task 8: UPDATE `src/app/components/EventRow.tsx` and CREATE `src/app/components/LocalEventRow.tsx`

- **ACTION**: Rows for the two event kinds. `EventRow` gains the optional prop `timeLabel?: string`; when present it replaces `formatEventTime(event.start)` as the leading label, when absent the markup and text are exactly today's (so a caller that passes nothing renders what shipped). `LocalEventRow({ event, timeLabel }: { event: EventDto; timeLabel: string })` renders one `<li>` matching `EventRow`'s geometry (`min-h-16`, `gap-3`, `rounded-card`, `px-3 py-2`, the fixed `w-14 flex-none` tabular mono time column, a 16 px glyph, the title `line-clamp-2 min-w-0 flex-1 font-text text-t2 text-ink`) but SOLID: a solid `border border-line` outline on a filled `bg-surface-1` ground instead of the dashed transparent one, no completion control, never `text-accent` or `text-live`, existing tokens only, a different Lucide glyph from the Google row's `Calendar` (for example `CalendarDays`, verify it compiles). The row is deliberately INERT in this phase (Notes, D3-5): no `<button>`, no `<a>`, no `role`, no `tabIndex`, no pointer, hover or pressed styling, because the Compromisso sheet that a tap would open is phase 4 (AC-28); phase 4 adds the `onOpen`. Real DOM text for the title (never a pseudo-element). Implementer files: `EventRow.tsx`, `LocalEventRow.tsx`. Delivers **AC-A6** and **AC-A7** (the three sources visibly distinct: local solid, Google dashed).
- **MIRROR**: `src/app/components/EventRow.tsx:32-42`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/components/EventRow.tsx src/app/components/LocalEventRow.tsx; npx prettier --check src/app/components/EventRow.tsx src/app/components/LocalEventRow.tsx`

### Task 9: CREATE `src/app/components/DayScreen.tsx`

- **ACTION**: The `/day/AAAA-MM-DD` screen. Props `{ day: string; onUnauthorized: () => void; back: () => void; navigate: (route: AppRoute) => void }`. Shell: the `AdherenceScreen` grid with four rows (`grid-rows-[auto_auto_auto_1fr]`): a header with the *Voltar* icon button (`ArrowLeft`) and an `<h1>` of `formatDayHeading(day, todayIn(new Date()))`; a stepper `<nav aria-label="Navegar entre dias">` with a 48 px icon button `aria-label="Dia anterior"` (`ChevronLeft`), a *Hoje* button (`variant="ghost"`, rendered only when `showTodayControl(day, today)`, `onClick={() => navigate("today")}`) and a 48 px icon button `aria-label="Próximo dia"` (`ChevronRight`), the two arrows calling `navigate(dayRouteOf(adjacentDays(day).previous | .next))` so every step is a real history entry; the always-render-a-slot offline `Banner` (same copy as the sibling screens); and `<main>`. `document.title` is `<heading> · Praesto Sum`; `Esc` calls `back()`. Data, three isolated atoms, none folded into another and none reported to `useConnectivity`'s reducer (Google down must not disable anything): `listEvents({ from: day, to: day })`; `listTasks({ ...EMPTY_FILTER, status: "open", from: day, to: day })`; `fetchGoogleEvents({ from: day, to: day })` held as `AgendaState` (`partial` when `failedCalendars` is non-empty, `failed` with the `ApiError.reason` otherwise). The screen STAYS MOUNTED while the owner steps, so the load effect is keyed on `day`: on a change it resets all three atoms to loading and invalidates in-flight requests with a per-source request counter plus the day it was issued for, so a slow response for yesterday can never paint over today; a 401 routes to `onUnauthorized`; it refetches on `visibilitychange` to visible and on reconnect (guidelines §12.4). Rendering: `itemsInRange` over `[{ id: "local", … }, { id: "google", … }, { id: "tasks", … }]` for `{ from: day, to: day }`, then `splitDayItems` into three `<section>`s in this DOM order with `aria-label` `Dia inteiro`, `Compromissos`, `Tarefas`, each a `<ul>` that renders only when non-empty: all-day items first (local rows via `LocalEventRow`, Google rows via `EventRow`, label `formatDayItemTime(item, day, "range")`), then timed items by start in one list, then the Tasks as the existing `TaskRow` (area names through `useLifeAreas` and `lifeAreaNameOf`; `onOpen` calls `navigate(taskRouteOf(task.id))`, which reuses the notification deep link so the Task opens in its sheet over *Hoje* and Android back returns to the day; complete, reopen and rename are server-first handlers copied from `SearchScreen`, each followed by a reload of the day's Tasks, a failure shown inline and persistent, never a toast). Keys are `` `${item.source}-${item.id}` `` (ids are unique per source only). Degraded and empty states, never a free day: `decideAgendaNotice({ google, othersReady: localReady && tasksReady, rowCount, emptyText: DAY_VIEW_EMPTY })` renders as a `role="status"` line (partial and failed Google reuse `agendaPartialMessage` and `googleFailureMessage` through that function); a failed local or Task request renders `classifyRequestFailure(cause).message` as a `role="alert"` line with a *Tentar de novo* button that retries only the failed sources, and while any source is unanswered the empty text is not shown. Every control is at least 48 px with at least 8 px between neighbours; copy is pt-BR sentence case; tokens only; no new colour, motion or primitive. Implementer file: `DayScreen.tsx` only. Delivers **AC-A7** and **AC-A8**.
- **MIRROR**: `src/app/components/AdherenceScreen.tsx:126-146` for the shell; `src/app/components/SearchScreen.tsx:222-240` for the Task handlers; `src/app/components/TodayScreen.tsx:333-351` for the isolated Google atom.
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/components/DayScreen.tsx; npx prettier --check src/app/components/DayScreen.tsx`

### Task 10: UPDATE `src/app/components/TodayHeader.tsx`, `src/app/App.tsx` and `src/app/components/TodayScreen.tsx` (route wiring only)

- **ACTION**: Open the door and mount the screen. `TodayHeader` gains the required prop `onOpenDay: () => void`; the date `<span>` becomes a `<button type="button">` showing the same `formatHeaderDate(now)` text with the same mono, muted, tabular styling, an underline offset so it reads as a control without adding an element or a width, at least 48 px tall by growing UPWARD only (`inline-flex min-h-12 items-end pb-0.5`, so the text keeps its current baseline and the header's other items keep their footprint), no extra padding that would eat the 12 px gap to its neighbours, and an `sr-only` suffix ` — abrir o dia` so the visible date stays inside the accessible name (WCAG 2.5.3). `TodayScreen` gains the prop `onOpenDay: () => void` and passes it to the header (nothing else in this file changes in this task). `App.tsx` adds, in the route chain before `search`, `const routeDay = dayFromRoute(route); if (routeDay !== null) return <DayScreen day={routeDay} onUnauthorized={onUnauthorized} back={back} navigate={navigate} />` with no `key`, so stepping keeps one mounted screen, and passes `onOpenDay={() => navigate(dayRouteOf(todayIn(new Date())))}` to `TodayScreen`; import `dayFromRoute`, `dayRouteOf`, `todayIn` and `DayScreen`. Implementer files: those three. Delivers **AC-A7** (the door from *Hoje*) with **AC-A4**'s route reaching a screen.
- **MIRROR**: `src/app/components/TodayHeader.tsx:38-42`; `src/app/App.tsx:97-111`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/App.tsx src/app/components/TodayHeader.tsx src/app/components/TodayScreen.tsx; npx prettier --check src/app/App.tsx src/app/components/TodayHeader.tsx src/app/components/TodayScreen.tsx`

### Task 11: UPDATE `src/app/components/TodayScreen.tsx` (the Agenda)

- **ACTION**: Feed *Hoje*'s Agenda from the range function and list local commitments beside Google's. Delete the local `AgendaState` type and the `AGENDA.partial`/`AGENDA.empty` copy and import `AgendaState`, `AGENDA_EMPTY`, `agendaItemsForToday` and `decideAgendaNotice` from `../../shared/agenda` (keep `AGENDA.name = "Agenda"`). Add a local-commitments atom pair beside the Google ones, never folded into `tasks`, `loadError`, `busy` or `events`: `localEvents: EventDto[] | null` and a state of `loading`, `ready` or `failed` with the classified message. `refreshLocalEvents()` computes `todayIn(new Date())` INSIDE the function (not from the render's `today`, because the visibility handler is registered once and the app can stay open across midnight), calls `listEvents({ from: day, to: day })`, routes a 401 to `onUnauthorized`, keeps every other failure out of `useConnectivity`'s reducer (the reason `refreshEvents` already gives) and sets the failed state with `classifyRequestFailure(cause).message`. Call it on mount beside `refreshEvents`, in the `visibilitychange` handler beside `refreshEvents`, and in `useConnectivity`'s `onOnline`. Replace `agenda` with `agendaItemsForToday(localEvents ?? [], events ?? [], today)`; the group count and the `TaskGroup` become *Agenda · N* over both kinds; rows render by `item.source`: `"google"` gives `EventRow` with `timeLabel={formatDayItemTime(item, today, "start")}`, `"local"` gives `LocalEventRow` likewise, and because the rows are typed `(LocalDayItem | ExternalDayItem)[]` the switch has exactly those two cases and a `default: return assertNeverDaySource(item)` that proves exhaustiveness at compile time (a future source stops compiling here instead of rendering a blank row). The notice becomes `decideAgendaNotice({ google: eventsState, othersReady: localEventsState.kind === "ready", rowCount: agenda.length, emptyText: AGENDA_EMPTY })`; a failed local request renders its message as an additional `role="status"` line in the region and, because `othersReady` is false, the empty text is never shown over it. The region still renders only when there are rows or a notice or a local failure, comes first in the DOM, and the top `Banner` for a failed Google fetch is unchanged. A Google-only day (no local commitments, local request ready) renders exactly as today, including the collapsed-by-default header showing name and count only. Implementer file: `TodayScreen.tsx` only. Delivers **AC-A6**.
- **MIRROR**: `src/app/components/TodayScreen.tsx:333-351`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/components/TodayScreen.tsx; npx prettier --check src/app/components/TodayScreen.tsx`

### Task 12: UPDATE `documentation/40-engineering/ui-layout-standard.md`

- **ACTION**: Record the new route as a dated amendment, in the document's own idiom. Set `last_updated` in the front matter to the day the change lands (`date -u +%F`). Add under §2 a new item 11 named **Day route (unit 14 — added <date>, numbered 11 so no existing item moves)**: the route `/day/AAAA-MM-DD`, reached from the *Hoje* header date, is a route with real history entries and not a destination of equal weight, so §1's flip rule is unchanged; its anatomy is a header (*Voltar* and the date as the `<h1>`), a stepper row (*Dia anterior*, *Hoje* only when another date is shown, *Próximo dia*), the offline banner slot, then up to three sections in DOM order: all-day, timed commitments with start and end, open Tasks of that day as time-less rows. Amend §2 item 1 to say the date beside the title is a button that opens `/day`. Amend §2 item 4 in place: the Agenda stack now also lists local commitments (solid outline, no checkbox, inert until the Compromisso sheet ships) beside Google's dashed read-only rows, *Agenda · N* counts both, and the collapsed state shows name and count only, as it has since unit 4 (the "collapsed to the next event" wording was never built and is recorded as such, not silently deleted). Amend §5 so `Esc` also leaves the day route. Add the §6 table row `| 14 events-and-day-view | …` pointing at §2 item 11 and the Agenda stack. Add the History row for **events-and-day-view phase 3** directly under the table header, dated the same day, naming the route `/day/AAAA-MM-DD`, the header date, the Agenda change and `PRPs/reports/events-and-day-view/phase-3/ui-checklist.md`. Do NOT touch §2 item 3's *Com hora* sentence or the rest of the unit's documentation sync: they are phase 5 (AC-34). Implementer file: this document only. Delivers **AC-A10**.
- **MIRROR**: `documentation/40-engineering/ui-layout-standard.md:70-71`
- **VALIDATE**: `node --input-type=module -e "import fs from 'node:fs'; const t = fs.readFileSync('documentation/40-engineering/ui-layout-standard.md', 'utf8'); const need = ['events-and-day-view phase 3', '| 14 events-and-day-view |', '/day/AAAA-MM-DD', 'Day route']; const miss = need.filter((s) => t.includes(s) === false); if (miss.length > 0) { console.error('missing: ' + miss.join(' | ')); process.exit(1); }"`

### Task 13: CREATE `PRPs/reports/events-and-day-view/phase-3/live-pass-protocol.md`

- **ACTION**: The executable protocol for the verification that this phase's three manual acceptance criteria require. The Implementer has no browser, so this task writes the protocol and the orchestrator (or the owner) runs it in the browser pane (Chromium at 375 x 812 and 1280 x 800, dark), recording the outcome as `PRPs/reports/events-and-day-view/phase-3/live-browser-pass.md` in the format of the life-areas precedent. The document has the headings `## Setup`, `## Fixtures`, `## AC-23`, `## AC-24`, `## AC-25` and `## Measurements`. **Setup**: start the dev server from the worktree (`npm run dev`) with a throwaway test token (back up `.dev.vars`, replace `API_BEARER_TOKEN` for the run, restore it byte-identical and stop the server afterwards; follow the setup paragraph of the life-areas `live-browser-pass.md` and `documentation/40-engineering/dev-environment.md`), never a production token or data. **Fixtures**: create commitments through the real route `POST /api/events` with the exact JSON bodies the protocol lists (a timed 09:30–10:30 today; an all-day today; a timed 23:00–01:00 crossing midnight tomorrow; a multi-day all-day Monday–Tuesday next week; one for next Tuesday), with the instant formula for the owner's zone (`America/Sao_Paulo` has been UTC−03:00 with no DST since 2019, so `epochSeconds = Date.UTC(y, m - 1, d, h + 3, min) / 1000`), plus Tasks dated those days through `POST /api/tasks`; and a copy-pasteable `window.fetch` wrapper that stubs `GET /api/google/events` in the page with: a ready payload of `CalendarEventDto` rows (milliseconds), a payload with `failedCalendars` non-empty, an HTTP 409 `{ "error": "unavailable", "reason": "not_connected" }`, an HTTP 409 with `invalid_grant`, and a 502, and that can also make `GET /api/events` answer 500. **AC-23** (Hoje): *Agenda · 2* counts one local and one Google row; expanded order is all-day first then by time; the local row is solid, has no checkbox, and is inert (record explicitly that it does nothing on tap, as designed); the Google row keeps its dashed look and its link; a Google-only day is unchanged against a pre-change reading of the same stubbed payload; Google down shows the explicit notice and the local rows still list; a failed local request shows its message and no empty text; the collapsed header shows name and count only (the discrepancy recorded in the plan's Notes). **AC-24** (`/day/2026-10-20` style): heading, ‹ and › step one day each with `history.length` growing and `history.back()` returning through the visited days, the all-day section first, timed rows with start and end, a midnight-crossing commitment on both days (`23:00–01:00` then `até 01:00`), the open Tasks last as rows that open the Task on tap (it opens over *Hoje* at `/tasks/<id>`; back returns to the day), the three sources visibly distinct, *Nada neste dia.* on an empty day, the *Hoje* control present only when another date is shown, and rapid stepping never painting a stale day. **AC-25**: a commitment for next Tuesday is listed on that Tuesday's `/day` and absent from today's Agenda; with the Google stub failing or partial the day shows the notice, still lists local commitments and Tasks, and never shows *Nada neste dia.*. **Measurements** (table in the shape of the life-areas `Measured` table): every control 48 x 48 or larger and 8 px or more from its neighbours on `/day` and on the changed *Hoje* header at 375 px, no horizontal overflow at 375 and 1280, the header date button's box, the longest heading (`quarta-feira, 30 de setembro de 2026` style) not clipped, no request to another origin in the network panel, and the narrowest label `até 01:00` inside the time column. State plainly what the pane cannot show (contrast on a real panel, safe areas, the Android back gesture, keyboard overlap, Lighthouse): those stay owed to the owner's device. Implementer file: this document only. Delivers the verification half of **AC-A6**, **AC-A7** and **AC-A8**.
- **MIRROR**: `PRPs/reports/life-areas/phase-4/live-browser-pass.md:18-21`
- **VALIDATE**: `node --input-type=module -e "import fs from 'node:fs'; const t = fs.readFileSync('PRPs/reports/events-and-day-view/phase-3/live-pass-protocol.md', 'utf8'); const need = ['## Setup', '## Fixtures', '## AC-23', '## AC-24', '## AC-25', '## Measurements', '375', '1280', 'POST /api/events', 'not_connected']; const miss = need.filter((s) => t.includes(s) === false); if (miss.length > 0) { console.error('missing: ' + miss.join(' | ')); process.exit(1); }"`

### Task 14: CREATE `PRPs/reports/events-and-day-view/phase-3/ui-checklist.md`

- **ACTION**: Run the mandatory UI/UX review checklist of `documentation/40-engineering/ui-ux-guidelines.md` (Tier A items 1 to 9 for every interface change, and Tier B items 10 to 14 because `DayScreen` is a new screen) on `DayScreen`, `LocalEventRow`, the changed `EventRow`, the changed *Hoje* header and the changed Agenda region, and record the result in the format of the life-areas precedent. The file has the headings `## Tier A — every interface change`, `## Tier B — a changed screen`, `## AC-23 walk`, `## AC-24 walk`, `## AC-25 walk` and `## Gate`; each of the 14 checklist items is one numbered line (`1. `, `2. `, … `14. `) that carries exactly one mark: `✔` with a `method:` that says what was actually done (static inspection of the named lines, a named suite, the build output, or a numbered observation in `live-browser-pass.md`), `✘` with the reason and a recorded exception, or `owed to the live pass` / `owed to the owner's device` for anything that needs a rendered page or a phone. Never claim a screenshot or a measurement that was not taken (guidelines §12.6). The Implementer records what it can establish without a browser and leaves the rendered clauses owed; when the orchestrator's live pass exists, its observations are cited by number and the owed marks are replaced in a follow-up edit, nothing else changing. Item 13 records the `npm run build` first-load JS and CSS gzip sizes and the precache total against guidelines §11. The three walks give one line per clause of PRD AC-23, AC-24 and AC-25, each stating the decidable half (the suite that pins it) and the observed half (or `owed`), and say plainly the two AC-23 clauses this phase deliberately does not deliver (the collapsed "next event" line, which unit 4 never built, and the sheet on tap, which is phase 4). `## Gate` records the exit status of the Level 1 to Level 3 commands and the invariant checks: `dates.ts`, `recurrence.ts` and `adherence.ts` byte-identical to `4231ee8`, the five existing suites unmodified, `test/app-route.test.ts` additive only. Implementer file: this document only. Delivers **AC-A9** and, with Task 2, **AC-A11**.
- **MIRROR**: `PRPs/reports/life-areas/phase-4/ui-checklist.md:57-61`
- **VALIDATE**: `node --input-type=module -e "import fs from 'node:fs'; const t = fs.readFileSync('PRPs/reports/events-and-day-view/phase-3/ui-checklist.md', 'utf8'); const lines = t.split(/\r?\n/); const bad = []; for (let n = 1; n <= 14; n++) { const line = lines.find((l) => l.startsWith(n + '. ')); if (line === undefined) bad.push('item ' + n + ' missing'); else if (/✔|✘|owed to/.test(line) === false) bad.push('item ' + n + ' has no mark'); } for (const h of ['## Tier A', '## Tier B', '## AC-23 walk', '## AC-24 walk', '## AC-25 walk', '## Gate']) { if (t.includes(h) === false) bad.push('missing heading ' + h); } if (bad.length > 0) { console.error(bad.join('\n')); process.exit(1); }"`

## Validation Commands

Each block starts with `set -euo pipefail` so one failure fails the block. Level 2 and Level 3 write their output to a file outside the repository, so a foreground run that ends without a summary (exit 127 on this Windows machine) can be re-run unchanged and its log read afterwards.

**Level 1 — STATIC_ANALYSIS**

```
set -euo pipefail
LOG="${TMPDIR:-/tmp}/events-phase3-l1.log"
if npm run check > "$LOG" 2>&1; then
  tail -n 5 "$LOG"
else
  tail -n 60 "$LOG"
  echo "FAIL: npm run check"
  exit 1
fi
```

**Level 2 — UNIT_TESTS**

```
set -euo pipefail
LOG="${TMPDIR:-/tmp}/events-phase3-l2-targeted.log"
if CI=1 NO_COLOR=1 npx vitest run day-range day-item day-groups task-groups agenda app-route day-view format > "$LOG" 2>&1; then
  tail -n 8 "$LOG"
else
  tail -n 80 "$LOG"
  echo "FAIL: targeted suites"
  exit 1
fi
LOG_ALL="${TMPDIR:-/tmp}/events-phase3-l2-all.log"
if CI=1 NO_COLOR=1 npx vitest run > "$LOG_ALL" 2>&1; then
  tail -n 8 "$LOG_ALL"
else
  tail -n 80 "$LOG_ALL"
  echo "FAIL: full suite"
  exit 1
fi
```

**Level 3 — INTEGRATION**

```
set -euo pipefail
LOG="${TMPDIR:-/tmp}/events-phase3-l3.log"
if npm run build > "$LOG" 2>&1; then
  tail -n 25 "$LOG"
else
  tail -n 60 "$LOG"
  echo "FAIL: npm run build"
  exit 1
fi
git diff --quiet 4231ee8 -- src/shared/dates.ts src/shared/recurrence.ts src/shared/adherence.ts
git diff --quiet 4231ee8 -- test/day-groups.test.ts test/day-item.test.ts test/day-item-event.test.ts test/agenda.test.ts test/task-groups.test.ts test/format.test.ts
if git diff --unified=0 4231ee8 -- test/app-route.test.ts | grep -E '^-[^-]' > /dev/null; then
  echo "FAIL: an existing line of test/app-route.test.ts was removed or changed"
  exit 1
fi
if grep -rE '\b(CompromissoSheet|createEvent|updateEvent|deleteEvent)\b' src/app > /dev/null; then
  echo "FAIL: phase 4 identifiers present under src/app"
  exit 1
fi
echo "PASS: build green, frozen modules byte-identical, existing suites unmodified, no phase 4 identifiers"
```

## Acceptance Criteria

- **AC-A1 (PRD AC-22):** Given `itemsInRange` and the range 2026-10-20 to 2026-10-22, when it is called with no sources, with a local-events source only, with a Google source only, and with local Events, Google Events and open dated Tasks together, then each call returns one entry per day of the range, ascending, through one code path with no branch on the source count; a multi-day all-day event appears on every day it covers (an all-day end equal to or before its start meaning one day); a timed event crossing midnight appears on both days and one ending exactly at 00:00 does not appear on the next; within a day all-day items come first, then timed items by start (ties in arrival order), then open Tasks (a Task's day is `deadline` or else `scheduledDate`; closed and undated Tasks are absent); items outside the range are absent; splitting one source's items in order across two sources returns the same result as passing them together; an inverted range returns no entries; and the function reads no clock.
- **AC-A2 (PRD AC-22):** Given Task-only input, when `collectDayItems` runs, then its result is byte-identical in behaviour to today (the existing `test/day-groups.test.ts`, `test/day-item.test.ts`, `test/day-item-event.test.ts` and `test/task-groups.test.ts` pass unmodified); `bucketOf` is an exhaustive switch over the day-item source; and a non-Task item (Google or local), even one marked closed or dated in the past, never lands in `overdue`, `done` or `missed`; `dayItemFromLocalEvent` projects an `EventDto` with the all-day `startDate` used verbatim, the timed start's owner-zone day, and `closed` always false.
- **AC-A3 (PRD AC-22, PRD AC-23):** Given the Agenda, when `agendaForToday` and `agendaItemsForToday` run, then `agendaForToday` is a thin caller of `itemsInRange` and `test/agenda.test.ts` passes unmodified; `agendaItemsForToday` lists local and Google rows together, all-day first then by start; and `decideAgendaNotice` reproduces today's Google-only notices byte for byte, shows a partial or failed Google state whatever the row count, and never returns the empty text while another source has not answered successfully.
- **AC-A4 (PRD AC-26):** Given `routeFromPath` and `pathOf`, when `/day/2026-10-20` is mapped, then the route is `day/2026-10-20` and `pathOf` returns the same path; `/day/2026-02-30`, `/day/abc` and `/day` map to `today`; and every existing route maps exactly as before, with the existing route tests unmodified.
- **AC-A5 (PRD AC-24, PRD AC-25):** Given the day screen's pure decisions, when they are evaluated, then the heading is the pt-BR long date (with the year only when it differs from today's), `adjacentDays` crosses month and year boundaries, the *Hoje* control shows only when another date is shown, the time label is `dia todo`, `HH:mm`, `HH:mm–HH:mm` or `até HH:mm` as specified (and identical to `formatEventTime` for a Google item starting on the day), the sections split into all-day, timed and Tasks, `DAY_VIEW_EMPTY` is `Nada neste dia.`, and `googleEventsPath()` without a range is exactly `/api/google/events`.
- **AC-A6 (PRD AC-23) (manual):** Given one local commitment and one Google event today, when *Hoje* loads, then *Agenda · 2* counts both, expanded it lists all-day first and then by time, the local row is solid with no checkbox (and, in this phase, inert: the sheet it will open is phase 4's AC-28), and the Google row keeps its dashed read-only look; given no local commitments, a Google-only day looks exactly as it does today; given Google down, the explicit unit-4 notice shows and local commitments still list; the collapsed header keeps showing name and count only, and the collapsed "next event" line is not delivered (recorded in Notes).
- **AC-A7 (PRD AC-24) (manual):** Given `/day/2026-10-20`, when it opens from *Hoje*'s header date or directly, then the heading shows that date, ‹ and › step one day each with a real history entry and Android back returns through the visited days, an all-day section comes first, timed commitments follow chronologically with start and end, open Tasks dated that day come last as rows that open the Task on tap, the three sources are visibly distinct (local solid, Google dashed and read-only, Task as on *Hoje*), a day with nothing reads *Nada neste dia.*, and a *Hoje* control returns to *Hoje* only when another date is shown.
- **AC-A8 (PRD AC-25) (manual):** Given a commitment created for next Tuesday, when `/day` opens for that Tuesday, then it is listed and absent from *Hoje*'s Agenda today; given Google fails or answers partially for a date, or the commitments or Tasks request fails, then `/day` shows the explicit notice or failure line, still lists what loaded, and never shows *Nada neste dia.*.
- **AC-A9 (PRD AC-30):** Given the changed and new screens, when the phase closes, then the UI/UX review checklist ✔/✘ for each is recorded under `PRPs/reports/events-and-day-view/phase-3/`, with a method for every ✔ and an explicit owed mark for anything not observed.
- **AC-A10 (PRD AC-34):** Given the new route, when `documentation/40-engineering/ui-layout-standard.md` is read, then it carries a dated amendment for the `/day/AAAA-MM-DD` route, the header date button and the Agenda stack, and does not yet claim the phase-5 items.
- **AC-A11 (PRD AC-33):** Given the phase's diff, when it is inspected, then `src/shared/dates.ts`, `src/shared/recurrence.ts` and `src/shared/adherence.ts` are byte-identical to the merge base `4231ee8`, no existing test was removed, skipped or loosened, no phase 4 identifier exists under `src/app`, and `npm run check`, `npm test` and `npm run build` pass.

R8b (the PRD AC-N token check) is satisfied: every item above carries the `(PRD AC-N)` token it derives from.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Widening the range function regresses the shipped Google Agenda on the owner's daily screen | M | H | `agendaForToday` keeps its signature and return type; `test/agenda.test.ts` stays unmodified and is a Level 2 and Level 3 gate; `formatDayItemTime` is pinned equal to `formatEventTime` for the start-day case; the live pass compares a Google-only day against a pre-change reading |
| A non-Task item is bucketed as `done` or `overdue` | M | M | `bucketOf` is an exhaustive switch (Task 2); the pair tests Google and local items marked closed and dated in the past |
| A multi-day Google all-day event, or an overnight Google event, now also appears on the later days on *Hoje* where the old start-day-only rule showed it once | L | M | Deliberate and required by AC-22 ("on every day it covers"); the old behaviour was a defect (a three-day trip vanished after day one); recorded in Notes D3-3 so it is not mistaken for a regression of "Google-only looks the same", which concerns the rows' markup |
| A day boundary lands an hour or a day off | L | H | One adapter (`dayItemPlacement`) derives every day through `todayIn(…, PRAESTO_TIMEZONE)`; an all-day date is used verbatim; a timed end is read as `end - 1` so a 00:00 end does not spill; the pair pins 22:00-local, 00:30-UTC and midnight-crossing cases; `America/Sao_Paulo` has no DST so the owner's own data would not reveal a gap bug, which is why `events.ts` already tests New York (phase 1) |
| Stepping fast lets a slow response for another day paint over the current one | M | H | The screen stays mounted, so the load effect is keyed on `day` and every request carries a counter and its day (Task 9); the live pass steps rapidly under a throttled stub |
| `/day` reads as a free day when a source failed or has not answered | M | H | `decideAgendaNotice` returns the empty text only when `othersReady` and the Google state is `ready`; a failed local or Task request renders its own `role="alert"` line; the pair tests every state; AC-A8 is exercised with forced failures in the live pass |
| The date button makes the 375 px *Hoje* header overflow, or breaks the 8 px gap rule | M | M | The button keeps the date's text and footprint, grows upward only and takes no horizontal padding (Task 10); the protocol measures the header at 375 px and the checklist records it |
| A tap on a local row in *Hoje* or on `/day` does nothing, which the owner may read as a bug | M | L | Rows carry no affordance at all (no pointer, hover, pressed or button semantics), so nothing promises a tap; the limitation is stated in AC-A6, the checklist and Notes; phase 4 wires the sheet |
| Task rows on `/day` open their sheet over *Hoje* rather than over the day | L | L | Chosen to reuse the existing `/tasks/<id>` deep link instead of wiring a second Task sheet (Notes D3-6); closing the sheet and Android back return to the day; the device proof asks whether it bothers him |
| This is the largest phase of the unit and may outrun the budget | M | M | Tasks 1 to 7 are the tested pure half and are useful alone; Tasks 8 to 14 are the UI half; no phase 4 or 5 work is pulled in, and a split would need the dated amendment note the 2026-08-29 decision requires |
| The test pair names its files differently from this plan, so a per-task `vitest run <name>` finds nothing | L | M | A vitest filter that matches no file exits non-zero, so the mismatch fails loudly; the names are fixed in Notes as the contract between plan and pair |
| Research gaps: Google's REST reference does not state that `end.date` is exclusive (only the parent `end` field and Apps Script docs do), and no source defines the label of a midnight-crossing continuation | L | L | Exclusive `end.date` is already assumed by the shipped `day-item-event` fixtures and treated defensively here (equal dates mean one day); the continuation label `até HH:mm` is this plan's decision, one function to change |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are
routed through the `test-writer`/`test-reviewer` pair's lifecycle
ledger (`/relay-write-test` → `/relay-test-write-review`), not authored
by the Implementer — R-X is a blanket straight-fail on any test glob in
the Implementer's diff. No task below and no `## Files to Change` row
targets a test file, so this plan's UI and documentation `**VALIDATE**` commands exercise the change directly (type-check, lint, format check, scripted file checks, the build) while the pure-module tasks run the pair's pre-authored suites by filename.

**Test files the pair authors (names fixed here so the per-task `VALIDATE` filters resolve).** `test/day-range.test.ts` (AC-A1), `test/day-item-local.test.ts` (the `dayItemFromLocalEvent` projection, AC-A2), `test/day-groups-local.test.ts` (non-Task items never in `overdue`, `done` or `missed`, AC-A2), `test/agenda-items.test.ts` (`agendaItemsForToday`, `decideAgendaNotice`, the copy, AC-A3), `test/day-view.test.ts` (AC-A5) and additive cases appended to `test/app-route.test.ts` (AC-A4). AC-A6, AC-A7 and AC-A8 have no test file by the methodology's "UI stays manually verified" line; their decidable logic is AC-A1 to AC-A5. **Existing tests that must pass unmodified:** `test/day-groups.test.ts`, `test/day-item.test.ts`, `test/day-item-event.test.ts`, `test/agenda.test.ts`, `test/task-groups.test.ts`, `test/format.test.ts` and the existing assertions of `test/app-route.test.ts`. If a legitimate behavioural change ever forces one of them to move, the pair updates it through the lifecycle ledger and never loosens it.

**Who runs what.** The Implementer has no browser. Tasks 13 and 14 make it write the protocol and the checklist; the orchestrator (or the owner) runs the protocol in the browser pane and records `live-browser-pass.md` beside them, after which the `owed to the live pass` marks are replaced with the observed result. Anything the pane cannot show stays `owed to the owner's device` and is picked up by phase 5's device proof.

**Decisions made by this plan (D3-n), so a reviewer can challenge them.**

- **D3-1 — Days are the owner's days.** Every day derived from an instant uses `PRAESTO_TIMEZONE`, and every clock time shown is in that zone, for local and Google items alike. This matches `dayItemFromEvent`, `formatEventTime` and the server's range read (`dayRangeInstants` defaults to the owner's zone). An Event's own `timezone` does not move it to another day or change its displayed time in this phase.
- **D3-2 — Sources carry day items.** `itemsInRange` takes the existing `DayItemSource` (a named list of `DayItem`s), so the PRD's signature and unit 16's reuse hold; `dayItemPlacement` is the one seconds/milliseconds adapter the PRD asks for.
- **D3-3 — Spans.** An Event covers every day it occupies: an all-day Event by its exclusive end, a timed one up to the day of its last instant (`end - 1`), so an Event ending exactly at 00:00 stays on its start day. Google rows now follow the same rule; the shipped Agenda placed a Google event only on its start day, which dropped the second and third day of a trip and the post-midnight half of an overnight event. The old behaviour is not preserved because AC-22 requires the new one for all three sources.
- **D3-4 — Ordering.** All-day first, timed by start, Tasks last; ties keep arrival order because `test/agenda.test.ts:150-159` pins it. Split-invariance is therefore claimed for order-preserving splits only.
- **D3-5 — Local rows are inert in this phase.** The PRD's "opens its sheet on tap" belongs to AC-28 (phase 4). A tappable row that does nothing is dishonest; an inert row with no affordance is safe and honest. Phase 4 adds the `onOpen`.
- **D3-6 — Opening a Task from `/day`.** A Task row calls `navigate(taskRouteOf(id))`, reusing the notification deep link: `TodayScreen` opens the Task's sheet once its list loads. Cost: the sheet opens over *Hoje*, and the URL stays `/tasks/<id>` after it closes; Android back then returns to the day. A second Task sheet inside `DayScreen` would repeat the whole sheet wiring that `SearchScreen` already had to duplicate from `TodayScreen`.
- **D3-7 — The *Hoje* control leaves for the *Hoje* screen.** It calls `navigate("today")`, one tap out of the day view, and is hidden when the day shown is today. *Voltar* and `Esc` pop one history entry. Whether the date in the header is discoverable enough as a door is the PRD's open question, asked at the device proof.
- **D3-8 — Non-Task items in `collectDayItems`.** Never `closed`-sensitive, never `overdue`; on or before today they fall in `today`, after it in `upcoming`, undated in `undated`. No screen feeds them there; the rule exists so the switch is total and the failure mild.
- **D3-9 — Open Tasks are fetched by the existing list route.** `GET /api/tasks?status=open&from=D&to=D` already compares `coalesce(deadline, scheduled_date)`, so no endpoint is added and a Task with neither date is never in range.
- **D3-10 — Copy.** Only the PRD's *Nada neste dia.*, the existing Agenda and Google-failure strings, and the guideline's canonical *Anterior/Próximo* and *Voltar* are used; section `aria-label`s reuse PRD terms (*Dia inteiro*, *Compromissos*, *Tarefas*); the continuation label *até HH:mm* is new and flagged here for the owner. `ALL_DAY_LABEL` (*dia todo*) is still the unit-4 value pending his confirmation.

**Two discrepancies the owner should see.** (1) PRD AC-23 and layout standard §2.4 say the collapsed Agenda "names the next one", but unit 4 shipped a collapsed state of name and count only; building the line now would change the Google-only look AC-23 requires unchanged, so it is not built and Task 12 records the standard as it really is. (2) Layout standard §2.3 still says the *Com hora* chip "returns as an option only when Event ships in unit 14"; this phase ships Event UI but the PRD (D-Q) keeps the chip withdrawn, and the correcting amendment is phase 5's (AC-34).

**Exempt glue.** `src/app/api.ts`, the screens and the rows are browser glue under `docs/context/methodology.md`; their decidable parts are in `src/shared` and tested. `scripts/check-mirror-inventory.mjs` already fails on `main` and is neither relied on nor fixed here.

*Generated: 2026-10-19*
*Approved: 2026-10-19*
*Implemented: 2026-10-19*
*Status: IMPLEMENTED*
