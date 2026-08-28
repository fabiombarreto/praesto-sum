# Feature: Reading the calendar (Phase 3 of google-calendar-read)

```
**Decision Gate**
- Active context: none
- Activated criteria: architectural decisions; cross-cutting patterns; domain rules (events); impact on reusable services
- Decisions found:
  - ADR-0007 — read-only in the project's Phase 1; `singleEvents=true` so this slice contains ZERO recurrence code; the mirror inventory is CLOSED (attendees, reminders and recurrence never cross); nothing but the credential and the calendar selection persists.
  - ADR-0003 — canonical data in D1, but this phase persists no event data at all, which is what keeps "no merge, no sync, no reconciliation" literally true rather than merely intended.
  - ADR-0005 — types flow schema → `dto.ts` → `src/shared/api.ts`; exact pins; no dependency is added here.
  - ADR-0008 — test-first.
  - ADR-0009 — visible UI copy pt-BR; identifiers, comments and tests English. This phase ships no UI, so the only pt-BR string it may produce is a fallback title, and even that is phase 4's to place.
  - Owner decisions, 2026-08-28: the window is **today through +7 days**, and "today" is a fixed **`America/Sao_Paulo`** (`PRAESTO_TIMEZONE`), not the device's zone.
- Applicable anti-patterns:
  - Mirroring Google's own reminders, or third-party attendees — attendees are other people's PII and would reach the FR-042 export. The mapper must be structurally incapable of carrying them, not merely careful.
  - Re-serializing a recurrence rule Praesto cannot express — `singleEvents=true` means no rule is ever read, so nothing can be re-serialized.
  - `updated_at` as a sync dirty flag — inapplicable and must stay so: nothing is stored, so nothing can be dirty.
  - Hand-duplicated entity types; version ranges; Portuguese in artifacts; weakening tests to force green.
- Applicable architectural rules:
  - `src/shared/` carries no DOM or Worker globals and no clock reads — `now`/`today` are arguments.
  - One Worker serves everything; every `/api/*` route is bearer-gated by prefix.
  - **Measured (C11 2026-08-11, reproduced C12 2026-08-25):** `calendarList.list` answers 403 without `calendar.calendarlist.readonly`. That scope was granted for real on 2026-08-28.
  - **Documented (Google sync guide):** sending `syncToken` together with `timeMin`/`timeMax`/`orderBy` is a 400. A bounded window and incremental sync are mutually exclusive, and this phase takes the window.
- Result: PROCEED
```

## Source

- `PRPs/prds/google-calendar-read.prd.md` — Implementation Phases row 3: "Reading the calendar" — Goal: turn a credential into the owner's real events, correctly and narrowly — Success signal: AC-6 through AC-9, AC-13 and AC-15 pass, with the mapper's tests written against the real payload shapes C12 returned on 2026-08-25.

## Summary

Phase 2 obtained a credential; this phase spends it. It adds an access-token refresh, a calendar list behind the newly granted scope, a persisted calendar selection defaulting to `primary`, and a bounded-window `events.list` call carrying no `syncToken`. Everything Google returns passes through one pure mapper in `src/shared/` whose output type structurally cannot hold an attendee, a reminder or a recurrence rule — the closed mirror inventory enforced by the shape of a type rather than by the discipline of whoever edits it next. Still nothing about an event is persisted: Google remains the source of truth for this slice, so there is no second copy and therefore no reconciliation code anywhere in the unit.

## User Story

```
As the owner of Praesto
I want the app to fetch my real commitments for the next week from the calendars I chose
So that phase 4 has something true to put on the screen next to my Tasks
```

## Problem Statement

A stored refresh token is not a calendar. Nothing in the app yet exchanges it for an access token, asks Google which calendars exist, remembers which of them the owner wants, or reads a single event. FR-027 promises the owner sees his Google commitments and *chooses which calendars are included*; today the app can prove it has permission to do that and cannot do any of it.

## Solution Statement

Extend the phase-2 Google client with three read operations — refresh, `calendarList.list`, `events.list` — all still taking an injected `fetch`, so a test can assert what a request carried and, more importantly, what it did not. Persist the owner's calendar selection in one small table, defaulting to `primary` when he has never chosen. Query the window today→+7 days in `America/Sao_Paulo`, with `singleEvents=true`, `orderBy=startTime` and explicitly no `syncToken`. Map every payload through one pure function whose output type omits attendees, reminders and recurrence entirely, so the mirror inventory is closed by construction. Expose the result on a bearer-gated route; putting it on the screen is phase 4.

## Metadata

| Key | Value |
|---|---|
| Type | Feature (external reads, new pure mapper, one small table) |
| Complexity | Medium — no new architectural seam, but the first code that spends a real credential and the first that parses a third party's payload |
| Systems Affected | `src/worker/google/client.ts`, `src/worker/routes/google.ts`, `src/shared/` (new mapper + wire types), `src/worker/db/schema.ts`, `migrations/` |
| Dependencies | Phase 2 (`implemented`, and verified against the real Google on 2026-08-28) |
| Estimated Tasks | 8 |
| phase_type | feature |
| Source PRD line ref | `PRPs/prds/google-calendar-read.prd.md:185` (Implementation Phases row 3); Phase Details at `:222` |

## Mandatory Reading

| Priority | Path | Lines | Why |
|---|---|---|---|
| 1 | `src/worker/google/client.ts` | 1-115 | The injected-`fetch` contract and the return-an-outcome-never-throw discipline the three new operations must follow |
| 1 | `src/shared/google-oauth.ts` | 20-35 | `GOOGLE_READONLY_SCOPES` — the closed consent boundary the new calls operate inside |
| 1 | `src/shared/dates.ts` | 22, 30 | `PRAESTO_TIMEZONE` and `todayIn(now, timeZone)` — the existing answer to "which day is it", which this phase reuses rather than reinventing |
| 1 | `src/shared/day-item.ts` | 40-70 | `DayItem`'s external variant, whose `payload` is `unknown` today. This phase gives it a real shape |
| 2 | `src/worker/routes/google.ts` | 1-60 | Where the new routes attach, and the fail-closed posture for missing configuration |
| 2 | `src/worker/db/schema.ts` | (the two phase-2 tables) | Table conventions, and the singleton-CHECK pattern the selection table mirrors |
| 2 | `src/shared/api.ts` | 24-40 | `TaskDto` — the shape a `CalendarEventDto` sits beside without imitating |
| 3 | `PRPs/prds/google-calendar-read.prd.md` | 68-78, 222-225 | PRD AC-6..AC-9, AC-13, AC-15 verbatim, and this phase's Goal/Scope/Success signal |

## Patterns to Mirror

```ts
# SOURCE: src/worker/google/client.ts:102-115
export async function revokeToken(token: string, deps: GoogleDeps = {}): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

```ts
# SOURCE: src/shared/google-oauth.ts:26-29
export const GOOGLE_READONLY_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const);
```

```ts
# SOURCE: src/shared/day-item.ts:56-63
export interface ExternalDayItem extends DayItemBase {
  source: "google";
  payload: unknown;
}
```

```ts
# SOURCE: src/shared/task-groups.ts:1-14
/**
 * The client half of the frozen Task read contract (unit 2, 2026-08-15):
 * `groupTasks` PARTITIONS the array the API already ordered into the buckets
 * layout standard §2.5 specifies. It never sorts — the ordering is produced
 * by the API and is its guarantee to keep (`docs/api-reference.md`), so
 * re-deriving it here would put the one thing every consumer must agree on
 * in the one place they cannot share.
 */
