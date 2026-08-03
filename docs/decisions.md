# Decisions

Decisões estáveis do projeto que não devem ser reavaliadas pela IA.
Atualizado pelo Docs Updater após cada aprovação de implementação.

> The authoritative decision records are the ADRs in
> `documentation/60-decisions/` (append-only, owner-approved). This file is
> the relay-facing index of them; when in doubt, the ADR wins. Nothing here
> is inferred — every entry has an explicit, owner-validated source.

---

## [2026-08-02] All artifacts in English

**Context:** Owner is Brazilian; the project needs one language across docs, code, commits and identifiers.
**Decision:** Everything in English; conversation with the owner stays in Portuguese.
**Reason:** Single vocabulary from docs to code; ecosystem and AI-tooling fit.
**Areas affected:** all · Source: `documentation/60-decisions/ADR-0001-write-all-artifacts-in-english.md`

---

## [2026-08-03] Project named Praesto Sum

**Context:** Provisional name needed replacement; owner criteria: short/abbreviable, meaningful, not generic, not a person's name.
**Decision:** **Praesto Sum** (Latin: "I am ready, at your service"); short form `praesto` for repo and CLI.
**Reason:** Literal voice of an assistant reporting for duty; echoes Portuguese *prestar/prestativo*.
**Areas affected:** all · Source: `documentation/60-decisions/ADR-0002-name-the-project-praesto-sum.md`

---

## [2026-08-03] Canonical data in Cloudflare D1 behind Workers

**Context:** Multi-device (PC + phone) confirmed; owner prioritized zero cost over home hardware, VPS and Oracle free tier.
**Decision:** Single canonical copy in D1; Workers API + cron; thin clients; NO merge/sync/offline-write logic. Binding safeguards: day-1 JSON+iCalendar export; automated local snapshots; no offline write queue without a superseding ADR; token on every route.
**Reason:** Only posture passing every QA/CON without exception; zero ops; merge-bug class structurally absent.
**Areas affected:** tasks, events, reminders, life-areas · Source: `documentation/60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md`

---

## [2026-08-03] Single installable PWA as the sole interface

**Context:** One codebase must serve phone and PC; owner confirmed PWA-first.
**Decision:** One responsive PWA (manifest + service worker + Web Push) served by the same Worker; no native apps or wrappers in the MVP. Revisit triggers: iOS push unreliability, or a needed native capability.
**Reason:** One codebase for every device (QA-004/CON-002); no store friction; same origin as API.
**Areas affected:** all · Source: `documentation/60-decisions/ADR-0004-single-pwa-as-sole-interface.md`

---

## [2026-08-03] Implementation stack: React 19 SPA + Vite + Hono + Drizzle

**Context:** Panel tie between paved path and minimal stack; owner profile (React + TypeScript, prefers HMR and end-to-end types, chose Drizzle) broke the tie.
**Decision:** React 19 SPA (no meta-framework/SSR/RSC — final position) + Vite + `@cloudflare/vite-plugin` + `vite-plugin-pwa` (injectManifest); Hono 4; `web-push` under `nodejs_compat`; Drizzle ORM with drizzle-kit migrations applied via wrangler; npm save-exact; Vitest + pool-workers; Prettier + tsc strict.
**Reason:** Most-documented member of every category; matches owner experience; dev/prod parity in real workerd.
**Areas affected:** all · Source: `documentation/60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md`

---

## [2026-08-03] MVP scope frozen: Phase 1 = Tasks

**Context:** All 23 FRs validated by the owner; phases and exit criteria confirmed.
**Decision:** Phase 1 = FR-001..005, 007, 009, 040, 041, 042, 044, 045 (exit: owner manages daily Tasks in the assistant). Phase 2 = Calendar (FR-020..026, FR-010; exit: replaces Google Calendar). FR-006/008/043 unscheduled.
**Reason:** Tasks answer the owner's sharpest pains first (capture friction, forgetting).
**Areas affected:** tasks, events, reminders, life-areas · Source: `documentation/20-requirements/functional-requirements.md` + `documentation/50-planning/roadmap.md`

---

<!-- Template for future entries:

## [YYYY-MM-DD] Title of the decision

**Context:** Why this decision was needed.
**Decision:** What was decided.
**Reason:** Why this option was chosen over alternatives.
**Areas affected:** [list domain areas]

-->
