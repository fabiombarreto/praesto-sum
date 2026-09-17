/**
 * The app's build stamp, turned into the one line the owner reads on the
 * settings screen.
 *
 * The stamp itself is injected at build time by `vite.config.ts` as
 * `__APP_VERSION__` (see `src/app/globals.d.ts`), following the same
 * define-a-constant pattern `__DEV_API_TOKEN__` already uses. This module is
 * pure: no DOM, no clock, no dependency — every decidable case is asserted in
 * `test/app-version.test.ts`.
 *
 * Why a build stamp rather than a semantic version: `package.json` carries no
 * `version` field, and a number nobody remembers to bump answers the only
 * question this line exists for — "is the app in front of me the build I just
 * deployed?" — with a stale yes. The date plus the short commit answers it.
 *
 * A development build carries the same date and commit, plus a `dev` marker
 * (2026-09-16, at the owner's request): the first version of this line read
 * "versão de desenvolvimento" and nothing else, which hid the very number the
 * line exists to show.
 */

/** The marker `buildStamp()` appends under `vite dev`. */
export const DEVELOPMENT_MARKER = "dev";

const SEPARATOR = " · ";

export function formatAppVersion(stamp: string | null | undefined): string {
  const trimmed = (stamp ?? "").trim();
  if (trimmed.length === 0) return "versão desconhecida";
  if (trimmed === DEVELOPMENT_MARKER) return "versão de desenvolvimento";

  const parts = trimmed.split(SEPARATOR);
  if (parts[parts.length - 1] === DEVELOPMENT_MARKER) {
    const rest = parts.slice(0, -1).join(SEPARATOR);
    // A stamp that is only the marker was handled above, so `rest` is never
    // empty here; the guard costs one comparison and removes the doubt.
    return rest.length === 0 ? "versão de desenvolvimento" : `versão ${rest} (desenvolvimento)`;
  }

  return `versão ${trimmed}`;
}
