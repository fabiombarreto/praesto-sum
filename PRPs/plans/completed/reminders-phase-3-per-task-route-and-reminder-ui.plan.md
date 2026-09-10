# Feature: Per-Task route and Reminder UI (Phase 3 of reminders)

```
**Decision Gate**
- Active context: none (no .context.md provided or referenced)
- Activated criteria: new `AppRoute` variant and codec change (src/shared/app-route.ts); impact on the service-worker/SPA messaging seam (src/app/hooks/useRoute.ts, src/sw.ts read but not changed); impact on the cron sweep's payload (src/worker/cron.ts); new UI surfaces under src/app/components/ (owner-facing, pt-BR); reuse of the existing `/api/reminders` CRUD and `ReminderDto`/`CreateReminderInput`/`UpdateReminderInput` contract (phase 1); the UI/UX guidelines' mandatory review checklist
- Decisions found:
  - ADR-0003 — bearer token on every route (unaffected — no new route); D1 as the single canonical store
  - ADR-0005 — React 19 SPA + Hono/Drizzle stack, exact version pins (no new dependency introduced by this phase)
  - ADR-0008 (2026-08-04) — test-first methodology active (`tdd: true`); this phase's testable slice (`src/shared/app-route.ts`, `src/shared/dates.ts`, `src/shared/reminder-edit.ts`, `src/shared/task-sheet.ts`) falls inside the automated scope, while React components stay manually verified per `docs/context/methodology.md`
  - ADR-0009 (2026-08-18) — visible UI copy in pt-BR; every new label, button and error message this phase ships is pt-BR
  - ADR-0010 / ADR-0011 — visual identity tokens (`src/app/tokens.css`) and owned shadcn-style components over Base UI (`src/app/components/ui/`); no raw colour values, no new UI dependency
  - PRD Decisions Log (`PRPs/prds/reminders.prd.md`) — the per-Task deep link is new end-to-end work, not merely a device-proof of existing code (`src/shared/app-route.ts` has no Task variant at all today)
  - `documentation/40-engineering/ui-layout-standard.md` §3 — "Never stack sheets"; §6 unit-7 row — "Reminder fields inside the detail sheet; standalone Reminders as rows with a bell glyph in *Hoje*"
- Applicable anti-patterns:
  - "Hand-duplicated entity types" (`docs/anti-patterns.md`) — the Reminder UI reuses `ReminderDto`/`CreateReminderInput`/`UpdateReminderInput` from `src/shared/api.ts` (phase 1) verbatim; no parallel type is introduced
  - "Portuguese in artifacts" carve-out (ADR-0009) — every new visible string is pt-BR; identifiers, comments and tests stay English
  - Writing under `.claude/` — not triggered; every write lands under `src/`, `test/` (owned by the test pair) or `PRPs/reports/`
  - Version ranges in dependencies — not triggered; no new dependency
- Applicable architectural rules:
  - Types flow from `src/worker/db/schema.ts` outward through `src/shared/api.ts`; this phase adds no new wire type, it only builds UI against phase 1's existing ones
  - `src/shared/` carries no DOM globals and stays environment-agnostic; the new local-datetime helpers take the timezone as an explicit argument, matching `offsetToInstant`'s own convention
  - Browser-API work is split per `docs/context/methodology.md`: the decidable half (route codec, date conversion, draft/patch diffing, the sheet's view state machine) is pure and test-first; only the thin adapter lines (the `postMessage` listener itself) are exempt and device-verified in phase 4
  - "Never stack sheets" (layout standard §3) — the Task-linked Reminder editor is an in-place VIEW inside the already-open Task `<dialog>`, never a second dialog
- Result: PROCEED
```

## Source PRD

- `PRPs/prds/reminders.prd.md` — Implementation Phases row 3: "Per-Task
  route and Reminder UI" — Goal: the owner can set a reminder without a
  terminal, and tapping one lands on the thing it is about. — Success
  signal: AC-8 green; the checklist result recorded; a reminder created
  entirely through the interface.

## Summary

Give the notification deep link somewhere real to point (`AppRoute` gains a
per-Task variant, the cron sweep's payload uses it, and the SPA learns to
navigate on a notification tap even while already open — AC-8), and give the
owner a pt-BR interface to create, edit and delete both Reminder shapes phase
1 already built a write path for: a standalone Reminder (label + absolute
instant) and a Task-linked one (absolute or offset-in-minutes before the
deadline). Standalone Reminders surface as their own group of rows with a
bell glyph on *Hoje* (layout standard §6); a Task-linked Reminder is edited
as an in-place view inside the Task's own detail sheet, never a second
stacked dialog. No deadline recomputation and no on-device proof — those are
phase 4.

## User Story

As the owner, I want to set, change and remove a reminder — either on its
own or attached to one of my Tasks — entirely from the app, and have tapping
a fired reminder land me on the thing it is about, so that I never have to
open a terminal or land on a blank home screen to use the feature the rest
of this unit built.

## Problem Statement

