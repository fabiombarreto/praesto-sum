# Feature: The day, whole (Phase 4 of google-calendar-read)

```
**Decision Gate**
- Active context: none
- Activated criteria: impact on shared UI; reuse or creation of components; cross-cutting patterns; domain rules (events, tasks)
- Decisions found:
  - ADR-0009 — every visible string here is pt-BR; identifiers, comments and tests stay English.
  - ADR-0010 — the Arcade identity. `src/app/tokens.css` is the only scale a component may use; the accent is reserved for what the owner can act on, and `--color-live` for live and overdue only.
  - ADR-0011 — owned shadcn-style components under `src/app/components/ui/` over Base UI, composed with `cn`.
  - ADR-0008 — test-first, but scoped: `docs/context/methodology.md` keeps React component verification MANUAL. The decidable parts move to `src/shared` and are authored test-first; the glue is verified on the device.
  - ADR-0007 — read-only. Nothing here gains a write affordance.
  - Owner decisions, 2026-08-28/29: the *Agenda* group shows TODAY only (option A of three compared visually); an untitled event reads *(sem título)*; the existing filters do NOT apply to the group; tapping an event opens Google Calendar.
- Applicable anti-patterns:
  - Portuguese in artifacts — inverted here by ADR-0009's carve-out: the string VALUES are pt-BR, everything around them English.
  - Weakening tests to force green — `test/task-groups.test.ts` and the phase-1/2/3 suites stay untouched.
  - Hand-duplicated entity types — the screen consumes `CalendarEventDto` through `dayItemFromEvent`, never a parallel shape.
  - Glossary synonym drift — the group is *Agenda*; the domain word stays Event.
- Applicable architectural rules:
  - `src/shared/` carries no DOM or Worker globals and no clock reads.
  - Guidelines §9 records the product VOICE as `TBD — pending owner input`, and its own preamble says a `TBD` is "never a licence to improvise around it". Every user-visible sentence in this phase is therefore quoted from an owner approval (2026-08-28), not invented by the implementer.
  - Layout standard §2.4 is this phase's specification and predates it.
- Result: PROCEED
```

## Source

- `PRPs/prds/google-calendar-read.prd.md` — Implementation Phases row 4: "The day, whole" — Goal: the morning question, answered by one screen — Success signal: AC-11 and AC-12 verified manually on the Android phone and the Windows PC, including a deliberately revoked token and a cut network, and the events region never looks like a free day.

## Summary

The owner's real commitments finally reach the screen he opens. Google events render as one collapsible *Agenda* group at the top of *Hoje* — today only, no checkbox, a leading time column, a dashed outline, never the accent colour, never interleaved with Tasks — and tapping one opens Google Calendar. The harder half is the failure surface: a grounding pass found that a failed events fetch would currently render as **nothing at all**, which is pixel-identical to a genuinely free day and is the exact outcome the unit's success metric sets to zero. So this phase adds a fourth error atom rendered beside the agenda, keeps the Google fetch out of the global connectivity reducer that would otherwise let a Google outage disable Task capture, and makes the screen's loaded/empty predicates aware that two sources now feed it.

## User Story

```
As the owner of Praesto
I want my real commitments on the screen I open in the morning, and an honest word when they could not be fetched
So that I stop opening Google Calendar to find out what my day looks like — and never mistake a broken fetch for a free day
```

## Problem Statement

Phases 1–3 put a correct, tested, deployed pipeline behind an API that nothing renders. The owner still opens two apps. And the screen as it stands cannot simply be handed the data: `TaskGroup` returns `null` at zero rows, so a failed fetch and an empty day are the same pixels; the connectivity reducer is global, so a Google outage would disable task capture; the loaded/empty branches all key on `tasks` alone, so a zero-task day would hide the events entirely.

## Solution Statement

Render the *Agenda* group per layout standard §2.4, from a new `EventRow` sibling to `TaskRow` and the existing `TaskGroup` shell. Filter to today on the client — the API's 7-day window stays, for unit 16. Keep events in their own state atom with their own error atom, so neither the tasks fetch nor the global connectivity state can be contaminated by a Google failure in either direction. Render the failure as a persistent, non-toast line inside the agenda region, and give the top banner an icon prop so a Google outage does not display a wifi-off glyph. Every visible string comes from the owner's 2026-08-28 approvals; the decidable logic (today-filtering, event ordering, time formatting) goes to `src/shared` and is authored test-first, leaving only JSX as manual-verified glue.

## Metadata