```

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/shared/google-events.ts` | CREATE | The pure mapper: Google's wire shape → `CalendarEventDto`. Where both date shapes, the absent title and the closed mirror inventory are settled, testable without a Worker |
| `src/shared/api.ts` | UPDATE | `CalendarEventDto` and `GoogleCalendarDto`. Neither carries attendees, reminders or recurrence — the omission is the feature |
| `src/shared/day-item.ts` | UPDATE | `ExternalDayItem.payload` stops being `unknown` and becomes `CalendarEventDto`, plus `dayItemFromEvent` — the projection phase 4 needs |
| `src/worker/google/client.ts` | UPDATE | `refreshAccessToken`, `listCalendars`, `listEvents` — same injected-`fetch`, same never-throw contract |
| `src/worker/db/schema.ts` | UPDATE | `google_calendar_selections`: which calendar ids the owner chose |
| `migrations/0003_*.sql` | CREATE | Generated by drizzle-kit, additive only |
| `src/worker/routes/google.ts` | UPDATE | `GET /calendars`, `PUT /calendars` (the selection), `GET /events` |
| `scripts/check-mirror-inventory.mjs` | CREATE | The ADR-0007 tripwire, as a zero-dependency script. A grep chain guarding PII is defeatable by a comment; this one strips comments before testing |

