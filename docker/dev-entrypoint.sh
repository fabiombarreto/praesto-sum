#!/bin/sh
# Praesto Sum — dev container entrypoint (ADR-0012).
#
# Three preflight checks, then hand over to the real command. Each one exists
# because its absence fails somewhere far from the cause: a stale dependency
# tree, the wrong platform's workerd, or a fail-closed auth gate that makes an
# unconfigured app look like a broken one.
set -eu

NODE_MODULES=/app/node_modules
STAMP="$NODE_MODULES/.praesto-lockfile-sha256"

# 1. node_modules must match the committed lockfile.
#    The named volume mounted here survives `docker compose down` and rebuilds,
#    so an image built after a dependency change does NOT by itself refresh it.
#    Compare fingerprints and reinstall when they differ — this is the same
#    "npm ci on return" rule the project already follows on the host (ADR-0005).
want=$(sha256sum /app/package-lock.json | cut -d " " -f 1)
have=$(cat "$STAMP" 2>/dev/null || echo none)

if [ "$want" != "$have" ]; then
  echo "praesto: node_modules does not match package-lock.json (have: $have) — running npm ci"
  # `npm ci` wipes node_modules, but this path is a volume mountpoint and
  # cannot be unlinked. Empty it in place, then install into it.
  find "$NODE_MODULES" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  npm ci
  echo "$want" > "$STAMP"
  echo "praesto: dependencies installed"
fi

# 2. The Linux workerd must be the one that is visible.
#    If the host's Windows node_modules ever leaks in (a removed volume, an
#    edited compose file), vite fails deep inside the Cloudflare plugin with a
#    message that names neither Docker nor the platform. Say it in one line.
if [ ! -d "$NODE_MODULES/@cloudflare/workerd-linux-64" ]; then
  echo "praesto: FATAL — @cloudflare/workerd-linux-64 is missing from $NODE_MODULES." >&2
  echo "praesto: the host node_modules (@cloudflare/workerd-windows-64) is probably" >&2
  echo "praesto: mounted over it. Restore the node_modules volume in compose.yaml," >&2
  echo "praesto: then run: npm run docker:rebuild" >&2
  exit 1
fi

# 3. .dev.vars must exist.
#    It is git-ignored, so a fresh clone has none, and src/worker/auth.ts is
#    fail-closed: without API_BEARER_TOKEN every API route answers 500 and the
#    app looks broken rather than unconfigured.
if [ ! -f /app/.dev.vars ]; then
  echo "praesto: FATAL — /app/.dev.vars not found." >&2
  echo "praesto: copy .dev.vars.example to .dev.vars on the host and fill it in" >&2
  echo "praesto: (see documentation/40-engineering/dev-environment.md)." >&2
  exit 1
fi

exec "$@"
