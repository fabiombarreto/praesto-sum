---
status: active
last_updated: 2026-08-15
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
- **Cloudflare account** (free plan) with `npx wrangler login` completed once, for deploys and remote D1 migrations. Local dev needs no account.
- **Microsoft VC++ Redistributable kept current** — a known workerd crash on Windows is mitigated by this (CON-001; see Known issues).

> **Every `wrangler` command in this document is written `npx wrangler`, and must stay that way.** Wrangler is a pinned devDependency (`4.118.0`), never installed globally — ADR-0005's exact-pin discipline exists so that "nothing changed by itself", and a global wrangler would drift from the pinned one silently. `npm run *` scripts work bare because npm puts `node_modules/.bin` on PATH; a command typed straight into the shell does not, and answers `wrangler : O termo 'wrangler' não é reconhecido`. Corrected 2026-08-12, after the owner hit exactly that while rotating the API token.

## Setup step by step

1. Install Node.js 24 LTS (bundles npm).
2. `git clone` the repository.
3. `npm ci` (exact versions from the committed lockfile).
4. Copy `.dev.vars.example` → `.dev.vars` and fill the secrets. `API_BEARER_TOKEN` is any string you choose — you paste the same value into the PWA once per device. VAPID keys: `npx web-push generate-vapid-keys --json`.
5. `npm run db:migrate` (applies `migrations/` to the local D1 under `.wrangler/`).
6. `npm run dev` — one process: Vite HMR + real workerd + local D1, at `http://127.0.0.1:5173`.

