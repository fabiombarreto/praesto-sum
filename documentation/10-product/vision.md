---
status: active
last_updated: 2026-08-04
review_trigger: "the owner validates the draft principles, or a Life Area is added, removed or rescoped"
---

# Vision

> **Purpose:** State why the project exists — the problem, the desired end state, the principles and the boundaries that anchor every scope decision.
> **Update when:** The owner validates or changes any principle, a Life Area moves between now/later/never, or a non-goal is added or dropped.

## Problem

Personal organization tends to end up scattered across separate tools: a calendar app for events, one or more task apps for to-dos, plus ad-hoc notes and reminders in between. Each tool holds a fragment of the picture; none holds the whole of it. The result is duplicated entries, things falling through the cracks between tools, and the person adapting their habits to each tool's model instead of the tools adapting to the person.

Owner's specific pains (stated 2026-08-03):

- Forgets appointments — and sometimes forgets to even note them down: capture friction is itself a pain, not just recall.
- Notes and information get lost because the owner cannot remember where they were noted — scattered storage defeats retrieval.
- Google Calendar helps with events, but lacks the flexibility the owner wants.
- Existing tools only *store* information; the owner wants an assistant that helps *organize* it, offers different ways to view the data, correlates information with appointments, and grows/evolves as needs change.

Owner's current tools: Google Calendar for events (helpful but inflexible); notes and information scattered across ad-hoc places.

## Vision

One assistant, built and owned by its single user, that organizes the whole of that user's personal life in one place. It starts with the calendar and the task list — the two fragments most people already juggle — and grows, one Life Area at a time, into the single trusted view of everything the owner needs to keep their life organized. The owner's data stays under the owner's control, and the assistant bends to the owner's way of living rather than the other way around. Keeping information is not enough: capture must be quick, retrieval must be immediate, and the assistant actively helps organize — offering different ways to view the data and to correlate information with appointments, evolving as the owner's needs change. That promise gives the project its name: **Praesto Sum** — Latin for "I am ready, at your service" ([ADR-0002](../60-decisions/ADR-0002-name-the-project-praesto-sum.md)).

## User and context of use

There is exactly one user: the owner, who is also the developer. There are no other users, roles or permission levels, and none are planned.

- Devices: the PC (Windows) and an **Android** phone, through the PWA ([ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md)). The device platforms are a hard constraint — CON-007 in [constraints.md](../20-requirements/constraints.md) — and they matter: ADR-0004's iOS consequences were written before the phone was known.
- Places and moments of use: TBD — pending owner input
- Frequency and rhythm of use: daily — the owner intends to use the assistant every day and expects it to proactively notify them throughout the day (2026-08-03).

## Product principles

> All six principles validated by the owner on 2026-08-03.

1. **Simplicity over completeness** — a small set of features that work every day beats a large set that mostly sits idle. Every addition must justify its ongoing cost.
2. **Owner's data under owner's control** — the owner decides where the data lives, in what format, and who (if anyone) else can reach it. Resolved for storage in [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md): canonical data in Cloudflare D1 by explicit consent, with mandatory local export snapshots.
3. **Sustainable for one person to maintain** — a solo developer must be able to understand, fix and evolve the whole system indefinitely. Complexity that one person cannot carry is out.
4. **The assistant adapts to the owner, not the opposite** — the domain model and the workflows follow how the owner actually lives; the owner never reshapes habits to fit the tool.
5. **Effortless in, effortless out** — adding information and finding it again must be near-zero friction; the moment capture or retrieval feels like work, the assistant loses to memory, paper and old habits.
6. **Honest mirror** — the assistant never hides the owner's misses: repeated failure of the same commitments is recorded, kept constantly visible and proactively surfaced, so the owner can replan or change behavior. In the owner's words: "if I keep failing the same tasks, it is on me to reorganize — but the assistant must show me."

## Life Areas

A **Life Area** is a domain of personal life the assistant organizes (see the [glossary](glossary.md)).

| Horizon | Life Areas | Notes |
|---|---|---|
| Now | Calendar, Tasks | The starting scope of the project. |
| Later | Notes / personal information — leading candidate, signaled by the owner's own pain of losing scattered notes (2026-08-03). Other candidates: TBD — pending owner input | Formal prioritization pending; candidates only enter scope via the [roadmap](../50-planning/roadmap.md) triage rules. |
| Never | None declared — the owner cannot think of any Life Area that could never enter scope (2026-08-03) | Row kept so future exclusions, if any emerge, are recorded and not re-litigated. |

## Explicit non-goals

> Validated by the owner on 2026-08-03.

- **Multi-user support** — the assistant serves exactly one person. No accounts, sharing or collaboration features.
- **Commercial product** — this is not built to be sold, marketed or offered to others; decisions never trade the owner's needs for market appeal.
- **Scale** — no engineering effort is spent supporting more load, users or data volume than one person's life produces.

## Success criteria and failure signals

Daily use is confirmed intent (2026-08-03). The two working criteria:

- **Daily real use** — the assistant becomes the place the owner actually organizes their days, replacing Google Calendar and the scattered notes described in the problem statement. Mirror failure signal: drifting back to the old tools.
- **Found-again rate** — information put into the assistant is reliably found when needed. Mirror failure signal: "I know I noted this somewhere" happening inside the assistant too.

A third signal was declared explicitly (2026-08-03): **stale data is project-level failure** — if tasks/habits sit outdated because the assistant is not being used, the product itself has failed, regardless of its features.

Concrete, measurable versions remain to be defined by the owner.
