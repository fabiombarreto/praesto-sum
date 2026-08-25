# Praesto Sum — image for the optional containerised dev server (ADR-0012).
# `npm run dev` on the host stays the default and is untouched by this file.
#
# Two pins that are load-bearing, not taste:
#
#   * The tag is EXACT, like every version in package.json (ADR-0005's
#     save-exact discipline). node:24 or node:latest would let the runtime
#     under the project drift on a rebuild — the one thing that discipline
#     exists to prevent. 24.15.0 is also the owner's own host Node, so the
#     container and the host run the same runtime.
#   * Debian, never Alpine. The Cloudflare workerd binary is linked against
#     glibc; on musl it does not start, and the failure is a bare "not found"
#     from the loader that reads like a missing file.
FROM node:24.15.0-bookworm-slim

WORKDIR /app

# Dependency manifests only, so this layer caches until they actually change.
# .npmrc carries save-exact + engine-strict and must be present for `npm ci`
# to behave here exactly as it does on the host.
COPY package.json package-lock.json .npmrc ./

# Installs @cloudflare/workerd-linux-64. The host tree holds the *Windows*
# build (@cloudflare/workerd-windows-64) — mounting it over this directory is
# the trap compose.yaml's named volume exists to avoid.
RUN npm ci

# Fingerprint of the lockfile these node_modules were built from. The named
# volume outlives the image, so the entrypoint compares this against the
# lockfile on disk and reinstalls when they drift, instead of running the app
# against silently stale dependencies.
RUN sha256sum package-lock.json | cut -d " " -f 1 > /app/node_modules/.praesto-lockfile-sha256

COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/usr/local/bin/dev-entrypoint.sh"]
CMD ["npm", "run", "dev:container"]
