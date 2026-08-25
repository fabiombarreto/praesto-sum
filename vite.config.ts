import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
});
