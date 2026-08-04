---
status: accepted
last_updated: 2026-08-04
review_trigger: "a new decision touches the same topic"
---

# ADR-0007: Bidirectional Google Calendar sync for Events, scoped by a closed mirror inventory

> **Purpose:** Record the resolution of pending decision 4 — the external calendar integration posture — its consent record, its limits and its consequences.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-04
- **Related:** [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md), [ADR-0006](ADR-0006-recurrence-model.md); QA-001..QA-004, CON-004, CON-005, CON-006; FR-027..FR-030

## Context

Pending decision 4 was queued as a privacy × convenience trade-off only the owner could arbitrate. On 2026-08-04 the owner arbitrated it: *"I want to sync my Google calendar with this application. This application must be able to read, create, edit and delete data in the Google calendar. Add it to the planning, as early as possible."*

Research (Aug 2026) established the facts that shape this decision:

- **The 7-day refresh token is a publishing-status problem, not a verification problem.** An OAuth app whose consent screen sits in *Testing* is issued refresh tokens expiring in 7 days — which would violate QA-002 outright. Publishing the app removes the expiry; a token then lasts indefinitely provided it is used at least once every 6 months, which a `*/5` cron guarantees trivially.
- **Google documents a personal-use exception to verification** ("if you are the only user of your app"). Its accepted consequences — an unverified-app screen once, and a 100-account cap — are irrelevant here. No Calendar scope is *restricted*; Calendar is merely *sensitive*, so no CASA assessment and no paid annual recertification.
- **Two official pages contradict each other** on whether a sensitive scope may go to production unverified, and no primary 2026 source settles it. Chores C11/C12 settle it empirically before anything is promised.
- **Push notifications (`events.watch`) are rejected**: they need a public unauthenticated route (breaking ADR-0003 safeguard 4), manual channel renewal every ~7 days (a channel that expires silently during the four untouched weeks of QA-002), possibly a verified domain, and Google itself states they are not 100% reliable — so they would not remove the need for polling anyway. Polling on the existing `*/5` cron costs ~288 requests/day against a 1,000,000/day quota.
- **The Cloudflare free plan bites at the backfill**, not at steady state: incremental sync fits comfortably (network wait is not CPU), but the initial import and any 410-GONE recovery must be resumable.

## Decision

We will integrate the owner's Google Calendar **bidirectionally, for Events only**, under a closed mirror inventory.

