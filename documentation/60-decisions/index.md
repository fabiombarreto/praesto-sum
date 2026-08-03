---
status: active
last_updated: 2026-08-03
review_trigger: "an ADR is created or changes state, or a pending decision is added, reordered or resolved"
---

# Decisions Index

> **Purpose:** Single index of all decision records (ADRs) and the ordered queue of technical decisions still pending.
> **Update when:** A new ADR is created, an ADR changes state, or a pending decision is added, reordered or resolved.

## How decisions work here

One file per decision, named `ADR-nnnn-short-kebab-title.md` and copied from [adr-template.md](../00-meta/templates/adr-template.md). ADRs are append-only: an accepted ADR is never edited, and a superseded one is never deleted — a change of course produces a new ADR that marks the old one `superseded`. ADR states: `proposed | accepted | superseded`.

## Pending decisions queue

The order is deliberate: the data posture constrains the interface, and both constrain the stack.

| # | Topic | Why it comes at this position | Blocks what |
|---|---|---|---|
| 1 | Data storage & ownership posture (local-first vs cloud, data format) | First because privacy and data-ownership principles constrain everything downstream | Interface type, tech stack |
| 2 | Interface type (CLI, web, desktop, mobile) | Defines how the owner interacts with the assistant daily | Tech stack |
| 3 | Programming language & tech stack | Falls out of decisions 1 and 2 | Start of implementation |
| 4 | External calendar integration posture (e.g. Google Calendar sync now vs later) | Trade-off of privacy × convenience — the owner arbitrates; can be decided after the MVP scope is set | Calendar-sync requirements and integration design |

## Decisions index

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-write-all-artifacts-in-english.md) | Write all artifacts in English | accepted | 2026-08-02 |
| [ADR-0002](ADR-0002-name-the-project-praesto-sum.md) | Name the project Praesto Sum | accepted | 2026-08-03 |