## NOT Building (Scope Limits)

- **Any UI.** No rendering, no pt-BR copy on screen, no failure state in the interface. Phase 4 owns every pixel, including where the titleless-event fallback text is placed.
- **Any write to Google.** The three new calls are all GET; the only non-GET requests in the unit remain phase 2's token exchange and revoke.
- **Persisting event data.** No events table, no cache, no `syncToken`. Google stays the source of truth for this slice.
- **Recurrence.** `singleEvents=true` expands series at Google's boundary, so no rule is ever read and none can be re-serialized.
- **Attendees, guest lists, Google's reminders.** Excluded from the DTO by its type, not by a filter someone can forget to apply. At most a boolean `hasGuests`.
- **Backwards windows.** The owner chose today→+7 days. A past commitment is not actionable, and *Atrasadas* is a Task concept that does not apply to an event that simply happened.
- **The cron.** Nothing is stored, so nothing is polled. `scheduled()` stays a stub.

## Step-by-Step Tasks

### Task 1: UPDATE `src/shared/api.ts`

- **ACTION**: Add `CalendarEventDto` and `GoogleCalendarDto`. `CalendarEventDto` carries: `id`, `calendarId`, `title: string | null` (**null, not `""`** — an absent title is a fact to render, and the owner's real calendar contains one), `allDay: boolean`, `start` and `end` as `{ date: string } | { dateTime: number; timeZone: string | null }` so the two payload shapes stay distinguishable rather than being flattened into one lossy field, `location: string | null`, `hasGuests: boolean`, and `htmlLink: string | null`. It carries **no** `attendees`, **no** `reminders`, **no** `recurrence` and **no** `organizer` — write a comment saying that the omission is deliberate and load-bearing, so a future editor adding one is doing it against an explicit statement rather than into a gap. `GoogleCalendarDto`: `id`, `summary`, `primary: boolean`, `selected: boolean`. Serves **AC-A3 (PRD AC-7)**, **AC-A4 (PRD AC-8)** and **AC-A5 (PRD AC-9)**.
- **MIRROR**: `src/shared/api.ts:24-40` — `TaskDto`'s explicit field-by-field shape and its comment style for fields whose `null` carries meaning.
- **VALIDATE**: `npx tsc -b`

### Task 2: CREATE `src/shared/google-events.ts`

- **ACTION**: The pure mapper. Export `toCalendarEventDto(raw, calendarId)` returning `CalendarEventDto | null` (`null` for a payload too malformed to place on a day — a cancelled instance with no start, say — rather than throwing, so one bad row cannot blank the whole day). Handle **both** date shapes: `start.date` → `allDay: true` with the `YYYY-MM-DD` preserved as a local day; `start.dateTime` → `allDay: false` with an instant plus `start.timeZone ?? null`. Map an absent or empty `summary` to `title: null`. Derive `hasGuests` from the presence of a non-empty `attendees` array **without copying a single attendee**. Export `eventWindow(today, days)` returning the RFC3339 `timeMin`/`timeMax` pair **with offset**, computed from a `today` argument — never from the clock. Keep the module DOM-free and Worker-free. Serves **AC-A3 (PRD AC-7)**, **AC-A4 (PRD AC-8)**, **AC-A5 (PRD AC-9)** and **AC-A1 (PRD AC-6)**.
- **MIRROR**: `src/shared/task-groups.ts:1-14` — the header contract for a `src/shared` module: compiled into both targets, no globals, no clock, time as an argument.
- **VALIDATE**: `npx vitest run test/google-events.test.ts`

### Task 3: UPDATE `src/worker/google/client.ts`

- **ACTION**: Add three operations, each taking the same `deps: GoogleDeps` and each returning an outcome rather than throwing. `refreshAccessToken(refreshToken, {clientId, clientSecret}, deps)` POSTs `grant_type=refresh_token` to the token endpoint and returns the access token or a typed failure — treating `invalid_grant` distinctly, because that is what a revoked or dead credential looks like and phase 4 must be able to say so. `listCalendars(accessToken, deps)` GETs `calendarList.list`. `listEvents({accessToken, calendarId, timeMin, timeMax}, deps)` GETs `events.list` with `singleEvents=true`, `orderBy=startTime`, an explicit `maxResults`, and **no `syncToken`** — Google returns 400 for that combination, and a test asserts the parameter's absence rather than its presence. Serves **AC-A1 (PRD AC-6)** and **AC-A6 (PRD AC-13)**.
- **MIRROR**: `src/worker/google/client.ts:102-115` — `revokeToken`'s injected-`fetch`, try/catch-to-outcome shape.
- **VALIDATE**: `npx vitest run test/google-client.test.ts`

### Task 4: UPDATE `src/worker/db/schema.ts` and generate the migration

- **ACTION**: Add `googleCalendarSelections` (`google_calendar_selections`): `calendarId` text primary key, `selectedAt` timestamp. A row present means the calendar is selected; **absence of any row means "never chosen", which the read path resolves to `primary`** — a distinction the schema cannot express and the route must therefore own explicitly. Add a CHECK that `calendar_id` is non-empty. Run `npm run db:generate`, then **READ the emitted SQL before applying** and confirm it is purely additive, touching no existing table — the discipline unit 2 learned the hard way on 2026-08-15 and phase 2 followed. Apply locally only; the remote apply is the owner's. Serves **AC-A7 (PRD AC-15)**.
- **MIRROR**: `src/worker/db/schema.ts` — the phase-2 `oauthStates`/`googleConnections` tables: explicit snake_case columns, epoch-integer timestamps, CHECKs as structural invariants.
- **VALIDATE**: `npm run db:migrate && node -e "const fs=require('fs');const f=fs.readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort().pop();const sql=fs.readFileSync('migrations/'+f,'utf8');const bad=/\b(DROP|ALTER)\s+TABLE\b|__new_/i.exec(sql);if(bad){console.error('FAIL: '+f+' is not purely additive - found '+bad[0]);process.exit(1)}console.log('PASS: '+f+' is additive only')"`

### Task 5: UPDATE `src/worker/routes/google.ts` — calendars and selection

- **ACTION**: `GET /calendars` refreshes an access token, calls `listCalendars`, and returns `GoogleCalendarDto[]` with `selected` computed from the selection table — and, when the owner has never chosen, with **only the `primary` calendar marked selected**, which is the documented default rather than an accident of an empty table. `PUT /calendars` replaces the selection with the posted list of ids, validating each is non-empty and rejecting an unknown id rather than silently storing it. Both fail closed with a distinguishable answer when there is no connection, so phase 4 can tell "not connected" from "Google is down". Serves **AC-A7 (PRD AC-15)** and **AC-A2 (PRD AC-6)**.
- **MIRROR**: `src/worker/routes/google.ts:1-60` — the sub-router shape and the fail-closed posture for missing configuration.
- **VALIDATE**: `npx vitest run test/google-routes.test.ts`

### Task 6: UPDATE `src/worker/routes/google.ts` — the events window

- **ACTION**: `GET /events` computes the window with `eventWindow(todayIn(new Date(), PRAESTO_TIMEZONE), 7)` — today through +7 days in the owner's fixed zone, per his 2026-08-28 decision — queries every selected calendar, maps each payload through `toCalendarEventDto`, drops the `null`s, and returns the flattened list. A failure from ONE calendar must not blank the others: report per-calendar failure alongside the events that did arrive, because a screen that silently shows fewer commitments than exist is the failure mode this unit exists to prevent. Serves **AC-A1 (PRD AC-6)** and **AC-A2 (PRD AC-6)**.
- **MIRROR**: `src/shared/dates.ts:22,30` — `PRAESTO_TIMEZONE` and `todayIn`, reused rather than reimplemented.
- **VALIDATE**: `npx vitest run test/google-routes.test.ts`

### Task 7: UPDATE `src/shared/day-item.ts`

- **ACTION**: Replace `ExternalDayItem.payload: unknown` with `payload: CalendarEventDto`, and add `dayItemFromEvent(event: CalendarEventDto): ExternalDayItem` — the counterpart to `dayItemFromTask`, deriving `dueDate` from the event's start (the local day for an all-day event, the instant's day in `PRAESTO_TIMEZONE` for a timed one) and `closed: false`, since an event has no completion state (`docs/domain/areas/events.md`). This belongs HERE rather than in phase 4: `unknown` was a placeholder for a type that did not exist yet, and it exists now — leaving it would hand phase 4 type work that this phase's own DTO created. Serves **AC-A9 (PRD AC-10)**.
- **MIRROR**: `src/shared/day-item.ts:56-63` — the `ExternalDayItem` shape being completed, and `dayItemFromTask` directly above it for the projection's form.
- **VALIDATE**: `npx vitest run test/day-item.test.ts test/day-groups.test.ts`

