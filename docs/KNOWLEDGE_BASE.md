# Knowledge Base — Praesto Sum

Tier 2 index: one entry per doc, 1-2 lines each. Details live in the target files.

## Intro

**Project documentation (authoritative)** — vision, requirements (FR/QA/CON), architecture, ADRs, roadmap; owner-validated source of truth for the whole project. → documentation/README.md

**UI/UX plan (roadmap units ON HOLD since 2026-08-18)** — the track that gives the app its visual foundation before any further unit: PWA UI/UX guidelines, layout standard, visual direction (minimalist + gamer-community ambience), one consolidated UI library, design pass over existing screens; opened pending decisions 5–7. → documentation/50-planning/ui-ux-plan.md

## Governance (AI control)

**Decision Gate** — mandatory gate before planning, coding or reviewing; consultation sources and evidence block format. → docs/decision-gate.md

**Decisions** — relay-facing index of the settled decisions (ADR-0001..0005 + MVP freeze); never re-evaluate. → docs/decisions.md

**Anti-patterns** — forbidden by decision: offline queues, live-DB sync, SSR/meta-frameworks, version ranges, synonym drift, test-weakening. → docs/anti-patterns.md

## Context

**Architecture (rules)** — stack (Workers + D1 + React SPA + Hono + Drizzle), thin-client pattern, planned layout, data safeguards. → docs/context/architecture.md

**Conventions** — English everywhere, canonical names, casing, TS strict, exact pins, git conventions. → docs/context/conventions.md

**Integrations** — Cloudflare platform, Web Push (VAPID as secrets), API bearer token; Google Calendar decided (ADR-0007: bidirectional, Events only) and access **proven** by chore C11 on 2026-08-11 — a real refresh token is already a Worker secret — but **no integration code exists yet**; unit 4 `google-calendar-read` writes it. → docs/context/integrations.md

**Constraints** — CON-001..006, QA-001..004 scenarios, platform limits, offline is read-only. → docs/context/constraints.md

**Methodology** — `tdd: true` (test-first, declared 2026-08-04 by ADR-0008); `docs_sync: true`; `figma_track: false`; browser-API work splits the logic into `src/shared` behind a port and exempts only the adapter. → docs/context/methodology.md

**UI/UX guidelines (pointer)** — MANDATORY on any change under `src/app/`, `index.html`, the manifest or `src/sw.ts`: read the authoritative rules, apply the owner decisions (pt-BR copy, dark-only, WCAG 2.2 A + 48 px targets + reduced motion), run the 10-item review checklist and paste ✔/✘. → docs/context/ui-guidelines.md

**Testing guardrail** — binding contract: keep suites green on EVERY change; fallback warning protocol; one detected tier (Vitest + `@cloudflare/vitest-pool-workers`, `npm test`), no browser/e2e tier yet. → docs/context/testing.md

## Domain

**Glossary** — canonical terms: Task, Event, Reminder, Life Area; validated distinctions and synonyms to avoid. → docs/domain/glossary.md

**User flows** — quick capture, daily organization, being reminded, finding again, data export, recurrence. → docs/domain/flows.md

**Tasks rules** — Phase 1 core: lifecycle, deadline vs scheduled date, N:N links, recurrence; open questions. → docs/domain/areas/tasks.md

**Events rules** — Phase 2: calendar slots, no completion state, recurrence, day/week views. → docs/domain/areas/events.md

**Reminders rules** — attached or standalone; server-side cron + Web Push; silent-failure mitigations. → docs/domain/areas/reminders.md

**Life Areas rules** — growth axis: new areas are data, not remodeling; triage rules for entering scope. → docs/domain/areas/life-areas.md

## Developer docs

**Architecture (dev view)** — the system in one paragraph, request paths, where to add things. → docs/architecture.md

**Development** — setup, day-to-day commands (planned, validate at scaffold), the feature loop. → docs/development.md

**API reference** — planned `/api/*` surface; fill with the real contract as routes land. → docs/api-reference.md

**Troubleshooting** — workerd on Windows, silent push, stale service worker, migration drift. → docs/troubleshooting.md

## Libs

**Library notes** — not generated yet: no dependency manifests exist pre-scaffold. Populate via context-builder `*libs` after the scaffold pins versions. → docs/libs/
