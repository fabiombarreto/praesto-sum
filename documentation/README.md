---
status: active
last_updated: 2026-08-03
review_trigger: "any document is created, renamed, merged or changes status"
---

# Praesto Sum — Documentation

> **Purpose:** Single entry point to the project documentation: what the project is, how the documents are organized, and how they are kept alive.
> **Update when:** Any document is created, renamed, merged or changes status. The status panel is regenerated on every audit.

## What is this project

A personal assistant built by its single user — the owner — to organize personal life: calendar and tasks (to-dos) first, other life areas later. The project is documentation-first: everything is defined here before implementation starts. No code exists yet and no tech stack has been chosen; the open technical questions live in the [pending decisions queue](60-decisions/index.md).

> **Praesto Sum** — Latin for "I am ready, at your service" ([ADR-0002](60-decisions/ADR-0002-name-the-project-praesto-sum.md)). Short form for the future repository and CLI: **praesto**.

## Document map

| Document | What it contains | Read it when |
|---|---|---|
| [documentation-guidelines](00-meta/documentation-guidelines.md) | Writing rules, frontmatter, lifecycle, stable IDs, templates | Before writing or editing any doc |
| [vision](10-product/vision.md) | Problem, vision, principles, non-goals, success criteria | To understand why the project exists |
| [glossary](10-product/glossary.md) | Canonical domain vocabulary | Before naming anything |
| [functional-requirements](20-requirements/functional-requirements.md) | FR-nnn by area, MoSCoW-prioritized | To know what the system must do |
| [quality-attributes](20-requirements/quality-attributes.md) | QA-nnn as verifiable scenarios | Before any architectural choice |
| [constraints](20-requirements/constraints.md) | CON-nnn: hard limits every decision must respect | Before analyzing alternatives |
| [architecture-overview](30-architecture/architecture-overview.md) | Drivers, C4 context/containers, data, integrations, risks | To understand the technical shape |
| [domain-model](30-architecture/domain-model.md) | Entities, relationships, invariants | Before modeling anything |
| [tech-stack](40-engineering/tech-stack.md) | Current stack snapshot, each row linked to its ADR | To know what the project runs on |
| [engineering-conventions](40-engineering/engineering-conventions.md) | Code, git and naming conventions | Before writing code |
| [dev-environment](40-engineering/dev-environment.md) | Machine setup and day-to-day commands | On a new machine or after a pause |
| [testing-strategy](40-engineering/testing-strategy.md) | What gets tested and what deliberately does not | Before writing tests |
| [roadmap](50-planning/roadmap.md) | Current phase, milestones, backlog, delivery history | To know where we are and what is next |
| [decisions index](60-decisions/index.md) | ADR index + pending decisions queue | Before deciding anything non-obvious |

## Recommended reading order

README → [guidelines](00-meta/documentation-guidelines.md) → [vision](10-product/vision.md) → [glossary](10-product/glossary.md) → [functional-requirements](20-requirements/functional-requirements.md) → [quality-attributes](20-requirements/quality-attributes.md) → [constraints](20-requirements/constraints.md) → [roadmap](50-planning/roadmap.md) → [decisions index](60-decisions/index.md) → [architecture-overview](30-architecture/architecture-overview.md) → [domain-model](30-architecture/domain-model.md) → [40-engineering/](40-engineering/tech-stack.md) docs.

This is also the writing order of Phase 0. Architecture and engineering documents start mostly as explicit gaps ("TBD") and are filled in as pending decisions are resolved.

## Maintenance map

| When this happens | Update |
|---|---|
| A non-obvious product or technical choice is made | New ADR in 60-decisions/ + [decisions index](60-decisions/index.md) |
| A new domain concept appears or an ambiguity is resolved | [glossary](10-product/glossary.md) + [domain-model](30-architecture/domain-model.md) |
| Scope changes or a backlog idea is accepted | [functional-requirements](20-requirements/functional-requirements.md) + [roadmap](50-planning/roadmap.md) |
| Stack, component, data or integration changes | [architecture-overview](30-architecture/architecture-overview.md) + affected 40-engineering/ docs |
| A milestone completes or a phase closes | [roadmap](50-planning/roadmap.md) |
| A convention proves useful or useless in practice | [documentation-guidelines](00-meta/documentation-guidelines.md) |

A document that has no row in this map should not exist.

## Documentation status

Regenerated on every audit from each document's frontmatter. Template files under `00-meta/templates/` are excluded.

| Document | Status | Last updated |
|---|---|---|
| 00-meta/documentation-guidelines.md | active | 2026-08-02 |
| 10-product/vision.md | active | 2026-08-03 |
| 10-product/glossary.md | active | 2026-08-03 |
| 20-requirements/functional-requirements.md | active | 2026-08-03 |
| 20-requirements/quality-attributes.md | active | 2026-08-03 |
| 20-requirements/constraints.md | active | 2026-08-03 |
| 30-architecture/architecture-overview.md | draft | 2026-08-03 |
| 30-architecture/domain-model.md | draft | 2026-08-03 |
| 40-engineering/tech-stack.md | draft | 2026-08-03 |
| 40-engineering/engineering-conventions.md | draft | 2026-08-03 |
| 40-engineering/dev-environment.md | draft | 2026-08-03 |
| 40-engineering/testing-strategy.md | draft | 2026-08-02 |
| 50-planning/roadmap.md | active | 2026-08-03 |
| 60-decisions/index.md | active | 2026-08-03 |
| 60-decisions/ADR-0001-write-all-artifacts-in-english.md | accepted | 2026-08-02 |
| 60-decisions/ADR-0002-name-the-project-praesto-sum.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0004-single-pwa-as-sole-interface.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md | accepted | 2026-08-03 |

## How AI assistants should use this folder

- Read this README at the start of every working session.
- Follow the [documentation-guidelines](00-meta/documentation-guidelines.md) when editing any document; set `last_updated` on every edit.
- Treat 10-product and 20-requirements as the source of intent. Never contradict them silently — surface the conflict to the owner instead.
- Any non-obvious choice made during a session becomes an ADR immediately (see the [decisions index](60-decisions/index.md)).
- Session close ritual: before ending, ask "did any requirement, decision, domain concept, diagram or convention change today?" If yes, update the affected documents per the maintenance map above.
