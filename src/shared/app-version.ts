/**
 * The app's build stamp, turned into the one line the owner reads on the
 * settings screen.
 *
 * The stamp itself is injected at build time by `vite.config.ts` as
 * `__APP_VERSION__` (see `src/app/globals.d.ts`), following the same
 * define-a-constant pattern `__DEV_API_TOKEN__` already uses. This module is
 * pure: no DOM, no clock, no dependency — the three cases that are actually
 * decidable (a real stamp, a development build, a stamp the build could not
 * resolve) are asserted in `test/app-version.test.ts`.
 *
 * Why a build stamp rather than a semantic version: `package.json` carries no
 * `version` field, and a number nobody remembers to bump answers the only
 * question this line exists for — "is the app in front of me the build I just
 * deployed?" — with a stale yes. The date plus the short commit answers it.
 */

/** What the build writes when it runs under `vite dev`. */
export const DEVELOPMENT_STAMP = "dev";

export function formatAppVersion(stamp: string | null | undefined): string {
  const trimmed = (stamp ?? "").trim();
  if (trimmed.length === 0) return "versão desconhecida";
  if (trimmed === DEVELOPMENT_STAMP) return "versão de desenvolvimento";
  return `versão ${trimmed}`;
}
