---
status: accepted
last_updated: 2026-08-03
review_trigger: "a new decision touches the same topic"
---

# ADR-0006: Model recurrence as a shared rule with per-entity instantiation

> **Purpose:** Record the recurrence model for Tasks (FR-009, Phase 1) and Events (FR-026, Phase 2) — rules, occurrences, exceptions, end conditions and missed-occurrence semantics.
> **Update when:** Never after acceptance — a change of course produces a new ADR that supersedes this one.

- **Date:** 2026-08-03
- **Related:** [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md), [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md); FR-009, FR-011, FR-012, FR-025, FR-026, FR-041

## Context

FR-009 (Task recurrence, Phase 1) and FR-026 (Event recurrence, Phase 2) require a shared recurrence model. The stack is fixed (Workers + D1 + Drizzle; cron-triggered Reminders); scale is one person's life. Domain invariants constrain the design: Tasks carry per-occurrence state (open/done, completed_at, overdue) while Events have no completion state; dated Tasks appear on calendar views (the app's hottest query); FR-007 requires plain filtering by status/dates/priority.

The owner proposed (2026-08-03): a single perpetual template record plus a separate entity recording actual realizations; for Events, possibly one record with the rule plus records for deviations. Research across Todoist, TickTick, Things 3, Taskwarrior, Loop Habit Tracker, Habitica, RFC 5545 and Google Calendar found: (a) no mainstream tool mass-materializes future task rows — Todoist/TickTick keep one live record with an advancing date plus a completion log; Things 3 keeps a template plus at most one live copy; Taskwarrior's template→children materialization is its own documented chronic bug source; (b) fully virtual occurrences with derived state are the most bug-prone variant (Habitica's multi-year history of cron/timezone/retroactive-due bugs); (c) for calendar events, master + RRULE + exception records with on-demand expansion is the universal standard.

The owner additionally decided (2026-08-03, resolving the panel's one open question): **missed occurrences must be recorded, not silently skipped** — "if I keep failing the same tasks while using the app correctly, I must be notified and constantly see my misses; then it is on me to replan or change my behavior. Stale data means the project itself has failed." This became vision principle 6 (honest mirror) and FR-011/FR-012.

## Decision

We will implement recurrence as **one shared rule vocabulary with two instantiation strategies**, following the domain asymmetry between Tasks and Events.

**Shared rule.** A single `recurrence_series` table stores the rule — freq (daily/weekly/monthly/yearly), interval, byweekday, bymonthday, dtstart, IANA timezone (default America/Sao_Paulo), anchor mode (calendar-anchored by default, completion-anchored per series — the Todoist *every* vs *every!* distinction), end conditions (never / until date / count). One shared pure function expands rules to occurrence dates, resolving each occurrence in local time before converting to UTC instants (confining DST handling to one place).

**Tasks (Phase 1) — materialized current occurrence.** The series holds the task template (title, priority, life area, date mode, reminder offsets). Each occurrence is a **real row in `tasks`** (series_id, occurrence_date), under the invariant **at most one open occurrence per active series**, enforced by a unique index. Completing the open occurrence computes the next date, checks end conditions, and inserts the successor with its Reminders resolved to absolute UTC fire times. Deleting the open occurrence skips it. **Missed semantics (owner decision):** when the next occurrence's date arrives and the current one is still open, the cron marks it **`missed` (terminal, system-written)** and materializes the successor — late completion stays possible until superseded, and every skipped cycle leaves a permanent `missed` row. Done + missed rows ARE the owner's realization log: adherence (miss counts, streaks, real completion dates) derives from real rows for free, powering constant miss visibility (FR-011) and repeated-miss notifications (FR-012). The daily cron gains an idempotent sweep repairing any active series lacking an open occurrence.

**Events (Phase 2) — the owner's model, RFC 5545 style.** A recurring Event is exactly **one master row** referencing its series; occurrences are never materialized. An `event_exceptions` table (original_start, cancelled, new_start/new_end) handles "only this" edits; calendar views expand the rule over the visible window via the shared expansion function and merge with dated Task rows. "This and future" edits are deferred to an explicit series split when actually needed. Event Reminders keep a denormalized `next_fire_at` recomputed at three write points, so the cron remains a single indexed scan. No precomputed occurrence cache at this scale (YAGNI — revisit only on measured pain).

## Alternatives considered

- **Owner's Model A applied uniformly (perpetual template + occurrence log for both entities, fully lazy)** — adopted as proposed for Events, where it matches RFC 5545/Google exactly. Rejected for Tasks: with fully virtual pending occurrences, the hottest reads depend on denormalized next-occurrence pointers maintained across every write path, and "what was due" becomes derived state — the bug class documented for years in Habitica's cron. Materializing the single current occurrence keeps the owner's template + realization-log shape while making reads plain SQL.
- **Full materialization for both entities (rolling window of future rows)** — rejected: Taskwarrior is the documented case study of template↔children synchronization as a chronic defect source; the window-regeneration path for Events is the most dangerous code of the model.
- **Rule-only expansion at every query** — rejected: makes FR-007 date filters and the Reminder cron scan impossible as indexed SQL.
- **Occurrence dates as a JSON list on the record** (one of the owner's floated variants) — rejected: not indexable/filterable in SQLite, no per-occurrence metadata.
- **Todoist-style silent skipping (missed dates leave no record)** — the panel's recommended default, **rejected by the owner**: missed occurrences are the signal that powers self-correction; hiding them would break the honest-mirror principle (vision principle 6).
- **Precomputed occurrence cache for Events** (industry hybrid at scale) — deferred, not rejected: negligible benefit at single-user scale; would add a second source of truth without measured need.

## Consequences

- Positive: the shared rule table and single expansion function satisfy the shared-model requirement; every Task read path, the export and the cron scan remain plain indexed SQL; adherence history (done, missed, streaks) derives from real rows at zero extra modeling cost; each entity avoids the other model's worst documented failure mode; DST handling is confined to one pure function; the database stays tiny.
- Negative / accepted trade-offs: two instantiation strategies to understand and test, though they share the rule engine; the Task materializer is a small state machine whose failure modes (dead or duplicated series) require the unique index and the idempotent daily sweep as non-optional mitigations; the missed-marking cron writer is Phase 1 scope accepted explicitly by the owner (it exists to serve FR-011/FR-012); Event Reminders rely on one denormalized pointer with three recompute points; "this and future" Event edits and per-occurrence Event links are deferred; series template edits propagate only to the open non-detached occurrence — historical rows keep the values they had when closed.
