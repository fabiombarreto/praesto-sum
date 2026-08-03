# Troubleshooting

> Known pitfalls collected from the ADR research (Aug 2026). Add real incidents here as they happen.

## workerd crashes on `npm run dev` (Windows)

Documented cause on Windows 11: outdated Microsoft VC++ Redistributable. Update it and retry (CON-001 note in `documentation/40-engineering/dev-environment.md`).

## Push notifications silently not arriving

Push failure is silent by nature. Check, in order: VAPID keys present as secrets (`.dev.vars` / `wrangler secret`); the dedicated VAPID integration test passes; the PWA is installed (iOS REQUIRES home-screen install for Web Push); subscription not expired (cron should prune dead subscriptions). A manual test-push route saves hours.

## The PWA shows a stale version ("it doesn't update")

Classic service-worker cache failure. The SW update flow (skipWaiting, versioned caches from the build hash) must be exercised before MVP ship — see ADR-0005 consequences. When debugging: DevTools → Application → Service Workers → Update/Skip waiting.

## Migrations differ between local and remote

Migrations are ALWAYS applied via `wrangler d1 migrations apply` (local and `--remote`). Never apply schema changes ad hoc; never let drizzle-kit push directly. If states diverge, compare `d1_migrations` table on both sides.

## "Server unreachable" in the PWA

By design the client is network-dependent (no offline writes). Check the Worker deploy status and the token; the UX must always show this state explicitly rather than spinning.