### Task 8: VERIFY the mirror inventory is closed by construction

- **ACTION**: Confirm that no attendee, reminder or recurrence datum can reach the wire, using `scripts/check-mirror-inventory.mjs` — a script rather than a grep chain, because the grep form is defeatable and was *measured* to be so on 2026-08-28: excluding every line containing the substring `hasGuests` let `const leaked = raw.attendees; // hasGuests` pass. The script strips comments BEFORE testing rather than letting a comment excuse a line, and enforces a positional rule: these fields may be read in exactly one file (the mapper), and only in the presence test behind `hasGuests` — anything that binds, spreads or returns the value fails. This is the ADR-0007 consent boundary and the CON-005 privacy line; a leak here would put other people's PII into the FR-042 export. Serves **AC-A5 (PRD AC-9)**.
- **MIRROR**: `src/shared/google-oauth.ts:26-29` — the frozen scope constant, the same "closed by construction" posture applied to data instead of permissions.
- **VALIDATE**: `node scripts/check-mirror-inventory.mjs`

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
npx vitest run test/google-events.test.ts test/google-client.test.ts test/google-routes.test.ts
```

## Acceptance Criteria

- **AC-A1 (PRD AC-6):** Given a connected account and a target day, when the Worker calls `events.list`, then the request carries `timeMin` and `timeMax` as RFC3339 **with offset**, `singleEvents=true`, `orderBy=startTime` and an explicit `maxResults`, and carries **no** `syncToken` parameter at all.
- **AC-A2 (PRD AC-6):** Given the window is computed, when `eventWindow(today, 7)` is called, then `timeMin` is `today` at 00:00:00 in `America/Sao_Paulo` and `timeMax` is **day 8 at 00:00:00** in the same zone — an EXCLUSIVE upper bound, because Google documents `timeMax` as exclusive on start time, so naming the end of day 7 would silently drop events on that day. Both carry an explicit offset, and the function reads no clock of its own.
- **AC-A3 (PRD AC-7):** Given a payload containing one event with `start.date` (`2026-08-25`) and one with `start.dateTime` (`2026-08-26T15:00:00-03:00`), when mapped, then the first is `allDay: true` carrying the local day and no time, and the second is `allDay: false` carrying an instant plus its zone. Both shapes exist in the owner's real calendar (C12, 2026-08-25).
- **AC-A4 (PRD AC-8):** Given an event whose `summary` is absent or empty, when mapped, then `title` is `null` — not `""` and not a placeholder string, because deciding what an untitled event *reads as* is phase 4's, and a mapper that invents copy takes that decision away.
- **AC-A5 (PRD AC-9):** Given a payload carrying `attendees`, `reminders` and `recurrence`, when mapped, then none reach `CalendarEventDto` in any form; the only permitted derivative is `hasGuests: true`, and no attendee value is copied anywhere.
- **AC-A6 (PRD AC-13):** Given the whole feature's source, when outbound calls are enumerated, then every Calendar API call uses `GET`, and the only non-GET requests remain phase 2's token exchange and revoke.
- **AC-A7 (PRD AC-15):** Given the owner has selected a subset of calendars, when the day is fetched, then only those are queried; and given he has never made a selection, then `primary` alone is queried and reported as selected.
- **AC-A8 (PRD AC-11):** Given two selected calendars and one of them failing, when `/events` is called, then the events from the healthy calendar are returned AND the failure is reported — never a silently shorter list. This is the API half of AC-11 (*a Google failure must never render as a free day*); phase 4 owns the rendered half, and it cannot render a distinction this route does not surface.

- **AC-A9 (PRD AC-10):** Given `dayItemFromEvent`, when a mapped event is projected, then it yields an `ExternalDayItem` whose `payload` is typed `CalendarEventDto` (never `unknown`), whose `closed` is `false` because an event has no completion state, and whose `dueDate` is the event's local day — so `collectDayItems` can take Google as a genuine second source without a cast.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A live call to Google on the render path makes *Hoje* hostage to Google's latency | H | M | Accepted, and named in the PRD as the cost of persisting nothing. Bounded by an explicit timeout and by phase 4 rendering Tasks independently. The recorded escape is a short-lived cache, as a new decision |
| The owner's calendar contains a payload shape neither C12 nor the tests saw | M | M | `toCalendarEventDto` returns `null` rather than throwing, so one unmappable row costs that row and not the day. AC-A8 keeps a partial failure visible |
| An attendee leaks into the DTO through a later edit | L | H | Task 8's VALIDATE runs `scripts/check-mirror-inventory.mjs`, which strips comments before testing and exits non-zero; the DTO's type has no field to hold one |
| `invalid_grant` on refresh is indistinguishable from Google being down | M | M | `refreshAccessToken` treats it as a distinct outcome, so phase 4 can say "reconnect" rather than "try again later" |
| Free-plan CPU/subrequest ceiling with several calendars | L | M | C11 measured 401 events in one page at 4.45 ms against a 10 ms limit; a 7-day window is far smaller. One subrequest per selected calendar, against a 50 limit |

## Notes

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

**Two owner decisions ground this phase**, both recorded in the PRD's Open Questions on 2026-08-28. The window is **today→+7 days**: a one-day window would leave the *Próximas* group permanently empty, and backwards is excluded because a past commitment is not actionable. "Today" is a **fixed `America/Sao_Paulo`** rather than the device's zone: all-day events carry no zone at all so the app needs an answer of its own regardless, and a fixed zone keeps the phone and the PC agreeing on which day it is.

**The mirror inventory is closed by the shape of a type, not by a filter.** `CalendarEventDto` has no field that could hold an attendee, so excluding them is not a step anyone can forget. Task 8 exists because a type can be widened: the script is the tripwire for the day someone does — and it is a script rather than a grep because the grep form was measured, on 2026-08-28, to let `const leaked = raw.attendees; // hasGuests` through.

**Why `title: null` rather than a fallback string.** The mapper knows an event has no title; it does not know what an untitled event should *read as* on a dark Portuguese screen. Inventing copy in the mapper would move a design decision into a data layer and put a pt-BR string in a module that ADR-0009 keeps English. Phase 4 renders it.

**What this phase still cannot prove.** It ends with real events fetched from the owner's real calendar, but nothing on screen. The unit's exit signal — a week of mornings answered without opening Google Calendar — needs phase 4 and then real use.

*Generated: 2026-08-28*
*Approved: 2026-08-28*
*Status: IMPLEMENTED*
