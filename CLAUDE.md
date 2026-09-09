# Praesto Sum

Personal assistant built by its single user (the owner) to organize personal life — Tasks and Calendar first, more Life Areas later. Latin: "I am ready, at your service" (short form: `praesto`). Phase 1 (MVP Tasks) in progress: the stack is scaffolded and verified end to end; Task create/list/complete/delete/edit works, on the dark *Hoje* screen the design pass shipped (2026-08-23). Recurrence, Reminders/push, search and export are next.

**The hold is lifted (2026-08-23) — delivery units run again.** The UI/UX plan closed `deprecated` with all six activities done: the app now has guidelines, a visual identity (ADR-0010), a layout standard, a UI library (ADR-0011) and a design pass applied to every screen and deployed. Units 3 and 4 closed 2026-09-03 on exit signals earned by use; unit 5 `data-export` closed 2026-09-07, reaching milestone M1 ("usable and portable") — the owner can take 100% of his data away, with the restore proved rather than assumed. **Units 1–6 are `shipped`** — unit 6 `push-channel-proven` closed 2026-09-09, verified on the owner's device: the phone rang with the app **closed** and the diagnostics screen showed the cron had just run. Deployed as `e5b1fa64`. `scheduled()` now records every run into `cron_runs` from a `finally` block, so a crashed run leaves a trace; `/api/push` and `/api/diagnostics` are live behind the bearer gate. **`web-push` was removed: it hangs inside workerd** (neither resolves nor rejects); the send library is `@block65/webcrypto-web-push@2.0.0` per **ADR-0013**, which supersedes ADR-0005's naming and **still awaits the owner's ratification**. Suite is 814 tests / 57 files. Unit 7 `reminders` is `next` — it is the other half of milestone M2, and the first thing that will exercise a notification deep link to a real Task route (so far only `/` has been device-proven). The browser test tier was **rejected** at its own trigger and re-armed elsewhere — do not re-litigate it; the reasoning is in the PRD's Decisions Log and the roadmap Backlog. Build on that foundation, do not re-litigate it: the rules live in `documentation/40-engineering/ui-ux-guidelines.md`, `documentation/40-engineering/ui-layout-standard.md` and `documentation/10-product/visual-identity.md` (machine truth: `src/app/tokens.css`); `documentation/50-planning/ui-ux-plan.md` is kept only to explain *why*.

**UI/UX guidelines — MANDATORY on every interface change:** `documentation/40-engineering/ui-ux-guidelines.md` (derived pointer: `docs/context/ui-guidelines.md`). Before touching `src/app/`, `index.html`, the manifest or `src/sw.ts`, read it; run its **review checklist** on the change and paste the ✔/✘ result in the PR or plan record. Visible UI copy is pt-BR (ADR-0009); code, identifiers and tests stay English.

## Project documentation — read FIRST, keep updated ALWAYS

The `documentation/` folder is the project's **authoritative source of truth**: vision, requirements (FR/QA/CON), architecture, ADRs and roadmap — all owner-validated.

- **ALWAYS read `documentation/README.md` before changing anything in this project.** It is the entry point and holds the maintenance map.
- **ALWAYS update the affected `documentation/` docs in the same session as the change.** The maintenance map in `documentation/README.md` says exactly which doc each kind of change touches. "Affected docs updated" is part of the Definition of Done — never "later".
- Any non-obvious product or technical choice becomes an ADR in `documentation/60-decisions/` immediately (append-only — never edit accepted ADRs).
- `docs/` (this relay context system) is **derived** from `documentation/`. On any conflict, `documentation/` wins — update both together.

## Tech stack (ADR-0003..0005 — versions pinned exact in package.json)

- Cloudflare Workers (free plan) + D1 + cron triggers + static assets — one Worker serves everything
- React 19 SPA + TypeScript strict + Vite + `@cloudflare/vite-plugin` + `vite-plugin-pwa` (injectManifest)
- Hono 4 API (bearer token on every route) · Drizzle ORM · `@block65/webcrypto-web-push` for Web Push (**not** `web-push`, which hangs inside workerd — ADR-0013)
- npm (`save-exact`) · Vitest + `@cloudflare/vitest-pool-workers` · Prettier + `tsc -b` + minimal ESLint

## Essential commands

- `npm run dev` — Vite HMR + real workerd + local D1, one process
- `npm run docker:up` / `docker:down` / `docker:status` — the SAME dev server under Docker Compose (ADR-0012): survives a reboot, one command up and one down. Optional second door; `npm run dev` on the host is unchanged and stays the default. Never mount the host `node_modules` into it — it holds the Windows workerd
- `npm test` · `npm run check` — tests / types + `tsc -b` + lint + format gate
- `npm run db:generate` · `npm run db:migrate` — drizzle-kit → wrangler d1 migrations
- `npm run cf-typegen` — regenerate committed worker-configuration.d.ts after editing wrangler.jsonc
- `npm run deploy` — build && wrangler deploy (assets + API + cron)

## Key patterns

1. One Worker serves everything — SPA assets, `/api/*` (Hono), `scheduled()` cron. No second service, no sync engine, no offline writes (ADR-0003).
2. Types flow from `src/worker/db/schema.ts` (Drizzle) outward; `src/worker/dto.ts` is the single mapping point to the wire contract in `src/shared/api.ts` — never hand-duplicate entity types.
3. Domain enums are enforced twice: TypeScript union + SQL CHECK. Invariants that protect the owner's data (ADR-0006) are unique indexes, not conventions.
4. Exact version pins; upgrades are deliberate changelog-in-hand events, never incidental.
5. Migrations are always generated by drizzle-kit and applied by `wrangler d1 migrations apply` — never `drizzle-kit migrate/push`.

## Context & Domain

Before implementing anything, read:
- docs/context/architecture.md — stack and patterns
- docs/context/conventions.md — naming and code standards
- docs/context/constraints.md — what NOT to do
- docs/context/methodology.md — methodology declaration (TDD opt-in)
- docs/context/testing.md — mandatory test guardrail (see section below)
- docs/context/ui-guidelines.md — pointer to the mandatory UI/UX guidelines + review checklist (any screen change)
- docs/domain/areas/[relevant-area].md — business rules for the area being changed
- docs/decision-gate.md — mandatory gate before planning or coding

Domain areas:
- tasks
- events
- reminders
- life-areas

## Test Guardrail (mandatory — every change)

Applies to EVERY code change, including small or single-file ones, and
whether or not a relay command was used. Do NOT skip this silently. It is
NOT waived by the Decision Gate scope exemptions.

- Before finishing, check which test suites cover the code you changed
  (see docs/context/testing.md) and state whether tests exist.
- If your change alters tested behavior, UPDATE those tests to match —
  never leave them stale, never delete/skip/weaken them to force a pass.
- Run the suites covering your change; treat all tiers equally and at a
  minimum run the e2e suite.
- If you CANNOT run them for any reason, do not stay silent: at the end of
  your response warn the user, say exactly why, and give copy-pasteable
  manual run instructions. Full protocol: docs/context/testing.md

Full index: docs/KNOWLEDGE_BASE.md
