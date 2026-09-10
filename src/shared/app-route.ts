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

export type AppRoute =
  "today" | "settings" | "notifications" | "notifications-diagnostics" | `task/${string}`;

/** Strips at most one trailing slash; the root path `/` itself is untouched. */
function withoutTrailingSlash(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Builds the Task-linked route for a given Task id. */
export function taskRouteOf(taskId: string): AppRoute {
  return `task/${taskId}`;
}

/** Recovers the Task id from a Task-linked route, or `null` for every other route. */
export function taskIdFromRoute(route: AppRoute): string | null {
  if (!route.startsWith("task/")) return null;
  return route.slice("task/".length);
}

const TASK_PATH_PATTERN = /^\/tasks\/([^/]+)$/;

export function routeFromPath(pathname: string): AppRoute {
  const path = withoutTrailingSlash(pathname);
  const taskMatch = TASK_PATH_PATTERN.exec(path);
  if (taskMatch !== null) {
    const taskId = taskMatch[1];
    if (taskId !== undefined && taskId !== "") return taskRouteOf(taskId);
  }
  if (path === "/settings/notifications/diagnostics") return "notifications-diagnostics";
  if (path === "/settings/notifications") return "notifications";
  if (path === "/settings") return "settings";
  return "today";
}

export function pathOf(route: AppRoute): string {
  if (route.startsWith("task/")) return `/tasks/${taskIdFromRoute(route)}`;
  if (route === "notifications-diagnostics") return "/settings/notifications/diagnostics";
  if (route === "notifications") return "/settings/notifications";
  if (route === "settings") return "/settings";
  return "/";
}
