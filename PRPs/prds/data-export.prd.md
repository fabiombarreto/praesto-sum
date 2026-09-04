# Data Export (unit 5 `data-export`)

```
**Decision Gate**
- Active context: none
- Activated criteria: cross-cutting artifact (a wire format eleven future units inherit); new API route; handling of credential-bearing tables; a durable file format the owner must be able to read years from now; domain rules (tasks, reminders, life-areas)
- Decisions found:
  - ADR-0003 — single canonical copy in D1, and the safeguards it names as *binding* in exchange: "day-1 JSON+iCalendar export; automated local snapshots". This unit is that clause, arriving late and deliberately (see Problem Statement).
  - ADR-0005 — types originate in `src/worker/db/schema.ts` and flow outward; `src/worker/dto.ts` is the single mapping point; exact version pins.
  - ADR-0008 — test-first for everything on the automated side. Serialization is decidable and therefore test-first, not manually verified.
  - ADR-0009 — the download control's visible copy is pt-BR; the exported file's own keys, and every identifier around them, stay English.
  - ADR-0007 — Google is the source of truth for events and Praesto persists nothing about them. The export therefore cannot contain Google events, only the calendar *selection*.
  - `docs/decisions.md` 2026-08-12 correction — FR-043 is scheduled in this unit, not unscheduled; leaving it unscheduled "would have contradicted ADR-0003, which treats automated snapshots as binding".
  - `src/worker/db/schema.ts:328-333` — the refresh token "is excluded from the FR-042 export — an export carrying a live credential would make every backup file a credential." Written by unit 4's consent-and-credential phase, before this PRD existed; this PRD inherits it rather than re-deciding it.
- Applicable anti-patterns:
  - **Syncing the live database file** (`docs/anti-patterns.md:19-25`) — naive copies under WAL are silently corrupt. Its stated remedy is verbatim this unit: "Consistent snapshots only (export command / scheduled snapshot job shipping to the owner's PC)." Both halves are phases here.
  - **Hand-duplicated entity types** (`:91-97`) — the dump must derive its shape from the Drizzle schema, never from a parallel hand-written list of columns.
  - **Weakening tests to force green** (`:121`) — the completeness guard is precisely the kind of test a future change is tempted to relax; AC-4 exists to make relaxing it visible.
  - **Portuguese in artifacts** (`:105`) — inverted by ADR-0009 only for the button's visible label; the JSON keys, the `.ics` properties and the test names stay English.
- Applicable architectural rules:
  - One Worker serves everything; `app.use("/api/*", requireToken)` runs before every mount, so a route under `/api/` is authenticated by construction (`src/worker/index.ts:16-38`).
  - `src/shared/` carries no DOM and no Worker globals and reads no clock — the serializers live there and receive their instant.
  - Free plan: 10 ms CPU and 50 subrequests per invocation. A whole-database dump is the first request in this project whose cost scales with the owner's accumulated life rather than with one screen.
- Result: PROCEED
```

## Problem Statement

Every row the owner has — tasks, their dates, their recurrence series, his life areas — exists in exactly one place: a Cloudflare D1 database he does not host and cannot copy. There is no export route in the Worker today (`/api/health`, `/api/tasks*`, `/api/google/*` is the whole surface), so the only way out is `wrangler d1 export` from an authenticated dev machine, producing SQLite-dialect SQL rather than a documented format, and reachable from neither the phone nor a scheduled job. ADR-0003 accepted that single-copy design *conditionally*, naming a JSON + iCalendar export and automated local snapshots as binding safeguards; until they exist, the ADR's own terms are unmet.

## Evidence

- `src/worker/index.ts:16-38` mounts exactly three route groups. A repo-wide search for export-adjacent terms (`Content-Disposition`, `attachment`, `dump`, `backup`, `VCALENDAR`) returns zero implementation hits — the premise was confirmed, not assumed.
- ADR-0003's decision line names the safeguards without hedging: "Binding safeguards: day-1 JSON+iCalendar export; automated local snapshots; no offline write queue without a superseding ADR; token on every route."
- `docs/anti-patterns.md:19-25` forbids replicating the live database file and prescribes this unit as the alternative, citing sqlite.org's corruption documentation.
- The roadmap's own note on this unit's position: units 1–4 held reproducible test rows, so the safeguard "would protect nothing while delaying a usable app by three weeks. This is the last place where export is still cheap and the first where it already protects something irreplaceable."
- Chore C10 fired early on 2026-08-12 because the API token was exposed in a screenshot. Credential material in this project has already leaked once through an ordinary channel — which is the standing evidence behind this PRD's exclusion rules.
- Google's Data Portability policy requires OAuth refresh tokens to be "encrypted at rest" and treats them as infrastructure credentials; exporting them is not a scenario the policy contemplates at all (https://developers.google.com/data-portability/policy).

