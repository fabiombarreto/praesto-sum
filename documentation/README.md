---
status: active
last_updated: 2026-08-20
review_trigger: "any document is created, renamed, merged or changes status"
---

# Praesto Sum — Documentation

> **Purpose:** Single entry point to the project documentation: what the project is, how the documents are organized, and how they are kept alive.
> **Update when:** Any document is created, renamed, merged or changes status. The status panel is regenerated on every audit.

## What is this project

A personal assistant built by its single user — the owner — to organize personal life: calendar and tasks (to-dos) first, other life areas later. The project is documentation-first: everything is defined here before implementation starts. Phase 0 closed on 2026-08-03 with the full document set validated and decisions 1–3 resolved as ADRs; Phase 1 (MVP Tasks) is now in progress. All four foundational decisions are resolved. **Since 2026-08-18 the delivery units are on hold** while the [UI/UX plan](50-planning/ui-ux-plan.md) gives the app its visual foundation — guidelines, layout standard, visual identity and UI library — and that plan opened decisions 5–7 in the [decisions index](60-decisions/index.md) — 7 (ADR-0009) and 5 (ADR-0010) are already resolved.

> **Praesto Sum** — Latin for "I am ready, at your service" ([ADR-0002](60-decisions/ADR-0002-name-the-project-praesto-sum.md)). Short form for the future repository and CLI: **praesto**.

## Document map

| Document | What it contains | Read it when |
|---|---|---|
| [documentation-guidelines](00-meta/documentation-guidelines.md) | Writing rules, frontmatter, lifecycle, stable IDs, templates | Before writing or editing any doc |
| [vision](10-product/vision.md) | Problem, vision, principles, non-goals, success criteria | To understand why the project exists |
| [glossary](10-product/glossary.md) | Canonical domain vocabulary | Before naming anything |
| [visual-identity](10-product/visual-identity.md) | Who Praesto is visually: name, attributes, brief, mark, tokens, voice | Before any visual or copy choice — filled in by UI/UX-plan activity A2 |
| [functional-requirements](20-requirements/functional-requirements.md) | FR-nnn by area, MoSCoW-prioritized | To know what the system must do |
| [quality-attributes](20-requirements/quality-attributes.md) | QA-nnn as verifiable scenarios | Before any architectural choice |
| [constraints](20-requirements/constraints.md) | CON-nnn: hard limits every decision must respect | Before analyzing alternatives |
| [architecture-overview](30-architecture/architecture-overview.md) | Drivers, C4 context/containers, data, integrations, risks | To understand the technical shape |
| [domain-model](30-architecture/domain-model.md) | Entities, relationships, invariants | Before modeling anything |
| [tech-stack](40-engineering/tech-stack.md) | Current stack snapshot, each row linked to its ADR | To know what the project runs on |
| [engineering-conventions](40-engineering/engineering-conventions.md) | Code, git and naming conventions | Before writing code |
| [dev-environment](40-engineering/dev-environment.md) | Machine setup and day-to-day commands | On a new machine or after a pause |
| [testing-strategy](40-engineering/testing-strategy.md) | What gets tested and what deliberately does not | Before writing tests |
| [ui-ux-guidelines](40-engineering/ui-ux-guidelines.md) | The rules every interface change follows (platform, layout, colour, type, motion, states, pt-BR copy, WCAG 2.2 A, performance budget) + the review checklist | Before touching any screen, manifest or service worker — and on every UI review |
| [roadmap](50-planning/roadmap.md) | Current phase, milestones, backlog, delivery history | To know where we are and what is next |
| [ui-ux-plan](50-planning/ui-ux-plan.md) | The UI/UX track: activities, open decisions, exit criterion — runs while the roadmap's units are on hold | Before touching any screen, and to know why units are paused |
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
| A UI/UX-plan activity changes state, an open question there is answered, or the hold on units opens or lifts | [ui-ux-plan](50-planning/ui-ux-plan.md) + [roadmap](50-planning/roadmap.md) (hold state, delivery history) |
| An identity element changes (mark, tokens, voice) | [visual-identity](10-product/visual-identity.md) + `src/app/tokens.css` + an ADR when non-obvious |
| A UI rule proves useless or wrong in practice, or a platform behaviour a rule cites changes | [ui-ux-guidelines](40-engineering/ui-ux-guidelines.md) (+ `docs/context/ui-guidelines.md` pointer) + a History line in [ui-ux-plan](50-planning/ui-ux-plan.md) |
| A convention proves useful or useless in practice | [documentation-guidelines](00-meta/documentation-guidelines.md) |

A document that has no row in this map should not exist.

## Documentation status

Regenerated on every audit from each document's frontmatter. Template files under `00-meta/templates/` are excluded.

| Document | Status | Last updated |
|---|---|---|
| 00-meta/documentation-guidelines.md | active | 2026-08-02 |
| 10-product/vision.md | active | 2026-08-04 |
| 10-product/glossary.md | active | 2026-08-15 |
| 10-product/visual-identity.md | active | 2026-08-20 |
| 20-requirements/functional-requirements.md | active | 2026-08-12 |
| 20-requirements/quality-attributes.md | active | 2026-08-03 |
| 20-requirements/constraints.md | active | 2026-08-04 |
| 30-architecture/architecture-overview.md | draft | 2026-08-15 |
| 30-architecture/domain-model.md | draft | 2026-08-15 |
| 40-engineering/tech-stack.md | active | 2026-08-03 |
| 40-engineering/engineering-conventions.md | active | 2026-08-03 |
| 40-engineering/dev-environment.md | active | 2026-08-15 |
| 40-engineering/testing-strategy.md | active | 2026-08-12 |
| 40-engineering/ui-ux-guidelines.md | active | 2026-08-20 |
| 50-planning/roadmap.md | active | 2026-08-20 |
| 50-planning/ui-ux-plan.md | active | 2026-08-20 |
| 60-decisions/index.md | active | 2026-08-20 |
| 60-decisions/ADR-0001-write-all-artifacts-in-english.md | accepted | 2026-08-02 |
| 60-decisions/ADR-0002-name-the-project-praesto-sum.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0004-single-pwa-as-sole-interface.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0006-recurrence-model.md | accepted | 2026-08-03 |
| 60-decisions/ADR-0007-google-calendar-bidirectional-sync.md | accepted | 2026-08-04 |
| 60-decisions/ADR-0008-adopt-test-first-methodology.md | accepted | 2026-08-04 |
| 60-decisions/ADR-0009-ui-copy-in-brazilian-portuguese.md | accepted | 2026-08-18 |
| 60-decisions/ADR-0010-visual-identity-direction-arcade.md | accepted | 2026-08-20 |

## How AI assistants should use this folder

- Read this README at the start of every working session.
- Follow the [documentation-guidelines](00-meta/documentation-guidelines.md) when editing any document; set `last_updated` on every edit.
- Treat 10-product and 20-requirements as the source of intent. Never contradict them silently — surface the conflict to the owner instead.
- Any non-obvious choice made during a session becomes an ADR immediately (see the [decisions index](60-decisions/index.md)).
- Session close ritual: before ending, ask "did any requirement, decision, domain concept, diagram or convention change today?" If yes, update the affected documents per the maintenance map above.
