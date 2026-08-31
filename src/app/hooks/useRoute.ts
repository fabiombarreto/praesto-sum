import { useCallback, useEffect, useState } from "react";
import { pathOf, routeFromPath, type AppRoute } from "../../shared/app-route";

/** Marks a history entry this app pushed, so `back()` knows it is ours to pop. */
const PUSHED_BY_APP = { praesto: "pushed" } as const;

function isOurs(state: unknown): boolean {
  return (state as { praesto?: string } | null)?.praesto === PUSHED_BY_APP.praesto;
}

/**
 * The exempt glue over `src/shared/app-route.ts`
 * (`docs/context/methodology.md`, "Browser-API work: split the logic out,
 * then the glue is exempt"): every routing DECISION — which path is which
 * route — lives in that pure module. This hook adds four things and nothing
 * else: the `history.pushState` call, the `popstate` listener,
 * `history.scrollRestoration = "manual"` (guidelines §12.4, so SPA navigation
 * restores scroll itself rather than the browser guessing), and the
 * `PUSHED_BY_APP` marker plus the `isOurs` test `back()` branches on.
 *
 * That fourth item is named here rather than left out of the count, because
 * an enumeration that says "only" while the file does more is the kind of
 * stale claim this phase already had to fix once elsewhere. It reads a fact
 * about the browser's own history — did WE push the entry on screen — which
 * is what the adapter exists to know; it decides no route. `isOurs` is pure
 * and would be testable in `app-route.ts`, but `src/shared/` here is
 * authored test-first (ADR-0008) and its suite is owned by the test pair, so
 * moving it without coverage would trade a documented device-verified
 * exemption for an undocumented gap. Move it when a test can move with it.
 *
 * No branch here may test a path literal — that would smuggle a real routing
 * decision back into the glue this split exists to keep thin.
 */
export function useRoute(): {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  back: () => void;
} {
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    function handlePopState(): void {
      setRoute(routeFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    history.pushState(PUSHED_BY_APP, "", pathOf(next));
    setRoute(next);
  }, []);

  const back = useCallback(() => {
    // The marker travels WITH the entry, so this reads the entry actually on
    // screen — including one reached by the browser's forward button, which a
    // "did we push?" flag kept beside the history could only get wrong.
    if (isOurs(history.state)) {
      // POP the entry `navigate` pushed — never push another one. Pushing a
      // second entry for the previous route would leave three where there were
      // two, so the next back gesture from *Hoje* would land back on this
      // screen instead of leaving the app: exactly the trap AC-A6 forbids
      // ("pressing back again from *Hoje* leaves the app rather than being
      // trapped"). `popstate` then re-derives the route, so no `setRoute` here.
      history.back();
      return;
    }
    // Nothing of ours to pop: the owner ARRIVED on this screen, which is a real
    // and frequent path — the OAuth callback redirects straight into it
    // (Task 9), and a reload or a bookmark does the same. `history.back()` here
    // would walk out of the app into the consent flow. Replace instead, so the
    // stack still gains no second entry and the trap stays closed.
    history.replaceState(null, "", pathOf("today"));
    setRoute("today");
  }, []);

  return { route, navigate, back };
}
