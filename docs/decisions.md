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
**Decision:** One responsive PWA (manifest + service worker + Web Push) served by the same Worker; no native apps or wrappers in the MVP. Revisit triggers: iOS push unreliability, or a needed native capability. *(Note 2026-08-04: the owner's phone is Android, so the iOS trigger is moot in practice — see `documentation/10-product/vision.md`.)* *(Note 2026-08-05: ADR-0004's trade-off list says "no **native** share targets, widgets, or OS calendar hooks in the MVP". Unit 1 phases 1 and 3 shipped the manifest's `share_target` and `shortcuts` members — the **web platform's** equivalents, reached with no native app, wrapper or store. The decision is intact and in fact strengthened: the integration arrived without going native. What aged is the prediction, not the choice. The ADR is append-only and was not edited.)*
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
**Decision:** Phase 1 = FR-001..005, 007, 009, 040, 041, 042, 044, 045 (exit: owner manages daily Tasks in the assistant). Phase 2 = Calendar (FR-020..026, FR-010; exit: replaces Google Calendar). *(Correction 2026-08-12: this entry said "FR-006/008/043 unscheduled", which the authoritative [traceability table](../documentation/20-requirements/functional-requirements.md#traceability) had already superseded on 2026-08-03 — all three are scheduled: FR-006 in unit 2 `task-detail-and-dates`, FR-008 in unit 13 `life-areas`, FR-043 in unit 5 `data-export`. FR-043 unscheduled would have contradicted ADR-0003, which treats automated snapshots as binding.)*
**Reason:** Tasks answer the owner's sharpest pains first (capture friction, forgetting).
**Areas affected:** tasks, events, reminders, life-areas · Source: `documentation/20-requirements/functional-requirements.md` + `documentation/50-planning/roadmap.md`

---

## [2026-08-03] Recurrence: shared rule, per-entity instantiation, missed recording

**Context:** FR-009/FR-026 need a shared model; research (Todoist, Things, Taskwarrior, Habitica, RFC 5545/Google) + owner's template+realizations proposal.
**Decision:** One `recurrence_series` rule table + one shared expansion function. Tasks: materialized current occurrence (max one open per series; superseded-without-completion → `missed`, permanent record). Events: master + `event_exceptions`, virtual expansion, no materialization. Owner explicitly chose missed-recording over silent skipping (honest-mirror principle; FR-011/FR-012).
**Reason:** Follows the domain asymmetry (Tasks have per-occurrence state; Events have no completion); avoids each pure model's documented failure mode.
**Areas affected:** tasks, events, reminders · Source: `documentation/60-decisions/ADR-0006-recurrence-model.md`

---

## [2026-08-04] Bidirectional Google Calendar sync for Events

**Context:** The owner arbitrated pending decision 4, asking to read, create, edit and delete in his Google calendar, as early as possible. Research found the OAuth "Testing" 7-day refresh-token expiry (violates QA-002) and that publishing removes it, with a documented personal-use exception to verification — unsettled between two official pages, hence the C11/C12 spike.
**Decision:** Bidirectional sync for **Events only**, scope `calendar.events` (never `calendar`), polling on the existing cron (never `events.watch`), conservative phasing (read in Phase 1, write in Phase 2). Closed mirror inventory: Tasks, Reminders, Life Areas, links, priorities and `missed` history never leave Praesto. LWW per item with deletion-beats-edit, tie-asks, and no silent loser. Dirty flag is a content hash, never `updated_at`. Own domain authorized if verification demands it; Workers Paid not authorized — backfill must fit the free plan.
**Reason:** Google already holds the owner's events; the privacy delta is the token and future scope creep, held by the closed inventory. Using the provider's own syncToken/ETag keeps the "no sync engine" rule intact under a bounded carve-out.
**Areas affected:** events, reminders, tasks · Source: `documentation/60-decisions/ADR-0007-google-calendar-bidirectional-sync.md`

---

## [2026-08-04] Test-first (TDD) as the declared methodology

**Context:** Phase 0 recorded a pragmatic test-after philosophy and `docs/context/methodology.md` carried `tdd: false`, keeping relay's test pair out of the pipeline. On 2026-08-04 the owner declared the opposite intent, with only the scaffold's worth of code written and the riskiest units (recurrence with DST edges, the autonomous `missed` sweep, calendar write-back) still ahead.
**Decision:** Practise **test-first**, declared as `tdd: true` + `tdd_evidence: "user-declared"`. Pipeline order becomes `/relay-plan` → `/relay-plan-review` → `/relay-write-test` → `/relay-test-write-review` → implement → code review → `/relay-test`; the suite must be RED for the right reason before implementation starts. **Scope is unchanged** from the existing automated/manual split — it does NOT extend to React components, and a purely visual PRD legitimately produces no test file. The guardrail in `docs/context/testing.md` is independent and remains in force either way.
**Reason:** Acceptance criteria become executable before code exists — the strongest available defence for units where a wrong write reaches data Praesto cannot restore. Accepted cost, recorded honestly: two extra agent round-trips per unit, so the roadmap's estimates are a floor that this raises further.
**Areas affected:** all · Source: `documentation/60-decisions/ADR-0008-adopt-test-first-methodology.md`

---

## [2026-08-18] Visible UI copy in Brazilian Portuguese; every other artifact stays English

**Context:** ADR-0001 fixed English for artifacts but never said which language the product speaks to its single user; `index.html`/manifest declared `pt-BR` while every shipped string was English. Surfaced by the UI/UX plan (pending decision 7) because voice-and-tone and the design pass depend on it.
**Decision:** All visible UI copy (labels, buttons, placeholders, states, notifications, install/update prompts, manifest text, `lang`) in **pt-BR**; code, identifiers, comments, tests, commits, docs and string keys stay **English**. No i18n layer (one user, one language). English strings still in the app are translated in the design pass (A5); tests pinning owner-facing messages pin the Portuguese wording from then on.
**Reason:** The owner reads this text daily — friction paid for a consistency that benefits nobody; keeps ADR-0001 intact by scoping, not editing.
**Areas affected:** all · Source: `documentation/60-decisions/ADR-0009-ui-copy-in-brazilian-portuguese.md`

---

## [2026-08-20] Visual identity: direction A "Arcade"

**Context:** UI/UX plan activity A2 — audit + nine owner references (warm accents on dark), attribute session (É moderno/ágil/nerd · quer ser minimalista/gamer/enérgico · não é sombrio/sério/corporativo), five design principles, moodboard veto (warm primaries, blurple cut, tactile/3D depth adopted), three directions rendered on the real screen, critiqued and measured; owner chose A.
**Decision:** Warm brown-black ladder `#161012/#1f1816/#2a211e/#352a25`; accent âmbar `#f5a524` (face `#b8751a`, on-accent `#1a1206`), `#ff5c1f` only for live + overdue; depth = lighter surface + top highlight, ONE elevated plane per screen (capture deck), primary controls with a 3 px lower face that sinks 3 px on press, relief never on text or static panels, gradients only on the mark; radius 18/14/pill; Inter variable (one shipped file) + Unbounded 800 wordmark as SVG (count in Unbounded only if a measured subset fits ≤ 100 KB total); 4 px spacing, type rungs 12/14/16/20/28; signature completion = check sinks + single ring; plumb-bob kept. Dark-only ships; tokens declared as pairs.
**Reason:** The owner's pick from rendered candidates; reconciles his warm references with the brass mark; the tactile depth he asked for, constrained by affordance and measured contrast.
**Areas affected:** all UI · Source: `documentation/60-decisions/ADR-0010-visual-identity-direction-arcade.md`

---

## [2026-08-21] UI library: shadcn-style owned components over Base UI + Tailwind v4

**Context:** UI/UX plan A4 — weighted matrix over the verified scouting (shadcn 65/70, Mantine 50, Chakra 50, HeroUI 41) and two spikes rendering the layout standard's Today screen in the Arcade tokens, measured in production builds (shadcn: JS 102.7 KB / CSS 5.5 KB gzip; Mantine: 107.0 / 11.3 per-component, 35.3 global) and judged by the owner on the phone.
**Decision:** Components we own under `src/app/components/ui/` (cva + cn, Base UI data attributes), exact pins: `@base-ui/react 1.7.0`, `class-variance-authority 0.7.1`, `clsx 2.1.1`, `tailwind-merge 3.6.0`, `lucide-react 1.33.0`; dev `tailwindcss 4.3.3`, `@tailwindcss/vite 4.3.3`. `src/app/styles.css` maps `tokens.css` into Tailwind with `@theme inline reference` — Tailwind emits no variables of its own. `shadcn init` is never run; `shadcn add` output is adapted to the tokens. Native `<dialog>` stays first for sheets unless Base UI Dialog is verified to honour Android close requests. No PostCSS/ESLint/Prettier plugins.
**Reason:** No house look to bend, smallest measured footprint, largest community, pin discipline natural (components never auto-update), Base UI a11y underneath; Mantine taxed every identity rule with overrides.
**Areas affected:** all UI · Source: `documentation/60-decisions/ADR-0011-ui-library-shadcn-style-base-ui-tailwind.md`

---

<!-- Template for future entries:

## [YYYY-MM-DD] Title of the decision

**Context:** Why this decision was needed.
**Decision:** What was decided.
**Reason:** Why this option was chosen over alternatives.
**Areas affected:** [list domain areas]

-->
