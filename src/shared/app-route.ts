/**
 * The navigation seam's decidable half (PRD AC-1, AC-4, AC-15 via plan
 * AC-A6) — path <-> route, both directions, total. Like
 * `src/shared/connectivity.ts` and `src/shared/toast.ts`, it only maps the
 * input it is handed and never touches the DOM, `history` or a timer.
 *
 * `src/app/hooks/useRoute.ts` is the exempt glue half of
 * `docs/context/methodology.md`'s "Browser-API work" split:
 * `history.pushState`, `popstate`, and `history.scrollRestoration` live
 * there, never here. This module is the decidable half, authored test-first
 * (`test/app-route.test.ts`).
 *
 * An unrecognised path resolves to `today` rather than throwing:
 * `not_found_handling: "single-page-application"` (`wrangler.jsonc`) serves
 * this SPA's shell for every unmatched path, so an unknown path is a real,
 * reachable input here, never an error case.
 *
 * **The path stays English** (`/settings`, not `/configuracoes`). ADR-0009's
 * pt-BR carve-out names "the string values the owner reads on screen
 * (labels, buttons, placeholders, states, notifications, manifest text)" —
 * not URLs — so ADR-0001 governs, and the existing dev-only `/design` route
 * (`src/app/main.tsx`) is the in-repo precedent.
 */

export type AppRoute = "today" | "settings";

/** Strips at most one trailing slash; the root path `/` itself is untouched. */
function withoutTrailingSlash(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function routeFromPath(pathname: string): AppRoute {
  return withoutTrailingSlash(pathname) === "/settings" ? "settings" : "today";
}

export function pathOf(route: AppRoute): string {
  return route === "settings" ? "/settings" : "/";
}
