---
status: active
last_updated: 2026-08-04
review_trigger: "a constraint is challenged by a decision under analysis, or the owner states time or budget limits"
---

# Constraints

> **Purpose:** The hard limits every decision must respect, as stable `CON-nnn` entries — the cheap filter applied before any deeper analysis.
> **Update when:** A constraint is added, challenged or lifted, or the owner fills in a TBD limit.

## How to read this document

- Every constraint has a stable ID `CON-nnn` (see [documentation-guidelines](../00-meta/documentation-guidelines.md)). IDs are never reused; a lifted constraint is marked withdrawn and keeps its ID.
- Constraints are the **cheap filter**: before spending analysis on any alternative (stack, interface, storage, integration), check it against this list. An alternative that violates a constraint is eliminated immediately — no comparison matrix needed.
- Constraints state hard limits; the measurable version of a principle lives as a scenario in [quality-attributes.md](quality-attributes.md). Link, never duplicate.
- Every decision in the pending decisions queue in [60-decisions/index.md](../60-decisions/index.md) must pass this filter first.

## Technical constraints

| ID | Constraint | Consequence for decisions |
|---|---|---|
| CON-001 | Windows is the development environment. | Every tool, runtime and workflow must work first-class on Windows. Anything that assumes Unix-only tooling is eliminated or needs an explicit compatibility layer recorded in an ADR. |
| CON-002 | Exactly one developer: the owner. | No alternative may assume a team — no technology whose learning curve or operational load exceeds what one person sustains alongside daily life. See QA-004 in [quality-attributes.md](quality-attributes.md). |
| CON-007 | Target devices: the owner's phone runs **Android**; the PC runs Windows (CON-001). Declared by the owner 2026-08-04. | Device assumptions must be verified against Android, never inherited from iOS. Two consequences bite immediately: Chrome on Android delivers Web Push **without** the PWA being installed, so home-screen install is an icon and UX choice rather than a prerequisite for FR-041; and adaptive-icon (`maskable`) plus monochrome notification-badge assets are required, not optional. The opposite posture recorded in [ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md)'s consequences was written while the target phone was assumed to be an iPhone — that ADR stays as written (append-only) and its iOS-unreliability revisit trigger is moot in practice. An iPhone entering the picture reactivates it. |

## Resource constraints

| ID | Constraint | Current value |
|---|---|---|
| CON-003 | Time available for the project (hours per week, expected cadence). | About **1 hour/day** (declared by the owner 2026-08-03). Phases and plans must be sliced to fit ~7 h/week of solo work. |
| CON-004 | Money budget (upfront and recurring). | Effectively ~zero: while resolving decision 1 (2026-08-03, [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)) the owner declined both one-time hardware (~R$550–700) and a ~R$25/month VPS. Refined on 2026-08-04 ([ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md)): a domain of the owner's own (~R$50/year) is **authorized** if Google verification requires it; **Cloudflare Workers Paid (US$5/month) is not authorized** — the Google backfill must fit the free plan by construction (bounded initial window, one page per cron tick, persisted cursor). Work that genuinely cannot fit stops and becomes a new decision; it never silently becomes a paid plan. |

## Personal principles as constraints

> Confirmed by the owner on 2026-08-03 — these principles are hard constraints.

| ID | Constraint | Consequence for decisions |
|---|---|---|
| CON-005 | Personal data stays under the owner's control. | Any alternative in which a third party holds the only copy of the data, or can read it without explicit revocable consent, is eliminated. Measured by QA-001 in [quality-attributes.md](quality-attributes.md). Shaped decision 1, resolved by [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md); relaxed a second time by [ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md) — see the interpretation notes below. |
| CON-006 | Maintenance must be sustainable by one person indefinitely. | Any alternative requiring ongoing operational babysitting, paid renewal rituals, or expertise the owner does not intend to maintain is eliminated. Measured by QA-002 and QA-004 in [quality-attributes.md](quality-attributes.md). |

### Interpretation notes on CON-005

> Recorded 2026-08-03 ([ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)): a provider-readable managed database (Cloudflare D1) is accepted under CON-005's "explicit, revocable consent" clause — the owner consented explicitly, the provider never holds the only copy (automated local snapshots are a binding safeguard), and exit is guaranteed by the day-1 export.

> Recorded 2026-08-04 ([ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md)): bidirectional Google Calendar sync is accepted under the same clause, with a **closed mirror inventory** — only **Events** cross to Google; Tasks, Reminders, Life Areas, Task↔Event links, priorities and the `missed` history never leave Praesto, and third-party attendees are never mirrored inward. The inventory is enforced by construction (the mapper has no code path to serialize them), not by policy. Widening it — including the owner's future wish to sync Tasks and Reminders — requires its own ADR. Consent is revocable: disconnecting revokes the token and keeps 100% of local data (FR-030).
