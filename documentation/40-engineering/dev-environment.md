---
status: draft
last_updated: 2026-08-03
review_trigger: "a setup step changes, fails on a fresh machine, or the scaffold validates the planned commands"
---

# Dev Environment

> **Purpose:** Everything needed to set up the development machine and the commands used day to day.
> **Update when:** A setup step changes, a step fails on a fresh machine, or the scaffold validates (or corrects) the planned commands below.

> The commands in this document are **planned** per [ADR-0005](../60-decisions/ADR-0005-implementation-stack-react-vite-hono-drizzle.md) and are validated when the scaffold lands. Target (QA-004): clean machine to running dev environment in ≤ 1 hour.

## Prerequisites

- **Operating system:** Windows 11 (the owner's development machine).
- **git** — repository initialized 2026-08-03, branch `main`.
- **Node.js LTS** (bundles npm — the only package manager used).
- **Cloudflare account** (free plan) with `wrangler login` completed once, for deploys and remote D1 migrations. Local dev needs no account.
- **Microsoft VC++ Redistributable kept current** — a known workerd crash on Windows is mitigated by this (CON-001; see Known issues).

## Setup step by step

1. Install Node.js LTS.
2. `git clone` the repository.
3. `npm ci` (exact versions from the committed lockfile).
4. Copy `.dev.vars.example` → `.dev.vars` and fill the secrets (API bearer token, VAPID keys).
5. `npm run db:migrate` (applies migrations to the local D1).
6. `npm run dev` — one process: Vite HMR + real workerd + local D1.

## Day-to-day commands

| Action | Command |
|---|---|
| Run (dev, one command) | `npm run dev` |
| Test | `npm test` |
| Type-check + lint + format check | `npm run check` |
| Generate migration from schema change | `npm run db:generate` |
| Apply migrations (local) | `npm run db:migrate` |
| Export data snapshot (JSON + iCalendar, ADR-0003) | `npm run db:snapshot` |
| Deploy (build + assets + API + cron, one Worker) | `npm run deploy` |

## Known issues and troubleshooting

- **workerd crash on Windows:** if `npm run dev` crashes workerd on startup, update the Microsoft VC++ Redistributable — documented cause on Windows 11.