| Key | Value |
|---|---|
| Type | Feature (UI) |
| Complexity | Medium-high — small surface, but it lands on the owner's daily screen and threads a second async source through state that assumed one |
| Systems Affected | `src/app/components/` (new `EventRow`, `TodayScreen`, `ui/Banner`), `src/shared/` (event ordering, today-filter, time formatting), `src/app/api.ts` |
| Dependencies | Phase 3 (`implemented`, verified in production 2026-08-28) |
| Estimated Tasks | 8 |
| phase_type | feature |
| Source PRD line ref | `PRPs/prds/google-calendar-read.prd.md:186` (Implementation Phases row 4); Phase Details at `:232` |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| 1 | `documentation/40-engineering/ui-layout-standard.md` | §2.2, §2.4, §2.5, §2.6 | §2.4 IS this phase's specification, written before it. §2.2 fixes banner placement and non-dismissibility; §2.6 fixes row anatomy |
| 1 | `documentation/40-engineering/ui-ux-guidelines.md` | §8, §9, §10, and the review checklist | The §8 state table, the pt-BR copy mechanics, the accessibility obligations, and the checklist this phase must run and paste |
| 1 | `src/app/components/TodayScreen.tsx` | 83-110, 117-123, 137-147, 402-405, 417-426, 440-474 | State block, the `collectDayItems` call, `refresh()`, the `google` branch that still carries an `as never` cast, the six-row grid, and the four mutually-exclusive `tasks` branches |
| 1 | `src/app/components/TaskRow.tsx` | full | The row `EventRow` must sit beside without looking like a different app — its class list is the reference, not an approximation |
| 2 | `src/app/components/TaskGroup.tsx` | 12-49 | Reusable as the agenda shell; note `if (count === 0) return null` — the line that makes a failed fetch invisible |
| 2 | `src/app/components/ui/Banner.tsx` | full | `WifiOff` is soldered in at the import; it needs an optional icon prop |
| 2 | `src/shared/connectivity.ts` | full | Why the Google fetch must never call `report(...)`: `server-unreachable` disables writes app-wide, and `request-succeeded` clears the offline banner |
| 2 | `src/shared/day-item.ts` | `dayItemFromEvent` | The projection the screen consumes |
| 3 | `src/app/api.ts` | 60-90 | The typed-client idiom a `fetchGoogleEvents` must match, and where `ApiError` flattens the body to `error` alone |

## Patterns to Mirror

```tsx
# SOURCE: src/app/components/TaskRow.tsx:78
      className="flex min-h-16 items-center gap-2 rounded-card bg-surface-2 py-2 pr-2 pl-2 shadow-row [content-visibility:auto] [contain-intrinsic-size:auto_64px]"
```

```tsx
# SOURCE: src/app/components/TaskGroup.tsx:25-27
  // A defensive early return: the caller decides which groups to render, but
  // an empty section must never reach the DOM (layout standard §2.7).
  if (count === 0) return null;
```

```tsx
# SOURCE: src/app/components/ui/Banner.tsx:4-12
import { WifiOff } from "lucide-react";

export function Banner({ lead, body }: { lead: string; body: string }) {
  return (
    <div
      role="status"
      className="flex min-h-12 items-center gap-3 border-b border-line bg-surface-1 px-4 text-t2 text-ink"
    >
      <WifiOff className="size-5 flex-none text-muted" aria-hidden="true" />
```

```ts
# SOURCE: src/shared/day-item.ts:106-119 (the return spans 112-118; collapsed here)
export function dayItemFromEvent(event: CalendarEventDto): ExternalDayItem {
  const dueDate =
    "date" in event.start
      ? event.start.date
      : todayIn(new Date(event.start.dateTime), PRAESTO_TIMEZONE);

  return { source: "google", id: event.id, dueDate, closed: false, payload: event };
}
```

