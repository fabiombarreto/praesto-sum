---
status: active
last_updated: 2026-08-21
review_trigger: "a stack-related ADR is accepted, or any technology/version in use changes"
---

# Tech Stack

> **Purpose:** Snapshot of what the project currently runs on, with every row traceable to the ADR that introduced it.
> **Update when:** A stack-related ADR is accepted, a technology is added or replaced, or a version in use changes.

## Current stack

The stack is fully decided ([ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) / [ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md) / [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md)) and installed. Versions below are the ones pinned in `package.json` at the 2026-08-03 scaffold — all exact (`save-exact`), never ranges. `package.json` is the machine-readable truth; this table is the human one.

| Layer | Technology | Version | Origin ADR |
|---|---|---|---|
| Hosting / runtime | Cloudflare Workers (free plan) + cron triggers + static assets; `wrangler` | wrangler 4.118.0 | [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) |
| Storage | Cloudflare D1 + Drizzle ORM; migrations `drizzle-kit generate` → `wrangler d1 migrations apply` | drizzle-orm 0.45.2 · drizzle-kit 0.31.10 | [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) / [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| Language | TypeScript strict, project references per target | typescript 6.0.3 | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| UI | React SPA + Vite + `@cloudflare/vite-plugin` + `vite-plugin-pwa` (injectManifest) | react 19.2.8 · vite 8.2.0 · @cloudflare/vite-plugin 1.50.0 · vite-plugin-pwa 1.3.0 | [ADR-0004](../60-decisions/ADR-0004-single-pwa-as-sole-interface.md) / [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| UI components & styling | Owned shadcn-style components (`src/app/components/ui/`) over Base UI primitives; Tailwind CSS v4 via the Vite plugin reading `src/app/tokens.css` through `@theme inline reference`; `cva` + `clsx` + `tailwind-merge`; Lucide icons | @base-ui/react 1.7.0 · tailwindcss 4.3.3 · @tailwindcss/vite 4.3.3 · class-variance-authority 0.7.1 · clsx 2.1.1 · tailwind-merge 3.6.0 · lucide-react 1.33.0 | [ADR-0011](../60-decisions/ADR-0011-ui-library-shadcn-style-base-ui-tailwind.md) (identity: [ADR-0010](../60-decisions/ADR-0010-visual-identity-direction-arcade.md)) |
| API | Hono (bearer-token middleware; `scheduled()` cron in the same Worker) | hono 4.12.34 | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |
| Integrations | Web Push via `web-push` + `nodejs_compat`; external calendar TBD — decision 4 in [60-decisions/index.md](../60-decisions/index.md) | web-push 3.6.7 | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) (push) |
| Tooling | npm (`save-exact`), Vitest + `@cloudflare/vitest-pool-workers`, Prettier, ESLint flat config | vitest 4.1.10 · @cloudflare/vitest-pool-workers 0.20.1 · prettier 3.9.6 · eslint 10.8.0 · typescript-eslint 8.66.0 | [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) |

Version constraints discovered at scaffold time (do not "fix" them casually):

- **TypeScript stays on 6.0.x**, not 7.x: `typescript-eslint` declares `typescript <6.1.0`, and TS 7's Go compiler exposes no stable programmatic API until 7.1. `tsc` alone would work — the breakage surfaces as an ESLint crash. Revisit as a deliberate ADR when 7.1 ships.
- **`wrangler` is pinned to the exact version** `@cloudflare/vitest-pool-workers` depends on; any drift duplicates wrangler in `node_modules`.
- **`@cloudflare/workers-types` is deliberately NOT installed.** `wrangler types` generates `worker-configuration.d.ts` (committed) from `wrangler.jsonc` + `.dev.vars`; having both declares the same globals twice.
- **`@vitejs/plugin-react` 6.x requires Vite 8** — they move together.
- **`@base-ui/react` is the package, never `@base-ui-components/react`** (frozen at 1.0.0-rc.0); pin ≥ 1.7.0. **`shadcn init` is not run** — its generated theme would compete with `tokens.css` (ADR-0011).
- **TypeScript 6 rejects tsconfig `baseUrl`** that the shadcn Vite guide still adds — the project uses relative imports, no alias.

## Pending stack decisions

None — decision 4 was resolved by [ADR-0007](../60-decisions/ADR-0007-google-calendar-bidirectional-sync.md) and the UI library by [ADR-0011](../60-decisions/ADR-0011-ui-library-shadcn-style-base-ui-tailwind.md); the queue in [60-decisions/index.md](../60-decisions/index.md) is empty.

Nothing in this document may be filled in ahead of its ADR — a stack row without a decision record is a decision made by accident.

## Dependency update policy

Per [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md): all versions pinned exact (`save-exact`), lockfile committed, `npm ci` on return. Upgrades are deliberate, changelog-in-hand events — never incidental — budgeted at ~one weekend per year. Drizzle (still 0.x) is upgraded only with its changelog open.
