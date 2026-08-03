---
status: active
last_updated: 2026-08-03
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

## Resource constraints

| ID | Constraint | Current value |
|---|---|---|
| CON-003 | Time available for the project (hours per week, expected cadence). | About **1 hour/day** (declared by the owner 2026-08-03). Phases and plans must be sliced to fit ~7 h/week of solo work. |
| CON-004 | Money budget (upfront and recurring). | Effectively ~zero: while resolving decision 1 (2026-08-03, [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)) the owner declined both one-time hardware (~R$550–700) and a ~R$25/month VPS. A formal ceiling remains TBD — pending owner input. |

## Personal principles as constraints

> Confirmed by the owner on 2026-08-03 — these principles are hard constraints.

| ID | Constraint | Consequence for decisions |
|---|---|---|
| CON-005 | Personal data stays under the owner's control. | Any alternative in which a third party holds the only copy of the data, or can read it without explicit revocable consent, is eliminated. Measured by QA-001 in [quality-attributes.md](quality-attributes.md). Shaped decision 1, resolved by [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md). |

> Interpretation recorded 2026-08-03 ([ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)): a provider-readable managed database (Cloudflare D1) is accepted under CON-005's "explicit, revocable consent" clause — the owner consented explicitly, the provider never holds the only copy (automated local snapshots are a binding safeguard), and exit is guaranteed by the day-1 export.
| CON-006 | Maintenance must be sustainable by one person indefinitely. | Any alternative requiring ongoing operational babysitting, paid renewal rituals, or expertise the owner does not intend to maintain is eliminated. Measured by QA-002 and QA-004 in [quality-attributes.md](quality-attributes.md). |
