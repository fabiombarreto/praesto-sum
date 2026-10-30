# Feature: The Compromisso sheet and search results (Phase 4 of events-and-day-view)

```
**Decision Gate**
- Active context: none
- Activated criteria: shared UI (one new sheet reused by three screens, a changed row on two of them, a changed search route and a changed Agenda on the owner's daily screen); domain rules for events (create, edit and delete of an Event, the time model, the source guard) and the closed `EDITABLE_EVENT_FIELDS` wire contract consumed by a client for the first time; a pure draft and patch module over a PATCH-merge contract; a change to a shared UI primitive (`ConfirmView` gains one optional prop); search (FR-040 extended to Events); offline and failure states; no schema, migration, endpoint, DTO, export or cron change
- Decisions found:
  - ADR-0016 / PRD D-E, D-F: a timed Event is two UTC instants (epoch seconds) plus a never-null IANA zone, an all-day Event is local days with an EXCLUSIVE end shown inclusive; the wire carries seconds and the zone, the client resolves wall-clock through the shared helper (`wallClockToInstant`, RFC 5545 gap and overlap rule) and the server validates through the same `validateEventInput`.
  - ADR-0016 / PRD D-L: the `CompromissoSheet` follows the Task sheet's pattern, opens from *Novo compromisso* on `/day` and by tapping a local row; the capture deck stays Task-only; the delete is real and asks once.
  - PRD D-M: `GET /api/events?q=` feeds a *Compromissos* group in search; Google events are never searched.
  - ADR-0007 / PRD D-I: `eventCapabilities(source)` decides what the UI offers; a Google row is neither editable nor deletable and opens in Google; unit 14 creates only `local` rows.
  - ADR-0003: one Worker, no offline write queue; every write waits for the server and fails inline; offline disables writes with the existing banner copy.
  - ADR-0009: visible copy is pt-BR as string VALUES; identifiers, comments and tests stay English. Every new visible string is listed in Notes for the owner's approval.
  - ADR-0008 and `docs/context/methodology.md`: test-first for `src/shared`; React components stay manually verified, so the decidable logic is extracted and tested and only glue is verified in the browser pane and on the device.
  - ADR-0010 / ADR-0011: tokens only, owned components under `src/app/components/ui/`, a native `<dialog>` sheet whose close and cancel events are mirrored.
  - PRD D-V (2026-10-21): AC-17 and AC-23 were amended in place by the owner; the phase-3 strings were approved; D3-3 stands; the 36 px *Pesquisar*/*Configurações* buttons are left out of this unit.
  - [2026-08-29] an APPROVED PRD's phase table may only grow with a dated amendment note: this plan adds no row and moves no work between phases.
- Applicable anti-patterns:
  - Offline write queue: none; a write waits for the server, is disabled offline and a failed one stays inline.
  - Hand-duplicated entity types: `EventDraft` is a form model, not an entity; the wire types (`EventDto`, `CreateEventInput`, `UpdateEventInput`) are imported from `src/shared/api.ts` and never redeclared.
  - Using `updated_at` as the sync dirty flag and any client-side hash: the client never computes or sends `contentHash`; the closed key set already refuses it on `POST` and `PATCH`.
  - Weakening tests to force green: no existing test is edited; the suites listed in Notes pass unmodified.
  - Glossary synonym drift: `Event` in code, docs and API; *Compromisso* is pt-BR copy and the PRD-named component `CompromissoSheet`; every other identifier says Event.
  - Portuguese in artifacts: only string values are Portuguese.
  - Editing accepted ADRs: none is touched.
- Applicable architectural rules:
  - `src/shared/` carries no DOM globals, no Worker globals and no clock reads; "now" is an argument.
  - Types flow schema, `dto.ts`, `src/shared/api.ts`: this phase adds no DTO and no endpoint; the client wrappers are one-liners over `request<T>()`.
  - One writer: `src/worker/event-repository.ts` stays the only writer of `events` and the only place the hash is computed; `test/event-api-inspection.test.ts` and `test/source-invariants.test.ts` scan `src/` including `src/app`, so no client file may spell a write to `events` or a Calendar mutation.
  - `src/shared/dates.ts`, `recurrence.ts` and `adherence.ts` stay byte-identical to `HEAD`; `src/shared/events.ts` and `src/shared/event-hash.ts` are not touched.
  - Every `/api/events` route stays behind the bearer gate; the client sends the token through `request()` only.
  - Every change under `src/app/` runs the `ui-ux-guidelines.md` review checklist and records the result under `PRPs/reports/events-and-day-view/phase-4/`; never stack sheets (layout standard §3).
  - Phase boundary: release `v0.14.0`, chore C6, the remote migration, the device proof, the glossary, domain-model, FR traceability, roadmap and layout-standard amendments are phase 5 (AC-31..AC-34).
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/events-and-day-view.prd.md` — Implementation Phases row 4: "The Compromisso sheet and search results" — Goal: the owner can create, change and delete a commitment on his phone and find it by words — Success signal: AC-27 green; AC-28, AC-29 and AC-30 recorded.

## Summary

Phases 1 to 3 gave the owner's commitments a validated, stored, exported and listed shape, but nothing in the app can create, change, delete or search one: the local rows on `/day` and on *Hoje*'s Agenda are inert on purpose (phase-3 decision D3-5) because the sheet did not exist. This phase builds the sheet and its pure core. Three new `src/shared` modules carry every decision and are written test-first: `event-edit.ts` (the draft, its seeds, its errors, the create input, the minimal PATCH, the end the owner has not typed yet, the zone choices), `event-sheet.ts` (the state machine that keeps one draft per commitment for the session) and `event-view.ts` (the pt-BR copy a function chooses, the write-failure mapping, the search path, label and body decision). The React half is a `CompromissoSheet`, a `useEventSheet` hook that the three screens share so they cannot drift, a local row that finally opens it, a *Novo compromisso* button on `/day`, the sheet wired into *Hoje*'s Agenda, and a *Compromissos* group in search fed by `GET /api/events?q=`. Offline disables every write with the existing banner words, a failed save stays inline and persistent, and the lists refetch after every accepted write. 11 tasks, 13 files, no test file, no migration, no endpoint.

## User Story

```
As the owner of Praesto Sum
I want to create, change and delete a commitment from a sheet on my phone, and find one by typing a few words
So that Praesto becomes the place where I record and look up my commitments, without opening Google Calendar
```

## Problem Statement

Praesto holds the owner's Tasks and shows his Google Calendar read-only, but it cannot hold a commitment of its own: anything that happens at a time of day has to be created, edited and checked in Google Calendar. After phases 1 to 3 the commitment exists in D1, behind `/api/events`, in the export and on two screens, but the only way to make one is `curl`. The row that would open its sheet was deliberately left inert, so a commitment shown on *Hoje* or `/day` cannot even be corrected, and a commitment typed into search finds nothing because search knows only Tasks. Without this phase the unit's exit signal ("the owner created a local commitment without missing any field Google has") is unreachable.

## Solution Statement