## Proposed Solution

One authenticated `GET /api/export` returns a self-describing JSON document containing every row of the five data-bearing tables, and a companion `.ics` of the owner's dated Tasks as all-day `VEVENT`s. Three infrastructure tables are excluded by name and by written reason, and a completeness test enumerates the Drizzle schema and fails when a table appears in neither the dump nor the exclusion list — so the guard cannot be silently disarmed by the first legitimate exclusion. A download control on the existing `/settings` screen makes it one tap; a local script plus a Windows Scheduled Task pulls the same route weekly to the owner's PC, discharging FR-043 and absorbing chore C5. The alternative — dumping raw rows and filtering later — was rejected because it puts credential material in the response body first and removes it second.

## Key Hypothesis

We believe a documented JSON dump plus a readable `.ics`, produced on demand and pulled automatically to the owner's own PC, will remove Cloudflare's status as the single point of loss for the owner's personal data.
We'll know we're right when chore C6 rebuilds a throwaway D1 from a snapshot and the per-table row counts match the source.

## What We're NOT Building

- **Import / restore into the running app** — the safeguard is a readable copy, not a round trip. C6 proves the restore out of band, with `wrangler d1 execute` against a throwaway database. An in-app importer is a write path over the owner's real life and deserves its own unit if it is ever wanted.
- **Google events in either file** — ADR-0007 makes Google the source of truth and Praesto persists nothing about events. Only `google_calendar_selections` (which calendars are chosen) is the owner's datum. This is why the `.ics` is Tasks-only today; it grows in unit 14 when local Events exist.
- **Encryption of the export file** — the dump carries no credential by construction (see the exclusion rules), so encrypting it protects tasks and dates, and would cost the "readable outside the app" property that is the entire point.
- **Any filtering, paging or date-windowing of the dump** — "100% of the data" means every row of every included table, `done` and `missed` rows included.
- **A second export format (CSV, SQL, Markdown)** — JSON for completeness, `.ics` for the one thing another program can consume. A third format is a maintenance cost with no named consumer.
- **`VTODO` output** — see Architecture Notes; the decision is recorded there with its cost.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Schema tables covered by the completeness guard | 8 of 8 (5 dumped + 3 excluded with reasons) | The guard test enumerates `src/worker/db/schema.ts` and fails on any table in neither list |
| Restore proved | 1 | Chore C6: rebuild a throwaway D1 from a snapshot, compare row counts per table |
| Unattended snapshots landing on the owner's PC | 1 per week, ≥ 4 consecutive | The dated files present in the snapshot directory a month after phase 4 ships |
| Credential strings in any produced artifact | 0 | AC-3: the response body is searched for the stored refresh token and the push keys |

## Acceptance Criteria (test scenarios)

- **AC-1 The route is authenticated by construction:** Given the Worker is running, when `GET /api/export` is called without an `Authorization: Bearer` header, then the response is 401 and carries no body content from the database.
- **AC-2 Every data-bearing table is present:** Given a database seeded with at least one row in each of `life_areas`, `recurrence_series`, `tasks`, `reminders` and `google_calendar_selections`, when the export is fetched, then the document contains a key for each of the five tables and each contains the seeded row.
- **AC-3 No credential material leaves the Worker:** Given a database holding a `google_connections` row whose `refresh_token` is a known sentinel string and a `push_subscriptions` row with known `p256dh`/`auth` sentinels, when the export is fetched, then the serialized response text contains none of those three sentinel strings and has no key for any of the three excluded tables.
- **AC-4 The completeness guard cannot be silently disarmed:** Given the exported table list and the exclusion list, when the guard test enumerates every table exported by `src/worker/db/schema.ts`, then any table present in neither list fails the test by name — and each exclusion carries a non-empty written reason, so an empty reason fails too.
- **AC-5 The document describes itself:** Given any export, when it is opened by a reader who has never seen the app, then it carries a format version, the instant it was generated, the IANA timezone the app's calendar days are expressed in (`America/Sao_Paulo`), and the list of excluded tables with their reasons.
- **AC-6 The download names itself by date:** Given an authenticated request, when the export is fetched, then the response carries `Content-Disposition: attachment` with a filename containing the generation date, and `Content-Type: application/json`.
- **AC-7 The `.ics` is minimally valid:** Given at least one dated Task, when the `.ics` is fetched, then it opens with `BEGIN:VCALENDAR`, carries `VERSION:2.0` and a `PRODID`, and every component carries a `UID` and a `DTSTAMP`, with CRLF line endings per RFC 5545.
- **AC-8 Dated Tasks become all-day events; undated ones are absent:** Given three Tasks — one with a `deadline`, one with a `scheduledDate`, one with neither — when the `.ics` is fetched, then it contains exactly two `VEVENT` components, each with `DTSTART;VALUE=DATE` equal to that Task's date, and the undated Task appears nowhere.
- **AC-9 One tap from the settings screen:** Given the owner is on `/settings` with a valid token, when he activates the download control, then the browser receives the export as a file download and the screen shows no error state.
- **AC-10 The unattended pull fails loudly:** Given the snapshot script runs with a wrong or missing API token, when it completes, then it exits non-zero and writes no file — so a silently broken backup cannot masquerade as a working one by leaving yesterday's file in place.
- **AC-11 The snapshot is dated and does not overwrite:** Given the snapshot script runs on two different days, when the second run completes, then both files exist, each named by its own date.

