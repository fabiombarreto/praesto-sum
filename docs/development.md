# Development

> Derived from `documentation/40-engineering/dev-environment.md` (authoritative). All commands below were executed and verified at the 2026-08-03 scaffold.

## Setup (clean machine → running, target ≤ 1 hour)

1. Install Node.js LTS (bundles npm).
2. `git clone` the repository.
3. `npm ci` (exact versions from the lockfile).
4. Copy `.dev.vars.example` → `.dev.vars`; fill API bearer token + VAPID keys.
5. `npm run db:migrate` (local D1).
6. `npm run dev` — one process: Vite HMR + real workerd + local D1.

Cloudflare account (free) + `wrangler login` are needed only for deploys and remote migrations. Keep the MS VC++ Redistributable current (workerd on Windows — see `docs/troubleshooting.md`).

## Day-to-day commands

| Action | Command |
|---|---|
| Dev (everything, one process) | `npm run dev` → http://127.0.0.1:5173 |
| Tests | `npm test` |
| Quality gate (types + `tsc -b` + lint + format) | `npm run check` |
| New migration from schema change | `npm run db:generate` then `npm run db:migrate` |
| Regenerate binding types after editing `wrangler.jsonc` | `npm run cf-typegen` |
| Exercise the PWA (service worker only exists in prod builds) | `npm run preview` |
| Deploy (assets + API + cron, one Worker) | `npm run deploy` |

`npm run db:snapshot` (FR-042 export) does not exist yet — it lands with the export slice.

## Adding a feature (the loop)

1. Read `documentation/README.md` + the relevant `docs/domain/areas/*.md`; run the Decision Gate (`docs/decision-gate.md`).
2. Schema first if data changes (`schema.ts` → generate → migrate), then worker route, then UI.
3. Tests per the guardrail (`docs/context/testing.md`).
4. Update the affected `documentation/` docs in the same session (maintenance map in `documentation/README.md`) — part of the Definition of Done.
5. Conventional commit referencing FR/ADR IDs.
