---
status: active
last_updated: 2026-08-20
review_trigger: "an ADR is created or changes state, or a pending decision is added, reordered or resolved"
---

# Decisions Index

> **Purpose:** Single index of all decision records (ADRs) and the ordered queue of technical decisions still pending.
> **Update when:** A new ADR is created, an ADR changes state, or a pending decision is added, reordered or resolved.

## How decisions work here

One file per decision, named `ADR-nnnn-short-kebab-title.md` and copied from [adr-template.md](../00-meta/templates/adr-template.md). ADRs are append-only: an accepted ADR is never edited, and a superseded one is never deleted — a change of course produces a new ADR that marks the old one `superseded`. ADR states: `proposed | accepted | superseded`.

## Pending decisions queue

The order was deliberate: the data posture constrained the interface, and both constrained the stack. Decisions 1–3 were resolved on 2026-08-03 by [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md) (canonical data on Cloudflare D1 + Workers), [ADR-0004](ADR-0004-single-pwa-as-sole-interface.md) (single installable PWA as the sole MVP interface) and [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md) (React SPA + Vite + Hono + Drizzle stack). Numbers are stable and never reused.

Decision 4 was resolved on 2026-08-04 by [ADR-0007](ADR-0007-google-calendar-bidirectional-sync.md) — the owner arbitrated the privacy × convenience trade-off in favour of bidirectional Google Calendar sync for Events, under a closed mirror inventory. The queue was empty from then until 2026-08-18, when the [UI/UX plan](../50-planning/ui-ux-plan.md) opened decisions 5–7. Decision 7 was resolved the same day by [ADR-0009](ADR-0009-ui-copy-in-brazilian-portuguese.md) (visible UI copy in Brazilian Portuguese; every other artifact stays English); decision 5 on 2026-08-20 by [ADR-0010](ADR-0010-visual-identity-direction-arcade.md) (direction A "Arcade"). **Open decisions: 6.** They are resolved inside that plan's activities and land here as ADRs; the plan holds the open questions and the owner's answers.

| # | Topic | Why it comes at this position | Blocks what |
|---|---|---|---|
| ~~5~~ | ~~Visual identity and theming~~ — **resolved 2026-08-20** by [ADR-0010](ADR-0010-visual-identity-direction-arcade.md): direction A "Arcade" — warm brown-black graphite, amber accent with hot orange for live/overdue, tactile depth with press physics, Inter + Unbounded wordmark, plumb-bob kept | Chosen by the owner from three rendered directions on the real screen | — |
| 6 | **UI library and styling approach** — the one consolidated, actively maintained, large-community component library that becomes the standard, and the styling pipeline it drags in (e.g. Tailwind, CSS-in-JS, CSS Modules) under exact-pinned deps and yearly deliberate upgrades | Comes after 5 because it is chosen *for* the direction; comes before the design pass because the pass is built with it | UI/UX plan activity A5; the `40-engineering/tech-stack.md` UI row; unit 3 onward |
| ~~7~~ | ~~Language of the visible UI copy~~ — **resolved 2026-08-18** by [ADR-0009](ADR-0009-ui-copy-in-brazilian-portuguese.md): pt-BR on screen, English everywhere else | Surfaced and resolved by the UI/UX plan the same day | — |

## Decisions index

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-write-all-artifacts-in-english.md) | Write all artifacts in English | accepted | 2026-08-02 |
| [ADR-0002](ADR-0002-name-the-project-praesto-sum.md) | Name the project Praesto Sum | accepted | 2026-08-03 |
| [ADR-0003](ADR-0003-store-canonical-data-in-cloudflare-d1.md) | Store canonical data in Cloudflare D1 behind Cloudflare Workers | accepted | 2026-08-03 |
| [ADR-0004](ADR-0004-single-pwa-as-sole-interface.md) | Adopt a single installable PWA as the sole interface | accepted | 2026-08-03 |
| [ADR-0005](ADR-0005-implementation-stack-react-vite-hono-drizzle.md) | Implementation stack — React 19 SPA + Vite + Hono + Drizzle ORM | accepted | 2026-08-03 |
| [ADR-0006](ADR-0006-recurrence-model.md) | Recurrence: shared rule, per-entity instantiation, missed recording | accepted | 2026-08-03 |
| [ADR-0007](ADR-0007-google-calendar-bidirectional-sync.md) | Bidirectional Google Calendar sync for Events, closed mirror inventory | accepted | 2026-08-04 |
| [ADR-0008](ADR-0008-adopt-test-first-methodology.md) | Adopt test-first (TDD) as the declared methodology | accepted | 2026-08-04 |
| [ADR-0009](ADR-0009-ui-copy-in-brazilian-portuguese.md) | Visible UI copy in Brazilian Portuguese; every other artifact stays English | accepted | 2026-08-18 |
| [ADR-0010](ADR-0010-visual-identity-direction-arcade.md) | Visual identity — direction A "Arcade" | accepted | 2026-08-20 |
