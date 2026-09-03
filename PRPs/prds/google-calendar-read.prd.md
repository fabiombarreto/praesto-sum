# Google Calendar Read

```
**Decision Gate**
- Active context: none
- Activated criteria: architectural decisions; cross-cutting patterns; reuse or creation of components; domain rules (events, tasks); impact on shared UI; impact on reusable services
- Decisions found: ADR-0003 (canonical data in D1; no merge/sync/offline-write logic; token on every route; only the PWA shell is unauthenticated); ADR-0004 (single installable PWA); ADR-0005 (React 19 SPA + Vite + Hono + Drizzle; exact pins); ADR-0007 (bidirectional Google Calendar sync, Events only, scope `calendar.events`, polling on the existing cron, read in the project's Phase 1 / write in its Phase 2, closed mirror inventory); ADR-0008 (test-first); ADR-0009 (visible UI copy in pt-BR, everything else English); ADR-0010/ADR-0011 (Arcade identity; owned shadcn-style components over Base UI + Tailwind v4)
- Applicable anti-patterns: CRDT or custom sync engines (permitted here only under ADR-0007's L1/L2/L3 carve-out); mirroring Tasks, Reminders or Life Areas to Google; treating absence in a full re-sync as a deletion; `updated_at` as the sync dirty flag; re-serializing a recurrence rule Praesto cannot express; mirroring Google's own reminders or third-party attendees; hand-duplicated entity types; version ranges in dependencies; Portuguese in artifacts (carve-out: visible UI copy is pt-BR); glossary synonym drift; weakening tests to force green
- Applicable architectural rules: one Worker serves everything; types flow from `src/worker/db/schema.ts` through `src/worker/dto.ts` to `src/shared/api.ts`; domain enums enforced twice (TS union + SQL CHECK); `src/shared/` carries no DOM or Worker globals; every `/api/*` route requires the bearer token and the PWA shell is the only unauthenticated surface (this is what rejected `events.watch` in ADR-0007 and what constrains the OAuth callback below); measured constraint from chore C11 and re-measured by C12 on 2026-08-25 — `calendarList.list` answers 403 `insufficientPermissions` under `calendar.events.readonly`
- Result: PROCEED
```

## Problem Statement

The owner's *Hoje* screen answers "what is today?" only for the half of his day that lives in Praesto. His actual commitments are in Google Calendar, so every morning he opens two apps and merges them in his head. The cost of not solving it is that Praesto stays a second-opinion app rather than the one he opens first — and the unit that makes it the first is cheap precisely now, because it creates no entity and no reconciliation code.

## Evidence

- FR-027 (Must, accepted): the owner sees Events from his external Google calendar inside Praesto, alongside his own items, visually distinct, and chooses which calendars are included. FR-030 (Must, accepted) pairs it with connect/disconnect under explicit consent, revoking access while preserving 100% of local data.
- Chore C11 (2026-08-11) proved real access against the owner's real account: the `praesto-sum` OAuth app is published *In production* with sensitive Calendar scopes and no verification submission, and a `workers.dev` redirect URI was accepted.
- Chore C12 (2026-08-25, run while opening this PRD) proved the premise nobody could prove from documentation: the refresh token minted on 2026-08-11T13:06Z still exchanged for an access token on **day 14** — double the 7-day expiry that External+Testing apps get. QA-002 holds.
- The same C12 run returned the owner's real next 7 days: **9 events**, carrying **both** payload shapes (`start.date` all-day, e.g. `2026-08-25 momo`; `start.dateTime` with offset, e.g. `2026-08-26T15:00:00-03:00 Daily - Super Ensino`) and **one event with no title at all** (`2026-08-27T17:45`). These are measured edge cases, not anticipated ones.
- C11 measured the free-plan headroom: 401 events across all history arrive in ONE page at 4.45 ms CPU, against limits of 50 subrequests and 10 ms CPU per invocation. A ±12-month window is 47 events and 0.66 ms.
- `calendarList.list` answers `403 insufficient authentication scopes` under `calendar.events.readonly` — measured by C11 and reproduced by C12 on 2026-08-25.
- The *Hoje* screen has no seam for a second item type: `TodayScreen` holds `tasks: TaskDto[] | null` and renders everything through one `renderTaskRows` helper (`src/app/components/TodayScreen.tsx:82-117,367-386`); `groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups` hard-codes `TaskDto[]` in all five buckets (`src/shared/task-groups.ts:20-44`).

## Proposed Solution

Praesto reads the owner's Google calendars live, on the request that renders the day, and shows those events inside the existing *Hoje* screen next to his dated Tasks — visually distinct and strictly read-only. Nothing about the events is stored: Google remains the single source of truth for this slice, so there is no second copy, therefore no conflict, therefore not one line of reconciliation code. Only two things persist: the OAuth credential and the owner's calendar selection. Connect and disconnect are real product surfaces, not a terminal ritual — the consent URL is minted by an authenticated request carrying a single-use `state` nonce, and the unauthenticated callback route is admissible only because that nonce is what closes it. The alternative designs were rejected deliberately: materializing events into D1 would drag the whole ADR-0007 conflict apparatus into a read-only unit, and doing OAuth out-of-band (as the C11 spike did) would leave FR-030 satisfied by the owner and a terminal rather than by the product.

## Key Hypothesis

We believe that showing the owner's real Google commitments read-only inside the *Hoje* screen will stop him from opening Google Calendar to find out what his day looks like.
We'll know we're right when, for a full week, he answered "what is today?" from Praesto alone on at least 5 of 7 days.

## What We're NOT Building

- **Writing anything to Google** (create / edit / delete / RSVP) — that is unit 15 `google-calendar-write`, gated behind the Event entity of unit 14. ADR-0007's conservative phasing is the whole reason this unit is cheap.
- **An Event entity, table, or any persistence of event data** — Google stays the source of truth for this slice. Introducing a local copy is what would create conflicts, and unit 14 is where the sync-aware schema is born.
- **`syncToken` / incremental sync** — Google documents a 400 when `syncToken` is combined with `timeMin`/`timeMax`/`orderBy`, so a bounded window and incremental sync are mutually exclusive. This unit wants the window. `syncToken` becomes meaningful in unit 15, when a local table exists to keep incrementally.
- **Recurrence handling** — `singleEvents=true` flattens series into instances at the API boundary, so this unit contains zero recurrence code, per ADR-0007.
- **Attendees, guest lists, or Google's own reminders** — attendees are other people's PII and would land in the FR-042 export; Google reminders would double every notification. Both are named anti-patterns. At most a boolean "has guests".
- **The cron / `scheduled()`** — with nothing persisted there is nothing to poll for. `scheduled()` stays the stub it is today.
- **Other calendar providers** (Outlook, Apple, CalDAV) — no decision authorizes them and no ADR covers them.
- **Week view** — FR-024, unit 16.
- **Editing the Google-side representation of anything** — read-only is enforced by construction, not by discipline.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Days the owner did NOT open Google Calendar to check his day | ≥ 5 of 7 | Self-report, daily, over the first week of real use |
| Commitments missed because they were not visible in Praesto | 0 | Self-report over the same week |
| Events present in the window that appear on the screen | 100% | Manual comparison of the *Hoje* screen against the Google app, on 3 distinct days |
| Google failures that produce a screen indistinguishable from a genuinely free day | 0 | Deliberate test: revoke the token and cut the network, and observe the screen in both states |

## Acceptance Criteria (test scenarios)

Mandatory. Each criterion is an observable scenario the resulting code must satisfy. `tdd: true`, so these are the contract the test pair authors **test-first**, before the Implementer.

Per `docs/context/methodology.md`, the automated tier covers the Worker routes, the auth gate, and the pure logic in `src/shared/`; React components stay manually verified. AC-11 and AC-12 are therefore marked **manual** and produce no test file — that is the sanctioned path, not a gap.

- **AC-1 Consent URL is minted, scoped and stateful:** Given an authenticated request, when the client calls the connect route, then the response carries a Google consent URL requesting **exactly** `calendar.events.readonly` and `calendar.calendarlist.readonly` and no other scope, with `access_type=offline`, and its `state` parameter is a freshly generated nonce persisted with an expiry and an unconsumed marker.
- **AC-2 The callback refuses every state it did not mint:** Given the OAuth callback route, when it is called with a `state` that was never minted, or was already consumed, or is past its expiry, then it answers 4xx, makes **no** outbound request to Google, and writes no credential. This is the property that makes an unauthenticated route admissible under ADR-0003 safeguard 4.
- **AC-3 A valid callback stores the credential exactly once:** Given a minted, unconsumed, unexpired `state` and an authorization code, when the callback runs, then the code is exchanged at `https://oauth2.googleapis.com/token`, the refresh token is persisted, and the nonce is marked consumed in the same operation — so replaying the identical callback URL hits AC-2 and changes nothing.
- **AC-4 Disconnect revokes remotely and preserves everything locally:** Given a stored connection and N Task rows, when the disconnect route is called, then the Worker POSTs the token to `https://oauth2.googleapis.com/revoke`, deletes the stored credential and the calendar selection, and the Task row count is still N with no row modified. (FR-030.)
- **AC-5 Disconnect succeeds even when Google refuses:** Given the revoke endpoint answers non-2xx or is unreachable — behaviour Google does not document for an already-dead token — when disconnect runs, then the local credential and selection are still deleted and the route reports success. The owner is never left unable to disconnect because a third party said no.
- **AC-6 The events query is a bounded window and carries no sync token:** Given a connected account and a target day, when the Worker calls `events.list`, then the request carries `timeMin` and `timeMax` as RFC3339 timestamps **with offset**, `singleEvents=true`, `orderBy=startTime` and an explicit `maxResults`, and carries **no** `syncToken` — the documented 400 combination.
- **AC-7 Both date shapes map correctly:** Given a payload containing one event with `start.date` (`2026-08-25`) and one with `start.dateTime` (`2026-08-26T15:00:00-03:00`), when mapped by the pure mapper in `src/shared/`, then the first is flagged all-day and carries no time-of-day, and the second carries an instant plus its IANA zone. Both shapes exist in the owner's real calendar (C12, 2026-08-25).
- **AC-8 A titleless event survives mapping and rendering:** Given an event whose `summary` is absent — one exists in the owner's real calendar at `2026-08-27T17:45` — when mapped, then the DTO carries an explicit absent title rather than an empty string, and the screen shows the pt-BR fallback rather than a blank row.
- **AC-9 The mirror inventory is closed by construction:** Given a Google payload carrying `attendees`, `reminders` and `recurrence`, when mapped, then none of those fields reach the DTO in any form; the only permitted derivative is a boolean indicating that guests exist. The mapper is structurally incapable of carrying them, not merely careful.
- **AC-10 One range function, proved at zero, one and two sources:** Given the function that produces the day's items, when it is called with **zero** sources, with **one** source, and with **two** sources, then all three return correct results through the same code path with no source-count branch. This is the roadmap's declared non-negotiable design condition for this unit — it is what lets unit 14 add local Events as a third source instead of rewriting the screen.
- **AC-11 Google failure never renders as a free day (manual):** Given Google answers 5xx, times out, or the refresh token is dead (`invalid_grant`), when the *Hoje* screen loads, then the Task list renders in full and independently, and the events region shows an explicit pt-BR failure state. An empty events region and a failed events region are never the same pixels.
- **AC-12 External events are visibly external and inert (manual):** Given a rendered day containing both dated Tasks and Google events, when the owner looks at it or taps an event, then the event is visually distinct from a Task per the ui-layout-standard and offers no completion, edit or delete affordance of any kind.
- **AC-13 Read-only is enforced by construction:** Given the whole feature's source, when outbound calls to Google are enumerated, then every Calendar API call uses `GET`, and the only non-GET requests in the feature are the token exchange and the revoke POST. No `events.insert`, `events.patch`, `events.delete` or `calendars.*` mutation exists anywhere.
- **AC-14 Grouping stays byte-identical for a Task-only day:** Given the generalized grouping function and a list containing only Tasks, when grouped, then the result is identical to what `groupTasks` returns today for the same input. The generalization is a widening, never a behaviour change — this is the regression guard for unit 3's shipped screen.
- **AC-15 The calendar selection is honoured, with a documented default:** Given the owner has selected a subset of his calendars, when the day is fetched, then only the selected calendars are queried; and given no selection has ever been made, then `primary` is queried and that default is what the UI shows as selected.

## Open Questions

- [ ] **Does adding `calendar.calendarlist.readonly` invalidate the existing refresh token?** Re-consent is certain; whether the 2026-08-11 token survives it is not documented. Mitigated by ordering (phase 2 re-consents early), but the answer is unknown until observed.
- [x] **How wide is the window?** **Resolved 2026-08-28 by the owner: today through +7 days** for the API. **Amended 2026-08-28 after a visual comparison: the *Agenda* group on screen shows TODAY only** (option A of three the owner compared side by side in the real tokens). The two decisions are not in tension — they are different questions. The layout standard §2.4 puts events in one group at the top and forbids interleaving them with Tasks, so days 2-7 have nowhere to appear on the *Hoje* screen; the mockup made the cost concrete, showing that the 7-day variant pushed *Atrasadas* off the fold and kept the *Hoje* group off screen entirely, on a screen named *Hoje*. Fetching more than is shown is deliberate: unit 16 (week view) consumes the same window with no new decision, and going A→B later costs nothing while C→B would cost the window back. A one-day window would leave the *Próximas* group permanently empty, and the screen already has that bucket. Backwards is deliberately excluded — a past commitment is not something the owner can act on, and *Atrasadas* is a Task concept that does not apply to an event that simply happened.
- [x] **Whose timezone is "today"?** **Resolved 2026-08-28 by the owner: a fixed `America/Sao_Paulo`,** reusing the existing `PRAESTO_TIMEZONE` constant rather than reading the device. All-day events carry no zone at all, so the app needs an answer of its own regardless; a fixed zone also means the phone and the PC agree on which day it is, which a device-derived zone would not guarantee while travelling.
- [ ] **Where does the credential live in D1, and under what protection?** A third party's refresh token in the owner's canonical store is new — ADR-0007 anticipates persisting "the credential", but the table shape, and whether it is excluded from the FR-042 export, are undecided.
- [ ] **Revoke idempotency is undocumented** — Google's web-server guide does not state what revoking an already-dead token returns. AC-5 makes the product safe either way, but the actual behaviour is unknown.
- [ ] **No sourced design precedent was found** for how mature calendar apps distinguish read-only external events or render a "could not reach the provider" state. Web research returned only listicles. The visual answer will come from `ui-layout-standard`/`visual-identity` rather than from external evidence — recorded as a gap, not filled with invention.
- [ ] **The `.ics` snapshot half of chore C12 did not run** — `scripts/google-calendar-spike.js` exposes no such command. It stays open and unowned by this unit.

---

## Users & Context

**Primary User**
- **Who:** The owner — sole user of Praesto, no accounts, no sharing. Android phone, Windows PC.
- **Current behavior:** Opens Google Calendar on the phone in the morning, then Praesto, and merges the two in his head.
- **Trigger:** The morning question "what is today?".
- **Success state:** One screen answers it, and Google Calendar stops being part of the morning.

**Job to Be Done**
When I open Praesto in the morning, I want to see my real commitments next to my dated Tasks, so I can know what today is without opening a second app.

**Non-Users**
Everyone else — this is a single-user app with no accounts. It is also explicitly not for *managing* the Google calendar: creating, editing, deleting or responding to events is unit 15's job, and nothing here is a step toward doing it early. Users of other calendar providers are out of scope entirely.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | In-app connect via OAuth, with a single-use `state` nonce minted by an authenticated request | FR-030's "explicit consent" has to be a product surface; the nonce is what keeps the unauthenticated callback compatible with ADR-0003 safeguard 4 |
| Must | In-app disconnect that revokes remotely and preserves 100% of local data | FR-030, stated verbatim. Shipped in the same unit as connect, per the roadmap |
| Must | Calendar selection, backed by the added `calendar.calendarlist.readonly` scope | FR-027 says "he chooses which calendars are included"; `calendarList.list` is 403 without it, measured twice |
| Must | Live read of events in a bounded window, persisting nothing | ADR-0007's read-only phasing; no local copy means no conflict and no reconciliation code |
| Must | Google events rendered inside the *Hoje* screen beside dated Tasks, visually distinct, with no write affordance | FR-027; the unit's whole point |
| Must | Explicit failure state when Google cannot be reached | An empty day and a broken integration must never look alike |
| Must | Correct handling of all-day vs timed events, and of a missing title | All three exist in the owner's real calendar as of 2026-08-25 |
| Must | One range function taking a list of sources, proved at zero, one and two | The roadmap's declared non-negotiable design condition; it is what unit 14 extends |
| Should | Multi-calendar selection persisted across sessions | Otherwise the picker is a per-session toy |
| Could | Event location, or a link to open the event in Google | Useful, unnecessary for the hypothesis |
| Won't | Any write to Google | Unit 15, gated on unit 14's Event entity |
| Won't | Persisting event data in D1 | Would import the entire conflict apparatus into a read-only unit |
| Won't | `syncToken` / incremental sync | Documented 400 when combined with a bounded window; meaningless with nothing stored |
| Won't | Recurrence code | `singleEvents=true` flattens at the API boundary |
| Won't | Attendees, guest PII, Google's reminders | Named anti-patterns; PII would reach the FR-042 export |
| Won't | Cron participation | Nothing is persisted, so there is nothing to poll |
| Won't | Other providers, week view | No authorizing decision; FR-024 is unit 16 |

### MVP Scope

Connect once, disconnect at will, and see today's real commitments beside today's Tasks on the screen the owner already opens — with an honest state when Google is unreachable. Everything else the integration could do is deferred by an existing decision.

### User Flow

1. The owner opens *Hoje*. The events region invites him to connect his Google calendar.
2. He taps connect. Praesto (authenticated) mints a `state` nonce and hands back a Google consent URL for the two readonly scopes.
3. Google's consent screen appears — with the unverified-app warning C11 already documented — and he approves.
4. Google redirects to the callback. The nonce validates and is consumed; the refresh token is stored.
5. He is returned to *Hoje*, where his calendars are listed and `primary` is selected by default. He adjusts the selection.
6. From then on, opening *Hoje* shows his real commitments next to his dated Tasks — distinct, inert, and never pretending the day is free when Google is down.
7. Disconnecting revokes the token at Google, deletes the credential and the selection locally, and leaves every Task untouched.

---

## Technical Approach

**Feasibility:** HIGH — access is proven twice against the owner's real account (C11, C12), the cost is measured (4.45 ms CPU for 401 events, against a 10 ms ceiling), no new entity is introduced, and no reconciliation logic exists to get wrong. The genuine work is the client-side generalization of a screen that was built for exactly one item type.

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

### Architecture Notes

- **Nothing about events is persisted.** The only new rows are the OAuth credential and the calendar selection. This is what keeps ADR-0003's "no merge, no sync, no reconciliation" intact while ADR-0007's carve-out stays unused in this unit.
- **The OAuth callback is the first unauthenticated route the project has ever added beyond the PWA shell**, and it exists only because a single-use, short-lived `state` nonce minted by an authenticated request closes it. This is a deliberate, bounded exception to ADR-0003 safeguard 4, argued rather than assumed — the same safeguard that rejected `events.watch`, which had no equivalent closing mechanism. If the nonce mechanism proves insufficient, the fallback is out-of-band OAuth with the token as a Worker secret, at the cost of FR-030.
- **Scope set becomes `calendar.events.readonly` + `calendar.calendarlist.readonly`.** Both readonly, both sensitive-tier, neither restricted. Per C11 this does not change the verification category already settled. It does force a re-consent.
- **No `syncToken`, ever, in this unit.** Google returns 400 when it is combined with `timeMin`/`timeMax`/`orderBy`, and all non-sync parameters must stay frozen across incremental calls. A bounded window and incremental sync cannot coexist; the window wins here.
- **The mapper is a pure function in `src/shared/`**, DOM-free and Worker-free like `dates.ts` and `task-groups.ts`, which is what makes AC-7 through AC-9 testable first. Its input is Google's wire shape and its output is a Praesto DTO that structurally cannot carry attendees, reminders or recurrence.
- **`groupTasks` and `TaskGroups` widen from `TaskDto` to a dated-item shape** (`src/shared/task-groups.ts:20-44`), and `TodayScreen`'s single `renderTaskRows` path gains a sibling renderer. `TaskGroup` is already item-agnostic (`children: ReactNode`) and is reused as-is; `TaskRow` is not, and an event row component is new. `TaskFilter` (`src/shared/task-filter.ts:20-25`) is Task-specific by its enums — how filters interact with events is phase 4's problem, not a silent widening.
- **`GOOGLE_REFRESH_TOKEN` exists as a deployed Worker secret but appears nowhere in code** — `worker-configuration.d.ts` declares only `DB`, `API_BEARER_TOKEN` and the three `VAPID_*` members. With connect moving in-app, the credential's home becomes D1 and that secret's role needs an explicit decision rather than inheritance.
- **`scripts/google-calendar-spike.js` is a throwaway** deliberately outside `src/`. It is a reference for the token-exchange request shape only; nothing imports it and nothing should.
- **The test tier has no established pattern for faking an outbound `fetch` to a third party** under `vitest-pool-workers`. Establishing one is part of phase 2's cost, not an afterthought.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Generalizing `groupTasks`/`TodayScreen` for a second item type is larger than the roadmap's 5-day floor assumed | M | Phase 1 does it alone, with no Google code present, guarded by AC-14's byte-identical regression check |
| The re-consent required by the added scope invalidates the current refresh token, and something in the new flow is broken at the same moment | M | Phase 2 performs the re-consent early, so a dead token surfaces at the start of the unit rather than the day before it ships. The C11 spike script remains a working out-of-band path to re-mint |
| A live call to Google on the render path makes *Hoje* hostage to Google's latency and uptime — the accepted cost of persisting nothing | H | Short timeout; Tasks render first and independently of the events request; the events region degrades on its own (AC-11). If this proves painful in real use, the recorded escape is a short-lived cache, which is a new decision, not a silent addition |
| The unauthenticated callback route is a genuinely new attack surface on a single-secret app | M | Single-use, short-lived, unguessable `state`; no side effect before validation (AC-2); no reflection of user input; the route does nothing but exchange and store |
| A third party's refresh token now sits in the owner's canonical D1 store, and reaches the FR-042 export by default | M | Decide its table and its export treatment in phase 2 — this is an Open Question, not an assumption |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Dated items, one screen | Widen `groupTasks`/`TaskGroups` and `TodayScreen` from `TaskDto` to a dated item that declares its source, and introduce the range function that takes a list of sources. No Google code at all. AC-10, AC-14 | complete | - | - | `PRPs/plans/completed/google-calendar-read-phase-1-dated-items-one-screen.plan.md` |
| 2 | Consent, credential, revocation | The connect route that mints the `state` nonce, the unauthenticated callback that validates and consumes it, the token exchange, the credential's home in D1, and disconnect with real revocation. Includes the re-consent for the added scope and the outbound-fetch faking pattern for the test tier. AC-1..AC-5 | complete | - | 1 | `PRPs/plans/completed/google-calendar-read-phase-2-consent-credential-revocation.plan.md` |
| 3 | Reading the calendar | `calendarList.list` behind the new scope, the calendar selection and its `primary` default, the bounded-window `events.list` call, and the pure mapper for both date shapes, the missing title, and the closed mirror inventory. AC-6..AC-9, AC-13, AC-15 | complete | - | 2 | `PRPs/plans/completed/google-calendar-read-phase-3-reading-the-calendar.plan.md` |
| 4 | The day, whole | Google events rendered beside dated Tasks in *Hoje* — visually distinct, inert, with the explicit failure state and the pt-BR copy. How filters relate to events is decided here. AC-11, AC-12 | complete | - | 3 | `PRPs/plans/completed/google-calendar-read-phase-4-the-day-whole.plan.md` |
| 5 | Consent, made visible | The settings surface FR-030 and FR-027 need: connect, the calendar picker, and disconnect, as screens rather than as `curl`. Added 2026-08-29 — see the amendment note below. AC-1, AC-4, AC-15 | complete | - | 4 | `PRPs/plans/google-calendar-read-phase-5-consent-made-visible.plan.md` |

#### Phase-status lifecycle

This table IS relay's canonical phase-state machine (`docs/decisions.md`, 2026-05-04) — there is no separate state file. Every row starts at `pending` and advances through exactly five states, in order, never skipping backwards:

| Status | Meaning | Written by |
|--------|---------|------------|
| `pending` | No plan yet. The only state from which a row is actionable. | Authored here, by hand or by `prd-writer` |
| `in-progress` | A DRAFT plan exists and the `PRP Plan` cell points at it. | `plan-writer` Step 5.1 back-fill |
| `implemented` | Code written and code-review APPROVED; tests not yet settled. | `/relay-implement` D8 Mutation c |
| `tested` | Test suite ran GREEN *and* post-green review confirmed the green was not obtained by weakening tests. | `/relay-execute` Step A.5.3 |
| `complete` | The orchestrator drove the phase end to end. | `/relay-execute` Step A.6.0 |

Three rules follow from this table and are enforced across the pipeline:

1. **`tested` is skipped, never faked, when nothing was tested.** A project with no declared test framework (or a phase whose test stage self-skipped) goes `implemented` → `complete` directly. The skip reason is recorded in `PRPs/reports/<feature>/orchestrator-run.json`, not hidden in the Status cell.
2. **A dependency is satisfied from `implemented` onward.** A row listed in another row's `Depends` cell unblocks it once it reaches `implemented`, `tested`, or `complete` — not only at `complete`.
3. **`complete` does not mean "merged".** It means the orchestrator finished the phase. Merge, branch cleanup, and post-merge docs sync belong to `/relay-approve`, which never edits this table.

To re-run a phase, hand-edit its `Status` cell back to `pending` — that is the documented escape hatch, and the only sanctioned backwards transition.

### Phase Details

**Phase 1: Dated items, one screen**
- **Goal:** Give the *Hoje* screen a seam for a second kind of dated item, before any of it exists.
- **Scope:** Widen `groupTasks`/`TaskGroups` beyond `TaskDto`; introduce the range function taking a list of sources; add the sibling row-rendering path in `TodayScreen`. `TaskGroup` is reused unchanged. No Google code, no new route, no schema change.
- **Success signal:** The range function is called with zero, one and two sources in a test and is correct in all three (AC-10); a Task-only day groups byte-identically to today (AC-14); the shipped screen looks and behaves exactly as it does now.

**Phase 2: Consent, credential, revocation**
- **Goal:** Make connect and disconnect real product surfaces, safely.
- **Scope:** Connect route (authenticated, mints the nonce, builds the consent URL with both readonly scopes); callback route (unauthenticated, validates and consumes the nonce, exchanges the code, stores the credential); disconnect route (revokes at Google, deletes locally, succeeds regardless of Google's answer); the credential's D1 home and its export treatment; the re-consent for the added scope; the outbound-`fetch` faking pattern for `vitest-pool-workers`.
- **Success signal:** AC-1 through AC-5 pass, a replayed callback URL changes nothing, and disconnecting leaves every Task row untouched.

**Phase 3: Reading the calendar**
- **Goal:** Turn a credential into the owner's real events, correctly and narrowly.
- **Scope:** `calendarList.list` behind the new scope; the selection and its `primary` default; the bounded-window `events.list` call with no `syncToken`; the pure mapper in `src/shared/` covering both date shapes, the absent title, and the structural exclusion of attendees/reminders/recurrence.
- **Success signal:** AC-6 through AC-9, AC-13 and AC-15 pass, with the mapper's tests written against the real payload shapes C12 returned on 2026-08-25.

**Phase 5: Consent, made visible** *(added 2026-08-29)*
- **Goal:** finish FR-030 and FR-027 as product, not as a terminal ritual.
- **Scope:** a settings surface carrying connect, the calendar picker and disconnect — the three MoSCoW Musts whose ROUTES phase 2 and phase 3 shipped and whose SCREENS no phase owned. Layout standard §6 already routes "calendar picker and disconnect" to settings, and no settings screen exists yet, so this phase creates the first one.
- **Success signal:** the owner connects, changes which calendars feed the day, and disconnects — all from inside the app, never from a shell.

**Why this row was added to an APPROVED PRD.** The conflict pass that grounded phase 4 on 2026-08-29 found that three MoSCoW **Must** rows — in-app connect, in-app disconnect, calendar selection — were named in the Solution Detail and the User Flow but assigned to no Implementation Phase. Phase 2 built their routes; phase 4's scope is rows, failure state, copy and filters. Shipping the table as originally written would have closed the unit with FR-030 satisfied by `curl`, which the Decisions Log explicitly rejected when it chose the in-app callback over out-of-band OAuth. The alternative to amending was to leave the gap and record it as debt; the owner chose the phase. Recorded here rather than quietly appended, because an APPROVED PRD's phase table is the pipeline's state machine.

**Phase 4: The day, whole**
- **Goal:** The morning question, answered by one screen.
- **Scope:** Event rows beside dated Tasks in *Hoje*, visually distinct per `ui-layout-standard` and `visual-identity`, with no completion/edit/delete affordance; the explicit unreachable-Google state; the pt-BR copy including the titleless fallback; the decision on how the existing filters relate to events.
- **Success signal:** AC-11 and AC-12 verified manually on the Android phone and the Windows PC, including a deliberately revoked token and a cut network — and the events region never looks like a free day.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Calendar picker scope | Add `calendar.calendarlist.readonly` to the existing `calendar.events.readonly` | Read `primary` only and defer the picker to unit 15 | `calendarList.list` is 403 without it, measured by C11 and again by C12. Without the scope FR-027 ships half-done and the unit becomes debt. Both scopes are readonly and sensitive-tier, so C11's settled verification position is unchanged |
| Event persistence | None — live read on the render path; only the credential and the calendar selection persist | Materialize events into D1; cache them with a TTL | ADR-0007 phases read before write precisely so this slice has no second copy, hence no conflict, hence no reconciliation code. A cache is a recorded escape if latency proves painful — as a new decision, not a silent addition |
| OAuth callback exposure | Unauthenticated callback route, closed by a single-use, short-lived `state` nonce minted by an authenticated request; tokens stored in D1 | Out-of-band OAuth keeping the Worker secret (zero new routes, but FR-030 satisfied by a terminal rather than the product); defer in-app connect to unit 15 | ADR-0003 safeguard 4 makes any unauthenticated route an argued exception. The nonce is the closing mechanism `events.watch` lacked when ADR-0007 rejected it. The roadmap explicitly requires disconnect "shipped the same day", which the out-of-band path cannot honour |
| `syncToken` | Not used in this unit | Incremental sync with frozen parameters | Google documents 400 when `syncToken` accompanies `timeMin`/`timeMax`/`orderBy`. A bounded window and incremental sync are mutually exclusive, and with nothing persisted there is nothing to sync incrementally. This also closes C11's open question rather than testing it |
| Screen generalization timing | Its own first phase, with no Google code present | Generalize while wiring Google in the same phase | The screen shipped days ago and is the owner's daily surface; a regression there is more expensive than a phase boundary. AC-14 makes the widening provably behaviour-preserving |
| Chore C12 | Run before authoring, on 2026-08-25 | Author the PRD on C11's evidence and run C12 later | The whole unit rests on the refresh token surviving, and only the wall clock could prove it. It passed at day 14, and the same run yielded three real payload edge cases that are now acceptance criteria instead of assumptions |

---

## Research Summary

**Market Context**

- Google's scope reference describes `calendar.calendarlist.readonly` as seeing the list of calendars the user is subscribed to, and documents no scope-free way to enumerate calendars — `calendarList.list` is the only path (https://developers.google.com/workspace/calendar/api/auth).
- Per-scope sensitivity (non-sensitive / sensitive / restricted) is not published in a static table; it is shown dynamically in the Cloud Console consent-screen UI. **No source confirms** whether adding `calendar.calendarlist.readonly` to an app already holding `calendar.events.readonly` changes its verification tier — C11's own console observation is the only evidence, and C11 also recorded that the console contradicts itself on this project (https://developers.google.com/identity/protocols/oauth2/scopes).
- `events.list`: `timeMin`/`timeMax` are RFC3339 with mandatory offset (`timeMin` exclusive on end time, `timeMax` exclusive on start); `orderBy=startTime` requires `singleEvents=true`; `maxResults` defaults to 250, max 2500; `timeZone` falls back to the calendar's own (https://developers.google.com/calendar/api/v3/reference/events/list).
- **Incremental sync is incompatible with a bounded window**: combining `syncToken` with `timeMin`, `timeMax`, `orderBy`, `q`, `iCalUID` or extended-property filters returns **400**, and every other parameter must stay identical across incremental calls; a **410 Gone** means the token is invalid and a full sync must follow (https://developers.google.com/workspace/calendar/api/guides/sync).
- All-day events carry `start.date` (`yyyy-mm-dd`, no zone); timed events carry `start.dateTime` (RFC3339, offset required unless `timeZone` is given) (https://developers.google.com/workspace/calendar/api/v3/reference/events).
- Refresh-token invalidation is enumerated: user revocation, six months of inactivity, password change when Gmail scopes are held, more than 100 refresh tokens per account per client ID, expiring grants, admin policy — and the 7-day expiry specific to External + Testing apps. **Google does not document** that a production app with sensitive-but-unverified scopes gets durable tokens; that is exactly the gap chore C12 closed empirically on 2026-08-25 (https://developers.google.com/identity/protocols/oauth2).
- Revocation is `POST https://oauth2.googleapis.com/revoke` with a `token` parameter, accepting an access or refresh token, returning 200 on success. **Undocumented:** idempotency, and what revoking an already-dead token returns (https://developers.google.com/identity/protocols/oauth2/web-server).
- Quotas are 10,000 requests/minute per project and 600 per user per project, with exponential backoff plus jitter on 403 `rateLimitExceeded` / 429 — orders of magnitude above this app's scale (https://developers.google.com/workspace/calendar/api/guides/quota).
- **Gap:** no sourced design material was found describing how Fantastical, Notion Calendar, Amie, Vimcal, Morgen or Reclaim distinguish read-only external events or render a provider-unreachable state. Searches returned only comparison listicles. This PRD therefore takes its visual answer from the project's own `ui-layout-standard` and `visual-identity`, and records the absence rather than inventing precedent.

**Technical Context**

- `TodayScreen` holds `tasks: TaskDto[] | null` as its only data state and renders every bucket through one `renderTaskRows` helper — there is no seam for a second entity type (`src/app/components/TodayScreen.tsx:82-117,367-386`).
- `groupTasks(tasks: readonly TaskDto[], today: string): TaskGroups` hard-codes `TaskDto[]` in all five buckets, never sorts (it relies on API ordering), and buckets on `status` plus `deadline ?? scheduledDate` — fields a Google event does not have (`src/shared/task-groups.ts:20-44`).
- `TaskFilter` embeds `TaskStatus | null` and `TaskPriority | null`, enums that exist only for Tasks, with no notion of item kind or source (`src/shared/task-filter.ts:20-25`).
- `TaskGroup` is already item-agnostic (`children: ReactNode`) and reusable as-is; `TaskRow` is tightly coupled to `TaskDto` (complete control, inline edit, priority glyph, `taskMetaLine`), so an event row is a new component (`src/app/components/TaskGroup.tsx:12-24`; `src/app/components/TaskRow.tsx:32-52`).
- `GET /api/tasks` builds an SQL `urgencyBucket` CASE over `coalesce(deadline, scheduledDate)` and orders before `limit`, which is the ordering the client's grouping assumes it never re-derives (`src/worker/routes/tasks.ts:53-118`).
- `toTaskDto(row: Task): TaskDto` writes every field explicitly so schema drift breaks the build — the pattern any new DTO mapper mirrors (`src/worker/dto.ts:10-25`).
- `requireToken` reads `c.env.API_BEARER_TOKEN` and fails closed when unset — the only existing pattern for a route reading a secret (`src/worker/auth.ts:11-16`).
- `worker-configuration.d.ts` declares only `DB`, `API_BEARER_TOKEN`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. **`GOOGLE_REFRESH_TOKEN` appears nowhere in code**, despite being a provisioned production secret (`worker-configuration.d.ts:4-10`).
- `scheduled()` in `src/worker/index.ts` is an empty stub; no Google polling exists, and this unit adds none.
- No Event or Calendar table exists in `src/worker/db/schema.ts` or `migrations/`; the schema header explicitly defers `events`, `event_exceptions`, `task_events` and `reminders.event_id` to the project's Phase 2 (Calendar) — not to this PRD's phase 2.
- **No existing pattern** in the repo fakes an outbound `fetch` to a third-party API under `vitest-pool-workers` — only D1-backed Hono route tests exist. Establishing one is real phase-2 work.
- `scripts/google-calendar-spike.js` (chore C11) is a throwaway outside `src/`, imported by nothing. It is a reference for the token-exchange shape only.
- **Chore C12, run 2026-08-25 while authoring this PRD:** the refresh token minted 2026-08-11T13:06Z still exchanged for an access token at day 14; `calendarList.list` answered 403 `insufficientPermissions` again; and the next 7 days returned 9 events carrying `start.date`, `start.dateTime` with offset, and one absent `summary`.

---

*Generated: 2026-08-25*
*Approved: 2026-08-25*
*Status: APPROVED*