**To deploy from a fresh clone** (not needed for local work): only `npx wrangler login`. The D1 database, its `database_id` in `wrangler.jsonc` and the `API_BEARER_TOKEN` secret were provisioned once on 2026-08-04 (chore C1) and are not per-machine. The full sequence, including what it costs to rebuild the account from zero, is the [Deploy runbook](#deploy-runbook) below.

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

## Deploy runbook

> Written from the **first real deploy, executed 2026-08-04** (chores C1–C3). Production is `https://praesto.fabiobarreto.workers.dev` — one Worker serving the SPA, `/api/*` and the 5-minute cron.
>
> Steps 1–4 are one-time account provisioning, already done; they are recorded so the account can be rebuilt from zero. Steps 5–8 are the recurring deploy — that is the part that must be mechanical.

### One-time provisioning (done 2026-08-04)

| # | Command | What it produced / what bit us |
|---|---|---|
| 1 | `npx wrangler login` | Browser OAuth. **It times out in about two minutes** waiting for the authorization; three attempts expired before one landed. If the browser does not open by itself, copy the printed URL. |
| 2 | `npx wrangler d1 create praesto-db` | `database_id` `57c2e21c-dcf6-4152-a3d1-6746c5972ee6`, region ENAM. Pasted over the placeholder in `wrangler.jsonc`. In a non-interactive shell wrangler answers "no" to editing the file for you — which is what we want: its snippet would rename the binding from `DB` to `praesto_db`. |
| 3 | `npm run cf-typegen` | **Produced no diff.** The generated types derive from binding *names*, not from the `database_id`, so `worker-configuration.d.ts` is byte-identical before and after a real database exists. `npm run check` still passes. Do not expect a commit here. |
| 4 | `npx wrangler secret put API_BEARER_TOKEN` | 32 random bytes, base64url. **The Worker did not exist yet, so wrangler created an empty one to hold the secret.** Harmless: the auth gate is fail-closed (`src/worker/auth.ts` answers 500 when the secret is missing), so no unauthenticated API ever existed. |

**Added 2026-08-11 (chore C11):** a second Worker secret, `GOOGLE_REFRESH_TOKEN`, holding the Google Calendar refresh token. Worker secrets are **write-only** — `npx wrangler secret list` returns names, never values — so the same token is also kept at `~/.praesto/google-oauth.json` (outside the repository, next to the OAuth client id and secret), because chore C12 must re-use the *same* token eight days later. Neither the token nor the client secret may enter the repository, `.dev.vars` included. Re-run the spike with `node scripts/google-calendar-spike.js list`; the script is a throwaway C11/C12 tool and no production code imports it.

### The recurring deploy

| # | Command | Expected |
|---|---|---|
| 5 | `npm run check` and `npm test` | Both green *before* anything touches production. Non-negotiable. |
| 6 | Read the pending SQL in `migrations/` | Confirm no `PRAGMA foreign_keys=OFF/ON` (see Known issues). `0000_neat_the_fallen.sql` is clean: `CREATE TABLE`/`CREATE INDEX` only. `0001_violet_pretty_boy.sql` recreates `tasks` and was hand-rewritten to `PRAGMA defer_foreign_keys=ON`. |
| 7 | `npm run db:migrate:remote` | Applies to **production** and auto-confirms in a non-interactive shell. The first run executed 17 commands. **If the pending migration rewrites an existing table, do the Remote migration steps below instead of running this bare.** |
| 8 | `npm run deploy` | Ends with the URL and `schedule: */5 * * * *`. |

### Remote migration over existing data

D1 holds the only canonical copy of the owner's data (ADR-0003), and chore C5
(automated snapshots) does not exist yet. Any migration that rewrites a table
that already carries rows runs these four steps, in this order, by hand. The
first one is the two-minute stand-in for C5.

| # | Command | Why |
|---|---|---|
| 1 | `npx wrangler d1 execute praesto-db --remote --command "SELECT * FROM tasks"` | Dump the table before touching it. Keep the output **off-repo** (it is personal data). This is the only copy that exists if the migration goes wrong. |
| 2 | `npx wrangler d1 migrations list praesto-db --remote` | Confirm exactly which migrations are pending — never assume. |
| 3 | `npm run db:migrate:remote` | Apply. |
| 4 | `npx wrangler d1 migrations list praesto-db --remote` | Confirm nothing is pending and the count matches step 2. |

Before step 1, the generated SQL must already have been read end to end and any
`PRAGMA foreign_keys=OFF/ON` rewritten as `PRAGMA defer_foreign_keys=ON` — D1
ignores the former inside a migration, so a table recreation that relies on it
can fail on foreign keys mid-flight. SQLite cannot alter a column type or add a
CHECK in place, so drizzle-kit emits a full `__new_<table>` recreate-copy-drop-
rename for those changes; read the recreated table's column list, indexes,
CHECKs and foreign keys against `src/worker/db/schema.ts` before applying.

### Two failures the first deploy hit

- **`workers.dev` subdomain.** The first `npm run deploy` uploaded the Worker and its assets, then failed with *"You need to register a workers.dev subdomain before publishing"*. The URL wrangler prints for this (`/workers/onboarding`) **404s** — the working page is `https://dash.cloudflare.com/<account-id>/workers/subdomain`. There is no wrangler command for it; it is a dashboard-only, account-wide setting. Note the page *changes* the subdomain rather than creating one — an account already has a default derived from the e-mail.
- **TLS propagation.** Right after the subdomain changed, every request to the new host failed with curl exit 35 (SSL connect error), not an HTTP status. It answered about a minute later. The dashboard warns about this; it is not a broken deploy, so poll instead of debugging.

### Smoke test (run after every deploy)

With `$TOKEN` = the production `API_BEARER_TOKEN` and `$BASE` = `https://praesto.fabiobarreto.workers.dev`:

| Check | Command | Expected |
|---|---|---|
| Gate closed | `curl -i $BASE/api/health` | `401 {"error":"Unauthorized"}` |
| Gate open | `curl -H "Authorization: Bearer $TOKEN" $BASE/api/health` | `200 {"ok":true}` |
| SPA served | `curl $BASE/` | `200 text/html`, the `Praesto Sum` shell |
| PWA installable | `curl -o /dev/null $BASE/manifest.webmanifest` and each `/icons/*.png` | `200`, correct byte sizes |
| D1 binding + migrations | `POST /api/tasks` then `GET /api/tasks` | `201` then the same Task back — this is the only check that proves the *remote* database and its migrations are up |
| Schema really applied | `npx wrangler d1 execute praesto-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` | `life_areas`, `push_subscriptions`, `recurrence_series`, `reminders`, `tasks`, `d1_migrations` |

The last check is manual and has no `curl` equivalent: **install the PWA and actually use it.** There is no browser/e2e suite (see `docs/context/testing.md`), so this is the only thing that exercises the UI. First run, 2026-08-04, by the owner on **Android (Chrome) and Windows**: the icon landed on the home screen on both, then create a Task → complete it → create another → delete it → reload, all green against production.

Two deploy warnings are expected and deliberate: `workers_dev` and `preview_urls` are absent from `wrangler.jsonc`, so both default to enabled. Preview URLs publish every version at its own hostname; that is acceptable only because every `/api/*` route is token-gated. Setting `preview_urls: false` is the move if that ever stops being true.

## Known issues and troubleshooting

- **workerd crash on Windows:** if `npm run dev` crashes workerd on startup, update the Microsoft VC++ Redistributable — documented cause on Windows 11.
- **No service worker in `vite dev`.** `src/app/pwa.ts` skips registration outside production builds (the `import.meta.env.PROD` guard), and `devOptions` in `vite.config.ts` is disabled to match, so nothing is generated to register either. Exercise the PWA (install, precache, push) with `npm run preview`.
- **Never write project files as UTF-8 with BOM.** Windows PowerShell's `Out-File -Encoding utf8` adds one, and the Vite/JSON parsers reject it (`Unexpected token '﻿'`). Use editors/tools that write plain UTF-8; `.gitattributes` handles line endings.
- **Migration review before every remote deploy.** When a schema change forces SQLite table recreation, drizzle-kit emits `PRAGMA foreign_keys=OFF/ON`, which passes locally but FAILS on remote D1. Hand-edit those to `PRAGMA defer_foreign_keys = true/false`. Part of the Definition of Done for schema changes.
- **`db:migrate:remote` targets production and auto-confirms** in non-interactive contexts. Never wire it into a watch script or CI.
- **Never run `drizzle-kit migrate` or `drizzle-kit push`.** wrangler owns the `d1_migrations` ledger; drizzle-kit would keep a second, independent one over the same database.