## Open Questions

- [ ] **One endpoint or two for the `.ics`?** `GET /api/export` (JSON) and `GET /api/export.ics` is the obvious shape, but a single endpoint content-negotiating on `Accept` is fewer routes. Deferred to the phase-1 plan; the acceptance criteria are written to hold either way.
- [ ] **Where does the Scheduled Task keep the API bearer token?** A plain script file, a Windows credential store, or an environment variable on the task itself. This is the unit's sharpest residual risk and is deliberately left to phase 4's plan, where it can be researched against Windows specifics rather than guessed now.
- [ ] **What is the real dump size and CPU cost?** Nothing in the repo documents the free plan's response-size ceiling, and the owner's row count is unmeasured. Phase 1 measures it against real production data and records the number; the C11 spike's 4.45 ms for 401 Google events suggests the owner's scale is far from the 10 ms limit, but that measured a different workload.
- [ ] **Does the `.ics` need a stable `UID` across exports?** RFC 5545 requires a `UID`; using the Task's own id makes re-imports idempotent in clients that de-duplicate, which may be desirable or may be surprising. Decided in phase 2.

---

## Users & Context

**Primary User**
- **Who:** The owner — the single user of Praesto, and its developer, on a Windows PC and an Android phone.
- **Current behavior:** He has begun moving his scattered notes into the app now that units 1–4 have shipped. He has no copy of any of it.
- **Trigger:** Two moments, one deliberate and one feared. The deliberate one is now: unit 6 makes the app an autonomous writer, and he wants the safeguard in place before something writes without him watching. The feared one is an account loss, a billing lapse, or a migration that corrupts a table.
- **Success state:** A dated `.json` on his own PC, readable in any text editor, which he did not have to remember to create.

**Job to Be Done**
When I have moved my life into Praesto, I want a complete and readable copy of it outside Praesto, so that neither Cloudflare nor my own mistake can be the end of it.

**Non-Users**
Nobody else — this is a single-user app with no accounts. It is explicitly not a compliance or data-subject-access feature: there is no second party with a right to request anything. It is also not for other people's data; nothing here contemplates importing or exporting on behalf of anyone but the owner.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `GET /api/export` returning every row of the five data-bearing tables as documented JSON | FR-042 and ADR-0003's binding safeguard; the whole unit rests on it |
| Must | Named exclusion of `google_connections`, `push_subscriptions` and `oauth_states`, each with a written reason | `schema.ts:328-333` already commits to the first; the other two carry delivery credentials and dead nonces, and an unreasoned exclusion is indistinguishable from an oversight |
| Must | A completeness guard that fails when a schema table is in neither the dump nor the exclusion list | The unit's exit signal names it; without the exclusion half, the first legitimate exclusion disarms it permanently |
| Must | A self-describing envelope: format version, generation instant, timezone, exclusion list | "Documented format" is in FR-042's own wording; a bare table dump documents nothing |
| Must | `.ics` of dated Tasks as all-day `VEVENT`s | FR-042's iCalendar half, per ADR-0003 |
| Must | A download control on `/settings` | "One click" is the unit's stated outcome; the settings screen shipped with unit 4's final phase (`09ebdd53`, 2026-08-31) |
| Should | Automated weekly snapshot to the owner's PC (script + Windows Scheduled Task) | FR-043, `Should` in MoSCoW; absorbs chore C5, whose trigger is "the same week as unit 5, never later" |
| Won't | In-app import/restore | Out of scope above; C6 proves the restore out of band |
| Won't | `VTODO` components | Google Calendar and Outlook ignore `VTODO` on import; see Architecture Notes |
| Won't | Encryption of the export at rest | The file carries no credential by construction; encrypting it would cost readability for no threat it faces |

