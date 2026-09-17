/**
 * Build-time constants substituted by `vite.config.ts`'s `define`.
 *
 * Declared under `src/app/` rather than at `src/` because that is exactly the
 * scope the constant has: `tsconfig.app.json` includes `src/app` and
 * `src/shared`, and only the browser bundle ever reads this value. Putting it
 * in `src/shared` would offer it to the Worker, the service worker and the test
 * project as well, none of which may see it.
 *
 * `__DEV_API_TOKEN__` carries the bearer token from `.dev.vars` during
 * `vite dev` and is `null` in every other mode, so the single branch that reads
 * it — in `src/app/main.tsx`, behind `import.meta.env.DEV` — is tree-shaken out
 * of the production bundle before the value could matter. See `devApiToken()`
 * in `vite.config.ts` for the three-guard rationale, and
 * `scripts/check-dev-token-absent.mjs` for the guard that inspects the built
 * artifact rather than trusting the intent.
 */
declare const __DEV_API_TOKEN__: string | null;

/**
 * `__APP_VERSION__` carries the build stamp the settings screen shows in its
 * corner: the build date and the short commit it was built from
 * (`2026-09-16 · 85f109b`), with ` · dev` appended under `vite dev`. It answers
 * one question
 * — is the app in front of me the build I just deployed? — which a
 * `package.json` version nobody remembers to bump answers wrongly.
 *
 * It is a plain string, never `null`. When `git` cannot be reached — a tarball
 * checkout with no `.git` — `buildStamp()` in `vite.config.ts` falls back to the
 * date alone rather than failing the build over a label. `formatAppVersion()` in
 * `src/shared/app-version.ts` handles the remaining degenerate cases (an empty
 * or absent stamp becomes "versão desconhecida", never an empty line).
 */
declare const __APP_VERSION__: string;