```ts
# SOURCE: src/shared/dates.ts:30-37
export function todayIn(now: Date, timeZone: string = PRAESTO_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
```

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/agenda.ts` | CREATE | The decidable half, testable without a browser: `agendaForToday(events, today)` filtering the 7-day window to today AND ordering by start instant, plus the all-day rule |
| `src/shared/format.ts` | UPDATE | `formatEventTime(moment)` — no time-of-day formatter exists anywhere in `src/`, and §2.4 requires a leading time column |
| `src/app/components/EventRow.tsx` | CREATE | The §2.4 row: no checkbox, leading time, calendar glyph, dashed outline, one row-wide `<a>` so the accessible name carries title + destination |
| `src/app/components/ui/Banner.tsx` | UPDATE | Optional `icon` prop, defaulting to `WifiOff`, so a Google outage does not show a wifi glyph |
| `src/app/components/TodayScreen.tsx` | UPDATE | The events atom, its own error atom, the source-aware predicates, the agenda group, and deleting the `as never` cast |
| `src/app/api.ts` | UPDATE | `fetchGoogleEvents()`, carrying the `reason` discriminator through instead of flattening it |
| `src/shared/api.ts` | UPDATE | The events response type the client consumes |
| `scripts/check-banner-semantics.mjs` | CREATE | Guards what `tsc -b` cannot: that the Banner kept `role="status"` and its `aria-hidden`, and that its doc comment stopped describing one condition |
| `scripts/check-device-verification.mjs` | CREATE | Makes a manual task fail when nobody recorded doing it, and when the record skips one of AC-A8's four conditions |

## NOT Building (Scope Limits)

- **Connect, the calendar picker, and disconnect as screens** — moved to the newly added **phase 5** (`Consent, made visible`). The grounding pass found these three MoSCoW Musts belonged to no phase; layout standard §6 routes them to settings, and no settings screen exists. Building them here would double this phase and put a first-ever settings route inside a diff about rows.
- **Days 2–7 of the window.** Fetched and deliberately not rendered. The surviving justification for the 7-day window is unit 16's week view; a reviewer must not "fix" the empty *Próximas* by piping events into it, which §2.4 forbids.
- **Any write affordance** — no completion control, no edit, no delete, no RSVP.
- **Event filters or an agenda-specific chip.** The existing chips stay Task-only.
- **`location` and `hasGuests` in the metadata line.** Both are in the DTO and no rule mentions them; showing them is a product decision nobody has made. Deferred rather than guessed.
- **A retry button in the banner.** Guidelines §12.4: "there is no manual refresh gesture"; refresh comes from `visibilitychange` and reconnect. §2.2's "action language" is satisfied by an imperative sentence, not a control.
- **A settings entry point in the header.** Phase 5's to place.

## Step-by-Step Tasks

### Task 1: CREATE `src/shared/agenda.ts`

- **ACTION**: The phase's decidable half, so the screen is left as glue. Export `agendaForToday(events: readonly CalendarEventDto[], today: string): CalendarEventDto[]` which (a) keeps only events whose local day equals `today` — the API returns 7 days and the owner's 2026-08-28 decision shows one — and (b) **orders them by start instant**, all-day events first, then timed ascending. The ordering is not cosmetic: `/api/google/events` concatenates per calendar and `collectDayItems` explicitly never sorts, so on a two-calendar day the rows arrive in calendar order and §2.4's "collapsed to the next event" would name the wrong one. Reuse `dayItemFromEvent`'s day derivation rather than writing a second one — an all-day event's `date` is used verbatim, a timed event's day comes from its instant in `PRAESTO_TIMEZONE`, and getting that wrong moves every late-evening commitment to tomorrow. Take `today` as an argument; read no clock. Serves **AC-A1 (PRD AC-11)** and **AC-A2 (PRD AC-12)**.
- **MIRROR**: `src/shared/day-item.ts:106-119` — the day derivation, reused rather than reimplemented.
- **VALIDATE**: `npx vitest run test/agenda.test.ts`

### Task 2: UPDATE `src/shared/format.ts`

- **ACTION**: Add `formatEventTime(moment: EventMoment): string` returning the pt-BR time for a timed event (`Intl.DateTimeFormat("pt-BR", { timeZone: PRAESTO_TIMEZONE, hour: "2-digit", minute: "2-digit" })`) and the owner-approved all-day label for an all-day one. **No time-of-day formatter exists anywhere in `src/` today**, and §2.4's leading time column needs one. Keep the module DOM-free and take the moment as an argument. The all-day cell must not be blank — §2.4 specifies a time column, and an empty cell in a mono column reads as a rendering bug. Serves **AC-A3 (PRD AC-12)**.
- **MIRROR**: `src/shared/dates.ts:29-36` — `Intl` with an explicit `timeZone`, the locale chosen for the shape it returns.
- **VALIDATE**: `npx vitest run test/format.test.ts`

### Task 3: UPDATE `src/app/components/ui/Banner.tsx`

- **ACTION**: Add an optional `icon` prop defaulting to `WifiOff`, typed against Lucide's icon component type, so the existing offline call site is unchanged and a Google outage can pass `CalendarX` (or the chosen glyph) instead. Keep `role="status"`, the class list and the `aria-hidden` on the icon exactly as they are. Update the component's own doc comment, which currently says "the offline / unreachable banner" — it now serves two conditions and the comment must stop describing one. Serves **AC-A4 (PRD AC-11)**.
- **MIRROR**: `src/app/components/ui/Banner.tsx:4-12` — the shipped markup, preserved verbatim around the one new prop.
- **VALIDATE**: `npx tsc -b && node scripts/check-banner-semantics.mjs`
  *(`tsc -b` alone only proves it compiles: JSX attribute VALUES are not typechecked and comments are not typechecked at all, so silently dropping `role="status"` or leaving the doc comment describing one condition would have passed. Review raised this; the script exercises what the ACTION claims. Verified to fail today and to pass once the prop exists.)*

### Task 4: CREATE `src/app/components/EventRow.tsx`

- **ACTION**: The §2.4 row. **No completion control.** A leading fixed-width time column in `font-data` with `tabular-nums` so times align. A calendar glyph, `aria-hidden`. A **dashed outline** (`border border-dashed border-line-strong`) on a transparent ground rather than `bg-surface-2`, which is what makes it read as not-a-Task at a glance — and per §4.4 the outline is not the only cue, the time column and the absent checkbox carry it too. **Never `text-accent`, never `text-live`** (§2.4; the accent means "you can act on this" and live/overdue is reserved). The whole row is one `<a href={htmlLink} target="_blank" rel="noopener noreferrer">` so it is a native control with the global focus ring; when `htmlLink` is `null` render the same markup as a non-interactive `<div>` rather than a dead link. The accessible name must contain the visible title AND name the destination — an `sr-only` span, never an `aria-label` that replaces the title (guidelines §10, 2.4.4 + 2.5.3). An untitled event renders `(sem título)` as **real DOM text** in muted italic, never a CSS `::before`, or the accessible name is empty. Serves **AC-A2 (PRD AC-12)**, **AC-A3 (PRD AC-12)** and **AC-A5 (PRD AC-8)**.
- **MIRROR**: `src/app/components/TaskRow.tsx:47` — the row's class list, matched in geometry and radius so the two read as one family while differing in treatment.
- **VALIDATE**: `npm run check`

### Task 5: UPDATE `src/app/api.ts` and `src/shared/api.ts`

- **ACTION**: Add the events response type and `fetchGoogleEvents()`. The route answers `{ events, failedCalendars, window }` on success and `{ error: "unavailable", reason }` on failure, where `reason` distinguishes `not_connected` and `invalid_grant` (both 409) from `not_configured` (400) and the transport failures (502). The existing `request<T>` flattens every error body to `String(body.error)`, which would collapse all of them to `"unavailable"` and make the screen unable to say which sentence is true. Carry the `reason` through — either by widening `ApiError` or by a dedicated path — and say in a comment which was chosen and why. Serves **AC-A6 (PRD AC-11)**.
- **MIRROR**: `src/app/api.ts:60-90` — the typed-client idiom and its error handling.
- **VALIDATE**: `npx tsc -b`

### Task 6: UPDATE `src/app/components/TodayScreen.tsx` — the state seam

- **ACTION**: Add `events` and `eventsError` as their **own** atoms, never folded into `tasks`, `loadError` or `busy`. Four things the grounding pass proved would otherwise break: (1) the Google fetch must **not** call `report(...)` from `useConnectivity` — `server-unreachable` disables capture and completion app-wide, and `request-succeeded` would clear the offline banner while `/api/tasks` is still failing; (2) the four mutually-exclusive branches on `tasks` (`:440`, `:442`, `:452`, `:460`) must become source-aware, or a failed task load hides every event and a zero-task day shows `EmptyState` with no agenda; (3) `remaining` (`:421-426`) sums every bucket and would count events as *restantes* — filter to `source === "task"` at the call site, not inside `TodayHeader`; (4) `refresh()` has no cancellation guard and is called from six places — the events fetch should follow `visibilitychange` and reconnect but **not** a task PATCH, and the new call needs the epoch guard the old one lacks. Optimistic rollback in `complete`/`reopen` captures `previous = tasks`; keeping events separate is what stops a rollback discarding them. Serves **AC-A6 (PRD AC-11)** and **AC-A7 (PRD AC-11)**.
- **MIRROR**: `src/app/components/TodayScreen.tsx:137-147` — `refresh()`, whose shape the new fetch follows while adding the guard it lacks.
- **VALIDATE**: `npm run check`

### Task 7: UPDATE `src/app/components/TodayScreen.tsx` — the agenda and its failure

- **ACTION**: Render the *Agenda* group first in the DOM (§10 1.3.2: DOM order is reading order; never CSS-reorder it above *Atrasadas*), reusing `TaskGroup` with `collapsed` persisted under the `praesto.today.collapsed.<group>` shape the other groups use. Delete the `as never` cast in `renderDayItems`' `google` branch — **the cast, not just the body**, or the exhaustiveness guarantee stays defeated — and key event rows as `` `google-${item.id}` `` since ids are unique per source only. **The failure state renders inside the agenda region**, as a persistent `role="status"` line beside the group, NOT as a toast (`src/shared/toast.ts` auto-dismisses an actionless toast after 4 s, and §10 2.2.1 forbids a time limit on it) and NOT only as the top banner: AC-11 says "the events region shows an explicit failure state" and `TaskGroup`'s `if (count === 0) return null` means a failed fetch otherwise renders as *nothing*, which is pixel-identical to a free day. Three states must be distinguishable — no events today, not connected, fetch failed — plus a fourth line when `failedCalendars` is non-empty inside an otherwise-successful response. Every string is quoted from the owner's 2026-08-28 approval; guidelines §9 records the voice as `TBD`, which is "never a licence to improvise around it". Serves **AC-A7 (PRD AC-11)** and **AC-A8 (PRD AC-11)**.
- **MIRROR**: `src/app/components/TaskGroup.tsx:24-27` — the early return this task must render around rather than through.
- **VALIDATE**: `npm run check`

### Task 8: VERIFY on the device, and run the mandated checklist

- **ACTION**: Manual verification, because `docs/context/methodology.md` keeps React component verification manual and this phase's acceptance is visual. On the Windows PC and the **Android phone** (which unit 3 never got, and the roadmap records that gap): the agenda renders today's events in time order, visually distinct and inert; an untitled event reads `(sem título)`; tapping opens Google Calendar; collapse persists across a reload; **a deliberately cut network and a deliberately revoked token each produce a distinguishable, persistent state that is not a free day**; task capture and completion keep working while Google is failing. Record all FOUR AC-A8 conditions in the written verification at `PRPs/reports/google-calendar-read/phase-4/device-verification.md`, including the two that cannot be staged on a device: **sem eventos** (arrange it, or note the day it happened naturally) and **falha parcial** per calendar, whose correctness rests on code review of Task 7's diff rather than on the device — review raised this and it is true, so it is a named limit rather than an implied one. Then run the guidelines' **review checklist** item by item and paste the ✔/✘ result into the plan record — `CLAUDE.md` makes that mandatory on every interface change, not optional. Serves **AC-A9 (PRD AC-11)** and **AC-A10 (PRD AC-12)**.
- **MIRROR**: `documentation/40-engineering/ui-ux-guidelines.md` — the review checklist, run rather than referenced.
- **VALIDATE**: `npm test && npm run check && node scripts/check-device-verification.mjs`
  *(The ACTION is entirely manual, so `npm test` alone reports PASS even if the device pass and the checklist were skipped — review said so and was right. The script cannot prove the owner looked; nothing can. It fails when nobody wrote down that he did, and when the record omits a condition — including the two AC-A8 conditions that cannot be staged on demand, which are the ones most likely to be quietly dropped.)*

## Validation Commands

**Level 1 — STATIC_ANALYSIS**

```
npm run check
```

**Level 2 — UNIT_TESTS**

```
npm test
```

**Level 3 — INTEGRATION**

```
npx vitest run test/agenda.test.ts test/format.test.ts
```

The pure modules this phase adds. The JSX has no automated tier by project decision; Task 8 is its verification.

## Acceptance Criteria

- **AC-A1 (PRD AC-11):** Given the API returns a 7-day window, when `agendaForToday(events, today)` runs, then only events whose local day equals `today` survive — an event at 22:00 local staying on its local day rather than moving to tomorrow via UTC.
- **AC-A2 (PRD AC-12):** Given events from two calendars arriving in calendar order, when the agenda is built, then rows are ordered by start instant with all-day events first — so "the next event" is the next one in time, not the first calendar's.
- **AC-A3 (PRD AC-12):** Given a timed event and an all-day event, when each is rendered, then the timed one shows its pt-BR time in the leading mono column and the all-day one shows the approved label rather than a blank cell.
- **AC-A4 (PRD AC-11):** Given the Google-unreachable banner, when it renders, then it carries an icon appropriate to that condition rather than the wifi-off glyph, and the existing offline call site is unchanged.
- **AC-A5 (PRD AC-8):** Given an event whose title is `null`, when the row renders, then `(sem título)` appears as real DOM text in the accessible name, not as a CSS pseudo-element.
- **AC-A6 (PRD AC-11):** Given a Google fetch that fails, when it is handled, then `useConnectivity`'s reducer is not called at all — task capture and completion stay enabled, and the offline banner's state is unchanged in both directions.
- **AC-A7 (PRD AC-11):** Given zero Tasks and a healthy events fetch, when *Hoje* renders, then the agenda is visible; and given a failed task load with healthy events, the agenda is still visible. The screen's loaded and empty predicates consider both sources.
- **AC-A8 (PRD AC-11):** Given four distinct conditions — no events today, not connected, fetch failed, and a partial per-calendar failure — when each renders, then each produces different visible text, and none of the three failure conditions is pixel-identical to the no-events one.
- **AC-A9 (PRD AC-11) (manual):** Given a deliberately cut network and, separately, a deliberately revoked token, when the owner opens *Hoje* on the phone and the PC, then the events region states the problem persistently and the Task list renders in full.
- **AC-A10 (PRD AC-12) (manual):** Given a rendered day with both kinds of row, when the owner looks at it or taps an event, then the event is visibly external, offers no completion, edit or delete affordance, and opens Google Calendar.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A Google failure disables Task capture through the shared connectivity reducer | H if unguarded | H | AC-A6 asserts the reducer is never called from the Google path; named explicitly in Task 6 rather than left to discipline |
| A failed fetch renders as a free day — the exact outcome the success metric sets to zero | H if unguarded | H | AC-A8 requires four distinguishable states; Task 7 renders the failure as a sibling of the group rather than through `TaskGroup`'s zero-row early return |
| The event row reads as a disabled Task rather than as something external | M | M | Dashed outline on a transparent ground, no checkbox, a leading time column, and never the accent — three cues, not one (§4.4 forbids colour alone). AC-A10 is the owner's judgement, and it is the phase's real acceptance |
| pt-BR strings invented by the implementer while §9's voice is `TBD` | M | M | Every string is quoted from the owner's 2026-08-28 approval; the Decision Gate records that a `TBD` is not a licence to improvise |
| No automated tier covers the JSX, so a regression on the owner's daily screen is invisible to CI | M | M | The decidable logic is moved to `src/shared` and tested; Task 8 is a real device pass on BOTH devices, including the phone unit 3 never got |
| Italic `(sem título)` renders as a synthetic oblique — one Inter face ships, `font-style: normal` | L | L | Accepted and recorded rather than adding a second font file against §5.3's ≤ 100 KB budget; contrast re-measured per §4.3 in the new treatment |

## Notes

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Test-first here means the `src/shared` half.** `docs/context/methodology.md` keeps React component verification manual and says so explicitly: "a PRD whose acceptance criteria are purely visual produces no test file — that is the `EXISTING_COVERAGE_SUFFICIENT` / no-test-required path, not a violation." The obligation that replaces it is the one that document actually imposes: extract the decidable part into `src/shared` and author it test-first, leaving only glue on the device. That is why `agendaForToday` and `formatEventTime` exist as separate modules rather than as helpers inside the component — the today-filter, the ordering and the time formatting are exactly the parts that can be wrong silently.

**Six findings from the 2026-08-29 grounding pass changed this plan before it was written**, and each is now a task or an AC rather than a surprise: the connectivity reducer would let a Google outage disable capture; `TaskGroup`'s zero-row early return makes a failed fetch invisible; `remaining` would count events as *restantes*; a filter matching zero Tasks would hide the agenda entirely; per-calendar concatenation means nothing sorts the rows; and `renderDayItems`' `as never` cast defeats the exhaustiveness guarantee it was written to provide.

**The window justification narrowed, and that is recorded so it is not "fixed" later.** The 7-day fetch was originally argued as keeping *Próximas* populated. §2.4 forbids interleaving events with Tasks, so *Próximas* stays Task-only and the surviving justification for +7 is unit 16's week view alone.

**Three MoSCoW Musts moved out.** Connect, the calendar picker and disconnect are product surfaces the grounding pass found assigned to no phase; the owner chose a new phase 5 over widening this one. Shipping phase 4 alone therefore does NOT close the unit.

*Generated: 2026-08-29*
*Approved: 2026-08-29*
*Status: APPROVED*