### MVP Scope

Phases 1–3: the route, the two serializers, the guard, and the button. That is the full `Must` set and validates the hypothesis — the owner can obtain a complete readable copy on demand. Phase 4 (the unattended pull) is FR-043's `Should` and turns a capability he must remember to use into one that happens without him.

### User Flow

**On demand:** open `/settings` → *Baixar meus dados* → the browser saves `praesto-YYYY-MM-DD.json`. The `.ics` is offered the same way.

**Headless:** `curl -H "Authorization: Bearer <token>" https://<host>/api/export -o praesto-$(date +%F).json` — the same route, no UI, which is what phase 4's script uses.

**Unattended:** a Windows Scheduled Task runs that script weekly into a snapshot directory on the owner's PC; a failed run exits non-zero and writes nothing.

---

## Technical Approach

**Feasibility:** HIGH

### TDD routing

Current value of `tdd` in `docs/context/methodology.md`: **true**. Test-first ordering — the test pair (test-writer/test-reviewer) produces the initial test suite from the Acceptance Criteria above, before the Implementer runs.

The split this project always applies still holds: the serializers and the guard are decidable and go to `src/shared/` authored test-first; the settings button is React glue and is verified manually per `docs/context/methodology.md`, as every screen has been. Phase 4's script is neither — it is a Windows-side artifact, verified by running it and by AC-10/AC-11 against a real failure.

### Architecture Notes

