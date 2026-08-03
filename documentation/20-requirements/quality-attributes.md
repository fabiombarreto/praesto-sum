---
status: active
last_updated: 2026-08-03
review_trigger: "the owner validates or reorders these priorities, or an architectural decision is evaluated against a scenario here"
---

# Quality Attributes

> **Purpose:** The qualities the system must have, as verifiable `QA-nnn` scenarios that every architectural decision is tested against.
> **Update when:** The owner validates or reorders the priorities, a scenario proves unverifiable in practice, or a decision reveals a missing attribute.

## How to read this document

- Every quality attribute has a stable ID `QA-nnn` (see [documentation-guidelines](../00-meta/documentation-guidelines.md)). IDs are never reused.
- A quality attribute is **never an adjective** ("fast", "secure", "simple") — adjectives cannot be argued with or tested. Each one is a concrete scenario:
  - **Stimulus** — something happens.
  - **Response** — how the system (or project) reacts.
  - **Measure** — the verifiable threshold that says whether the response is good enough.
- When choosing between technical alternatives, run each alternative through these scenarios. An alternative that fails a scenario needs an explicit trade-off recorded as an ADR in [60-decisions/index.md](../60-decisions/index.md).

## Prioritized attributes

> Validated by the owner on 2026-08-03. The scenarios held through decisions 1–3 ([ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md)..[0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md)); every future decision must satisfy them.

### QA-001 — Privacy and data ownership

- **Stimulus:** The owner asks: "where is my personal data, and can I take all of it with me right now?"
- **Response:** All personal data lives where the owner controls it, and can be fully exported without the application's help beyond an export command.
- **Measure:** 100% of personal data is exportable to an open, documented format (see FR-042 in [functional-requirements.md](functional-requirements.md)); no third party can read the data without the owner's explicit, revocable consent.

### QA-002 — Operational simplicity

- **Stimulus:** The owner returns to the assistant after four weeks of not touching it at all.
- **Response:** The assistant works exactly as before, with no maintenance having been performed in the interim.
- **Measure:** Zero scheduled maintenance actions are required for routine use; getting the assistant running again takes at most one action (one command, one click, or opening one address).

### QA-003 — Low or zero running cost

- **Stimulus:** A month of normal use passes.
- **Response:** The assistant incurs recurring cost only where a deliberate decision accepted it.
- **Measure:** Baseline target is zero recurring cost per month; any alternative that introduces a recurring cost requires an ADR recording the amount and why it is worth paying. (Owner's actual budget ceiling: TBD — pending owner input; see [constraints.md](constraints.md).)

### QA-004 — Sustainability for a solo maintainer

- **Stimulus:** After three months without touching the code, the owner wants to make a small change on a freshly set up machine.
- **Response:** The documented setup and the codebase are enough to ship the change alone — no other person, no lost tribal knowledge.
- **Measure:** From clean machine to running dev environment in at most 1 hour by following [dev-environment.md](../40-engineering/dev-environment.md); the change is shipped without help from anyone else.

## What we deliberately do NOT prioritize

> Validated by the owner on 2026-08-03. Recording these prevents accidentally paying for qualities nobody asked for.

| Not prioritized | Why |
|---|---|
| Multi-user support | Exactly one user by definition — see [vision](../10-product/vision.md). No accounts, roles or permissions. |
| High scale | The data volume is one person's life. Design for thousands of records, not millions. |
| High availability | If the assistant is briefly unavailable, the owner waits or restarts it. No redundancy, no failover, no SLA. |
