---
status: draft
last_updated: 2026-08-03
review_trigger: "the owner validates the draft principles, or a Life Area is added, removed or rescoped"
---

# Vision

> **Purpose:** State why the project exists — the problem, the desired end state, the principles and the boundaries that anchor every scope decision.
> **Update when:** The owner validates or changes any principle, a Life Area moves between now/later/never, or a non-goal is added or dropped.

## Problem

Personal organization tends to end up scattered across separate tools: a calendar app for events, one or more task apps for to-dos, plus ad-hoc notes and reminders in between. Each tool holds a fragment of the picture; none holds the whole of it. The result is duplicated entries, things falling through the cracks between tools, and the person adapting their habits to each tool's model instead of the tools adapting to the person.

- Owner's specific pains: TBD — pending owner input
- Owner's current tools and workflows: TBD — pending owner input

## Vision

One assistant, built and owned by its single user, that organizes the whole of that user's personal life in one place. It starts with the calendar and the task list — the two fragments most people already juggle — and grows, one Life Area at a time, into the single trusted view of everything the owner needs to keep their life organized. The owner's data stays under the owner's control, and the assistant bends to the owner's way of living rather than the other way around. That promise gives the project its name: **Praesto Sum** — Latin for "I am ready, at your service" ([ADR-0002](../60-decisions/ADR-0002-name-the-project-praesto-sum.md)).

## User and context of use

There is exactly one user: the owner, who is also the developer. There are no other users, roles or permission levels, and none are planned.

- Devices, places and moments of use: TBD — pending owner input
- Frequency and rhythm of use: TBD — pending owner input

## Product principles

> Draft pending owner validation.

1. **Simplicity over completeness** — a small set of features that work every day beats a large set that mostly sits idle. Every addition must justify its ongoing cost.
2. **Owner's data under owner's control** — the owner decides where the data lives, in what format, and who (if anyone) else can reach it. Resolved for storage in [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md): canonical data in Cloudflare D1 by explicit consent, with mandatory local export snapshots.
3. **Sustainable for one person to maintain** — a solo developer must be able to understand, fix and evolve the whole system indefinitely. Complexity that one person cannot carry is out.
4. **The assistant adapts to the owner, not the opposite** — the domain model and the workflows follow how the owner actually lives; the owner never reshapes habits to fit the tool.

## Life Areas

A **Life Area** is a domain of personal life the assistant organizes (see the [glossary](glossary.md)).

| Horizon | Life Areas | Notes |
|---|---|---|
| Now | Calendar, Tasks | The starting scope of the project. |
| Later | TBD — pending owner input | Candidates to be proposed and validated by the owner. |
| Never | TBD — pending owner input | Explicit exclusions, recorded so they are not re-litigated. |

## Explicit non-goals

> Draft pending owner validation.

- **Multi-user support** — the assistant serves exactly one person. No accounts, sharing or collaboration features.
- **Commercial product** — this is not built to be sold, marketed or offered to others; decisions never trade the owner's needs for market appeal.
- **Scale** — no engineering effort is spent supporting more load, users or data volume than one person's life produces.

## Success criteria and failure signals

TBD — pending owner input.

The obvious candidate success criterion is **daily real use**: the assistant becomes the place the owner actually organizes their days, replacing the scattered tools described in the problem statement. Its mirror failure signal would be the owner drifting back to the old tools. Concrete, measurable criteria remain to be defined by the owner.