- **The `.ics` emits `VEVENT`, not `VTODO`, and that is a deliberate loss.** Praesto's Tasks are semantically to-dos, and RFC 5545's `VTODO` is the correct component — it is also cheaper, requiring only `UID` and `DTSTAMP` and permitting an undated item. But component support is left to each application by the RFC, and both Google Calendar and Outlook silently ignore `VTODO` on import (https://groups.google.com/g/tasks-backup/c/YVUSYThNtl8). The owner lives in Google Calendar; a semantically correct file that opens empty for him fails the only purpose the file has. So a dated Task becomes an all-day `VEVENT` with `DTSTART;VALUE=DATE`, and the file says so in a comment property so a future reader is not misled into thinking these were appointments.
- **The dump derives its shape from the Drizzle schema, never from a hand-written column list** — the anti-pattern at `docs/anti-patterns.md:91-97` applies directly. Whether that means reflecting over the schema module's exports or `getTableConfig` is the plan's call, but a parallel list of columns maintained by hand is the one shape ruled out.
- **Exclusion is by table today, not by column.** All three excluded tables are wholly infrastructural, so no data is lost by dropping them entirely, and a table-level rule is one the guard can state and check. If a future table ever mixes owner data with credential material in one row, the rule becomes column-level then, deliberately.
- **The serializers take their instant rather than reading the clock**, like every other module in `src/shared/` (`dates.ts`, `day-item.ts`, `agenda.ts`). `PRAESTO_TIMEZONE` is the single place the timezone is named and the envelope quotes it rather than restating it.
- **Calendar days stay calendar days.** `deadline`, `scheduledDate` and `occurrenceDate` are `YYYY-MM-DD` text and are exported verbatim; genuine instants (`createdAt`, `completedAt`, `fireAt`) are epoch seconds, matching the `toEpochSeconds` convention `src/worker/dto.ts` already established. The envelope documents which is which so the distinction survives the app.

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The Scheduled Task must hold the API bearer token on the owner's PC to call the route — the same exposure class that already fired chore C10 once | H | Phase 4 researches the Windows-specific options (credential store vs. restricted-ACL file vs. task-level environment variable) and records the choice with its reason; the token remains rotatable, and C10's rotation procedure already exists and has been executed once |
| The whole-database dump exceeds the free plan's CPU or response-size ceiling as the owner's data accumulates | M | Phase 1 measures against real production data and records the number rather than assuming; if it ever bites, the documented fallback is a per-table streamed response, which the envelope's shape already permits without a format change |
| The `.ics`'s all-day `VEVENT`s are re-imported into Google Calendar and pollute the real calendar with former to-dos | M | The file is an export, not a sync — stated in the file itself via a comment property and in the settings copy. Unit 15 owns writing to Google, and nothing here writes anything |
| The completeness guard is relaxed rather than satisfied when a future table is added under time pressure | M | AC-4 requires each exclusion to carry a non-empty reason, so disarming the guard means writing a false justification rather than deleting a line; `docs/anti-patterns.md:121` and R-X already make weakening tests a reviewable event |

---

## Implementation Phases

| # | Phase | Description | Status | Repo | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|------|----------|---------|----------|
| 1 | The dump and its guard | `GET /api/export`, the five-table JSON document, the self-describing envelope, the named exclusion constant with reasons, and the schema-enumerating completeness test. Measures the real dump size and CPU against production data and records it. AC-1..AC-6 | pending | - | - | - | - |
| 2 | The calendar file | The `.ics` serializer as a pure module in `src/shared/`: dated Tasks to all-day `VEVENT`s, RFC 5545 minimums, CRLF, the UID decision. AC-7, AC-8 | pending | - | - | 1 | - |
| 3 | The button | The download control on the existing `/settings` screen, in the layout standard's settings anatomy, with the pt-BR copy and the §8 failure state. Runs the mandatory UI/UX review checklist. AC-9 | pending | - | - | 2 | - |
| 4 | The unattended copy | The local pull script and its Windows Scheduled Task, writing dated snapshots to the owner's PC, failing loudly and writing nothing when the token is wrong. Discharges FR-043 and absorbs chore C5. AC-10, AC-11 | pending | - | - | 2 | - |

#### Phase-status lifecycle

This table IS relay's canonical phase-state machine (`docs/decisions.md`, 2026-05-04) — there is no separate state file. Every row starts at `pending` and advances through `pending` → `in-progress` → `implemented` → `tested` → `complete`, never skipping backwards. `tested` is skipped, never faked, when nothing was tested. A dependency is satisfied from `implemented` onward. `complete` does not mean "merged". To re-run a phase, hand-edit its `Status` cell back to `pending`.

### Phase Details

**Phase 1: The dump and its guard**
- **Goal:** A complete, documented, credential-free copy of the database reachable with one authenticated request.
- **Scope:** The route and its mount; the five-table document; the envelope (format version, generated instant, timezone, exclusion list with reasons); the exclusion constant; the schema-enumerating guard test; `Content-Disposition` with a dated filename; a recorded measurement of the real dump's size and CPU cost.
- **Success signal:** AC-1 through AC-6 pass, and a `curl` against production writes a file the owner can open and read whose content he recognizes as his own.

**Phase 2: The calendar file**
- **Goal:** The dated half of the owner's data readable by a calendar program he already uses.
- **Scope:** A pure serializer in `src/shared/`; all-day `VEVENT` from `deadline ?? scheduledDate`; `VERSION`, `PRODID`, per-component `UID` and `DTSTAMP`; CRLF; the explicit note in the file that these were to-dos; the UID-stability decision.
- **Success signal:** AC-7 and AC-8 pass, and the produced file imports into Google Calendar showing the owner's dated Tasks on their correct days.

**Phase 3: The button**
- **Goal:** The export stops requiring a terminal.
- **Scope:** The download control on `/settings`, its pt-BR copy, its failure state per guidelines §8, and the mandatory UI/UX review checklist run and pasted.
- **Success signal:** AC-9 passes, verified on both the Windows PC and the Android phone, with the checklist result recorded.

**Phase 4: The unattended copy**
- **Goal:** The safeguard stops depending on the owner remembering it.
- **Scope:** The pull script; its token handling, chosen and justified; the Windows Scheduled Task; dated non-overwriting output; loud failure. Discharges FR-043 and absorbs chore C5. **Depends on phase 2, not phase 3:** the script is headless and pulls both files from the routes; the settings button is irrelevant to it, so making it wait on phase 3 would serialize the plan for no reason.
- **Success signal:** AC-10 and AC-11 pass, and two consecutive weekly snapshots exist on the owner's PC that nobody triggered by hand.

---

## Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| `.ics` emits all-day `VEVENT`, not `VTODO` | `VTODO` is semantically correct and cheaper, but Google Calendar and Outlook ignore it on import and the owner lives in Google Calendar. A correct file that opens empty fails the file's only purpose. The loss is recorded in the file itself | 2026-09-03 |
| The dump excludes `google_connections`, `push_subscriptions` and `oauth_states` | The first was already excluded by `schema.ts:328-333` before this PRD existed — "an export carrying a live credential would make every backup file a credential". The second holds delivery credentials belonging to a device rather than to the owner; the third holds single-use nonces the schema itself calls worthless once consumed | 2026-09-03 |
| The completeness guard uses an explicit, reasoned exclusion list rather than an inclusion list | An inclusion-only check passes forever once written, which is the exact failure mode the unit's exit signal names. Requiring every table to be in one list or the other keeps the decision mandatory while making it non-silent | 2026-09-03 |
| FR-043 enters this PRD as phase 4 rather than remaining chore C5 | Owner's decision, against the recommendation to keep machine configuration outside an application PRD. Consequence recorded: the unit's estimate rises from 3 to ~5 days of 1 h, still under the roadmap's ~10-day ceiling, so the unit is not split (roadmap rule 7); chore C5 becomes absorbed by this unit rather than running beside it | 2026-09-03 |
| Foundation and deep-dive answers carried from the roadmap and requirements rather than re-elicited | The unit's outcome, FRs, dependencies, estimate and exit signal were already owner-validated in `documentation/50-planning/roadmap.md`; the writer restated them for confirmation instead of asking them fresh, and the owner confirmed | 2026-09-03 |

## Research Summary

**Market Context**

- Both Google Calendar and Outlook read only `VEVENT` from an imported `.ics` and silently ignore `VTODO`; RFC 5545 leaves component support to each application, and most mainstream clients implement `VEVENT` only (https://groups.google.com/g/tasks-backup/c/YVUSYThNtl8). This finding inverted the unit's default design.
- RFC 5545 `VTODO` requires only `UID` and `DTSTAMP`; `DUE` and `DURATION` are optional and mutually exclusive, and a date-less `VTODO` is valid — flexibility `VEVENT` lacks (https://icalendar.org/iCalendar-RFC-5545/3-6-2-to-do-component.html).
- Google's Data Portability policy requires OAuth access and refresh tokens to be kept "encrypted at rest" and to request minimum permissions, treating tokens as infrastructure credentials rather than portable user data; token export is not a contemplated scenario (https://developers.google.com/data-portability/policy).
- Bitwarden — whose product *is* portable secrets — exports plaintext by default but instructs users to "delete the file immediately after use" and warns that some exported secrets are unsuitable as long-term backups, showing that "includes the secret" and "is a safe backup" are separate guarantees (https://bitwarden.com/help/export-your-data/).
- **Gaps, recorded rather than papered over:** no citable statement was found confirming Google Takeout omits OAuth credentials (the absence of such a category is suggestive, not documented); Apple Calendar's and Thunderbird's `VTODO` import behaviour was not confirmed against a primary source; no security guidance was found addressing the narrow case of writing a long-lived refresh token into an automated export job; and no source addressed `DATE` vs `DATE-TIME` handling specifically for `VTODO` due dates. The first and third gaps do not affect this PRD's decisions, both of which rest on the schema's own pre-existing rule.

**Technical Context**

- No export, dump, backup, `Content-Disposition` or `.ics` code exists anywhere in the repository — confirmed by search, not assumed.
- `app.use("/api/*", requireToken)` is applied before every route mount, so a route under `/api/` is authenticated by construction; `/oauth/callback` is the only unauthenticated route and is deliberately outside that prefix (`src/worker/index.ts:16-38`, `src/worker/auth.ts:11-26`).
- `src/worker/dto.ts` writes every field explicitly "so that schema drift becomes a compile error instead of a runtime surprise", and converts instants with `toEpochSeconds`. Any export dumping rows verbatim bypasses that discipline and reintroduces the credential risk the schema comment names.
- `PRAESTO_TIMEZONE = "America/Sao_Paulo"` (`src/shared/dates.ts:22`) is the single place the timezone is named; calendar days are `YYYY-MM-DD` text and instants are epoch-second integers — the distinction the envelope must document.
- No schema-enumerating or reflective test idiom exists in `test/`; `test/isolation.ts` imports tables by name. The completeness guard has no precedent here and is written from scratch.
- `wrangler.jsonc` documents no CPU, subrequest or response-size limits — the size risk has no in-repo evidence and is measured in phase 1.

*Generated: 2026-09-03*
*Approved: 2026-09-03*
*Status: APPROVED*
