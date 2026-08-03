---
status: active
last_updated: 2026-08-03
review_trigger: "a setup step changes, fails on a fresh machine, or the scaffold validates the planned commands"
---

# Dev Environment

> **Purpose:** Everything needed to set up the development machine and the commands used day to day.
> **Update when:** A setup step changes, a step fails on a fresh machine, or the scaffold validates (or corrects) the planned commands below.

> All commands below were **executed and verified** on the owner's Windows 11 machine at the 2026-08-03 scaffold (Node v24.15.0, npm 11.13.0). Target (QA-004): clean machine to running dev environment in ≤ 1 hour.

## Prerequisites

- **Operating system:** Windows 11 (the owner's development machine).
- **git** — repository initialized 2026-08-03, branch `main`.
- **Node.js LTS** (bundles npm — the only package manager used).
- **Cloudflare account** (free plan) with `wrangler login` completed once, for deploys and remote D1 migrations. Local dev needs no account.
- **Microsoft VC++ Redistributable kept current** — a known workerd crash on Windows is mitigated by this (CON-001; see Known issues).

## Setup step by step

1. Install Node.js 24 LTS (bundles npm).
2. `git clone` the repository.
3. `npm ci` (exact versions from the committed lockfile).
4. Copy `.dev.vars.example` → `.dev.vars` and fill the secrets. `API_BEARER_TOKEN` is any string you choose — you paste the same value into the PWA once per device. VAPID keys: `npx web-push generate-vapid-keys --json`.
5. `npm run db:migrate` (applies `migrations/` to the local D1 under `.wrangler/`).
6. `npm run dev` — one process: Vite HMR + real workerd + local D1, at `http://127.0.0.1:5173`.

**Before the first real deploy** (not needed for local work): `wrangler login`, then `wrangler d1 create praesto-db` and paste the printed id over the `database_id` placeholder in `wrangler.jsonc`; `npm run cf-typegen` and commit; `wrangler secret put API_BEARER_TOKEN` (and the VAPID keys); `npm run db:migrate:remote`. Note that `wrangler deploy --dry-run` and local migrations both SUCCEED with the placeholder id — only a real deploy catches it.

## Day-to-day commands

| Action | Command |
|---|---|
| Run (dev, one process: HMR + workerd + local D1) | `npm run dev` |
| Test | `npm test` (watch: `npm run test:watch`) |
| Quality gate: types + `tsc -b` + lint + format | `npm run check` |
| Format the code | `npm run format` |
| Generate migration from a schema change | `npm run db:generate` |
| Apply migrations (local) | `npm run db:migrate` |
| Apply migrations (**production**) | `npm run db:migrate:remote` |
| Regenerate Worker/binding types after editing `wrangler.jsonc` | `npm run cf-typegen` |
| Build (type-check + client + worker + service worker) | `npm run build` |
| Preview the production build locally (needed to exercise the PWA) | `npm run preview` |
| Deploy (assets + API + cron, one Worker) | `npm run deploy` |

Not yet implemented: the export snapshot of FR-042 (`db:snapshot`) — it lands with the export slice, and is a day-1 requirement of [ADR-0003](../60-decisions/ADR-0003-store-canonical-data-in-cloudflare-d1.md) for the first usable version.

## Known issues and troubleshooting

- **workerd crash on Windows:** if `npm run dev` crashes workerd on startup, update the Microsoft VC++ Redistributable — documented cause on Windows 11.
- **No service worker in `vite dev`.** `devOptions` is disabled, so `src/app/pwa.ts` skips registration outside production builds. Exercise the PWA (install, precache, push) with `npm run preview`.
- **Never write project files as UTF-8 with BOM.** Windows PowerShell's `Out-File -Encoding utf8` adds one, and the Vite/JSON parsers reject it (`Unexpected token '﻿'`). Use editors/tools that write plain UTF-8; `.gitattributes` handles line endings.
- **Migration review before every remote deploy.** When a schema change forces SQLite table recreation, drizzle-kit emits `PRAGMA foreign_keys=OFF/ON`, which passes locally but FAILS on remote D1. Hand-edit those to `PRAGMA defer_foreign_keys = true/false`. Part of the Definition of Done for schema changes.
- **`db:migrate:remote` targets production and auto-confirms** in non-interactive contexts. Never wire it into a watch script or CI.
- **Never run `drizzle-kit migrate` or `drizzle-kit push`.** wrangler owns the `d1_migrations` ledger; drizzle-kit would keep a second, independent one over the same database.