Phase 1 gave the domain a full CRUD surface (`/api/reminders`) and phase 2
gave the cron a job, but nothing in `src/app/` can reach either yet, and the
notification payload still points at `/` because `AppRoute` has no Task
variant at all
(`src/shared/app-route.ts:25`, confirmed unchanged since the PRD's own
Technical Context). Scoped to this phase: an owner who sets a reminder today
has to call the API by hand, and a reminder that does fire (through phase
2's sweep) opens the home screen instead of the Task it named.

## Solution Statement

Extend `AppRoute` with a template-literal Task variant (`` `task/${string}` ``)
so the existing two-function codec (`routeFromPath`/`pathOf`) stays a total,
round-tripping pair per AC-8, and point the sweep's payload at it. Add the
one missing half of the notification-tap path — a `message` listener in the
existing `useRoute` hook, since `src/sw.ts`'s `notificationclick` handler
already posts a generic `{type: "NOTIFICATION_CLICK", url}` message and
needs no change. For the UI, reuse phase 1's wire contract unchanged and add
a small, pure, test-first layer (`src/shared/dates.ts` local-datetime
helpers, `src/shared/reminder-edit.ts`'s draft/patch builder, and two new views —
`"reminder"` and its own `"confirm-reminder"` — added to
`src/shared/task-sheet.ts`'s existing state machine, four in total) so the only untested code is the React glue that renders it —
exactly the split `docs/context/methodology.md` already established for
`task-edit.ts`/`task-sheet.ts`. A dialog-agnostic `ReminderForm` is shared by
both entry points: inline inside the already-open Task sheet (Task-linked,
never a second dialog) and inside its own `ReminderSheet` dialog for the
standalone case, reached from a "Novo lembrete" header action on a new
*Lembretes* group on *Hoje* — the layout standard's own precedent for a
group-header action (*Reagendar para hoje* on *Atrasadas*), since the
standard names WHERE pending Reminders live but is silent on how one gets
created.

## Metadata

| Field | Value |
|---|---|
| Type | Feature |
| Complexity | High |
| Systems Affected | SPA (`src/app/components/`, `src/app/hooks/useRoute.ts`, `src/app/api.ts`); shared pure logic (`src/shared/app-route.ts`, `src/shared/dates.ts`, `src/shared/reminder-edit.ts`, `src/shared/task-sheet.ts`); Worker cron payload (`src/worker/cron.ts`) |
| Dependencies | Phase 2 (`The due-Reminder sweep`) — `complete` |
| Estimated Tasks | 14 |
| Source PRD line ref | `PRPs/prds/reminders.prd.md` Implementation Phases row 3 (lines 370, 399-410) |
| phase_type | feature |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| P0 | `src/shared/app-route.ts` | 1-46 | The exact two-member codec (`routeFromPath`/`pathOf`) this phase extends to a Task variant — AC-8's round-trip contract lives here |
| P0 | `src/worker/cron.ts` | 26-89 | The sweep's payload-build block (`route: "/"`) this phase repoints at the Task route once one exists |
| P0 | `src/app/hooks/useRoute.ts` | 34-82 | The exempt-glue hook this phase extends with the missing `message` listener — same "decidable half in `src/shared/`, thin adapter here" discipline the file's own doc comment states |
| P0 | `src/sw.ts` | 75-96 | `notificationclick` already posts a generic `{type: "NOTIFICATION_CLICK", url}` message — confirms NO change is needed here, only on the SPA side |
| P0 | `src/shared/dates.ts` | 1-139 | The exact timezone-safe diffing technique (`offsetMinutesAt`, `offsetToInstant`) this phase's local-datetime helpers reuse rather than re-deriving |
| P0 | `src/shared/task-edit.ts` | 1-96 | The draft/patch-diff pattern (`buildTaskPatch`) `src/shared/reminder-edit.ts` mirrors for both Reminder shapes |
| P0 | `src/shared/task-sheet.ts` | 1-116 | The sheet's existing `SheetView` state machine (`"detail" \| "confirm"`) this phase extends with a `"reminder"` editor view and its own `"confirm-reminder"` view — the mechanism that keeps the Task-linked editor from stacking a second dialog, and that keeps the two deletions from being confused for each other |
| P0 | `src/app/components/TaskSheet.tsx` | 1-191 | The exact view-swap markup (`view === "detail" ? <form> : <ConfirmView/>`) the two new views extend the same way, widening the ternary to a four-way switch |
| P0 | `documentation/40-engineering/ui-ux-guidelines.md` | 146-168 | The mandatory Tier A review checklist this phase must run and record (Hard project rule) |
| P0 | `documentation/40-engineering/ui-layout-standard.md` | 38-67 | §3 "Never stack sheets"; §6 unit-7 row naming where Reminders live on *Hoje* and in the detail sheet |
| P1 | `src/app/components/EventRow.tsx` | 1-87 | The non-Task-row pattern (leading glyph, no completion control, no colour-only cue) `ReminderRow` adapts with a bell glyph |
| P1 | `src/app/components/ui/ConfirmView.tsx` | 1-73 | The delete-confirmation pattern (`Cancelar` focused by default, destructive button second) both Reminder delete flows reuse |
| P1 | `src/app/api.ts` | 184-199 | The one-liner `request<T>()` wrapper pattern the new Reminder CRUD client functions follow |
| P1 | `src/app/components/TodayScreen.tsx` | 119-190, 653-696 | Screen-owns-state-and-requests convention, and the `TaskGroup` rendering pattern the new *Lembretes* group follows |
| P1 | `src/shared/api.ts` | 104-118, 252-283 | `ReminderDto`/`CreateReminderInput`/`UpdateReminderInput`/`EDITABLE_REMINDER_FIELDS` — phase 1's existing wire contract, reused unchanged, never re-declared |

## Patterns to Mirror

```
# SOURCE: src/shared/app-route.ts:25-45
export type AppRoute = "today" | "settings" | "notifications" | "notifications-diagnostics";

function withoutTrailingSlash(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function routeFromPath(pathname: string): AppRoute {
  const path = withoutTrailingSlash(pathname);
  if (path === "/settings/notifications/diagnostics") return "notifications-diagnostics";
  if (path === "/settings/notifications") return "notifications";
  if (path === "/settings") return "settings";
  return "today";
}

export function pathOf(route: AppRoute): string {
  if (route === "notifications-diagnostics") return "/settings/notifications/diagnostics";
  if (route === "notifications") return "/settings/notifications";
  if (route === "settings") return "/settings";
  return "/";
}
```
Extended by Task 1 — the existing "check the most specific path first"
convention already used for the three settings routes, now checking a
`/tasks/:id` pattern before falling through to `today`; `AppRoute` grows a
template-literal member (`` `task/${string}` ``) rather than a discriminated
union, so every existing `route === "settings"`-style comparison in
`src/app/App.tsx` stays valid with no call-site change.

```
# SOURCE: src/worker/cron.ts:56-63
const payload = JSON.stringify(
  buildNotificationPayload({
    title: "Praesto",
    body: reminder.label ?? task?.title ?? "Lembrete",
    route: "/",
    tag: `reminder-${reminder.id}`,
  }),
);
```
Edited by Task 2 — only the `route` field changes, to the Task's path when
`reminder.taskId !== null`, exactly the scope phase 2's own plan reserved
("The payload's `route` may still be `/` at the end of this phase — phase 3
gives it somewhere better to point").

```
# SOURCE: src/app/hooks/useRoute.ts:45-56
useEffect(() => {
  function handlePopState(): void {
    setRoute(routeFromPath(window.location.pathname));
  }
  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, []);

const navigate = useCallback((next: AppRoute) => {
  history.pushState(PUSHED_BY_APP, "", pathOf(next));
  setRoute(next);
}, []);
```
Mirrored by Task 3 — the same "listen for a browser/platform event, decode
through the shared pure codec, call the existing `navigate`" shape, applied
to `navigator.serviceWorker`'s `message` event instead of `popstate`.

```
# SOURCE: src/sw.ts:75-96
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { route: string };
  const target = new URL(data.route, self.location.origin);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (new URL(client.url).origin !== target.origin) continue;
        await client.focus();
        client.postMessage({ type: "NOTIFICATION_CLICK", url: target.pathname + target.search });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
```
Read (not copied) by Task 3 — confirms `src/sw.ts` already posts exactly the
`{type: "NOTIFICATION_CLICK", url}` shape the new listener consumes; no
`src/sw.ts` edit is part of this plan.

```
# SOURCE: src/shared/dates.ts:55-94
function offsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  // ... builds `asIfUtc` via Date.UTC and diffs it against `instant`
}
```
Reused by Task 4 — exported (adding `export` only, no behavioural change)
so the new local-datetime helpers can call it directly rather than
re-deriving the same `formatToParts`-diff technique research-web already
identified for this codebase (phase 1's own `## Risks and Mitigations`).

```
# SOURCE: src/shared/dates.ts:108-139
export function offsetToInstant(day: string, offsetMinutes: number, timeZone: string = PRAESTO_TIMEZONE): number {
  ...
  const wallClockAsIfUtc = Date.UTC(year, month - 1, date, hours, minutes, 0);
  const firstPassOffset = offsetMinutesAt(new Date(wallClockAsIfUtc), timeZone);
  let instantMs = wallClockAsIfUtc - firstPassOffset * 60_000;
  const secondPassOffset = offsetMinutesAt(new Date(instantMs), timeZone);
  if (secondPassOffset !== firstPassOffset) instantMs = wallClockAsIfUtc - secondPassOffset * 60_000;
  return Math.floor(instantMs / 1000);
}
```
Mirrored by Task 4's `localPartsToInstant` — the identical two-pass
DST-refinement shape, generalised to take an explicit `HH:mm` instead of
deriving one from the end-of-day constant.

```
# SOURCE: src/shared/task-edit.ts:50-67
export function buildTaskPatch(original: TaskDto, draft: TaskDraft): UpdateTaskInput {
  const patch: UpdateTaskInput = {};
  const title = draft.title.trim();
  if (title !== "" && title !== original.title) patch.title = title;
  const description = draft.description.trim();
  const nextDescription = description === "" ? null : description;
  if (nextDescription !== original.description) patch.description = nextDescription;
  if (draft.priority !== original.priority) patch.priority = draft.priority;
  applyDate(patch, original, draft);
  return patch;
}
```
Copied by Task 5 (`buildUpdateReminderInput`) — the identical
"only-the-changed-keys" diff contract, adapted to `label`/`fireAt`/
`originOffsetMinutes` instead of `title`/`description`/`priority`/dates.

```
# SOURCE: src/shared/task-sheet.ts:71-115
export function reduceTaskSheet(state: TaskSheetState, event: TaskSheetEvent): TaskSheetState {
  switch (event.type) {
    case "open": ...
    case "request-delete":
      if (state.taskId === null) return state;
      return { ...state, view: "confirm" };
    case "cancel-delete":
      if (state.taskId === null) return state;
      return { ...state, view: "detail" };
    ...
  }
}
```
Extended by Task 7 — the exact `view` swap already used for
`"detail" -> "confirm"` gains two more values, `"reminder"` and
`"confirm-reminder"`, with `open-reminder`/`close-reminder` and
`request-delete-reminder`/`cancel-delete-reminder` events following the same
"no-op when `taskId` is null" guard every other event already has. The
second pair is what keeps a reminder deletion from reaching the Task's own
confirmation.

```
# SOURCE: src/app/components/TaskSheet.tsx:70-90, 176-187
{view === "detail" ? (
  <form ...>
    ...
  </form>
) : (
  <ConfirmView
    title="Excluir esta tarefa?"
    ...
  />
)}
```
Extended by Task 12 — the ternary widens to four branches. `view ===
"reminder"` renders `ReminderForm`, and `view === "confirm-reminder"`
renders its own `ConfirmView`, both inside the SAME `<Sheet>` the
`"detail"`/`"confirm"` branches already share, which is what keeps the
Task-linked Reminder editor from
ever opening a second `<dialog>` (layout standard §3, "Never stack sheets").

```
# SOURCE: src/app/components/EventRow.tsx:34-56
export function EventRow({ event }: { event: CalendarEventDto }) {
  const time = formatEventTime(event.start);
  const content = (
    <>
      <span className="w-14 flex-none font-data text-t1 text-muted tabular-nums">{time}</span>
      <Calendar className="size-4 flex-none text-faint" aria-hidden="true" />
      <span className={cn("line-clamp-2 min-w-0 flex-1 font-text text-t2 text-ink", ...)}>
        {event.title ?? UNTITLED}
      </span>
    </>
  );
  ...
}
```
Adapted by Task 10 (`ReminderRow`) — the same "leading fixed-width time
column + glyph + title" row shape, `Calendar` swapped for `Bell`
(lucide-react), with a leading completion-less, dashed-free `bg-surface-2`
row (a Reminder is the owner's own item, unlike a read-only Google event, so
it keeps `TaskRow`'s filled background rather than `EventRow`'s dashed
outline) and a trailing edit affordance instead of an outward link.

```
# SOURCE: src/app/components/TaskGroup.tsx:12-27
export function TaskGroup({ name, count, collapsed, onToggle, children }: {...}) {
  if (count === 0) return null;
  const headerContent = (
    <>
      <h2 ...>{name}</h2>
      <span ...>{count}</span>
      {onToggle !== undefined && <ChevronDown .../>}
    </>
  );
  ...
}
```
Reused unmodified by Task 11 — the *Lembretes* group is rendered with the
existing `TaskGroup` component; its header GAINS an action button
(`Novo lembrete`) the same way the layout standard already documents for
*Atrasadas* ("header action *Reagendar para hoje*",
`documentation/40-engineering/ui-layout-standard.md:31`) — `TaskGroup`
itself needs no change, the action renders as a sibling inside the
`<section>` `TodayScreen.tsx` already wraps each group in.

```
# SOURCE: src/app/api.ts:184-199
export async function startGoogleConnect(): Promise<{ consentUrl: string }> {
  return request<{ consentUrl: string }>("/api/google/connect", { method: "POST" });
}

export async function fetchGoogleConnection(): Promise<{ connection: GoogleConnectionDto | null }> {
  return request<{ connection: GoogleConnectionDto | null }>("/api/google/connection");
}
```
Copied by Task 6 — the same one-liner `request<T>()` wrapper shape for
`listReminders`/`createReminder`/`updateReminder`/`deleteReminder`, no local
types beyond what `src/shared/api.ts` already exports.

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/app-route.ts` | UPDATE | Add the per-Task `AppRoute` variant and its two codec functions (AC-A1) |
| `src/worker/cron.ts` | UPDATE | Point the sweep's payload `route` at the Task path when `taskId` is set (AC-A1) |
| `src/app/hooks/useRoute.ts` | UPDATE | Add the `message` listener that turns a `NOTIFICATION_CLICK` postMessage into a `navigate()` call (AC-A5) |
| `src/shared/dates.ts` | UPDATE | Export `offsetMinutesAt`; add `instantToLocalParts`/`localPartsToInstant` for the absolute-Reminder date/time inputs (scaffolding for AC-A2/AC-A3) |
| `src/shared/reminder-edit.ts` | CREATE | The pure draft-seed and create/patch-diff builder for both Reminder shapes (scaffolding for AC-A2/AC-A3/AC-A4) |
| `src/app/api.ts` | UPDATE | Add `listReminders`/`createReminder`/`updateReminder`/`deleteReminder` client wrappers (scaffolding) |
| `src/shared/task-sheet.ts` | UPDATE | Add the `"reminder"` and `"confirm-reminder"` views and their four events to the existing state machine (scaffolding for AC-A3, keeps "never stack sheets", and puts the which-delete-is-in-flight discrimination under test in `src/shared`) |
| `src/app/components/ReminderForm.tsx` | CREATE | The dialog-agnostic pt-BR form (label, absolute/offset toggle, delete) shared by both entry points (AC-A2, AC-A3, AC-A4) |
| `src/app/components/ReminderSheet.tsx` | CREATE | The standalone-Reminder dialog wrapping `ReminderForm` + `ConfirmView` (AC-A2) |
| `src/app/components/ReminderRow.tsx` | CREATE | The bell-glyph row for a standalone Reminder on *Hoje* (AC-A2 display) |
| `src/app/components/TodayScreen.tsx` | UPDATE | Fetch Reminders, render the *Lembretes* group with its "Novo lembrete" header action, own the `ReminderSheet` open/save/delete requests (AC-A2); wire the Task-linked Reminder props at the `<TaskSheet .../>` call site (AC-A3) |
| `src/app/components/TaskSheet.tsx` | UPDATE | Render the `"reminder"` view (`ReminderForm` inline, its delete affordance wired to `onReminderDeleteRequest`), a separate `"confirm-reminder"` view with its own pt-BR copy and callbacks, and a Reminder summary row in `"detail"` view (AC-A3) |
| `PRPs/reports/reminders-phase-3/ui-ux-checklist.md` | CREATE | The recorded Tier A ✔/✘ checklist result the Hard project rules require — a process gate with no numbered PRD AC or plan AC-A of its own (see Task 14) |

## NOT Building (Scope Limits)

- **No deadline recomputation.** Recomputing a relative Reminder's `fireAt`
  when its Task's deadline changes (AC-11/AC-12) is phase 4.
- **No on-device proof.** The owner's phone tapping a real Task-linked
  reminder, app closed and app open, is phase 4's exit signal, not this
  plan's — the `message`-listener task (Task 3) is verified by `tsc -b`
  only, per the PRD's own Technical Risk row on this exact seam.
- **No change to `/api/reminders` or the sweep's dispatch/claim logic.**
  Phases 1 and 2 already own that; this phase only calls the existing
  routes from the UI and repoints the payload's `route` field.
- **No new database column, no migration.** `reminders` already carries
  every field this phase's UI needs.
- **No new dependency.** `ReminderForm`/`ReminderSheet`/`ReminderRow` are
  built from the existing owned components (`Button`, `Chip`, `Sheet`,
  `ConfirmView`) under `src/app/components/ui/`.
- **No new header icon / navigation region.** The layout standard caps the
  header at "up to three" icon buttons and reserves the third for unit 8's
  search; the standalone-Reminder entry point is a group-header action on
  *Hoje* instead (the same mechanism *Atrasadas* already uses), not a new
  icon button — see `## Notes` for the reasoning.
- **No change to `src/sw.ts`.** `notificationclick` already posts the
  generic `{type: "NOTIFICATION_CLICK", url}` message this phase's SPA-side
  listener consumes; verified by reading it (Task 3's Mandatory Reading),
  not assumed.

## Step-by-Step Tasks

### Task 1: Extend `AppRoute` with a per-Task variant

**ACTION**: In `src/shared/app-route.ts`, widen `AppRoute` to
`"today" | "settings" | "notifications" | "notifications-diagnostics" | \`task/${string}\``
(a template-literal member, not a discriminated union, so every existing
`route === "settings"`-style equality check elsewhere keeps compiling
unchanged). Add two exported functions: `taskRouteOf(taskId: string):
AppRoute` returning `` `task/${taskId}` ``, and `taskIdFromRoute(route:
AppRoute): string | null` returning the id when `route` starts with
`"task/"`, else `null`. Extend `routeFromPath` to match `/tasks/:id` via a
regex (`/^\/tasks\/([^/]+)$/`) BEFORE falling through to the `"today"`
default, returning `taskRouteOf(match[1])` when the captured group is a
non-empty string (guard the `noUncheckedIndexedAccess` read explicitly).
Extend `pathOf` with a branch for a route starting with `"task/"`,
returning `` `/tasks/${taskIdFromRoute(route)}` ``. This is the codec half
of AC-8: `pathOf(routeFromPath(p)) === p` must hold for a Task path.

**MIRROR**: `src/shared/app-route.ts:25-45` (`# SOURCE` block above) — same
"most specific path first" ordering already used for the three settings
routes.

**VALIDATE**: `npm test` (runs the test-first suite `test-writer` extends
`test/app-route.test.ts` with, per the file's own documented "ADDITIVE"
convention — see its header comment for the precedent from
`push-channel-proven` phase 4; `vitest run` exits non-zero on any failing
test; against the tree as it stands today `AppRoute` has no Task member at
all, so an AC-8 round-trip assertion fails today for the right reason)

### Task 2: Point the sweep's payload at the Task route

**ACTION**: In `src/worker/cron.ts`, import `pathOf` and `taskRouteOf` from
`../shared/app-route`. In the `buildNotificationPayload({...})` call inside
`runScheduledJob`, change the `route: "/"` field to
`route: reminder.taskId !== null ? pathOf(taskRouteOf(reminder.taskId)) : "/"`
— a standalone Reminder (`taskId === null`) keeps pointing at `/`; a
Task-linked one now points at that Task's path. No other line in this
function changes.

**MIRROR**: `src/worker/cron.ts:56-63` (`# SOURCE` block above).

**VALIDATE**: `npm test` (exercises the test-first suite `test-writer`
extends `test/cron-sweep.test.ts` with, asserting a Task-linked Reminder's
dispatched payload carries the Task's path per AC-8; against the tree
today the payload's `route` is the literal `"/"` for every Reminder, so a
Task-linked assertion fails today for the right reason)

### Task 3: Add the SPA's notification-tap listener

**ACTION**: In `src/app/hooks/useRoute.ts`, inside `useRoute()`, add a new
`useEffect` (after `navigate` is declared, since it depends on it) that
adds a `message` listener on `navigator.serviceWorker` — guarded with
optional chaining, since `navigator.serviceWorker` is `undefined` in
non-HTTPS/non-supporting contexts. The handler reads `event.data` as
`{ type?: unknown; url?: unknown }`; when `data.type === "NOTIFICATION_CLICK"`
and `typeof data.url === "string"`, it calls `navigate(routeFromPath(data.url))`
— reusing the existing `navigate` (already imported) so the tap behaves
like any other in-app navigation (a new history entry `back()` can pop).
Clean up the listener on unmount. This is the exempt glue half of
`docs/context/methodology.md`'s "Browser-API work" split — the DECISION
(which route a URL is) already lives in the pure `routeFromPath`; this
task only wires the platform event to it, mirroring the existing
`popstate` listener in the same hook. Delivers AC-A5: this is the
listener that lets the SPA, already open in the foreground, navigate on
a `NOTIFICATION_CLICK` message without a page reload.

**MIRROR**: `src/app/hooks/useRoute.ts:45-56` (`# SOURCE` block above) —
same "listen, decode through the shared codec, act" shape as the existing
`popstate` handler.

**VALIDATE**: `npx tsc -b` (fails non-zero on any strict-mode violation;
device verification of this exact seam — "the postMessage path into an
already-open SPA has never run on hardware" — is explicitly the PRD's own
phase-4 Technical Risk, not this task's; against the tree today this
listener does not exist at all, so this exercises genuinely new code)

### Task 4: Add local-datetime <-> instant conversions to `src/shared/dates.ts`

**ACTION**: Add the `export` keyword to the existing `offsetMinutesAt`
function (no other change to it — a pure visibility widening). Add two new
exported functions: `instantToLocalParts(epochSeconds: number, timeZone:
string = PRAESTO_TIMEZONE): { day: string; time: string }` — formats the
instant via `Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23",
year/month/day/hour/minute: "2-digit" }).formatToParts(...)` and assembles
`day` (`YYYY-MM-DD`) and `time` (`HH:mm`) from the parts (guard every
`lookup.get(...)` the same explicit way `offsetToInstant` already does for
`noUncheckedIndexedAccess`); and `localPartsToInstant(day: string, time:
string, timeZone: string = PRAESTO_TIMEZONE): number` — parses `day` and
`time`, builds `wallClockAsIfUtc` via `Date.UTC`, and applies the exact
same two-pass `offsetMinutesAt` refinement `offsetToInstant` already uses
(first pass, second pass against the candidate instant, adopt the second
offset only if it differs) before returning `Math.floor(instantMs /
1000)`. Both functions read no ambient clock beyond the `epochSeconds` or
`day`/`time` they are handed, matching AC-14's convention exactly. These
back the absolute-Reminder date/time inputs Task 5/Task 8 need; the
existing `offsetToInstant` is left untouched (no refactor, no behavioural
risk to its already-shipped, already-tested fixtures).

**MIRROR**: `src/shared/dates.ts:55-94` (`offsetMinutesAt`, exported) and
`src/shared/dates.ts:108-139` (`offsetToInstant`'s two-pass refinement,
generalised) — both `# SOURCE` blocks above.

**VALIDATE**: `npm test` (runs the test-first suite `test-writer` adds to
`test/dates.test.ts` for `instantToLocalParts`/`localPartsToInstant`,
including a DST-boundary fixture mirroring the existing `offsetToInstant`
coverage; against the tree today neither function exists, so this exercises
genuinely new code; `npx tsc -b` also re-run implicitly by `npm run check`
at Level 1 to catch a `noUncheckedIndexedAccess` violation on the new
`formatToParts` lookups)

### Task 5: Add the pure Reminder draft/patch builder

**ACTION**: Create `src/shared/reminder-edit.ts`. Export `type
ReminderTimeMode = "absolute" | "offset"` and `interface ReminderDraft {
label: string; timeMode: ReminderTimeMode; absoluteDay: string;
absoluteTime: string; offsetMinutes: number }`. Export `draftFromReminder
(reminder: ReminderDto | null): ReminderDraft` — seeds an empty draft
(`timeMode: "absolute"`, `offsetMinutes: 60`) when `reminder` is `null`
(create), else restores every field from the existing row, deriving
`absoluteDay`/`absoluteTime` via Task 4's `instantToLocalParts(reminder.fireAt)`
and `timeMode` from whether `originOffsetMinutes` is non-null. Export
`buildCreateReminderInput(draft: ReminderDraft, taskId: string | null):
CreateReminderInput` — trims `label` (empty becomes `null`), and sets
either `originOffsetMinutes` (when `timeMode === "offset"` AND `taskId !==
null` — an offset with no Task target is meaningless, mirroring the
route's own AC-4 invariant) or `fireAt` via Task 4's `localPartsToInstant`
(guarded by `isCalendarDate(draft.absoluteDay)` and a `/^\d{2}:\d{2}$/`
check on `absoluteTime`, never trusting a half-typed value). Export
`buildUpdateReminderInput(original: ReminderDto, draft: ReminderDraft):
UpdateReminderInput` — the same "only the changed keys" diff contract as
`buildTaskPatch`, additionally clearing `originOffsetMinutes` to `null`
when the draft has moved from offset mode back to an absolute time. No DOM
globals, no runtime dependency — compiles into both targets like every
other `src/shared/` module.

**MIRROR**: `src/shared/task-edit.ts:50-67` (`# SOURCE` block above) — the
same "only the changed keys" diff contract; `src/worker/routes/reminders.ts:36-65`
(read, not copied) — the same "offset with a Task with a deadline, else a
finite `fireAt`, else reject" precedence the route itself already enforces
server-side, which this draft builder deliberately narrows CLIENT-side so
the owner never submits a request the route would 400 (AC-A4).

**VALIDATE**: `npm test` (runs the test-first suite `test-writer` writes
against `test/reminder-edit.test.ts`, covering both Reminder shapes'
create and patch paths; against the tree today this module does not exist,
so the suite is RED for the right reason — module-not-found — until this
task lands)

### Task 6: Add Reminder CRUD wrappers to the API client

**ACTION**: In `src/app/api.ts`, add four one-liner wrappers mirroring the
existing Google/push wrappers exactly: `listReminders(): Promise<ReminderDto[]>`
(`GET /api/reminders`, unwraps `{ reminders }`), `createReminder(input:
CreateReminderInput): Promise<ReminderDto>` (`POST /api/reminders`, unwraps
`{ reminder }`), `updateReminder(id: string, input: UpdateReminderInput):
Promise<ReminderDto>` (`PATCH /api/reminders/:id`, unwraps `{ reminder }`),
and `deleteReminder(id: string): Promise<void>` (`DELETE
/api/reminders/:id`). Import `ReminderDto`, `CreateReminderInput`,
`UpdateReminderInput` from `../shared/api` (add to the existing `import
type {...}` block). No local types, no error re-mapping — a failure
already arrives as `ApiError` exactly like every other wrapper in this
file. These four wrappers are what AC-A2 (standalone Reminder CRUD) and
AC-A3 (Task-linked Reminder create/edit) call through from the UI —
this task is the one place both routes through.

**MIRROR**: `src/app/api.ts:184-199` (`# SOURCE` block above) and
`src/app/api.ts:127-146` (`createTask`/`updateTask` — the
JSON-body-plus-unwrap shape for the two write methods).

**VALIDATE**: `if grep -q "export async function listReminders" src/app/api.ts && grep -q "export async function createReminder" src/app/api.ts && grep -q "export async function updateReminder" src/app/api.ts && grep -q "export async function deleteReminder" src/app/api.ts; then echo "PASS: reminder API client wrappers present"; else echo "FAIL: reminder API client wrappers missing"; exit 1; fi`
(fails today — none of the four functions exist yet; these thin wrappers
carry no dedicated test file, matching the existing Google/push wrapper
convention, so `npx tsc -b` at Level 1 is this task's compile-correctness
gate)

### Task 7: Extend the Task sheet's state machine with a `"reminder"` view

**ACTION**: In `src/shared/task-sheet.ts`, widen `SheetView` to `"detail" |
"confirm" | "reminder" | "confirm-reminder"`. Add FOUR events to
`TaskSheetEvent`: `{ type: "open-reminder" }`, `{ type: "close-reminder" }`,
`{ type: "request-delete-reminder" }` and `{ type:
"cancel-delete-reminder" }`. In `reduceTaskSheet`, handle `"open-reminder"`
and `"request-delete-reminder"` exactly like `"request-delete"` (no-op when
`state.taskId === null`, else `{ ...state, view: "reminder" }` and `{
...state, view: "confirm-reminder" }` respectively); handle
`"close-reminder"` like `"cancel-delete"` (no-op when null, else `{
...state, view: "detail" }`) and `"cancel-delete-reminder"` the same way but
returning to `{ ...state, view: "reminder" }` — cancelling a reminder
deletion goes back to the reminder editor the owner was in, not to the Task
detail, which is the honest destination and the one difference from the
Task-delete pair.

**A `"confirm-reminder"` view distinct from `"confirm"` is the whole point
of this task, not a refinement of it.** Reusing the single `"confirm"` view
for both deletions leaves nothing in the state able to say WHICH delete is
in flight, so the confirmation would read "Excluir esta tarefa?" over a
reminder deletion and, wired to the Task-delete callbacks it already owns,
would delete the whole Task. `tsconfig.base.json` sets neither
`noUnusedParameters` nor `noUnusedLocals`, so the orphaned reminder
callbacks would compile clean and `tsc -b` would never see it. Keeping the
discrimination HERE — in `src/shared`, where `test/task-sheet.test.ts`
reaches it — rather than in a React prop is what puts it under test at all,
per `docs/context/methodology.md`'s browser-API split. This is the
state-machine half of AC-A3's "without ever opening a second, stacked
dialog" claim: four views, one dialog.

**MIRROR**: `src/shared/task-sheet.ts:71-115` (`# SOURCE` block above) —
the identical `request-delete`/`cancel-delete` no-op-when-null guard and
view-swap shape, applied to the two new pairs of events.

**VALIDATE**: `npm test` (runs the test-first suite `test-writer` extends
`test/task-sheet.test.ts` with, asserting each new event's
no-op-when-null guard and its view transition — including that
`"cancel-delete-reminder"` lands on `"reminder"` and NOT on `"detail"`,
which is what would catch the two confirmations being conflated; against
the tree today neither `"reminder"` nor `"confirm-reminder"` is a valid
`SheetView` value at all, so a type-level and a behavioural assertion both
fail for the right reason until this task lands)

### Task 8: Build `ReminderForm` — the shared pt-BR create/edit form

**ACTION**: Create `src/app/components/ReminderForm.tsx`. Props: `draft:
ReminderDraft`, `taskId: string | null` (when non-null, the offset toggle
is offered; when null, only the absolute date/time fields show), `busy:
boolean`, `error: string | null`, `existing: boolean` (whether this edits a
Reminder or creates one, controlling whether a delete affordance renders),
`onDraftChange: (changes: Partial<ReminderDraft>) => void`, `onSubmit: () =>
void`, `onDeleteRequest?: () => void`. Fields, in this order (mirroring the
layout standard §3 detail-content-order convention of label-then-control):
a `label` text input ("Lembrete de quê?" — pt-BR, ADR-0009); when `taskId
!== null`, a `ChipGroup` toggling `timeMode` between `"absolute"`
("Hora exata") and `"offset"` ("Antes do prazo"); when `timeMode ===
"offset"`, a numeric minutes input bound to `offsetMinutes` (label "Minutos
antes do prazo"); when `timeMode === "absolute"`, a `type="date"` input
bound to `absoluteDay` and a `type="time"` input bound to `absoluteTime`
(native inputs per guidelines §12.5 — no custom picker); `Cancelar`/`Salvar`
buttons in a `flex gap-2` row exactly like `TaskSheet.tsx`'s own form
footer; an inline `role="alert"` error paragraph when `error !== null`;
and, when `existing && onDeleteRequest !== undefined`, a ghost `Excluir`
button with the `Trash2` icon, styled identically to `TaskSheet.tsx`'s own
delete affordance. Client-side pre-empts the same invariant the route
enforces server-side (AC-2/AC-A4): disable `Salvar` when `label.trim() ===
""` and `taskId === null` (a standalone Reminder MUST name what it is
about).

**MIRROR**: `src/app/components/TaskSheet.tsx:71-175` (the whole `form`
block — field order, `Cancelar`/`Salvar` footer, inline error, delete
affordance) and `src/app/components/ui/Chip.tsx:10-46` (the `ChipGroup`/
`Chip` pattern already used for `TaskSheet`'s own date-mode toggle).

**VALIDATE**: `npx tsc -b` (React component — manual verification per
`docs/context/methodology.md`'s scope statement; compiles clean including
`exactOptionalPropertyTypes` on the optional `onDeleteRequest` prop;
against the tree today this file does not exist, so this exercises
genuinely new code)

### Task 9: Build `ReminderSheet` — the standalone-Reminder dialog

**ACTION**: Create `src/app/components/ReminderSheet.tsx`. Props: `open:
boolean`, `reminder: ReminderDto | null`, `draft: ReminderDraft | null`,
`view: "form" | "confirm"`, `busy: boolean`, `error: string | null`,
`onDraftChange`, `onClose: () => void`, `onSave: () => void`,
`onDeleteRequest: () => void`, `onDeleteCancel: () => void`,
`onDeleteConfirm: () => void`. Wraps `Sheet` (title: "Novo lembrete" when
`reminder === null`, else "Editar lembrete") the same way `TaskSheet.tsx`
does, rendering `ReminderForm` (`taskId={null}`, `existing={reminder !==
null}`) in the `"form"` view and `ConfirmView` ("Excluir este lembrete?" /
"Não dá para desfazer.") in the `"confirm"` view. This component owns no
requests and no reducer of its own — the caller (Task 11, `TodayScreen`)
owns the open/closed state, the draft and the requests, exactly the
division of labour `TaskSheet.tsx`'s own header comment states. This is
the standalone-Reminder dialog AC-A2 requires for create/edit/delete
entirely through the pt-BR interface.

**MIRROR**: `src/app/components/TaskSheet.tsx:62-69, 176-190` (the `Sheet`
wrapper and the `view`-swap `ConfirmView` branch) and
`src/app/components/ui/ConfirmView.tsx:14-32` (the exact prop shape).

**VALIDATE**: `npx tsc -b` (React component, manual verification; against
the tree today this file does not exist)

### Task 10: Build `ReminderRow` — the bell-glyph standalone-Reminder row

**ACTION**: Create `src/app/components/ReminderRow.tsx`. Props: `reminder:
ReminderDto`, `onOpen: () => void`. Renders an `<li>` matching `TaskRow`'s
64 px filled `bg-surface-2` row shape (a Reminder is the owner's own item,
unlike a read-only Google event), with a leading `Bell` icon
(`lucide-react`, `aria-hidden`) instead of a completion control (a
Reminder has no open/done state), the `reminder.label` (or, if `null`,
a placeholder the caller never actually reaches — a standalone Reminder
always has a non-empty label by AC-2 — omit the fallback branch as
unreachable rather than inventing a copy string for it) as the tappable
title (`onOpen`), and a formatted time (`instantToLocalParts(reminder.fireAt).time`
alongside the day when it is not today — reuse `todayIn`/`instantToLocalParts`
from `src/shared/dates.ts`, never a raw `Date` format) as the trailing meta
line, in mono/tabular per guidelines §5.3. No trailing edit icon (unlike
`TaskRow`'s pencil) — tapping the row opens `ReminderSheet` directly, since
a Reminder's only fields are exactly what that sheet edits.

**MIRROR**: `src/app/components/EventRow.tsx:34-56` (`# SOURCE` block
above) — leading-glyph-plus-title row shape, adapted with `Bell` and a
filled background.

**VALIDATE**: `npx tsc -b` (React component, manual verification; against
the tree today this file does not exist)

### Task 11: Wire standalone Reminders into `TodayScreen`

**ACTION**: In `src/app/components/TodayScreen.tsx`: add `reminders:
ReminderDto[] | null` state, fetched via `listReminders()` in a new
`refreshReminders()` function (mirroring `refresh()`'s try/catch and
`handleFailure` reuse), called from the same mount effect and
`visibilitychange` handler that already refetch Tasks and Google events.
Add local state for the `ReminderSheet` (`reminderSheetState: {
reminder: ReminderDto | null; draft: ReminderDraft; view: "form" |
"confirm" } | null`), seeded via `draftFromReminder(null)` /
`draftFromReminder(existing)` (Task 5) when opened. Render a new
*Lembretes* `TaskGroup` (name: "Lembretes", `count: standaloneReminders.length`,
never collapsible — mirrors the never-collapsible *Hoje* Task group, since
a due Reminder should never hide) listing every `reminders` row whose
`taskId === null` and `sentAt === null` (already-sent or Task-linked
Reminders do not belong on this list) via `ReminderRow`, positioned in the
DOM between the agenda region and the Task groups (reading order matters
per guidelines §10, 1.3.2 — an owner-authored reminder is closer to "your
own commitments" than the read-only Google agenda, but not a Task).
Immediately inside that group's `<section>`, add a header action button
"Novo lembrete" (mirroring the layout standard's own *Atrasadas* header
action) that opens `ReminderSheet` with a fresh draft. Wire `onSave` to
call `createReminder`/`updateReminder` (via Task 5's builders) through the
existing `runSheet`-style pattern, then `refreshReminders()`, then close
and toast ("Lembrete salvo"); wire delete to `deleteReminder` then
`refreshReminders()` and toast ("Lembrete excluído", no undo action — an
irreversible delete per guidelines §8). Render `<ReminderSheet
open={reminderSheetState !== null && sheet.taskId === null} .../>` — gated
on `sheet.taskId === null` exactly like the existing `FilterSheet`, so the
Task sheet and the standalone Reminder sheet can never both be open
(layout standard §3). This is the wiring that makes AC-A2 (standalone
Reminder create/edit/delete entirely through the interface) reachable
from *Hoje*.

**MIRROR**: `src/app/components/TodayScreen.tsx:208-226` (`refreshEvents`'s
try/catch shape, adapted for `refreshReminders`) and
`src/app/components/TodayScreen.tsx:740-745` (the `FilterSheet`'s
`sheet.taskId === null` gating, reused verbatim for `ReminderSheet`).

**VALIDATE**: `npx tsc -b` (React component, manual verification per
`docs/context/methodology.md`; the underlying `listReminders`/
`createReminder`/`updateReminder`/`deleteReminder` calls and
`draftFromReminder`/`buildCreateReminderInput`/`buildUpdateReminderInput`
builders are already covered by Task 5/6's own test-first suites — this
task is glue over already-tested pieces)

### Task 12: Wire the Task-linked Reminder into `TaskSheet`

**ACTION**: In `src/app/components/TaskSheet.tsx`: accept two new props,
`reminder: ReminderDto | null` (the Task's own linked Reminder, if any —
threaded down from `TodayScreen`, which already holds the full `reminders`
list and can `find` by `taskId`) and `reminderDraft: ReminderDraft | null`,
plus `onOpenReminder: () => void`, `onCloseReminder: () => void`,
`onReminderDraftChange`, `onReminderSave: () => void`,
`onReminderDeleteRequest`, `onReminderDeleteCancel`, `onReminderDeleteConfirm`
— the same request-ownership split `TodayScreen` already keeps for the
Task fields themselves. In the `view === "detail"` branch, after the
priority `ChipGroup` and before the `Cancelar`/`Salvar` row, add a
"Lembrete" section: when `reminder === null`, a ghost button "Adicionar
lembrete" (`Bell` icon) calling `onOpenReminder`; when non-null, a summary
line (the same time formatting Task 10 uses) plus an "Editar" ghost button
calling `onOpenReminder`. Replace the existing two-way `view === "detail" ?
... : ...` ternary with a FOUR-way switch on `view`, one branch per
`SheetView` value Task 7 defines:

- `"detail"` — the existing Task form, unchanged.
- `"reminder"` — renders `ReminderForm` (`taskId={task.id}`,
  `existing={reminder !== null}`) with `onSubmit={onReminderSave}`, a
  `Cancelar`-equivalent wired to `onCloseReminder`, and — when `reminder
  !== null` — **`onDeleteRequest={onReminderDeleteRequest}`**. Wiring
  `ReminderForm`'s own delete affordance to the reminder's request callback
  is what makes `onReminderDeleteRequest` reachable at all; left unwired it
  is an orphaned prop that compiles clean and does nothing.
- `"confirm-reminder"` — a SECOND `ConfirmView`, with its own pt-BR copy
  (`title="Excluir este lembrete?"`, `body="Não dá para desfazer."`) and
  its own callbacks, `onCancel={onReminderDeleteCancel}` and
  `onConfirm={onReminderDeleteConfirm}`.
- `"confirm"` — the existing Task-delete `ConfirmView`, unchanged: still
  `title="Excluir esta tarefa?"` with `onCancel={onDeleteCancel}` /
  `onConfirm={onDeleteConfirm}`.

**The two confirmations must stay separate branches with separate copy and
separate callbacks.** Routing a reminder deletion through the `"confirm"`
branch would show the owner "Excluir esta tarefa?" and then delete the
Task, because that branch's callbacks are the Task's — and nothing would
fail: `tsconfig.base.json` sets neither `noUnusedParameters` nor
`noUnusedLocals`, so the three unused reminder callbacks compile clean and
no VALIDATE in this plan would see it. Four views in one `<dialog>` still
honours layout standard §3 ("never stack sheets") — the constraint is one
dialog, not one view. This is the wiring that makes AC-A3 (a Task-linked
Reminder created and edited from inside that Task's own detail sheet)
reachable from the UI, and safely deletable from it.

**MIRROR**: `src/app/components/TaskSheet.tsx:70-187` (`# SOURCE` block
above, the `view` ternary this task widens to four branches),
`src/app/components/TaskSheet.tsx:176-186` (the existing `ConfirmView`
call, whose prop shape the new `"confirm-reminder"` branch copies with
reminder copy and reminder callbacks), and
`src/app/components/TaskSheet.tsx:165-174` (the existing ghost "Excluir"
button, whose shape the new "Adicionar/Editar lembrete" button copies).

**VALIDATE**: `npx tsc -b`, then verify the discrimination held by
grepping the file — the reminder confirmation must exist and must NOT be
wired to the Task's callbacks:
`if ! grep -q 'Excluir este lembrete?' src/app/components/TaskSheet.tsx; then echo "FAIL: no reminder-specific ConfirmView"; exit 1; fi`
and
`if ! grep -q 'onConfirm={onReminderDeleteConfirm}' src/app/components/TaskSheet.tsx; then echo "FAIL: reminder confirm not wired to onReminderDeleteConfirm"; exit 1; fi`
and
`if ! grep -q 'onDeleteRequest={onReminderDeleteRequest}' src/app/components/TaskSheet.tsx; then echo "FAIL: ReminderForm delete not wired"; exit 1; fi`
(all three fail against the tree as it stands — none of those strings
exists today — and all three would still fail under the conflated wiring
this task exists to prevent, which `tsc -b` alone cannot catch. The
underlying `"reminder"` / `"confirm-reminder"` view transitions are covered
by Task 7's test-first suite against `task-sheet.ts`; this task is the glue
rendering that already-tested state, verified manually per
`docs/context/methodology.md`.)

### Task 13: Wire the Task-linked Reminder into the `<TaskSheet .../>` call site

**ACTION**: In `src/app/components/TodayScreen.tsx`, update the sole
`<TaskSheet .../>` call site (`TodayScreen.tsx:716-736` — before this task
lands it passes only the existing Task-field props) to also pass Task 12's
seven new Reminder props, since `TaskSheet` requires them once Task 12
lands. Import `type { ReminderDraft }`, `draftFromReminder`,
`buildCreateReminderInput` and `buildUpdateReminderInput` from
`../../shared/reminder-edit` (Task 5) and `createReminder`/
`updateReminder`/`deleteReminder` from `../api` (Task 6), alongside
whatever Task 11 already imported for the standalone case. Add `const
[taskReminderDraft, setTaskReminderDraft] = useState<ReminderDraft | null>
(null);` next to the sheet's other local state (`busy`/`sheetError`,
`TodayScreen.tsx:140,143`), and derive `const sheetTaskReminder = sheetTask
=== null ? null : (reminders ?? []).find((r) => r.taskId === sheetTask.id)
?? null;` — reusing the `reminders` state Task 11 fetches via
`refreshReminders()`. Add a `runTaskReminder` helper that mirrors the
existing `runSheet` helper (`TodayScreen.tsx:256-268`) exactly, with
`refreshReminders()` in place of `refresh()`: `setBusy(true)`; run the
action; on success `setSheetError(null)` then `await refreshReminders()`;
on failure `const message = handleFailure(cause); if (message !== null)
setSheetError(message);`; `setBusy(false)` in `finally`. Wire the seven
props:
- `reminder={sheetTaskReminder}`
- `reminderDraft={taskReminderDraft}`
- `onOpenReminder={() => { setTaskReminderDraft(draftFromReminder(sheetTaskReminder)); dispatchSheet({ type: "open-reminder" }); }}`
- `onCloseReminder={() => { setTaskReminderDraft(null); dispatchSheet({ type: "close-reminder" }); }}`
- `onReminderDraftChange={(changes) => setTaskReminderDraft((prev) => (prev === null ? prev : { ...prev, ...changes }))}`
- `onReminderSave={() => { if (sheetTask === null || taskReminderDraft === null) return; void runTaskReminder(async () => { if (sheetTaskReminder === null) { await createReminder(buildCreateReminderInput(taskReminderDraft, sheetTask.id)); } else { await updateReminder(sheetTaskReminder.id, buildUpdateReminderInput(sheetTaskReminder, taskReminderDraft)); } setTaskReminderDraft(null); dispatchSheet({ type: "close-reminder" }); showToast({ key: "reminder-saved", text: "Lembrete salvo" }); }); }}`
- `onReminderDeleteRequest={() => dispatchSheet({ type: "request-delete-reminder" })}`
  and `onReminderDeleteCancel={() => dispatchSheet({ type: "cancel-delete-reminder" })}`
  — Task 7's OWN reminder events, driving Task 12's OWN
  `"confirm-reminder"` view. Never `"request-delete"` / `"cancel-delete"`:
  those two drive the Task-delete confirmation, whose callbacks delete the
  Task, so reusing them here would make "Excluir" on a reminder show
  "Excluir esta tarefa?" and destroy the Task instead. The request-ownership
  split `TodayScreen` already keeps for the Task fields is mirrored, but the
  events are the reminder's own
- `onReminderDeleteConfirm={() => { if (sheetTaskReminder === null) return; void runTaskReminder(async () => { await deleteReminder(sheetTaskReminder.id); dispatchSheet({ type: "close-reminder" }); showToast({ key: "reminder-deleted", text: "Lembrete excluído" }); }); }}`

This is what makes **AC-A3** (a Task-linked Reminder created and edited
from inside that Task's own detail sheet) actually reachable: once Task 12
lands, the call site either fails `tsc -b` (the seven new props are
required, not optional) or — if this task never ran — never opens the
Task-linked reminder editor at all, since no other task in this plan
touches this call site.

**MIRROR**: `src/app/components/TodayScreen.tsx:716-736` (the
`<TaskSheet .../>` call site this task extends), `TodayScreen.tsx:256-268`
(`runSheet`'s busy/try/catch/finally shape, mirrored by `runTaskReminder`),
and `TodayScreen.tsx:413-422` (`deleteSheetTask`'s `dispatchSheet`
sequencing — the dispatch sits AFTER the awaited call, so a failed delete
leaves the sheet open, the same ordering `onReminderDeleteConfirm` follows).

**VALIDATE**: `npx tsc -b` (React glue, manual verification per
`docs/context/methodology.md`; against the tree as it stands once Task 12
lands but before this task runs, the call site is missing Task 12's seven
required props, so this genuinely fails — a required-prop compile error,
not a stub — until this task's wiring lands, and compiles clean once it
does)

### Task 14: Run and record the UI/UX Tier A review checklist

**INFRASTRUCTURE/SCAFFOLDING**: this task delivers no Acceptance Criterion
of its own — it is a process gate (a Hard project rule, not a numbered
PRD AC and not a plan `AC-A` item) that the project's own CLAUDE.md and
`documentation/40-engineering/ui-ux-guidelines.md` require on every
interface change, named explicitly in this phase's Hard project rules
because running it once already caught a defect no other gate did on a
prior unit, and restated in the PRD's own Phase 3 success signal ("the
checklist result recorded").

**ACTION**: Using the browser pane at 375 px, dark mode (per guidelines
§12.6), exercise every surface Tasks 8-13 added — `ReminderForm` (both
Reminder shapes), `ReminderSheet`, `ReminderRow` on *Hoje*, and the Task
sheet's new "reminder" view (now reachable end-to-end via Task 13's
`<TaskSheet .../>` wiring) — against the 9-item Tier A checklist
(`documentation/40-engineering/ui-ux-guidelines.md:150-160`: one primary
action per screen; 48 px targets with 8 px gaps; no colour-only meaning;
pt-BR/sentence-case/infinitive-button copy; Tab/Enter/Esc + visible focus +
focus-returns-to-opener; `aria-label`s and visible labels; tokens-only
styling with reduced-motion honoured; destructive actions follow §8; no
cross-origin request). Record one ✔/✘ line per item, with the reason for
any ✘, in a new file `PRPs/reports/reminders-phase-3/ui-ux-checklist.md`
(mirroring the existing `PRPs/reports/<activity>/` convention guidelines
§12.6 item 14 names). A ✘ with no recorded, conscious exception means the
change is not done — fix it before this task's `VALIDATE` is expected to
pass.

**MIRROR**: `documentation/40-engineering/ui-ux-guidelines.md:146-160` (the
Tier A checklist itself — process, not code, so no `src/` file anchor
applies here).

**VALIDATE**: `if [ -f PRPs/reports/reminders-phase-3/ui-ux-checklist.md ] && grep -qE "(✔|✘)" PRPs/reports/reminders-phase-3/ui-ux-checklist.md; then echo "PASS: Tier A checklist recorded"; else echo "FAIL: Tier A checklist result missing"; exit 1; fi`
(fails today — the file does not exist yet)

## Validation Commands

**Level 1 (STATIC_ANALYSIS)**:
```
npm run check
```
(`wrangler types --check && tsc -b && eslint . && prettier --check .`,
chained with `&&` — fails non-zero on the first failing stage, including
`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` violations this
project has twice let slip past a green Vitest run)

**Level 2 (UNIT_TESTS)**:
```
npm test
```
(`vitest run` — exits non-zero on any failing test; exercises the
test-first suites `test-writer` authors/extends against AC-8 —
`test/app-route.test.ts`, `test/cron-sweep.test.ts`,
`test/dates.test.ts`, `test/reminder-edit.test.ts`, `test/task-sheet.test.ts`
— before this plan's Implementer runs, per `docs/context/methodology.md`'s
`tdd: true` routing; React components (`ReminderForm`, `ReminderSheet`,
`ReminderRow`, the `TaskSheet`/`TodayScreen` wiring) stay manually
verified, per the same document's explicit UI carve-out)

**Level 3 (INTEGRATION)**:
```
if grep -q 'task/\${' src/shared/app-route.ts \
   && grep -q 'taskRouteOf' src/worker/cron.ts \
   && grep -q 'NOTIFICATION_CLICK' src/app/hooks/useRoute.ts \
   && grep -q 'export async function listReminders' src/app/api.ts \
   && grep -q 'export async function createReminder' src/app/api.ts \
   && grep -q '"reminder"' src/shared/task-sheet.ts \
   && [ -f src/app/components/ReminderForm.tsx ] \
   && [ -f src/app/components/ReminderSheet.tsx ] \
   && [ -f src/app/components/ReminderRow.tsx ] \
   && [ -f PRPs/reports/reminders-phase-3/ui-ux-checklist.md ]; then
  echo "PASS: per-Task route, notification-tap listener, Reminder CRUD wrappers, sheet view and UI surfaces are all wired"
else
  echo "FAIL: at least one of the route/listener/wrapper/UI/checklist pieces is missing"
  exit 1
fi
```
(against the tree as it stands today none of these ten conditions hold, so
this fails for the right reason before the plan's tasks run, and passes
only once every piece is wired)

## Acceptance Criteria

- **AC-A1 (PRD AC-8):** Given a Reminder whose `taskId` is `T`, when the
  sweep builds its notification payload, the payload's nested `{ data:
  { route } }` carries the path of Task `T`, and `routeFromPath` parses
  that path back into the corresponding `AppRoute` variant —
  `pathOf(routeFromPath(p)) === p` holds for it.
- **AC-A2 (PRD AC-1):** A standalone Reminder (label + absolute instant)
  can be created, edited and deleted entirely through the pt-BR interface
  — `ReminderSheet`/`ReminderForm`/`ReminderRow` on *Hoje* — calling the
  same `/api/reminders` create/list/update/delete contract AC-1 pins.
- **AC-A3 (PRD AC-3):** A Task-linked Reminder, set either as an absolute
  instant or as an offset in minutes before the Task's deadline, can be
  created and edited from inside that Task's own detail sheet, resolving
  through the same `offsetToInstant`/`fireAt` contract AC-3 pins, without
  ever opening a second, stacked dialog.
- **AC-A4 (PRD AC-2):** Given a standalone-Reminder draft with an empty or
  whitespace-only label, the UI disables `Salvar` before the request is
  ever sent — the same "a Reminder must say what it is about" invariant
  AC-2 pins server-side, enforced client-side as well (defense in depth,
  not a replacement for the route's own 400).
- **AC-A5 (PRD AC-8):** Given the SPA already open in the foreground, when
  the service worker posts a `NOTIFICATION_CLICK` message carrying a
  Task-linked Reminder's route `p`, the SPA's listener decodes `p` back
  to the corresponding `AppRoute` variant through the same
  `routeFromPath`/`pathOf` codec AC-8 pins — `pathOf(routeFromPath(p)) ===
  p` — and calls `navigate` with the decoded route, without a page
  reload.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The absolute-Reminder local-datetime conversion invents a SECOND timezone technique that drifts from the already-proven `offsetToInstant`/`offsetMinutesAt` one | M | A reminder's absolute time is off by an hour around a DST boundary | Task 4 explicitly REUSES `offsetMinutesAt` (exported, not reimplemented) and applies the identical two-pass refinement `offsetToInstant` already uses and already has fixture coverage for |
| Opening the Task-linked Reminder editor stacks a second `<dialog>` on top of the already-open Task sheet, violating layout standard §3 | M | Android back closes the wrong layer; the top layer becomes unreachable (the exact class of bug `Sheet.tsx`'s own header comment documents from A5) | Tasks 7 and 12 render the Reminder editor and its own delete confirmation as two ADDITIONAL `view` values inside the SAME `<Sheet>`/`<dialog>` the Task detail and delete-confirm views already share, four in total — no second `Sheet` instance is ever mounted for the Task-linked case |
| The notification-tap `postMessage` listener (Task 3) cannot be exercised in Vitest-inside-workerd (no `ServiceWorkerRegistration`, no real `postMessage`) | M | A bug in the listener ships uncaught by any automated tier | Named explicitly as the PRD's own phase-4 device-proof obligation — `tsc -b` is this task's only automated gate, and the on-device tap (app closed AND app open) is phase 4's exit signal, not this phase's |
| A suite that passes under Vitest still breaks under `tsc -b` (this project has done this twice) | M | A merged phase ships a type error | `npm run check` (Level 1) runs before Level 2/3 report success, and every shared-module task's own `VALIDATE` already runs `npm test`/`tsc -b` directly on the smallest possible diff |
| The Tier A checklist is skipped or its result never recorded | M | A defect the checklist would have caught (as it already did once on this project) ships silently | Task 14 is a dedicated, non-optional task with a `VALIDATE` that fails until the recorded file exists and contains at least one ✔/✘ line |
| The `<TaskSheet .../>` call site is left unwired after Task 12 adds required Reminder props, so `tsc -b` breaks or the Task-linked editor is silently unreachable | M | AC-A3's path never opens from any task's own instructions | Task 13 is a dedicated task that wires all seven Reminder props at the one `<TaskSheet .../>` call site, with a `VALIDATE` that fails until it lands |

## Notes

**TDD routing (this plan, against the relay repo):** Current value of `tdd`
in `docs/context/methodology.md`: **true**. Test-first ordering — the test
pair (test-writer/test-reviewer) produces the initial test suite from the
Acceptance Criteria above, before the Implementer runs.

**Test-file routing:** this phase's test-file creation and updates are
routed through the `test-writer`/`test-reviewer` pair's lifecycle ledger
(`/relay-write-test` → `/relay-test-write-review`), not authored by the
Implementer — R-X is a blanket straight-fail on any test glob in the
Implementer's diff. No task above and no `## Files to Change` row targets a
test file, so every shared-module task's `**VALIDATE**` invokes `npm test`
directly against the pre-authored suite, and every React-component task's
`**VALIDATE**` invokes `npx tsc -b` — matching `docs/context/methodology.md`'s
explicit statement that React component verification stays manual and a
purely visual deliverable's tasks legitimately produce no test file of
their own.

**Where a standalone Reminder is created from (an open question this plan
resolves, not the PRD's to pre-empt).** The PRD's own Open Questions
section left "where do pending Reminders live" to
`documentation/40-engineering/ui-layout-standard.md`, which names WHERE
(§6: "standalone Reminders as rows with a bell glyph in *Hoje*") but is
silent on HOW ONE GETS CREATED — no header icon, no capture-deck
extension, no dedicated route is named for it anywhere in that document.
Adding a fourth header icon button would exceed the "up to three" the
layout standard reserves (§2.1), and the third slot is explicitly reserved
for unit 8's search. This plan's own choice — a "Novo lembrete" action on
the new *Lembretes* group's header — reuses a mechanism the layout
standard ALREADY establishes for a different group (*Atrasadas*'s "header
action *Reagendar para hoje*",
`documentation/40-engineering/ui-layout-standard.md:31`), rather than
inventing a new navigation affordance the guidelines' own principle 4
("fewer elements over more visible features") would flag. If the owner's
use of the shipped screen finds this placement wrong, that is exactly the
kind of finding `documentation/40-engineering/ui-layout-standard.md`'s own
review trigger exists for — the same way its History table already
records three prior corrections made by looking at the built thing.

**`src/sw.ts` needs no change.** Verified by reading it in full
(Mandatory Reading, Task 3): `notificationclick` already resolves the
target Task path generically and posts `{type: "NOTIFICATION_CLICK", url}}`
to the focused/opened client — it never inspected `AppRoute` at all, so
extending that union does not touch this file. The PRD's own Solution
Detail language ("the `sw.ts` `notificationclick` handler ... all need to
learn it") is corrected here by what reading the file actually shows,
mirroring how phase 2's own plan corrected the PRD's residual claim about
this exact seam ("the roadmap's residual ... understates this").

**Delete has no dedicated numbered AC, for both Reminder shapes, exactly
like phase 1's own `DELETE /:id` task.** Phase 1's plan flagged its
`DELETE /:id` route task as scope-completion work with no AC of its own
("AC-1..AC-4/AC-13/AC-14 cover create/read/token-gate/the time contract,
not a direct-delete scenario"). The UI delete affordances this phase adds
(`ReminderForm`'s `Excluir` button, `ReminderSheet`'s confirm view, the
Task sheet's reminder-delete wiring) inherit the same status: they complete
the CRUD surface the PRD's own MoSCoW row promises ("UI to create, edit
and delete both shapes") without mapping to a numbered `AC-N` of their own,
and are covered by AC-A2/AC-A3's "created, edited and deleted" wording
rather than by a sixth, redundant `AC-A` bullet.

*Generated: 2026-09-09*
*Approved: 2026-09-09*
*Status: IMPLEMENTED*
