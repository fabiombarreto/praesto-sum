import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * The dev-only bearer token handed to the client so `vite dev` does not stop
 * at the TokenGate (chore C17, 2026-09-05).
 *
 * ADR-0003 safeguard 4 ("token on every route") is UNCHANGED by this: the
 * Worker still rejects every unauthenticated `/api/*` request, in dev exactly
 * as in production. What this removes is only the local re-typing of a token
 * the machine already holds — `.dev.vars` is the same file the Worker reads,
 * so no new secret is introduced and nothing new is written to disk.
 *
 * THREE independent guards keep it out of production, because the failure mode
 * (a live token inside a shipped bundle) is far worse than the friction it
 * removes:
 *   1. this function returns null unless Vite's mode is exactly "development",
 *      so `vite build` never even opens the file;
 *   2. `src/app/main.tsx` gates its only use behind `import.meta.env.DEV`,
 *      which is statically replaced with `false` at build time and tree-shaken
 *      away — the mechanism the DesignPlayground branch already documents;
 *   3. `scripts/check-dev-token-absent.mjs` greps the built bundle for both the
 *      placeholder name and the literal token value, and `npm run build` fails
 *      if either survives.
 */
function devApiToken(mode: string): string | null {
  if (mode !== "development") return null;
  try {
    const raw = readFileSync(".dev.vars", "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.trimStart().startsWith("API_BEARER_TOKEN"));
    if (!line) return null;
    const value = line.slice(line.indexOf("=") + 1).trim();
    // .dev.vars values appear both bare and quoted; accept either shape.
    const unquoted = value.replace(/^["']/, "").replace(/["']$/, "");
    return unquoted.length > 0 ? unquoted : null;
  } catch {
    // A machine that has never run local dev has no .dev.vars. Not an error —
    // the gate simply behaves exactly as it always did.
    return null;
  }
}

export default defineConfig(({ mode }) => ({
  // Always defined so the identifier never dangles; null outside development.
  define: {
    __DEV_API_TOKEN__: JSON.stringify(devApiToken(mode)),
  },
  // Vite 8 binds IPv6 (::1) by default; pinning IPv4 keeps curl/health checks
  // and e2e scripts deterministic on Windows. The dev container overrides the
  // host with `--host 0.0.0.0` on the command line, so this stays as written.
  //
  // PRAESTO_WATCH_POLLING is set ONLY by compose.yaml (ADR-0012). inotify does
  // not cross a Windows bind mount into Linux, so the watcher sees nothing and
  // HMR silently stops — measured 2026-08-24: an edit produced no update at
  // all, in the vite log or in the browser. Polling is the fix, and it is the
  // only one: vite does not read CHOKIDAR_USEPOLLING. Unset on the host, this
  // branch is inert and watching stays event-driven and free.
  server: {
    host: "127.0.0.1",
    ...(process.env.PRAESTO_WATCH_POLLING === "true"
      ? {
          watch: {
            usePolling: true,
            interval: 300,
            // Every poll is a stat() crossing the Windows/Linux boundary, so
            // the cost scales with how many files are watched. Vite already
            // ignores .git and node_modules; these are the rest of the tree
            // the dev server never serves. PRPs alone is half the remainder.
            ignored: [
              "**/PRPs/**",
              "**/documentation/**",
              "**/docs/**",
              "**/dist/**",
              "**/coverage/**",
              "**/.worktrees/**",
              // Also a correctness fix, not only a cost one: the Cloudflare
              // plugin writes into .wrangler/tmp while the server is running.
              "**/.wrangler/**",
            ],
          },
        }
      : {}),
  },
  plugins: [
    react(),
    // Tailwind v4 reads src/app/styles.css (ADR-0011); tokens.css stays the source of values.
    tailwindcss(),
    // Reads wrangler.jsonc automatically; `main` is the Worker entry. The Worker
    // runs inside real workerd during `vite dev`, in the same process as the SPA.
    cloudflare(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // We call registerSW() ourselves in src/app/pwa.ts.
      injectRegister: null,
      // 'prompt' requires the SKIP_WAITING message listener in src/sw.ts.
      registerType: "prompt",
      // The web app manifest is a static file at public/manifest.webmanifest and
      // is linked manually from index.html. Setting this to false prevents the
      // plugin from emitting a second manifest.webmanifest that would collide
      // with the public/ copy in dist/client.
      manifest: false,
      includeAssets: ["favicon.svg", "manifest.webmanifest", "icons/*.png", "fonts/*.woff2"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 3145728,
      },
      // No service worker during `vite dev` — the plugin's default, kept explicit.
      // A SW caching in development fights HMR and serves stale assets, and
      // src/app/pwa.ts refuses to register outside production anyway, so leaving
      // this on only compiled a file nobody ever requested.
      // To re-enable for SW debugging you need all three keys back:
      // `type: 'module'` (src/sw.ts uses ES imports; Chromium only, and production
      // always registers classic) and `navigateFallback: 'index.html'` (the dev
      // precache manifest is empty, so the NavigationRoute has nothing to resolve).
      devOptions: { enabled: false },
    }),
  ],
}));