**Scope (owner's choice A).** `calendar.events` — full CRUD on the owner's real calendars, which is what was asked for. Never `calendar` (which can create and delete whole calendars): that keeps "the app deleted an entire agenda" structurally impossible. The read-only phase uses `calendar.events.readonly` and the upgrade to `calendar.events` happens at an explicit re-consent when write lands.

**Phasing (owner's choice: conservative).** Phase sequencing is preserved: read lands inside Phase 1 as a declared exception (`google-calendar-read`, read-only, creates no new entity, and directly serves Phase 1's exit criterion of becoming the app the owner opens daily); write lands in Phase 2 immediately after the Event entity exists. The owner declined the aggressive path that would have promoted the Event entity above the Phase 1 tail.

**Mirror inventory (closed).** Only **Events** cross to Google. Tasks, Reminders, Life Areas, Task↔Event links, priorities and the `missed` history **never leave Praesto** — and this is guaranteed by construction, not by policy: the mapper has no code path able to serialize them. Third-party attendees are not mirrored inward either (only a `has_guests` flag and a link to open in Google), keeping other people's PII out of D1 and out of the FR-042 export. Extending the inventory — notably syncing Tasks or Reminders, which the owner wants in the future — requires its own ADR.

**Mechanics.** Pull incrementally with Google's own `syncToken` (query parameters frozen alongside the token, `showDeleted=true`, deletions arriving as `status: cancelled`); treat `410 GONE` as routine, recovering by full re-sync **as upsert with zero deletions**. Write with `If-Match: <etag>`, treating `412` as a conflict rather than forcing. Supply a deterministic id on insert so a retried insert returns `409` instead of creating a duplicate. Never mirror Google's own reminders: every pushed Event carries `reminders: { useDefault: false, overrides: [] }`, because double notifications are precisely the "duplicated entries between tools" pain in the problem statement.

**Dirty tracking (a trap closed in advance).** The sync queue is *derived state*, never an outbox table: a row is dirty when `content_hash <> synced_content_hash`. The dirty flag is **never** `updated_at` — the schema's `$onUpdate` also fires when a remote change is applied, which would create an infinite echo, rewriting the owner's agenda every 5 minutes and spamming his phone with Google notifications.

**Conflict policy.** Last-writer-wins **per item**, never per field (field-level merge would require per-field timestamps — the CRDT vocabulary this project rejected). Three hard exceptions: deletion always beats edit (a resurrected event is a fake obligation, the app inventing commitments); a technical tie (<60 s, both sides dirty) is not guessed — local is kept and the owner is asked; and the loser is **never silently discarded** — both snapshots are stored and surfaced with a restore action. This is vision principle 6 (honest mirror) applied to data instead of habits.

**Cost posture (owner's answers).** A **domain of the owner's own** (~R$50/year) is authorized if the C11/C12 spike proves verification is required, since `*.workers.dev` is neither his nor verifiable — the owner already planned to own a domain. **Cloudflare Workers Paid is NOT authorized.** The initial backfill must therefore fit the free plan by construction: a bounded initial window rather than all history, one page per cron tick with a persisted cursor, and no unbounded loop inside a single invocation. If a future need genuinely cannot fit, it stops and becomes a new decision — it never silently becomes a paid plan.

## Alternatives considered

- **Option B — `calendar.events.readonly` + `calendar.app.created`** (Praesto writes only to a calendar it created, structurally unable to touch the main calendar even with a bug). Rejected by the owner: it cannot edit or delete the events already in his Google calendar, which is explicitly part of what he asked for. It remains the documented fallback if write-back ever proves too risky in practice.
- **`calendar` scope** — rejected: it grants creating and deleting whole calendars, a failure class with no upside here.
- **Service account** — rejected: domain-wide delegation exists only in Workspace; a personal Gmail account cannot authorize it.
- **Push notifications via `events.watch`** — rejected for the reasons in Context; polling on the existing cron is cheaper, simpler and does not breach ADR-0003 safeguard 4.
- **Read-only via a secret `.ics` URL** — rejected: it cannot write, so it does not answer the request. Kept as the degraded fallback if the spike shows OAuth cannot be made durable.
- **Aggressive phasing** (Event entity promoted above the Phase 1 tail, bidirectional sync ~6 weeks earlier) — declined by the owner in favour of finishing Phase 1's habit-forming units first.

## Consequences

- Positive: the owner's real commitments appear inside Praesto early and read-only, at zero risk to his calendar; later, Events created in Praesto reach every surface Google already feeds (phone lock screen, car, watch, sharing with other people) without Praesto having to build any of it; the closed inventory keeps the CON-005 relaxation narrow and auditable; using the provider's own `syncToken` and ETag means no change-log, no tombstone table and no vector clock of our own.
- Negative / accepted trade-offs:
  - **Google gains continuous programmatic access to the owner's calendar.** The privacy delta is not the events (they are already in Google) — it is the token, and the standing pressure to widen scope later. The closed inventory and this ADR exist to hold that line. Consent is explicit and revocable: disconnecting revokes the token and keeps 100% of local data (FR-030).
  - **`sync` vocabulary enters a project that rejected sync engines.** See the carve-out below; the boundary is written into `docs/anti-patterns.md` rather than left implicit.
  - **The Event entity must be born sync-aware** — provenance, `all_day`, IANA timezone and a content hash from day one, plus a separate `event_sync_links` table. Retrofitting later would be a migration over the owner's real data.
  - **A recurrence rule Praesto cannot express is never re-serialized.** Real calendars contain `BYSETPOS`, `BYMONTH`, `WKST` and multiple `RDATE`/`EXDATE`; flattening them would destroy the owner's agenda silently and permanently. Such series are stored verbatim and marked read-only in the UI with the reason shown.
  - **Free-plan ceiling is a design constraint, not a discovery.** Backfill is bounded and resumable by construction.
  - **Google may publish Calendar API billing details later in 2026** (announced with at least 90 days' notice). Low practical risk at one person's volume, but named here so it is not a surprise.

## Carve-out: the "no sync engine" anti-pattern

[ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md) states there is deliberately no merge, sync or offline-write logic anywhere in the system, and `docs/anti-patterns.md` forbids CRDTs and custom sync engines. That clause is about **replicating Praesto's own canonical store across the owner's devices** — the problem that thin clients solved. Integrating with an external system a third party already operates is a different problem, and ADR-0003 is not edited (accepted ADRs are append-only). The boundary, binding from here:

- **L1 — Events only.** The mirror inventory above is closed; widening it needs a new ADR.
- **L2 — The provider's mechanisms only.** Google's `syncToken`, `etag` and `status: cancelled` are what we use. Building our own change-log, tombstone table, cursor protocol, vector clock or divergent-version merge remains forbidden.
- **L3 — No queue of our own.** The push set is derived state (`content_hash <> synced_content_hash`), self-healing and logless.

The tripwire: if a future change needs to invent one of the mechanisms in L2, that is the anti-pattern returning, and it stops for a new decision instead of being written.
