import { useCallback, useEffect, useRef, useState } from "react";
import { pathOf, routeFromPath, type AppRoute } from "../../shared/app-route";

/**
 * The exempt glue over `src/shared/app-route.ts`
 * (`docs/context/methodology.md`, "Browser-API work: split the logic out,
 * then the glue is exempt"): every routing DECISION lives in that pure
 * module; this hook only adds the `history.pushState` call, the `popstate`
 * listener, and `history.scrollRestoration = "manual"` (guidelines §12.4,
 * so SPA navigation restores scroll itself rather than the browser
 * guessing). No branch here may test a path literal — that would smuggle a
 * decision back into the glue this split exists to keep thin.
 */
export function useRoute(): {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  back: () => void;
} {
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname));
  // Whether the entry currently on screen is one `navigate` pushed, and so is
  // ours to pop. It is a browser-history fact, not a routing decision — the
  // decisions all stay in `app-route.ts`, which is what keeps this file glue.
  const pushedWithinApp = useRef(false);

  useEffect(() => {
    history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    function handlePopState(): void {
      // The entry we pushed is gone once it has been popped, so it is no
      // longer ours to pop a second time.
      pushedWithinApp.current = false;
      setRoute(routeFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    history.pushState(null, "", pathOf(next));
    pushedWithinApp.current = true;
    setRoute(next);
  }, []);

  const back = useCallback(() => {
    if (pushedWithinApp.current) {
      // POP the entry `navigate` pushed — never push another one. Pushing
      // would leave the stack at [/, /settings, /], so the next back gesture
      // from *Hoje* would return to /settings instead of leaving the app:
      // exactly the trap AC-A6 forbids ("pressing back again from *Hoje*
      // leaves the app rather than being trapped"). `popstate` then re-derives
      // the route, so no `setRoute` belongs here.
      history.back();
      return;
    }
    // Nothing of ours to pop: the owner ARRIVED at /settings, which is a real
    // and frequent path — the OAuth callback redirects straight into it
    // (Task 9), and a reload or a bookmark does the same. `history.back()`
    // here would walk out of the app into the consent flow. Replace instead,
    // so the stack still gains no second entry and the trap stays closed.
    history.replaceState(null, "", pathOf("today"));
    setRoute("today");
  }, []);

  return { route, navigate, back };
}