Add a Compromisso sheet in the Task sheet's pattern and keep every decision in tested pure code. `src/shared/event-edit.ts` turns the sheet's form model (wall-clock day and time parts in the commitment's own zone, an inclusive last day for all-day) into the exact `POST` body and the minimal `PATCH`, resolving instants through the shared `wallClockToInstant`/`validateEventInput` so the sheet and the route cannot disagree, and decides the one inline reason the PRD names (an end before the start). `src/shared/event-sheet.ts` keeps one draft per commitment, plus one per day for new ones, and holds a snapshot of the commitment being edited so no screen's list can pull the sheet out from under the owner. `src/shared/event-view.ts` owns the copy that a function chooses. A shared `useEventSheet` hook runs the create, update and delete requests, keeps the failure inline and tells its screen to refetch; `CompromissoSheet` renders it with the existing `Sheet`, `Button`, `Chip`/`ChipGroup`, `Banner` and `ConfirmView`. `/day` gets *Novo compromisso*, both screens' local rows become real buttons that open the sheet, and search gets a *Compromissos* group beside the Task groups with its own request, its own failure line and a tested decision about when it may say "nothing found". This route was chosen over a time-quick-capture in the deck (PRD D-L: the deck is zero-friction capture of Tasks) and over a second sheet per screen (the Task sheet already had to be duplicated once).

## Metadata

| Key | Value |
|---|---|
| Type | Feature (three pure shared modules, one hook, one sheet, three wired screens) |
| Complexity | High — a form model over a PATCH-merge contract with a DST-aware time model, a sheet shared by three screens that each have their own sheet, Esc and stale-response hazards, and a search route that gains a second independent request |
| Systems Affected | `src/shared/` (event-edit, event-sheet, event-view), `src/app/` (api client, ConfirmView, LocalEventRow, CompromissoSheet, useEventSheet, DayScreen, TodayScreen, SearchScreen), `PRPs/reports/events-and-day-view/phase-4/` |
| Dependencies | Phase 3 (`complete`): `LocalEventRow`, `DayScreen`, `listEvents`, `agendaItemsForToday`; phase 2: `POST/PATCH/DELETE/GET /api/events` with `?q=` (at least 2 characters, 400 below that), the closed `EDITABLE_EVENT_FIELDS`, the PATCH merge rule; phase 1: `src/shared/events.ts` (`wallClockToInstant`, `instantToWallClock`, `validateEventInput`, `allDaySpanFromInclusive`, `displayEndDay`, `isValidTimeZone`, `eventCapabilities`) |
| Estimated Tasks | 11 |
| phase_type | feature |
| Source PRD line ref | `PRPs/prds/events-and-day-view.prd.md:213` (Implementation Phases row 4); Phase Details `:233-236`; AC-27..AC-30 at `:96-99`; amended AC-17 and AC-23 at `:86` and `:92`; Decisions Log D-L, D-M, D-V at `:260`, `:261`, `:270` |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `PRPs/prds/events-and-day-view.prd.md` | 86, 92, 96-99, 105-115, 185-187, 213, 233-236, 260-261, 270 | AC-27..AC-30, the amended AC-17 and AC-23, the Open Questions this plan answers (zone select, default start), the UI architecture note, row 4 and its Phase Details, decisions D-L, D-M, D-V |
| P0 | `src/shared/task-edit.ts` | 17-98 | The draft type, `buildTaskPatch` (only changed keys, empty means nothing to save) and `effectiveLifeAreaId`: the pattern `event-edit.ts` follows |
| P0 | `src/shared/task-sheet.ts` | 26-134 | The sheet state machine: one draft per Task, `open` restores a kept draft, `close` keeps every draft, `saved` and `deleted` drop one |
| P0 | `src/shared/events.ts` | 78-107, 135-163, 165-236, 243-373 | The error vocabulary, `wallClockToInstant`/`instantToWallClock`, `isValidLocalDay`, `shiftLocalDay`, `displayEndDay`, `allDaySpanFromInclusive`, `isValidTimeZone`, the input and resolved types, `resolveEventTimes` and `validateEventInput` that every builder must go through |
| P0 | `src/shared/api.ts` | 251-376 | `EventDto` (seconds), `CreateEventInput`, `UpdateEventInput`, `EDITABLE_EVENT_FIELDS`, `EventsResponse`, `EventResponse`, `MAX_EVENT_SEARCH_RESULTS` |
| P0 | `src/worker/routes/events.ts` | 189-197, 242-304 | The server contract the builders target: the `q` floor of 2 (400 below), the PATCH merge (absent key keeps, `null` clears, toggling `allDay` carries only the target shape, a start moved past the stored end is a 400) |
| P0 | `src/app/components/TaskSheet.tsx` | 155-243, 707-782 | The sheet this one mirrors: last-draft refs for the exit transition, the label and input classes, *Cancelar*/*Salvar*, the inline `role="alert"` error, the distant *Excluir*, the `ConfirmView` that repeats the verb |
| P0 | `src/app/components/ui/Sheet.tsx` | 35-122 | The native `<dialog>` primitive: `open`, `onOpenChange`, `title`, the `close` and `cancel` mirror that makes Esc and the back gesture work |
| P0 | `src/app/components/ui/ConfirmView.tsx` | 14-73 | The confirmation that gains the optional `confirmDisabled` prop |
| P0 | `src/app/components/LocalEventRow.tsx` | 1-49 | The inert row that becomes a button; its header comment records the D3-5 decision this phase closes |
| P0 | `src/app/components/DayScreen.tsx` | 84-125, 127-154, 200-238, 340-460 | The screen that gains *Novo compromisso* and the sheet: the per-source request counters, the `loadLocal` loader, the unguarded `Escape` handler, the `local` row case |
| P0 | `src/app/components/TodayScreen.tsx` | 175-183, 285-295, 353-378, 409-424, 800-871, 978-1028, 1312-1341 | The Agenda row render, `refreshLocalEvents` (no stale guard yet), `refreshAdherence` (the guard to copy), the `/` shortcut guard and the never-stack-sheets gating |
| P0 | `src/app/components/SearchScreen.tsx` | 61-130, 144-192, 387-474 | The Task search this phase extends: the debounce and abort, the empty-state chain, the group render, the Esc gating |
| P0 | `src/app/api.ts` | 89-115, 248-266, 297-310 | `request<T>()` and `ApiError`, the create/update/delete wrapper trio to mirror, `listEvents` |
| P0 | `PRPs/reports/events-and-day-view/phase-3/ui-checklist.md` | 28-33, 105-122, 169-185 | The record format of the checklist, the AC-23 clauses that say "inert" and are superseded here, the plan-deviation format |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 40-45, 75-92, 93-104, 105-121, 146-168 | §3 targets, §8 states (field error, request error, offline, irreversible delete, dirty editor closed), §9 copy, §10 accessibility and the review checklist this phase must run and record |
| P1 | `src/shared/life-areas-view.ts` | 86-118 | The per-status write-failure mapping with `staleList` that `eventWriteFailure` mirrors |
| P1 | `src/shared/request-failure.ts` | 39-57 | The generic classifier the mapping falls back to (it never reads the server's message) |
| P1 | `src/shared/search.ts` | 118-134 | `SEARCH_MIN_QUERY_LENGTH` and `shouldSearch`, the client-side floor the events request must respect |
| P1 | `src/shared/day-view.ts` | 132-145 | `eventsRangePath`/`googleEventsPath`, the path-builder idiom `eventsSearchPath` follows |
| P1 | `src/shared/format.ts` | 39-51, 208-231 | `ALL_DAY_LABEL` (exported) and `formatEventTime`, the time-label rules the search label must agree with |
| P1 | `src/app/components/EventRow.tsx` | 54-128 | The Google row (read-only, link) the local row sits beside; `timeColumnClassName` and the `li > a` structure the button row copies |
| P1 | `src/app/components/ui/Chip.tsx` | 11-59 | `ChipGroup`/`Chip` for the *Dia inteiro* toggle (48 px targets, on-state by fill and check) |
| P1 | `src/app/components/ui/Button.tsx` | 9-30 | The variants (`primary`, `secondary`, `ghost`, `icon`) and the 48 px minimum height |
| P1 | `src/app/components/ui/Banner.tsx` | 15-36 | The offline banner reused inside the sheet |
| P1 | `src/app/hooks/useSeriesSheet.ts` | 12-45 | The hook precedent: glue shared by *Hoje* and search so two sheets cannot drift |
| P1 | `test/source-invariants.test.ts` | 73-82 | The Calendar-mutation tripwire over all of `src/`: no `events.update`, `events.delete` and the like in client code |
| P1 | `test/event-api-inspection.test.ts` | 61-65, 145-151 | The one-writer tripwire over all of `src/`, `src/app` included |
| P2 | `PRPs/reports/events-and-day-view/phase-3/live-pass-protocol.md` | 3-37, 87-137, 232-262 | The protocol format, setup, fixture script and `window.fetch` stub this phase's protocol reuses |
| P2 | `documentation/40-engineering/ui-layout-standard.md` | 31, 38, 40-44, 68 | Read only: §2.4 says the local rows are inert, §3 describes the Task sheet, §6 says the Compromisso sheet is "not described here yet" — phase 5 (AC-34) amends them |
| P2 | `tsconfig.app.json` | 1-10 | `lib: ES2022, DOM`: `Intl.supportedValuesOf` is typed for the component that calls it; `src/shared` compiles under `ES2022` only (`tsconfig.test.json`) |

## Patterns to Mirror

```ts
# SOURCE: src/shared/task-edit.ts:62-86
export function buildTaskPatch(original: TaskDto, draft: TaskDraft): UpdateTaskInput {
  const patch: UpdateTaskInput = {};

  const title = draft.title.trim();
  // An empty title is a 400 and so is an empty body; the owner should meet
  // neither. Emitting nothing lets the caller abandon the edit silently.
  if (title !== "" && title !== original.title) patch.title = title;

  const description = draft.description.trim();
  const nextDescription = description === "" ? null : description;
  if (nextDescription !== original.description) patch.description = nextDescription;

  if (draft.priority !== original.priority) patch.priority = draft.priority;

  // Emitted only when the owner chose a value that differs from the Task's own
  // (set, change, or clear with `null`): an unchanged area is never sent, because
  // any key on this PATCH detaches an occurrence from its series (ADR-0006).
  if (draft.lifeAreaId !== undefined && draft.lifeAreaId !== original.lifeAreaId) {
    patch.lifeAreaId = draft.lifeAreaId;
  }

  applyDate(patch, original, draft);

  return patch;
}
```

Copied by Task 1 (a patch carries only the keys that changed, and an empty one means "nothing to save").

```ts
# SOURCE: src/shared/events.ts:207-216
export function allDaySpanFromInclusive(
  startDate: string,
  lastDayInclusive?: string | null,
): EventResult<{ startDate: string; endDate: string }> {
  if (!isValidLocalDay(startDate)) return fail("startDate", "invalid_date");
  const lastDay = lastDayInclusive ?? startDate;
  if (!isValidLocalDay(lastDay)) return fail("endDate", "invalid_date");
  if (lastDay < startDate) return fail("endDate", "end_not_after_start");
  return { ok: true, value: { startDate, endDate: shiftLocalDay(lastDay, 1) } };
}
```

Copied by Task 1 (the owner types an INCLUSIVE last day; the stored end is exclusive).

```ts
# SOURCE: src/shared/events.ts:158-163
export function instantToWallClock(
  epochSeconds: number,
  timeZone: string,
): { day: string; time: string } {
  return instantToLocalParts(epochSeconds, timeZone);
}
```

Copied by Task 1 (the draft's date and time parts are the wall clock in the Event's OWN zone).

```ts
# SOURCE: src/shared/task-sheet.ts:75-97
export function reduceTaskSheet(state: TaskSheetState, event: TaskSheetEvent): TaskSheetState {
  switch (event.type) {
    case "open":
      // An existing draft is restored untouched — the AC-12 rule — so only a
      // Task with no kept draft yet gets seeded here.
      return {
        taskId: event.task.id,
        view: "detail",
        drafts: {
          ...state.drafts,
          [event.task.id]: state.drafts[event.task.id] ?? draftFromTask(event.task),
        },
      };
    case "edit": {
      const { taskId } = state;
      if (taskId === null) return state;
      const draft = state.drafts[taskId];
      if (draft === undefined) return state;
      return {
        ...state,
        drafts: { ...state.drafts, [taskId]: { ...draft, ...event.changes } },
      };
    }
```

Copied by Task 2 (`open` restores a kept draft, `edit` merges into the open one, every no-op returns the very same state object).

```ts
# SOURCE: src/shared/task-sheet.ts:119-132
    case "close":
      if (state.taskId === null) return state;
      return { ...state, taskId: null, view: "detail" };
    case "saved":
    case "deleted": {
      // Drop only `event.taskId`'s draft — a fresh copy via `Object.entries`,
      // never a mutation of `state.drafts`; every other draft keeps its exact
      // reference, since `Object.fromEntries` re-maps entries, it does not
      // clone their values.
      const drafts = Object.fromEntries(
        Object.entries(state.drafts).filter(([id]) => id !== event.taskId),
      );
      return { taskId: null, view: "detail", drafts };
    }
```

Copied by Task 2 (`close` keeps every draft; `saved` and `deleted` drop exactly one).

```ts
# SOURCE: src/shared/life-areas-view.ts:86-118
/** The numeric `status` of a caught cause, duck-typed exactly as `classifyRequestFailure` does. */
function statusOf(cause: unknown): number | null {
  if (typeof cause !== "object" || cause === null || !("status" in cause)) return null;
  const { status } = cause as { status: unknown };
  return typeof status === "number" ? status : null;
}

/**
 * Maps a failed create, rename or delete to a fixed pt-BR sentence and says
 * whether the list on screen can no longer be trusted (plan AC-A6). The
 * server's own error text carries a field marker meant for tools, so it is
 * never shown. 404 and 409 mean another device changed the areas first, hence
 * `staleList`: the screen shows the message and refetches. A 401 never reaches
 * this function — the screen routes it to the token gate first.
 */
export function lifeAreaWriteFailure(cause: unknown): { message: string; staleList: boolean } {
  switch (statusOf(cause)) {
    case 400:
      return {
        message: "O nome não foi aceito. Confira o nome e tente de novo.",
        staleList: false,
      };
    case 404:
      return { message: `Essa área não existe mais. ${LIST_REFRESHED}`, staleList: true };
    case 409:
      return {
        message: `Esse nome já existe ou o limite de ${LIFE_AREA_LIMIT} áreas foi atingido. ${LIST_REFRESHED}`,
        staleList: true,
      };
    default:
      return { message: classifyRequestFailure(cause).message, staleList: false };
  }
}
```

Copied by Task 3 (a fixed pt-BR sentence per status, `staleList` for "another device changed it first", the server's text never shown).

```ts
# SOURCE: src/app/api.ts:248-266
export async function createLifeArea(input: CreateLifeAreaInput): Promise<LifeAreaDto> {
  const body = await request<{ lifeArea: LifeAreaDto }>("/api/life-areas", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.lifeArea;
}

export async function updateLifeArea(id: string, input: UpdateLifeAreaInput): Promise<LifeAreaDto> {
  const body = await request<{ lifeArea: LifeAreaDto }>(`/api/life-areas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.lifeArea;
}

export async function deleteLifeArea(id: string): Promise<void> {
  await request<void>(`/api/life-areas/${id}`, { method: "DELETE" });
}
```

Copied by Task 4 (one-liners over `request<T>()`, no local types, no error re-mapping).

```tsx
# SOURCE: src/app/components/ui/ConfirmView.tsx:49-70
      <div className="flex gap-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onConfirm}
          disabled={busy}
        >
          <Trash2 className="size-5" aria-hidden="true" />
          {confirmLabel}
        </Button>
      </div>
```

Copied by Task 5 (the second button is where `confirmDisabled` joins `busy`; *Cancelar* must stay enabled offline).

```tsx
# SOURCE: src/app/components/EventRow.tsx:114-128
  return (
    <li>
      <a
        href={event.htmlLink}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(ROW_CLASSNAME, "w-full no-underline")}
      >
        {content}
        {/* Appended to the accessible name rather than replacing it: a reader
            hears the event, then where the link goes. An `aria-label` here
            would silence the title. */}
        <span className="sr-only">— {DESTINATION}</span>
      </a>
    </li>
  );
```

Copied by Task 8 (`li` around a full-width control that carries the row classes; no `aria-label` that would hide the visible text).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:155-162
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastTask = useRef<TaskDto | null>(null);
  if (task !== null) lastTask.current = task;
  const lastDraft = useRef<TaskDraft | null>(null);
  if (draft !== null) lastDraft.current = draft;
  const shown = task ?? lastTask.current;
  const shownDraft = draft ?? lastDraft.current ?? (shown === null ? null : draftFromTask(shown));
  if (shown === null || shownDraft === null) return null;
```

Copied by Task 6 (the exit transition keeps rendering what the owner last saw instead of popping empty).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:218-228
          <label htmlFor="sheet-title" className="m-0 font-data text-t1 font-semibold text-muted">
            Título
          </label>
          <input
            id="sheet-title"
            type="text"
            value={shownDraft.title}
            onChange={(event) => onDraftChange({ title: event.target.value })}
            disabled={busy}
            className="min-h-12 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
          />
```

Copied by Task 6 (a visible label, a 48 px field, the token classes of an input).

```tsx
# SOURCE: src/app/components/TaskSheet.tsx:707-742
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={busy || recurrenceError !== null}
            >
              Salvar
            </Button>
          </div>

          {error !== null && (
            <p role="alert" className="m-0 font-text text-t2 text-overdue">
              {error}
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            className="mt-4 self-start text-muted"
            onClick={onDeleteRequest}
            disabled={busy}
          >
            <Trash2 className="size-5" aria-hidden="true" />
            Excluir
          </Button>
```

Copied by Task 6 (the two buttons, the persistent inline request error under them, the distant *Excluir* that opens the confirmation).

```ts
# SOURCE: src/app/hooks/useSeriesSheet.ts:27-42
export function useSeriesSheet(
  sheetTask: TaskDto | null,
  onUnauthorized: () => void,
): {
  series: SeriesDto | null;
  /** Set when the series could not be loaded, so the sheet says so instead of going quiet. */
  seriesError: string | null;
  ruleDraft: SeriesRuleDraft | null;
  changeRuleDraft: (changes: Partial<SeriesRuleDraft>) => void;
  applyTo: ApplyTo;
  setApplyTo: (next: ApplyTo) => void;
  /** Replace the loaded series after a successful edit, so the drafts re-seed from the truth. */
  acceptSeries: (next: SeriesDto) => void;
  /** The nudge switch's own write state; `setEnabled(true)` means "notify me". */
  nudge: { pending: boolean; error: string | null; setEnabled: (enabled: boolean) => void };
} {
```

Copied by Task 7 (a hook that takes `onUnauthorized`, owns the sheet's glue and returns what the screens render, so two or three sheets cannot drift).

```ts
# SOURCE: src/app/components/DayScreen.tsx:229-238
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      // The inline title editor claims `Esc` for itself (it cancels the edit and
      // calls `preventDefault`), so that keystroke must not also leave the day.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back]);
```

Copied by Task 8 (this handler is not gated on an open sheet; the same Esc that closes the native dialog would also leave the day).

```ts
# SOURCE: src/app/components/TodayScreen.tsx:409-424
  async function refreshAdherence(): Promise<void> {
    // Only the newest request may write, so a slow older response cannot
    // overwrite fresher data.
    const mine = ++latestAdherenceRequest.current;
    try {
      const response = await fetchAdherence();
      if (mine === latestAdherenceRequest.current) setAdherence(response);
    } catch (cause) {
      if (mine !== latestAdherenceRequest.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setAdherence(null);
    }
  }
```

Copied by Task 8 (the stale-response guard `refreshLocalEvents` lacks).

```tsx
# SOURCE: src/app/components/TodayScreen.tsx:1312-1325
      {/* Never stack sheets (layout standard §3): gated on the same
          condition the toast slot above already uses. */}
      <FilterSheet
        open={filtersOpen && sheet.taskId === null}
        onOpenChange={setFiltersOpen}
        filter={filter}
        onChange={setFilter}
        areas={lifeAreas}
      />

      {/* Never stack sheets (layout standard §3): the Task sheet and the
          standalone Reminder sheet can never both be open. */}
      <ReminderSheet
        open={reminderSheetState !== null && sheet.taskId === null}
```

Copied by Task 8 (the Compromisso sheet joins the never-stack gating).

```ts
# SOURCE: src/app/components/SearchScreen.tsx:112-130
  /** Issues one `GET /api/tasks?q=` for `q`, aborted via `signal` (AC-A3). */
  async function search(q: string, signal: AbortSignal): Promise<void> {
    try {
      const next = await listTasks({ ...EMPTY_FILTER, q }, undefined, signal);
      setResults(next);
      setSearchError(null);
    } catch (cause) {
      // An aborted request is a superseded one, not a real failure.
      if (signal.aborted) return;
      const message = handleFailure(cause);
      if (message !== null) setSearchError(message);
    }
  }

  /** Re-issues the current debounced search — the sheet's own post-mutation refresh, never a full list fetch. */
  function rerunSearch(): Promise<void> {
    if (!shouldSearch(debounced)) return Promise.resolve();
    return search(debounced, new AbortController().signal);
  }
```

Copied by Task 9 (the commitments search is this function's sibling with its own atoms).

```ts
# SOURCE: src/app/components/SearchScreen.tsx:155-164
  useEffect(() => {
    if (!shouldSearch(debounced)) {
      setResults(null);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    void search(debounced, controller.signal);
    return () => controller.abort();
  }, [debounced]);
```

Copied by Task 9 (below the minimum length nothing is requested and stale results are cleared; a newer keystroke aborts the older request).

```ts
# SOURCE: src/app/components/SearchScreen.tsx:181-192
  useEffect(() => {
    // Gated on the sheet: an open TaskSheet is a native <dialog> with its own
    // Escape/back-gesture handling, which this listener must never double-fire
    // underneath.
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      if (sheet.taskId !== null) return;
      back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back, sheet.taskId]);
```

Copied by Task 9 (and by Task 8 for the same gating on `/day`).

```
# SOURCE: PRPs/reports/events-and-day-view/phase-3/ui-checklist.md:28-33
## Tier A — every interface change

1. ✔ — method: static inspection. `DayScreen` has no `primary` button: its controls are *Voltar*, the two arrows, the
   ghost *Hoje* (only when another date is shown), the secondary *Tentar de novo* (only after a failed read) and the
   Task rows that already exist on *Hoje*. The header date is the existing text turned into a control, not a new element
   beside it; *Hoje* keeps the capture deck as its one primary action. `LocalEventRow` carries no control at all.
```

Copied by Task 11 (the numbered item with a mark and an honest `method:`).

```
# SOURCE: PRPs/reports/events-and-day-view/phase-3/live-pass-protocol.md:3-10
This is the executable protocol for the verification that three manual acceptance criteria of the phase need
(PRD AC-23, AC-24, AC-25; plan AC-A6, AC-A7, AC-A8). The Implementer has no browser, so it wrote this document and did
not run it. The orchestrator (or the owner) runs it in the browser pane — Chromium at 375 x 812 and at 1280 x 800,
dark — and records the outcome as `PRPs/reports/events-and-day-view/phase-3/live-browser-pass.md`, in the format of
`PRPs/reports/life-areas/phase-4/live-browser-pass.md`: a short preamble saying how it was run, a `Measured` table,
`Observed behaviour` as numbered items, and the findings that need a change. The marks that
`PRPs/reports/events-and-day-view/phase-3/ui-checklist.md` leaves as `owed to the live pass` are then replaced by a
citation of those numbered observations, and nothing else in that file changes.
```

Copied by Task 10 (the protocol's preamble, rules and the "what the pane cannot show" closing).

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/event-edit.ts` | CREATE | The draft, its seeds, its errors, the create input, the minimal PATCH, the end preview and the zone choices: the pure core of AC-27 (Implementer file) |
| `src/shared/event-sheet.ts` | CREATE | The sheet state machine: one draft per commitment, one per day for new ones, a snapshot of the commitment being edited (Implementer file) |
| `src/shared/event-view.ts` | CREATE | The pt-BR copy a function chooses, the write-failure mapping, the search path, the search row label and the search body decision (Implementer file) |
| `src/app/api.ts` | UPDATE | `createEvent`, `updateEvent`, `deleteEvent` and `searchEvents` wrappers (Implementer file) |
| `src/app/components/ui/ConfirmView.tsx` | UPDATE | An optional `confirmDisabled` prop so a confirmation can disable only its destructive button offline (Implementer file) |
| `src/app/components/LocalEventRow.tsx` | UPDATE | The inert row becomes a button with a required `onOpen`; closes plan decision D3-5 (Implementer file) |
| `src/app/components/CompromissoSheet.tsx` | CREATE | The sheet: fields in the PRD's order, inline reasons, the resolved-end hint, offline banner, the irreversible confirmation (Implementer file) |
| `src/app/hooks/useEventSheet.ts` | CREATE | The glue the three screens share: the reducer, the requests, the inline failure and the refetch callback (Implementer file) |
| `src/app/components/DayScreen.tsx` | UPDATE | *Novo compromisso*, the sheet, the local row's `onOpen`, the Esc gating (Implementer file) |
| `src/app/components/TodayScreen.tsx` | UPDATE | The Agenda's local row opens the sheet, the sheet joins the never-stack gating, `refreshLocalEvents` gets the stale-response guard, the `/` guard ignores a select (Implementer file) |
| `src/app/components/SearchScreen.tsx` | UPDATE | The *Compromissos* group, the second request, the tested body decision, the sheet and the Esc gating (Implementer file) |
| `PRPs/reports/events-and-day-view/phase-4/live-pass-protocol.md` | CREATE | The executable protocol for the browser-pane pass that verifies AC-28, AC-29 and AC-30 (Implementer file) |
| `PRPs/reports/events-and-day-view/phase-4/ui-checklist.md` | CREATE | The recorded UI/UX review checklist and the AC-28, AC-29 and AC-30 walks (Implementer file) |

## NOT Building (Scope Limits)

- **Release `v0.14.0`, chore C6, the remote migration, the device proof and every documentation amendment** — phase 5 (AC-31..AC-34). That includes `documentation/40-engineering/ui-layout-standard.md` (its §2 item 4 still says the local rows are inert "until the Compromisso sheet ships", §3 describes only the Task sheet and §6's unit-14 row says the sheet is "not described here yet"), the glossary entry for *Compromisso*, `domain-model.md`, `docs/domain/areas/events.md`, `docs/context/architecture.md`, FR traceability and the roadmap. This phase's `PRPs/reports/events-and-day-view/phase-4/ui-checklist.md` records exactly what those amendments must say (Notes, "Hand-off to phase 5").
- **Guests, Meet links, colour, busy/free, visibility, attachments, reminders on Events, recurrence and exceptions, Task↔Event links, a Life Area on Events** — units 15, 17, 18, 20, 13 (PRD "What We're NOT Building"). The form has none of those controls.
- **Writing to Google, editing a Google event, storing Google events** — unit 15. A Google row stays read-only and opens in Google; `eventCapabilities` refuses to open the sheet for any non-`local` Event.
- **Searching Google events and searching a commitment's location** — search reuses the shipped helper over title and description (PRD D-M).
- **Duration-preserving start edits** — moving a commitment's start does not move its end (Notes, D4-8); the inline reason names an end that falls before the start. Reopen trigger: the owner reports it at the device proof.
- **A short zone list with search** — the full list of the runtime is offered with the owner's zone first (Notes, D4-3); the short list is the recorded fallback, built only if the device measurement asks for it.
- **Success toasts for commitments** — the sheet closing and the list changing are the confirmation (Notes, D4-6); no new success strings.
- **Changing the search field's placeholder, its `aria-label` or the empty-state sentence** — they still say *tarefas*; flagged for the owner in Notes, not changed without approval.
- **The 36 px *Pesquisar* and *Configurações* header buttons** — left out of this unit by the owner (PRD D-V).
- **A new endpoint, DTO, migration, table, token, colour, motion or primitive** — none is needed; `ConfirmView` gains one optional prop only.
- **A tomorrow section on *Hoje*, a week view, overlap warnings** — *Hoje* keeps showing today only (PRD D-K).
- **Fixing `scripts/check-mirror-inventory.mjs`** — it already fails on two unrelated `reminders` lines; this phase neither depends on it nor fixes it (phase 5).
- **Any test file, `vitest.config.ts`, `test/event-fixtures.ts` or `test/day-fixtures.ts`** — they belong to the test pair; the Implementer does not touch them.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/event-edit.ts`

- **ACTION**: Create the pure draft module behind the sheet: the decidable half of PRD AC-27, `task-edit.ts` for an Event. It imports types from `./api` and values from `./events` only; no DOM, no Worker globals, no clock (the current instant is always an argument), and `exactOptionalPropertyTypes`-safe (assign an optional key only when it has a value). Exports, by exact name:
  1. `EVENT_DEFAULT_START_TIME = "09:00"`.
  2. `interface EventDraft { title: string; description: string; location: string; allDay: boolean; startDay: string; startTime: string; endDay: string; endTime: string; timezone: string }`, every member required (a form always has a value). `startDay`/`endDay` are `YYYY-MM-DD` and `startTime`/`endTime` are `HH:mm`, all WALL-CLOCK parts in `timezone`; the empty string means "not given". For an all-day draft `endDay` is the INCLUSIVE last day the owner sees (the stored end is exclusive), `startTime` and `endTime` are ignored by every function below and stay in the draft so switching *Dia inteiro* off needs no re-typing.
  3. `type EventDraftError = { field: "title"; code: "blank" | "too_long" } | { field: "description" | "location"; code: "too_long" } | { field: "start"; code: "day_required" | "time_required" } | { field: "end"; code: "end_before_start" }`.
  4. `newEventDraft(day: string, nowSeconds: number): EventDraft`: empty title, description and location, `allDay` false, `startDay` = `day`, `endDay` and `endTime` empty, `timezone` = `EVENT_DEFAULT_TIMEZONE`; `startTime` is `EVENT_DEFAULT_START_TIME`, EXCEPT when `day` is the owner's today at `nowSeconds` (`instantToWallClock(nowSeconds, EVENT_DEFAULT_TIMEZONE).day === day`), when it is the next full hour after `nowSeconds` (14:00 gives 15:00, 14:30 gives 15:00, 06:30 gives 07:00), capped at `23:00` because no later full hour exists that day (23:10 gives 23:00).
  5. `eventDraftFromEvent(event: EventDto): EventDraft`: description and location `?? ""`; `allDay` from the Event; `timezone` from the Event (a zone `isValidTimeZone` refuses falls back to `EVENT_DEFAULT_TIMEZONE`). Timed: `startDay`/`startTime` and `endDay`/`endTime` are `instantToWallClock(startAt, event.timezone)` and `instantToWallClock(endAt, event.timezone)`, the wall clock in the Event's OWN zone and not the owner's. All-day: `startDay` = `startDate`, `endDay` = `displayEndDay(endDate)` (a stored `2026-10-28` seeds `2026-10-27`), `startTime` = `EVENT_DEFAULT_START_TIME`, `endTime` = `""`. A DTO missing the start its kind needs (unreachable under the schema CHECK) seeds empty day and time parts rather than throwing.
  6. `eventDraftErrors(draft: EventDraft): EventDraftError[]`: every problem, at most one per field, in the order title, description, location, start, end. Title blank after trimming gives `{ field: "title", code: "blank" }`, longer than `EVENT_TITLE_MAX` after trimming gives `too_long`; description and location likewise against `EVENT_DESCRIPTION_MAX` and `EVENT_LOCATION_MAX` (`too_long` only). Start: a `startDay` that is not a real day (`isValidLocalDay`) gives `{ field: "start", code: "day_required" }`, otherwise a timed draft whose `startTime` is not a real `HH:mm` (00:00 to 23:59) gives `time_required`. End, evaluated only when the start has no error: `{ field: "end", code: "end_before_start" }` when the resolved end (rule 7) is before the resolved start. A timed end EQUAL to the start is accepted; an all-day last day before `startDay` is the error and a last day equal to it is a single day. A malformed end part counts as "not given", never as an error of its own.
  7. The resolution rule that 6, 8, 9 and 10 share, so they cannot disagree: trimmed text; timed, the start is `wallClockToInstant(startDay, startTime, timezone)`, and if `endDay` is a real day or `endTime` is a real `HH:mm` the end is `wallClockToInstant(endDay if real else startDay, endTime if real else startTime, timezone)`, while when neither is given the end is left to the shared default of `validateEventInput` (start plus `EVENT_DEFAULT_DURATION_SECONDS`); all-day, `allDaySpanFromInclusive(startDay, endDay if real else null)` gives the exclusive end (no last day means a single day, so `2026-12-31` ends `2027-01-01`). Every candidate goes through `validateEventInput`, so the sheet and the route agree on what is valid; the module has NO second validator.
  8. `buildCreateEventInput(draft: EventDraft): CreateEventInput | null`: `null` exactly when `eventDraftErrors(draft)` is non-empty. Otherwise `{ title, allDay, timezone }` (trimmed title) plus `description` and `location` only when non-empty, plus for a timed draft `startAt` and `endAt` (the end ALWAYS present, whether given, partly filled or the default) and for an all-day draft `startDate` and the exclusive `endDate`; never the other kind's keys.
  9. `buildEventPatch(event: EventDto, draft: EventDraft): UpdateEventInput`: the minimal patch that turns the Event as the server holds it into the draft. It is `{}` when nothing changed AND when `eventDraftErrors(draft)` is non-empty (the caller checks the errors first; a patch is never built from a bad draft). `title`, `description` (`null` when empty) and `location` (`null` when empty) are present only when the trimmed value differs from the Event's; `timezone` only when it differs. Time keys are decided by comparing the draft's wall-clock parts with `eventDraftFromEvent(event)`, NEVER by comparing instants, because an Event stored in an hour that occurs twice, or inside a gap, does not survive the round trip instant to wall clock to instant, and an edit of its title must not move it: (a) the *Dia inteiro* switch differs from the Event gives `allDay` plus ONLY the target shape's keys (`startDate` and the exclusive `endDate` going all-day; `startAt` and `endAt` going timed), never the other kind's keys; (b) same kind, timed: if `startDay`, `startTime` or `timezone` differ from the seed, BOTH `startAt` and `endAt` (the route does not shift the end, and a start moved past the stored end is a 400), else if `endDay` or `endTime` differ, `endAt` alone; (c) same kind, all-day: if `startDay` differs, BOTH `startDate` and `endDate`, else if `endDay` differs, `endDate` alone; a zone-only change on an all-day Event sends only `timezone`. Changing the zone with the wall clock unchanged therefore moves a timed Event's instants (Notes, D4-4).
  10. `draftEndPreview(draft: EventDraft): { day: string; time: string | null } | null`: the end the owner has not fully typed, so the sheet shows it BEFORE saving. `null` when the start cannot be resolved (the draft has a `start` error) or when the end is fully given (timed: a real `endDay` and a real `endTime`; all-day: a real `endDay`). Otherwise the resolved end as wall-clock parts in the draft's zone: timed `{ day, time }` of the resolved end instant through `instantToWallClock` (start plus one hour, or the partly filled end), all-day `{ day: <inclusive last day>, time: null }`.
  11. `timeZoneChoices(supported: readonly string[], current: string): string[]`: the options of *Fuso horário*: `EVENT_DEFAULT_TIMEZONE` first, then `current` when it differs and `isValidTimeZone` accepts it (so a zone the runtime does not list, such as `UTC` in V8, is still offered when an Event uses it), then every entry of `supported` not already present, in the given order. A fresh array; `supported` is not mutated.

  Implementer file: `event-edit.ts` only; the pair authors `test/event-edit.test.ts` first. Delivers **AC-A1**, **AC-A2**, **AC-A3** and the draft half of **AC-A4**.
- **MIRROR**: `src/shared/task-edit.ts:62-86`; `src/shared/events.ts:207-216`; `src/shared/events.ts:158-163`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run event-edit`

### Task 2: CREATE `src/shared/event-sheet.ts`

- **ACTION**: Create the sheet's state machine: `task-sheet.ts` for the Compromisso sheet, total and side-effect free, no DOM, no timer, no network, no clock (the instant arrives inside `open-new`). It imports the `EventDto` type from `./api`, `eventCapabilities` and `isValidTimeZone` from `./events` and `EventDraft`, `eventDraftFromEvent`, `newEventDraft` from `./event-edit`. Exports:
  1. `type EventSheetView = "form" | "confirm"`.
  2. `type EventSheetTarget = { kind: "new"; day: string } | { kind: "edit"; event: EventDto }`. An edit target carries the SNAPSHOT of the Event as it was when the sheet opened, so the sheet depends on no screen's list: a refetch that no longer holds the Event cannot blank or close it, and the patch is computed against the snapshot.
  3. `interface EventSheetState { target: EventSheetTarget | null; view: EventSheetView; drafts: Readonly<Record<string, EventDraft>> }` and `INITIAL_EVENT_SHEET_STATE = { target: null, view: "form", drafts: {} }`.
  4. `eventSheetKey(target: EventSheetTarget): string`: `new:<day>` for a new commitment (one kept draft per DAY, so reopening *Novo compromisso* on a day restores that day's draft while on another day it opens prefilled with THAT day, as PRD AC-28 says) and the Event's `id` for an edit.
  5. `currentEventDraft(state: EventSheetState): EventDraft | null`: the kept draft of the open target, `null` when the sheet is closed.
  6. `type EventSheetEvent = { type: "open-new"; day: string; nowSeconds: number } | { type: "open"; event: EventDto } | { type: "edit"; changes: Partial<EventDraft> } | { type: "request-delete" } | { type: "cancel-delete" } | { type: "close" } | { type: "saved"; key: string } | { type: "deleted"; key: string }`.
  7. `reduceEventSheet(state: EventSheetState, event: EventSheetEvent): EventSheetState`, with these rules:
     - `open-new`: target `{ kind: "new", day }`, view `form`; the key's draft is kept when it exists, otherwise `newEventDraft(day, nowSeconds)`.
     - `open`: an Event whose `eventCapabilities(event.source).editable` is false (a Google row) returns the SAME state object, so a Google Event can never open this sheet. Otherwise target `{ kind: "edit", event }`, view `form`, the kept draft restored untouched (a reducer that always re-seeds fails the restore rule) or `eventDraftFromEvent(event)`.
     - `edit`: closed, or no draft for the open target, returns the same state; otherwise merges `changes` into the open draft. A `timezone` that `isValidTimeZone` refuses is dropped from `changes` (the select cannot produce one; the invariant is kept here).
     - `request-delete`: only for an edit target in view `form`, giving view `confirm`; `cancel-delete`: only from `confirm`, giving `form`; every other case returns the same state object. A new commitment has no delete.
     - `close`: closed returns the same state; otherwise target `null`, view `form`, EVERY draft kept.
     - `saved` and `deleted`: drop the draft of `event.key` (a fresh `drafts` object; every other draft keeps its exact reference) and close the sheet (target `null`, view `form`) only when the open target's key equals `event.key`, so a response that arrives after the owner moved on to another commitment closes nothing; when nothing changes (no such draft, a different open target) return the same state object.

  Implementer file: `event-sheet.ts` only; the pair authors `test/event-sheet.test.ts` first. Delivers **AC-A5**.
- **MIRROR**: `src/shared/task-sheet.ts:75-97`; `src/shared/task-sheet.ts:119-132`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run event-sheet`

### Task 3: CREATE `src/shared/event-view.ts`

- **ACTION**: Create the module that owns every pt-BR sentence a function chooses plus the search decisions, like `life-areas-view.ts` and `day-view.ts`: no DOM, no Worker globals, no clock. It imports types from `./api` and `./event-edit`, `EVENT_TITLE_MAX`, `EVENT_DESCRIPTION_MAX` and `EVENT_LOCATION_MAX` from `./events`, `PRAESTO_TIMEZONE` from `./dates`, `ALL_DAY_LABEL` from `./format`, `classifyRequestFailure` from `./request-failure` and `instantToWallClock` from `./events`. Exports:
  1. `NEW_EVENT_LABEL = "Novo compromisso"` and `EVENT_SEARCH_GROUP = "Compromissos"`: the two words two components must say identically (guidelines §12.3), so they leave both components.
  2. `eventDraftErrorMessage(error: EventDraftError): string`, exhaustive over the union with no fallback sentence: `title`/`blank` gives `Informe o título.`; `too_long` gives `Use no máximo ${limit} caracteres.` with the field's own limit; `start`/`day_required` gives `Informe o dia de início.`; `start`/`time_required` gives `Informe a hora de início.`; `end`/`end_before_start` gives `O fim não pode ser antes do início.`.
  3. `formatDraftEnd(end: { day: string; time: string | null }): string`: `Termina em 20/10/2026 às 10:30.` for a timed end and `Termina em 20/10/2026.` when `time` is `null`; the date is `dd/MM/aaaa` assembled from the `YYYY-MM-DD` string, without `Intl`.
  4. `eventWriteFailure(cause: unknown): { message: string; staleList: boolean }`: duck-types a numeric `status` exactly as `lifeAreaWriteFailure` does. Status 404 gives `Este compromisso não existe mais. A lista foi atualizada.` with `staleList: true` (another device deleted it first: the screen shows the reason and refetches); every other cause gives `classifyRequestFailure(cause).message` with `staleList: false`. The server's own error text is never shown (it carries a field marker meant for tools). A 401 never reaches this function: the hook routes it to the token gate first.
  5. `eventsSearchPath(q: string): string`: `/api/events?q=` plus `encodeURIComponent(q.trim())` (so `"  consulta dentista "` gives `/api/events?q=consulta%20dentista`).
  6. `formatEventSearchWhen(event: EventDto): string`: the date and time a search row shows, in the OWNER's zone like every day screen (plan decision D3-1): a timed Event reads `dd/MM/aaaa · HH:mm` from `instantToWallClock(event.startAt, PRAESTO_TIMEZONE)`, an all-day Event reads `dd/MM/aaaa · ${ALL_DAY_LABEL}` from `startDate` verbatim (no zone conversion); an Event lacking the start its kind needs (unreachable) reads `""`.
  7. `type SearchBodyKind = "offline" | "hint" | "loading" | "task-error" | "empty" | "results"` and `decideSearchBody(input: { online: boolean; queryReady: boolean; tasksAnswered: boolean; tasksFailed: boolean; taskCount: number; eventsAnswered: boolean; eventsFailed: boolean; eventCount: number }): SearchBodyKind`, evaluated in this order: not online gives `offline`; query not ready gives `hint`; tasks failed gives `task-error`; tasks not answered gives `loading`; any Task or any commitment found gives `results`; commitments failed gives `results` (the failure line shows, and nothing claims that nothing was found); commitments not yet answered gives `loading`; otherwise `empty`. The commitments request is isolated: it never turns a Task result into an error, and the screen never says "nothing found" while it is unanswered or failed.

  Implementer file: `event-view.ts` only; the pair authors `test/event-view.test.ts` first. Delivers the copy half of **AC-A4**, **AC-A8** (the path, the row label and the body decision) and the failure mapping of **AC-A9**.
- **MIRROR**: `src/shared/life-areas-view.ts:86-118`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx tsc -p tsconfig.worker.json; CI=1 NO_COLOR=1 npx vitest run event-view`

### Task 4: UPDATE `src/app/api.ts`

- **ACTION**: Add the four client wrappers the sheet and the search need, as one-liners over `request<T>()` in the idiom of the sibling wrappers (no local types, no error re-mapping; a failure arrives as `ApiError`). `export async function createEvent(input: CreateEventInput): Promise<EventDto>` POSTs `JSON.stringify(input)` to `/api/events` and returns `body.event` (`EventResponse`); `export async function updateEvent(id: string, input: UpdateEventInput): Promise<EventDto>` PATCHes `/api/events/${id}` the same way; `export async function deleteEvent(id: string): Promise<void>` sends `DELETE` to `/api/events/${id}` (a 204 answers `undefined`); `export async function searchEvents(q: string, signal?: AbortSignal): Promise<EventDto[]>` requests `eventsSearchPath(q)` and returns `body.events`, passing `{ signal }` only when defined (`exactOptionalPropertyTypes` forbids handing `undefined` on), exactly as `listEvents` does. Import `CreateEventInput`, `EventResponse` and `UpdateEventInput` as types from `../shared/api` and `eventsSearchPath` from `../shared/event-view`. These names also exist in `src/worker/event-repository.ts`; they are different modules and the inspection tripwire matches `insert(events)`, `update(events)` and `delete(events)` call shapes only, which these files never spell. This file is exempt glue under `docs/context/methodology.md`; the URL decision it relies on is pinned in `event-view`. Implementer file: `api.ts` only. Infrastructure for **AC-A6**, **AC-A7** and **AC-A8** (the requests behind the sheet and the search).
- **MIRROR**: `src/app/api.ts:248-266`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/api.ts; npx prettier --check src/app/api.ts`

### Task 5: UPDATE `src/app/components/ui/ConfirmView.tsx`

- **ACTION**: Give the confirmation one optional prop so the sheet can disable only the destructive button while offline: `confirmDisabled?: boolean`, default `false`, applied to the SECOND button as `disabled={busy || confirmDisabled}`. The first button (*Cancelar*) keeps `disabled={busy}` only, so a confirmation reached while online can still be cancelled after the connection drops. Update the header comment with one sentence saying why the prop exists. Every existing caller (`TaskSheet`, `ReminderSheet`, `LifeAreasScreen`, `GoogleConnectionCard`) passes nothing and renders exactly as before; no other markup, class or copy changes. Implementer file: `ConfirmView.tsx` only. Delivers the offline half of **AC-A9** (writes disabled offline, including the confirmed delete).
- **MIRROR**: `src/app/components/ui/ConfirmView.tsx:49-70`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/components/ui/ConfirmView.tsx; npx prettier --check src/app/components/ui/ConfirmView.tsx`

### Task 6: CREATE `src/app/components/CompromissoSheet.tsx`

- **ACTION**: The sheet. It is controlled glue like `TaskSheet`: the parent (the hook of Task 7) owns the draft and the requests, this component renders and calls back. Export `interface CompromissoSheetProps { open: boolean; title: string | null; mode: "new" | "edit" | null; view: EventSheetView; draft: EventDraft | null; timeZones: readonly string[]; busy: boolean; writable: boolean; error: string | null; onDraftChange: (changes: Partial<EventDraft>) => void; onClose: () => void; onSave: () => void; onDeleteRequest: () => void; onDeleteCancel: () => void; onDeleteConfirm: () => void }` and `CompromissoSheet(props)`. Behaviour:
  1. Like `TaskSheet.tsx:155-162` it keeps the last non-null `draft`, `title` and `mode` in refs and returns `null` when it has never had one, so the exit transition shows what the owner last saw instead of popping empty or reverting.
  2. It renders `Sheet` with `open`, `onOpenChange={(next) => { if (!next) onClose(); }}` and `title` (`NEW_EVENT_LABEL` for a new commitment, the commitment's own title for an edit; supplied by the hook). The page behind a native `showModal()` is inert, so the sheet carries its own offline notice (item 8).
  3. View `form`: a `<form className="flex flex-col gap-4">` whose `onSubmit` calls `preventDefault`, sets an internal `attempted` flag to true and calls `onSave()` only when `eventDraftErrors(draft)` is empty. Fields in the PRD's order, each with a visible label and a 48 px control, tokens only (the classes of `TaskSheet.tsx:218-228` for inputs): **Título** (text input, `maxLength={EVENT_TITLE_MAX}`); **Dia inteiro** (a `ChipGroup label="Dia inteiro"` with one `Chip value="allDay"`, `value={draft.allDay ? ["allDay"] : []}`, `onValueChange={(next) => onDraftChange({ allDay: next.includes("allDay") })}`); **Início** and **Fim** each as a `<fieldset>` with a `<legend>` styled like the labels, holding a `Dia` label with an `<input type="date">` and, only while `draft.allDay` is false, a `Hora` label with an `<input type="time">` beside it (the date input flexible, the time input a fixed width, both `min-w-0` so 375 px never overflows); for an all-day draft *Fim* holds only its `Dia` (the inclusive last day); **Fuso horário** (a native `<select>` whose options are `timeZones`, each option's text the IANA id verbatim, value `draft.timezone`); **Local** (text input, `maxLength={EVENT_LOCATION_MAX}`); **Descrição** (`<textarea rows={3}>`, `maxLength={EVENT_DESCRIPTION_MAX}`). No `autoFocus` anywhere (guidelines §12.5): `Sheet` focuses the dialog itself.
  4. Reasons, from `eventDraftErrors(draft)` rendered with `eventDraftErrorMessage`: each reason is a `role="alert"` paragraph immediately after its own field or fieldset (`m-0 font-text text-t2 text-overdue`). The `end_before_start` reason shows LIVE, the moment it holds (PRD AC-28); every other reason shows only once the owner has pressed *Salvar* with the draft invalid (`attempted`), never while he is still typing into a field he has not left (guidelines §8, field error). `attempted` resets when `open` becomes false.
  5. The resolved end: right after *Fim*, when `draftEndPreview(draft)` is not `null`, a `role="status"` paragraph in muted text with `formatDraftEnd(preview)`, so leaving the end empty shows the end before saving.
  6. Buttons: *Cancelar* (secondary, `onClick={onClose}`, `disabled={busy}`) and *Salvar* (primary, `type="submit"`, `disabled={busy || !writable}`), each `flex-1`, as `TaskSheet.tsx:707-725`; the persistent request `error` as a `role="alert"` paragraph under them (`TaskSheet.tsx:727-731`) — it stays until the next attempt, and no toast ever replaces it. Only in `mode === "edit"`, the distant ghost *Excluir* with the `Trash2` glyph (`TaskSheet.tsx:733-742`), `disabled={busy || !writable}`.
  7. View `confirm`: `ConfirmView title="Excluir este compromisso?" body="Não dá para desfazer." cancelLabel="Cancelar" confirmLabel="Excluir" busy={busy} confirmDisabled={!writable} error={error} onCancel={onDeleteCancel} onConfirm={onDeleteConfirm}`: the verb repeated, *Cancelar* focused, destructive button second.
  8. While `!writable`, a `Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto."` at the top of the form (the words of the screens' own offline banner; nothing new). Every write control is disabled; *Cancelar*, *Fechar* and reading stay available.
  9. Every control is at least 48 px and at least 8 px from its neighbours; copy is pt-BR sentence case; tokens only (no raw literal, no new class family, no `uppercase`); dates and times use the native inputs (guidelines §12.5) and `color-scheme: dark` already styles their pickers.

  Implementer file: `CompromissoSheet.tsx` only. Delivers **AC-A6**, **AC-A7** (the delete confirmation) and **AC-A9**.
- **MIRROR**: `src/app/components/TaskSheet.tsx:155-162`; `src/app/components/TaskSheet.tsx:218-228`; `src/app/components/TaskSheet.tsx:707-742`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/components/CompromissoSheet.tsx; npx prettier --check src/app/components/CompromissoSheet.tsx`

### Task 7: CREATE `src/app/hooks/useEventSheet.ts`

- **ACTION**: The glue the three screens share, so their sheets cannot drift (`useSeriesSheet`'s reason for existing). Signature: `useEventSheet(options: { onUnauthorized: () => void; writable: boolean; onChanged: () => void | Promise<void> }): { isOpen: boolean; openNew: (day: string) => void; openEvent: (event: EventDto) => void; close: () => void; sheetProps: CompromissoSheetProps }`. It holds `useReducer(reduceEventSheet, INITIAL_EVENT_SHEET_STATE)`, `busy` and `error`, and:
  1. `openNew(day)` clears the error and dispatches `open-new` with `nowSeconds = Math.floor(Date.now() / 1000)` (the clock is read here, in the glue); `openEvent(event)` clears the error and dispatches `open`; `close` is stable (`useCallback`) and dispatches `close`; `isOpen` is `state.target !== null`.
  2. `onSave`: reads `currentEventDraft(state)`; returns for `null` or when `eventDraftErrors(draft)` is non-empty (the sheet shows the reasons). For a new commitment it builds `buildCreateEventInput(draft)` (returns for `null`) and runs `createEvent(input)`. For an edit it builds `buildEventPatch(snapshot, draft)`; an empty patch dispatches `close` and stops, because a PATCH with an empty body is a 400 by design and there is nothing to save. Otherwise it runs `updateEvent(snapshot.id, patch)`. On success it dispatches `saved` with `eventSheetKey(target)`.
  3. `onDeleteConfirm` runs `deleteEvent(snapshot.id)` and dispatches `deleted` with the Event's id. `onDeleteRequest` and `onDeleteCancel` clear the error and dispatch `request-delete` and `cancel-delete`.
  4. The shared `run(action)`: `setBusy(true)`; `try { await action(); succeeded = true } catch (cause)`: a 401 `ApiError` calls `onUnauthorized()` and returns; any other cause goes through `eventWriteFailure(cause)`, sets `error` to its message, and when `staleList` is true also awaits `onChanged()`; `finally { setBusy(false) }`. Only after a successful action does it clear the error and `await onChanged()`, outside the try, so a failing refetch can never be reported as a failed save. `onChanged` must not reject: the screens' loaders catch their own failures.
  5. Failure stays IN the sheet: the sheet stays open with the draft intact and `error` rendered persistently under *Salvar* or the confirmation. The hook never toasts and never reports to the connectivity reducer (a failed commitments write must not disable capture app-wide, the isolation `refreshEvents` already keeps).
  6. `sheetProps` is derived, not stored: `open`, `title` (`NEW_EVENT_LABEL` for a new target, the snapshot's title for an edit, `null` when closed), `mode`, `view`, `draft: currentEventDraft(state)`, `timeZones: timeZoneChoices(supportedTimeZones(), draft?.timezone ?? EVENT_DEFAULT_TIMEZONE)` where `supportedTimeZones()` is a module-level function returning `Intl.supportedValuesOf("timeZone")` when `typeof Intl.supportedValuesOf === "function"` and `[]` otherwise (then the choices are the owner's zone and the Event's own), `busy`, `writable`, `error`, and the handlers (`onDraftChange` dispatches `edit`; `onClose` dispatches `close`).

  Implementer file: `useEventSheet.ts` only. Delivers **AC-A6**, **AC-A7** and the failure half of **AC-A9**.
- **MIRROR**: `src/app/hooks/useSeriesSheet.ts:27-42`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/hooks/useEventSheet.ts; npx prettier --check src/app/hooks/useEventSheet.ts`

### Task 8: UPDATE `src/app/components/LocalEventRow.tsx`, `src/app/components/DayScreen.tsx` and `src/app/components/TodayScreen.tsx`

- **ACTION**: Make the local row a real control and wire the sheet into the two screens that render it. It is one task because the row's `onOpen` is REQUIRED and its two callers must compile in the same step. **A. `LocalEventRow.tsx`** closes plan decision D3-5: the row that was inert on purpose becomes a real control now that its sheet exists. `LocalEventRow` takes a REQUIRED `onOpen: () => void` and renders `<li><button type="button" onClick={onOpen} className={cn(ROW_CLASSNAME, "w-full text-left")}>…</button></li>` with the same contents as today (the leading time column through `timeColumnClassName(wideTime)`, the 16 px `CalendarDays` glyph, the two-line title); the existing row classes (`min-h-16`, solid `border-line` outline on the filled `bg-surface-1` ground, `rounded-card`, `px-3 py-2`) move onto the button unchanged, so the whole 64 px row is the hit area and the solid-versus-dashed distinction from the Google row is untouched. No `aria-label` (it would silence the visible title and time), no new token, no accent or live colour, no pressed or hover styling beyond what `TaskRow`'s open button has (none). Import `cn` from `./ui/cn`. Rewrite the header comment: delete the "Inert on purpose" paragraph and say the row opens the Compromisso sheet through `onOpen`, that Google rows stay read-only and open in Google, and that decision D3-5 is closed by unit 14 phase 4. `SearchScreen` renders this row too, from Task 9. **B. `DayScreen.tsx`**: add the entry point and the sheet to `/day`. (1) Call `useEventSheet({ onUnauthorized, writable, onChanged: () => loadLocal(dayRef.current) })` after `loadLocal` and `dayRef` are declared; its `onChanged` is the existing, stale-guarded commitments loader, so a created, edited or deleted commitment shows on the day without a reload. (2) A `Button variant="primary"` with a `Plus` glyph (lucide-react, `aria-hidden`) and the text `NEW_EVENT_LABEL`, as the FIRST child of `<main>` (before the failures block), `className="self-start"`, `disabled={!writable}`, `onClick={() => eventSheet.openNew(day)}`: the screen's one primary action (checklist item 1), 48 px by the `Button` primitive. (3) `renderEventRow`'s `case "local"` passes `onOpen={() => eventSheet.openEvent(item.event)}` to `LocalEventRow`; the Google case is unchanged (read-only, opens in Google). (4) Mount `<CompromissoSheet {...eventSheet.sheetProps} />` as the last child of the shell `<div>`, after `<main>`. (5) The window `Escape` handler also returns when `eventSheet.isOpen`, and its effect depends on `[back, eventSheet.isOpen]`: without this the same keystroke that closes the native dialog also calls `back()` and leaves the day (the hazard `SearchScreen.tsx:187` already guards). (6) An effect keyed on `day` calls `eventSheet.close()`, so a sheet left open by a history pop (the desktop Back button) never outlives the date it was opened for; a new-commitment draft is kept under its own day and is restored if he returns. Do not change the three loaders, the in-render reset on a `day` change, the notice logic or the Task handlers. Update the file header comment by one sentence. **C. `TodayScreen.tsx`**: wire the sheet into *Hoje*'s Agenda and close the stale-response gap the phase-3 code review observed. (1) Call `useEventSheet({ onUnauthorized, writable, onChanged: refreshLocalEvents })`. (2) The Agenda's `case "local"` passes `onOpen={() => eventSheet.openEvent(item.event)}` to `LocalEventRow`; the Google case and the collapsed header (name and count only) are unchanged. (3) Mount `<CompromissoSheet {...eventSheet.sheetProps} open={eventSheet.sheetProps.open && sheet.taskId === null} />` after `ReminderSheet`, with the same never-stack comment and gating pattern as `FilterSheet` and `ReminderSheet`. (4) `refreshLocalEvents` gains the guard `refreshAdherence` has: a `latestLocalEventsRequest = useRef(0)`, `const mine = ++latestLocalEventsRequest.current` at the start of the function, and both the success writes and the failure writes (the 401 route excepted) are skipped when `mine !== latestLocalEventsRequest.current`. It matters now because every write is followed by a refetch while the foreground and reconnect refetches can still be in flight, and an older response must never repaint a deleted commitment. (5) The `/` shortcut's text-field guard also ignores a focused `HTMLSelectElement`, because the sheet has one and typing `/` there would otherwise open the search and unmount the screen that owns the sheet's state. Nothing else changes in the three files: no new atom beyond the ref, the three loaders and the notice logic of `DayScreen` are untouched, and so are the Task, Reminder and Filter sheets of `TodayScreen`. Implementer files: these three only. Delivers **AC-A6**, **AC-A7** and the 48 px targets of **AC-A9**.
- **MIRROR**: `src/app/components/EventRow.tsx:114-128`; `src/app/components/DayScreen.tsx:229-238`; `src/app/components/SearchScreen.tsx:181-192`; `src/app/components/TodayScreen.tsx:409-424`; `src/app/components/TodayScreen.tsx:1312-1325`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/components/LocalEventRow.tsx src/app/components/DayScreen.tsx src/app/components/TodayScreen.tsx; npx prettier --check src/app/components/LocalEventRow.tsx src/app/components/DayScreen.tsx src/app/components/TodayScreen.tsx`

### Task 9: UPDATE `src/app/components/SearchScreen.tsx`

- **ACTION**: Add the *Compromissos* group and the sheet to search. (1) Two atoms beside the Task ones: `eventResults: EventDto[] | null` and `eventsError: string | null`. (2) `searchEventsFor(q, signal)` mirrors `search`: `searchEvents(q, signal)`, an aborted request is not a failure, a 401 routes to the gate through `handleFailure`; the debounce effect fires BOTH requests, each in its own `void` call so one failing never cancels the other, and below the minimum length it clears BOTH atoms (`shouldSearch` is the floor; the route answers 400 below it). (3) `rerunEventSearch()` is the sheet's `onChanged`; a `rerunBoth()` serves *Tentar de novo*. (4) The results region becomes a switch over `decideSearchBody({ online: connectivity === "online", queryReady: shouldSearch(debounced), tasksAnswered: results !== null, tasksFailed: searchError !== null, taskCount, eventsAnswered: eventResults !== null, eventsFailed: eventsError !== null, eventCount })`; each branch keeps its present markup and strings: `offline` renders nothing, `hint` the existing hint, `loading` the `Skeleton`, `task-error` the existing alert and *Tentar de novo*, `empty` the existing `Nenhuma tarefa encontrada para “{debounced}”.` block, `results` the groups. (5) In `results`, the *Compromissos* group comes FIRST in the DOM: `TaskGroup name={EVENT_SEARCH_GROUP} count={eventResults.length}` (not collapsible; `TaskGroup` already renders nothing at zero, so with no match the group is absent), each row a `LocalEventRow` with `timeLabel={formatEventSearchWhen(event)}`, `wideTime`, `onOpen={() => eventSheet.openEvent(event)}` and key `` `event-${event.id}` ``; then the existing Task groups, byte-for-byte; and when the commitments search failed, a `role="alert"` line with `eventsError` and the *Tentar de novo* button after the groups, so a failed commitments search is never read as "no commitments". Google events never appear: the route returns stored Events only. (6) `useEventSheet({ onUnauthorized, writable: canWrite(connectivity), onChanged: rerunEventSearch })` and `<CompromissoSheet {...eventSheet.sheetProps} />` after `TaskSheet`; the window `Escape` handler also returns when `eventSheet.isOpen` (deps `[back, sheet.taskId, eventSheet.isOpen]`); the Task `renderDayItems` switch (whose `local` case keeps throwing, because it only ever receives Task groups) is untouched. The field's `placeholder`, `aria-label` and the empty sentence still say *tarefas*, on purpose (Notes, copy for the owner). Implementer file: `SearchScreen.tsx` only. Delivers **AC-A8** and **AC-A9**.
- **MIRROR**: `src/app/components/SearchScreen.tsx:112-130`; `src/app/components/SearchScreen.tsx:155-164`; `src/app/components/SearchScreen.tsx:181-192`
- **VALIDATE**: `set -euo pipefail; npx tsc -p tsconfig.app.json; npx eslint src/app/components/SearchScreen.tsx; npx prettier --check src/app/components/SearchScreen.tsx`

### Task 10: CREATE `PRPs/reports/events-and-day-view/phase-4/live-pass-protocol.md`

- **ACTION**: The executable protocol for the verification that this phase's three manual criteria need (PRD AC-28, AC-29, AC-30; plan AC-A6 to AC-A9). The Implementer has no browser, so it writes the protocol and the orchestrator (or the owner) runs it in the browser pane (Chromium at 375 x 812 and 1280 x 800, dark), recording the outcome as `PRPs/reports/events-and-day-view/phase-4/live-browser-pass.md` in the format of `PRPs/reports/events-and-day-view/phase-3/live-browser-pass.md`. The document opens with the preamble and the rules of the pass, then has exactly the headings `## Setup`, `## Fixtures`, `## AC-28`, `## AC-29`, `## AC-30` and `## Measurements`. **Setup** repeats the phase-3 setup (throwaway token in `.dev.vars` with backup and byte-identical restore, `npm run db:migrate`, `npm run dev -- --host 127.0.0.1 --port 5180`, explicit viewport, stop `workerd`) and its `window.fetch` wrapper, extended so a request can be made to fail on demand: `failPaths` (answer 500), a `failMethods` list that matches `POST`, `PATCH` or `DELETE` on `/api/events`, a way to answer 404 for one event id, and a way to throw a network `TypeError`. **Fixtures**: events and Tasks through the real routes (`POST /api/events` and `POST /api/tasks`) with the phase-3 fixture script, plus two commitments whose titles share a word (for example *Consulta dentista* and *Reunião*, one description reading *levar exames da consulta*) for the search. **AC-28**: *Novo compromisso* on `/day/<date>` opens the sheet prefilled with that date and `09:00`; on today's date the start is the next full hour (record the clock it was run at); the field order in the DOM is *Título*, *Dia inteiro*, *Início*, *Fim*, *Fuso horário*, *Local*, *Descrição*, *Cancelar*, *Salvar*; leaving *Fim* empty shows `Termina em …`; *Dia inteiro* hides both *Hora* inputs and *Fim* keeps its *Dia*; an end earlier than the start shows `O fim não pode ser antes do início.` live and *Salvar* then refuses to send (check the request log); a blank title shows `Informe o título.` only after *Salvar*; *Salvar* creates the commitment and the day lists it without a reload; tapping a local row on `/day` and on *Hoje*'s Agenda (expand the group first) opens the sheet filled, an edit lists the change without a reload, the patch sent contains only the changed keys (read the request body in the log: a title-only edit sends only `title`; moving the start sends both `startAt` and `endAt`; toggling *Dia inteiro* sends `allDay` and the target shape's keys), *Excluir* opens a confirmation titled `Excluir este compromisso?` with *Cancelar* focused and *Excluir* second, the delete removes the row without a reload; Esc closes the sheet and does NOT leave `/day`; a closed sheet reopened on the same commitment shows the unsaved edit, and after *Salvar* the draft is gone; a Google row is not a button and still opens in Google; a new draft survives close and reopen on the same day and is empty-but-prefilled on another day; stepping with the desktop Back button while the sheet is open closes it. **AC-29**: on `/search`, two words find the commitment (a *Compromissos* group first, count, each row `dd/MM/aaaa · HH:mm`), a local row opens the sheet and an edit refreshes the group, no Google event appears (the stub still serves Google rows today), a one-character query sends no `/api/events` request, a query with no match shows no *Compromissos* group, a failing `/api/events?q=` shows a `role="alert"` line and never `Nenhuma tarefa encontrada…`, and a Task-only match still renders exactly as before. **AC-30**: offline (dispatch `window.dispatchEvent(new Event("offline"))` as the phase-3 pass did, and the network panel's Offline) disables *Novo compromisso*, *Salvar*, *Excluir* and the confirmation's *Excluir* while *Cancelar* and reading stay, with the banner `Sem conexão.` inside the sheet; a failed save (500, then a network `TypeError`, then a 404 on an edit) keeps the sheet open with the draft intact and a persistent inline `role="alert"` reason, no toast appears, and a retry after clearing the failure succeeds; a failed delete likewise; the 404 case shows `Este compromisso não existe mais. A lista foi atualizada.` and the list refetches. **Measurements** (table in the shape of the phase-3 protocol, read with `getBoundingClientRect`): every control in the sheet and on `/day` at 375 px at least 48 x 48 and at least 8 px from its neighbours; the date and time inputs side by side without horizontal overflow at 375 and 1280 (`scrollWidth` against `clientWidth`); the sheet's height against `90dvh` and that it scrolls internally; the number of `<option>` elements in *Fuso horário* and its first two values; the widest search label on one line and the title column beside it at 375; the primary *Novo compromisso* button's box; no request to another origin. State plainly what the pane cannot show and stays `owed to the owner's device` (phase 5's device proof): how the native date, time and the roughly 400-option zone `<select>` render and scroll on Android Chrome, keyboard overlap and the visual viewport with the sheet open, the Android back gesture closing the sheet, contrast on a real panel, Lighthouse. Implementer file: this document only. Delivers the verification half of **AC-A6**, **AC-A7**, **AC-A8** and **AC-A9**.
- **MIRROR**: `PRPs/reports/events-and-day-view/phase-3/live-pass-protocol.md:3-10`
- **VALIDATE**: `node --input-type=module -e "import fs from 'node:fs'; const t = fs.readFileSync('PRPs/reports/events-and-day-view/phase-4/live-pass-protocol.md', 'utf8'); const need = ['## Setup', '## Fixtures', '## AC-28', '## AC-29', '## AC-30', '## Measurements', '375', '1280', 'POST /api/events', 'Termina em', 'Excluir este compromisso?']; const miss = need.filter((s) => t.includes(s) === false); if (miss.length > 0) { console.error('missing: ' + miss.join(' | ')); process.exit(1); }"`

### Task 11: CREATE `PRPs/reports/events-and-day-view/phase-4/ui-checklist.md`

- **ACTION**: Run the mandatory UI/UX review checklist of `documentation/40-engineering/ui-ux-guidelines.md` (Tier A items 1 to 9 for every interface change; Tier B items 10 to 14 because `CompromissoSheet` is a new surface and `/day`, *Hoje*'s Agenda and search changed) on `CompromissoSheet`, the changed `LocalEventRow`, `ConfirmView`, `DayScreen`, `TodayScreen`'s Agenda and `SearchScreen`, and record it in the format of the phase-3 checklist. The file opens with a preamble (what the record rests on; the surfaces under review; where a mark rests on a pure module, which suite pins it; the list of new visible strings copied from this plan's Notes), then has exactly the headings `## Tier A — every interface change`, `## Tier B — a changed screen`, `## AC-28 walk`, `## AC-29 walk`, `## AC-30 walk` and `## Gate`. Each of the 14 checklist items is one numbered line (`1. `, `2. `, … `14. `) carrying exactly one mark: `✔` with a `method:` that says what was actually done (static inspection of named lines, a named suite, the build output, or a numbered observation in `live-browser-pass.md`), `✘` with the reason and a recorded exception, or `owed to the live pass` / `owed to the owner's device` for anything that needs a rendered page or a phone. Never claim a screenshot or a measurement that was not taken (guidelines §12.6). Item 1 records that `/day` now has exactly one primary action (*Novo compromisso*) and that the sheet's primary is *Salvar*. Item 8 records the destructive rules: the delete is irreversible and asks once with the verb repeated, and the plan decision to show no success toast (D4-6). Item 13 records the `npm run build` first-load JS and CSS gzip sizes and the precache total against guidelines §11. The three walks give one line per clause of PRD AC-28, AC-29 and AC-30, each stating the decidable half (the suite that pins it) and the observed half (or `owed`), and the AC-28 walk says plainly that the clause the amended AC-23 left for this phase ("opens its sheet on tap") is now delivered and that plan decision D3-5 and the "inert" clauses of the phase-3 checklist are superseded by it. `## Gate` records the exit status of the Level 1 to Level 3 commands and the invariant checks: `dates.ts`, `recurrence.ts` and `adherence.ts` byte-identical to `HEAD`, `events.ts` and `event-hash.ts` untouched, no test file or fixture touched by the Implementer, the existing suites unmodified, and that `scripts/check-mirror-inventory.mjs` still fails on the same two lines. It ends with a section `## Hand-off to phase 5` listing what AC-34 must amend and now know: `ui-layout-standard.md` §2 item 4 (rows no longer inert; tapping opens the Compromisso sheet), §2 item 11 (*Novo compromisso* as the screen's primary action), §3 (the Compromisso sheet's field order and its irreversible confirmation) and §6's unit-14 row, plus the `docs/context/architecture.md` sentences that call `LocalEventRow` inert. The Implementer records what it can establish without a browser and leaves the rendered clauses owed; the orchestrator's live pass then replaces those marks by citation, nothing else changing. Implementer file: this document only. Delivers **AC-A9** and, with the Level 3 block, **AC-A10**.
- **MIRROR**: `PRPs/reports/events-and-day-view/phase-3/ui-checklist.md:28-33`
- **VALIDATE**: `node --input-type=module -e "import fs from 'node:fs'; const t = fs.readFileSync('PRPs/reports/events-and-day-view/phase-4/ui-checklist.md', 'utf8'); const lines = t.split(/\r?\n/); const bad = []; for (let n = 1; n <= 14; n++) { const line = lines.find((l) => l.startsWith(n + '. ')); if (line === undefined) bad.push('item ' + n + ' missing'); else if (/✔|✘|owed to/.test(line) === false) bad.push('item ' + n + ' has no mark'); } for (const h of ['## Tier A', '## Tier B', '## AC-28 walk', '## AC-29 walk', '## AC-30 walk', '## Gate', '## Hand-off to phase 5']) { if (t.includes(h) === false) bad.push('missing heading ' + h); } if (bad.length > 0) { console.error(bad.join('\n')); process.exit(1); }"`

## Validation Commands

Each block starts with `set -euo pipefail` so one failure fails the block. Level 2 and Level 3 write their output to a file outside the repository, so a foreground run that ends without a summary (exit 127 on this Windows machine) can be re-run unchanged and its log read afterwards.

**Level 1 — STATIC_ANALYSIS**

```
set -euo pipefail
LOG="${TMPDIR:-/tmp}/events-phase4-l1.log"
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
LOG="${TMPDIR:-/tmp}/events-phase4-l2-targeted.log"
if CI=1 NO_COLOR=1 npx vitest run event-edit event-sheet event-view day-view agenda day-range task-edit task-sheet > "$LOG" 2>&1; then
  tail -n 8 "$LOG"
else
  tail -n 80 "$LOG"
  echo "FAIL: targeted suites"
  exit 1
fi
LOG_ALL="${TMPDIR:-/tmp}/events-phase4-l2-all.log"
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
LOG="${TMPDIR:-/tmp}/events-phase4-l3-build.log"
if npm run build > "$LOG" 2>&1; then
  tail -n 25 "$LOG"
else
  tail -n 60 "$LOG"
  echo "FAIL: npm run build"
  exit 1
fi
LOG_DOCS="${TMPDIR:-/tmp}/events-phase4-l3-docs.log"
if CI=1 NO_COLOR=1 npx vitest run --project docs > "$LOG_DOCS" 2>&1; then
  tail -n 8 "$LOG_DOCS"
else
  tail -n 60 "$LOG_DOCS"
  echo "FAIL: docs project (source-invariants, event-api-inspection, event-migration-additive)"
  exit 1
fi
# dates.ts, recurrence.ts and adherence.ts exist at HEAD and must not have moved.
git diff --quiet HEAD -- src/shared/dates.ts src/shared/recurrence.ts src/shared/adherence.ts
# events.ts and event-hash.ts are phase 1 files: the working tree is compared with the index,
# so a change made by this phase shows as a difference once the orchestrator has staged phase 1.
git diff --quiet -- src/shared/events.ts src/shared/event-hash.ts
echo "PASS: build green, docs project green, frozen modules unchanged"
```

## Acceptance Criteria

- **AC-A1 (PRD AC-27):** Given an Event and the pure builders, when a draft is built from it, then its date and time parts are the wall-clock parts in the Event's OWN zone (an instant 12:30 UTC in `America/Sao_Paulo` seeds `09:30`, and an Event in `America/New_York` reads in New York); an all-day draft shows the INCLUSIVE last day (a stored end `2026-10-28` seeds `2026-10-27`) and keeps `09:00` ready for the switch; and a new draft for a day is prefilled with that day, `09:00`, an empty end and `America/Sao_Paulo`, or the next full hour when the day is today in the owner's zone (14:00 and 14:30 give 15:00, 06:30 gives 07:00, 23:10 gives 23:00).
- **AC-A2 (PRD AC-27):** Given a valid draft, when the create input is built, then it carries instants resolved by the shared helper with an empty end already filled (start plus one hour; a draft with only an end day or only an end time fills the missing part from the start), an all-day draft carries `startDate` and the exclusive `endDate` (a last day `2026-10-27` gives `2026-10-28`, no last day gives the next day, `2026-12-31` gives `2027-01-01`), a wall-clock time inside a DST gap resolves with the offset before the gap, empty description and location are omitted, no key of the other kind is present, and an invalid draft yields `null`.
- **AC-A3 (PRD AC-27):** Given an Event and a draft, when the patch is built, then it contains only changed fields and is empty when nothing changed (including for an Event stored in an hour that occurs twice, which must not move on a title-only edit) and when the draft is invalid; moving a timed start sends both `startAt` and `endAt`; moving only the end sends `endAt` alone; changing only the zone of a timed Event sends `timezone`, `startAt` and `endAt`; toggling *Dia inteiro* sends `allDay` and only the target shape's keys; clearing a description or location sends `null`; and a zone-only change on an all-day Event sends only `timezone`.
- **AC-A4 (PRD AC-27):** Given a draft, when it is checked, then an end before the start (timed, across days, or an all-day last day before the first) yields `{ field: "end", code: "end_before_start" }` and its pt-BR sentence is `O fim não pode ser antes do início.`; a timed end equal to the start and an all-day single day are accepted; a blank title, a missing start day and a missing start time yield their own errors in form order with their pinned sentences; `draftEndPreview` returns the resolved end (and `formatDraftEnd` its sentence) when the end is empty or partly given and `null` when it is fully given or the start is unresolved; and `timeZoneChoices` starts with `America/Sao_Paulo`, then the Event's own zone when it differs and is valid (including `UTC` when the runtime list omits it), then the rest without duplicates.
- **AC-A5 (PRD AC-27):** Given the sheet state machine, when events are applied, then it keeps one draft per commitment for the session (restored untouched on reopen, kept on close, dropped on `saved` and `deleted` for that commitment only), one new-commitment draft per day, a snapshot of the commitment being edited, ignores a Google Event (the same state object), refuses an unknown zone in an edit, closes on `saved`/`deleted` only when the response belongs to the open commitment, and returns the very same state object for every no-op.
- **AC-A6 (PRD AC-28) (manual):** Given `/day/<date>`, when the owner taps *Novo compromisso*, then a sheet opens prefilled with that date and a start of 09:00 (the next full hour when the date is today), showing in order *Título*, *Dia inteiro*, *Início* and *Fim* (date and time), *Fuso horário* (a native select with `America/Sao_Paulo` first), *Local*, *Descrição*, *Cancelar* and *Salvar*; leaving the end empty shows the resolved end; *Dia inteiro* hides the times; an end before the start shows an inline reason; *Salvar* creates the commitment and `/day` lists it without a reload; Esc and the back gesture close the sheet and a closed sheet keeps its unsaved draft in memory.
- **AC-A7 (PRD AC-28, PRD AC-23) (manual):** Given a local commitment on `/day` or on *Hoje*'s Agenda, when the owner taps it, then the same sheet opens filled, an edit is listed without a reload on both screens, *Excluir* opens an irreversible confirmation that repeats the verb (*Excluir este compromisso?*, *Cancelar* focused, *Excluir* second) and the delete removes the row without a reload; the Google row keeps its dashed read-only look and opens in Google; the Agenda's collapsed header still shows name and count only.
- **AC-A8 (PRD AC-29) (manual):** Given the search route and at least one matching commitment, when the owner types two words, then a *Compromissos* group lists the matching local commitments with date and time, a local row opens the sheet and an edit refreshes the group, no Google event ever appears, a query below two characters sends no events request, with no match the group is absent, and a failed or unanswered commitments search never reads as "nothing found" while a Task-only search renders exactly as before; the decidable parts (the request path, the row label and the body decision) are pinned by tests.
- **AC-A9 (PRD AC-30) (manual):** Given the device is offline or a write fails, when the owner uses the sheet, then writes (*Novo compromisso*, *Salvar*, *Excluir* and the confirmation's *Excluir*) are disabled offline with the existing offline words while *Cancelar* and reading stay; a failed save or delete keeps the sheet open with an inline persistent reason (a deleted-elsewhere commitment says so and the list refetches) and no toast replaces it; every control is at least 48 px; the copy is pt-BR; and the UI/UX review checklist ✔/✘ for each screen touched is recorded under `PRPs/reports/events-and-day-view/phase-4/`.
- **AC-A10 (PRD AC-33):** Given the phase's diff, when it is inspected, then `src/shared/dates.ts`, `recurrence.ts` and `adherence.ts` are byte-identical to `HEAD`, `events.ts` and `event-hash.ts` are untouched, no migration, schema, endpoint, DTO, token or test file was added or changed by the Implementer, no client file spells a write to `events` or a Calendar mutation (`test/source-invariants.test.ts` and `test/event-api-inspection.test.ts` stay green), and `npm run check`, `npm test` and `npm run build` pass.

R8b (the PRD AC-N token check) is satisfied: every item above carries the `(PRD AC-N)` token it derives from.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A time lands an hour off across a DST gap or overlap, or a zone change shifts a commitment unexpectedly | M | H | One resolution rule shared by errors, create, patch and preview, built on the shared `wallClockToInstant`/`validateEventInput`; time keys of a patch are decided from wall-clock fields, never from instants, so an unchanged commitment cannot move; the pair pins New York gap and overlap cases; the zone-change semantics are stated (D4-4) |
| A title-only edit silently PATCHes a moved start or end | L | H | The patch compares the draft with `eventDraftFromEvent(event)` and an unchanged time sends no time key; the empty-patch case closes the sheet instead of sending an empty body (a 400 by design) |
| A start moved past the stored end is a 400 the owner cannot read | M | M | The builder sends both `startAt` and `endAt` when the start moves; the draft error `end_before_start` shows live, before any request; D4-8 records that the end is not shifted with the start |
| `Esc` closes the sheet and also leaves `/day` or search | M | M | Both screens' window handlers gate on `eventSheet.isOpen` (`SearchScreen.tsx:187` is the model); the live pass presses Esc with the sheet open |
| A late refetch repaints a deleted commitment on *Hoje* | M | M | `refreshLocalEvents` gets the newest-request-wins guard of `refreshAdherence`; `DayScreen` already has per-source counters |
| The full-IANA native select is long or awkward on Android | M | L | Decided and stated (D4-3): the full list with the owner's zone first; the option count and first values are measured in the pane, the real rendering is a device-proof item; the short-list-with-search fallback is one function (`timeZoneChoices`) and a component swap; V8 omits `UTC`/`Etc/*` from `Intl.supportedValuesOf` (reported by research), which `timeZoneChoices` covers for an Event already using one |
| Native date and time inputs misbehave inside the dialog on Android (keyboard overlap, partial entry yielding an empty value) | M | M | The inputs are native and an empty value is a defined state (`day_required`, `time_required`); `interactive-widget=resizes-content` is already set; the draft survives a closed sheet; the real behaviour is owed to the device (research found no authoritative source for a `<dialog>`) |
| Search says "nothing found" over a failed or pending commitments request | M | M | `decideSearchBody` is pure and tested: the empty branch needs both requests answered and empty; the commitments failure has its own alert line and retry |
| Opening the Compromisso sheet from *Hoje* stacks over the Task, Filter or Reminder sheet | L | M | The same `sheet.taskId === null` gating as `FilterSheet` and `ReminderSheet`; the modal dialog makes the page behind inert, so a row cannot be tapped under an open sheet |
| A client file trips the repository's source tripwires | L | M | The wrappers spell no `insert(events)`, `update(events)` or `delete(events)` and none of `events.insert`, `events.update`, `events.patch` or `events.delete`; Level 3 runs the whole `docs` project, which holds both tripwires |
| A multi-device edit overwrites a newer change with an older draft | L | L | The patch is computed against the snapshot taken at open; a deleted-elsewhere commitment is handled by the 404 mapping; the same limit the Task sheet has, accepted for one owner |
| The phase outgrows its budget (11 tasks, three modules and a hook) | M | M | Tasks 1 to 4 are the tested pure half plus the client wrappers and are useful alone; Tasks 5 to 9 are the UI half and Tasks 10 and 11 write the reports; no phase 5 work is pulled in; a split would need the dated amendment note the 2026-08-29 decision requires |
| The pair names its files differently, so a per-task `vitest run <name>` finds nothing | L | M | A vitest filter that matches no file exits non-zero, so a mismatch fails loudly; the names are fixed in Notes as the contract between plan and pair |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are
routed through the `test-writer`/`test-reviewer` pair's lifecycle
ledger (`/relay-write-test` → `/relay-test-write-review`), not authored
by the Implementer — R-X is a blanket straight-fail on any test glob in
the Implementer's diff. No task below and no `## Files to Change` row
targets a test file, so this plan's UI and report `**VALIDATE**` commands exercise the change directly (type-check, lint, format check, scripted file checks, the build) while the three pure-module tasks run the pair's pre-authored suites by filename.

**Test files the pair authors (names fixed here so the per-task `VALIDATE` filters resolve).** `test/event-edit.test.ts` (AC-A1, AC-A2, AC-A3 and the draft half of AC-A4), `test/event-sheet.test.ts` (AC-A5) and `test/event-view.test.ts` (the copy half of AC-A4, the decidable half of AC-A8, the failure mapping of AC-A9). AC-A6 and AC-A7 have no test file by the methodology's "UI stays manually verified" line; their decidable logic is AC-A1 to AC-A5. **Existing tests this phase changes: none.** The suites most likely to be near it — `test/task-edit.test.ts`, `test/task-sheet.test.ts`, `test/day-view.test.ts`, `test/day-range.test.ts`, `test/agenda-items.test.ts`, `test/source-invariants.test.ts`, `test/event-api-inspection.test.ts` — pass unmodified. If a legitimate behavioural change ever forces one to move, the pair updates it through the lifecycle ledger and never loosens it. Every function that needs the time takes `nowSeconds` as an argument by design, so the pair needs no fake clock.

**Who runs what.** The Implementer has no browser. Tasks 10 and 11 make it write the protocol and the checklist; the orchestrator (or the owner) runs the protocol in the browser pane and records `live-browser-pass.md` beside them, after which the `owed to the live pass` marks are replaced by a citation of the numbered observations. Anything the pane cannot show stays `owed to the owner's device` and is picked up by phase 5's device proof.

**Research grounding.** `research-codebase` located every anchor above (its two gaps are filled by this plan's own reads: `task-edit.ts` has no create builder or error function, and `draftFromTask` lives in `task-sheet.ts`, so the new modules split the same way). `research-web` reported: `Intl.supportedValuesOf("timeZone")` is Baseline since March 2022, sorted lexicographically, primary IDs only (MDN, `.../Intl/supportedValuesOf`); engines disagree on `UTC` and `Etc/*` (V8 omits them; ECMA-402 issue 778, date not captured); Google Calendar's own picker is a city or country search, not a full dropdown (`support.google.com/calendar/answer/37064`); since Chrome 108 the keyboard resizes only the visual viewport (`developer.chrome.com/blog/viewport-resize-behavior`); and an empty string is a defined value of `input type="time"` and `type="date"` (MDN). Gaps it could not close, so they are owed to the device: how a 400-option native `<select>` renders on Android Chrome, and how the native pickers behave inside a `<dialog>`.

**Decisions made by this plan (D4-n), so a reviewer can challenge them.**

- **D4-1 — Local rows become buttons; D3-5 is closed.** `LocalEventRow` takes a required `onOpen` and renders a button inside the `li`; the inert branch is deleted, not kept behind a flag. The phase-3 plan and reports are history and are not edited; their "inert" clauses are superseded by this phase's AC-28 walk. Google rows are unchanged.
- **D4-2 — The sheet keeps a snapshot.** The open edit target holds the Event as it was when the sheet opened, so no screen's list (the day, *Hoje*'s today, search results) can blank or close the sheet when it refetches, and the patch is computed against the snapshot. One draft per commitment id; one new-commitment draft per day (`new:<day>`), so reopening *Novo compromisso* is prefilled with the day it is opened for.
- **D4-3 — The zone select (PRD Open Question, answered).** A native `<select>` of `Intl.supportedValuesOf("timeZone")` (about 400 entries), `America/Sao_Paulo` first, the commitment's own zone second when it differs, option text the IANA id verbatim (an identifier, not copy), `[]` plus those two when the runtime lacks the API. No search and no short list in this phase: the PRD asks the device to decide, and the fallback (a short list with the owner's zone first, plus a search) is a one-function and one-component change recorded here as the trigger "the device proof finds the list unwieldy". The zone select stays visible for an all-day commitment (the PRD fixes the field order and says only that the times hide); the zone has no effect on an all-day commitment.
- **D4-4 — The wall clock is the draft's truth.** The draft holds wall-clock parts in `timezone`, and instants always derive from (wall clock, zone). Changing the zone with the wall clock untouched therefore moves a timed commitment's instants ("09:00 in New York" replaces "09:00 in São Paulo"), the way Google Calendar treats a zone change. Conversely, wall-clock fields the owner did not touch never produce a time key in a patch, which is what protects a commitment stored in an ambiguous hour.
- **D4-5 — *Novo compromisso* on `/day`.** A primary `Button` with a `Plus` glyph and the visible text, first in `<main>`, disabled offline. It is the screen's one primary action. A bottom bar or a header icon were rejected: the first needs a fifth grid row and safe-area handling, the second hides the PRD's own label behind an `aria-label`.
- **D4-6 — No success toast.** The PRD forbids a toast REPLACING the failure reason; success is shown by the sheet closing and the list changing. `/day` and search have no toast slot (the phase-3 checklist item 8 exception) and adding "Compromisso salvo" and "Compromisso excluído" to *Hoje* alone would make three screens behave differently. No new success strings.
- **D4-7 — Search.** Two independent requests (`GET /api/tasks?q=` unchanged, `GET /api/events?q=` new) and independent atoms; *Compromissos* is the FIRST group in the DOM, mirroring *Hoje* where the Agenda precedes the Tasks, capped by the API's 100 results; `decideSearchBody` is the only place that decides when the screen may say "nothing found". Reopen trigger for the order: the owner finds that commitments push his Tasks down.
- **D4-8 — The end does not follow the start.** Editing a start does not shift the end (Google Calendar does); the inline reason names an end that falls before the start. Preserving the duration would hide a rule inside the reducer and is not in AC-27. Reopen trigger: the owner reports it at the device proof ("moving it an hour" needs two edits).
- **D4-9 — Reasons.** `end_before_start` shows live; every other reason shows only after a *Salvar* attempt; `maxLength` on the three text fields makes `too_long` unreachable from the UI while the pure function stays total.
- **D4-10 — A partly typed end is completed from the start**: a missing end day takes the start day, a missing end time takes the start time, and a fully empty end takes the shared default (start plus one hour, or the next day), always shown before saving.
- **D4-11 — Failures.** 404 means another device deleted it: a fixed sentence and a refetch. Every other status uses the generic classifier sentence; the server's text (which carries a field marker) is never shown. The hook never reports to the connectivity reducer, so a failed commitments write cannot disable capture app-wide.
- **D4-12 — A new-commitment start.** The next full hour after now, capped at 23:00, only when the day is today in the owner's zone; otherwise 09:00 (PRD AC-28, whose own Open Question calls it a guess to revisit after a week).
- **D4-13 — Naming.** Identifiers say Event (`event-edit.ts`, `useEventSheet`, `EventDraft`); `CompromissoSheet` is the component name the PRD gives, and *Compromisso* appears elsewhere only as copy.

**New visible strings, for the owner's approval (ADR-0009).** Fixed by the PRD: *Novo compromisso*, *Título*, *Dia inteiro*, *Início*, *Fim*, *Fuso horário*, *Local*, *Descrição*, *Cancelar*, *Salvar*, *Excluir*, and the search group *Compromissos* (already the `/day` section label). Reused as they are: *Dia* (the Task sheet's date label), *Não dá para desfazer.*, *Sem conexão.* with *Dá para ler, mas não para salvar por enquanto.*, *Tentar de novo*, *dia todo*, the generic request-failure sentences and *A lista foi atualizada.* (the life-areas sentence). New: **`Hora`** (label of the time inputs); **`Excluir este compromisso?`** (confirmation title, the verb repeated); **`Termina em dd/MM/aaaa às HH:mm.`** and **`Termina em dd/MM/aaaa.`** (the resolved end); **`Informe o título.`**; **`Use no máximo N caracteres.`** (defensive, `maxLength` prevents it); **`Informe o dia de início.`**; **`Informe a hora de início.`**; **`O fim não pode ser antes do início.`**; **`Este compromisso não existe mais. A lista foi atualizada.`**; and the search row's label format **`dd/MM/aaaa · HH:mm`** (or `dd/MM/aaaa · dia todo`). The option text of *Fuso horário* is the IANA identifier and is not copy.

**Copy questions left for the owner, deliberately not changed.** The search field's placeholder (*Pesquisar tarefas…*), its `aria-label` and the empty sentence (*Nenhuma tarefa encontrada para “…”.*) still say tarefas although search now also finds commitments; a proposed replacement is *Pesquisar tarefas e compromissos…* and *Nada encontrado para “…”.*, one edit each. A second question is whether a saved or deleted commitment should also show a toast on *Hoje* (D4-6).

**Hand-off to phase 5 (AC-34) and the docs-sync pair.** Not touched here: `documentation/40-engineering/ui-layout-standard.md` §2 item 4 ("inert until the Compromisso sheet ships"), §2 item 11 (add *Novo compromisso*), §3 (the Compromisso sheet's order: *Título*, *Dia inteiro*, *Início*, *Fim*, *Fuso horário*, *Local*, *Descrição*, then *Cancelar*/*Salvar* and a distant *Excluir* behind the irreversible confirmation), §6's unit-14 row, and the History row; the glossary entry for *Compromisso*; `domain-model.md`; `docs/domain/areas/events.md`; `docs/context/architecture.md` (which says `LocalEventRow` "has no control, role or pointer styling of any kind, inert on purpose" and that the Agenda row is inert) and `docs/api-reference.md` (unchanged: no endpoint was added); FR-020 to FR-023 and FR-040 traceability; the roadmap row. The `Com hora` chip note stays phase 5's. Phase 4's `ui-checklist.md` ends with the list.

**Honest limits of this plan's verification.** The sheet, the hook and the screens have no component test tier (rejected at its own trigger; do not re-litigate): their VALIDATE is the type-check, lint and format of the real component graph plus the build, and the behaviour is the live pass and the device. Everything decidable is in the three tested modules. `scripts/check-mirror-inventory.mjs` already fails on two unrelated lines and is neither relied on nor fixed here.

*Generated: 2026-10-21*
*Approved: 2026-10-21*
*Implemented: 2026-10-21*
*Status: IMPLEMENTED*
