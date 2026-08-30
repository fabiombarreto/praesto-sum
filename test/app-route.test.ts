// PRPs/prds/google-calendar-read.prd.md AC-1, AC-4, AC-15 — the navigation
// seam that makes `/settings` reachable at all. None of the three ACs' own
// wording changes here (their server-route behaviour is already covered —
// see test/google-routes.test.ts and test/google-calendar-routes.test.ts);
// what phase 5 adds is the PRECONDITION that a screen exists to call them
// from. The plan's own AC-A6 states the observable contract this module
// exists to satisfy: Android back (or Esc, or the header's back affordance)
// returns to Hoje from settings, and pressing back again from Hoje leaves the
// app — `/settings` is a real history entry, never a sheet.
//
// Source plan: PRPs/plans/google-calendar-read-phase-5-consent-made-visible.plan.md
// (Task 1 — src/shared/app-route.ts: AppRoute, routeFromPath, pathOf; plan AC-A6)
//
// Pure, DOM-free unit under test: path <-> route, both directions, total (an
// unrecognised path resolves to `today` rather than throwing, because
// `not_found_handling: "single-page-application"` serves the SPA shell for
// every unmatched path — an unknown path is a real, reachable input, not an
// error case). The actual `history.pushState` / `popstate` / Android-back
// mechanics live in `src/app/hooks/useRoute.ts` — the exempt glue half of
// `docs/context/methodology.md`'s "Browser-API work" split, verified on the
// device (CON-007), never here.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/app-route.ts does not exist yet, so this file is RED for the
// right reason (module-not-found on the import below) until plan Task 1 lands.

import { describe, expect, it } from "vitest";
import { pathOf, routeFromPath, type AppRoute } from "../src/shared/app-route";

describe("routeFromPath", () => {
  it("maps the root path to today", () => {
    expect(routeFromPath("/")).toBe("today");
  });

  it("maps /settings to settings", () => {
    expect(routeFromPath("/settings")).toBe("settings");
  });

  it("accepts a trailing slash on /settings", () => {
    expect(routeFromPath("/settings/")).toBe("settings");
  });

  it("resolves an unrecognised path to today rather than throwing", () => {
    expect(() => routeFromPath("/does-not-exist")).not.toThrow();
    expect(routeFromPath("/does-not-exist")).toBe("today");
  });

  it("resolves an unrecognised NESTED path to today too — there is no third route", () => {
    expect(routeFromPath("/settings/nested/unknown")).toBe("today");
  });
});

describe("pathOf", () => {
  it("maps today to the root path", () => {
    expect(pathOf("today")).toBe("/");
  });

  it("maps settings to /settings", () => {
    expect(pathOf("settings")).toBe("/settings");
  });
});

describe("routeFromPath and pathOf agree — a route survives its own round trip", () => {
  it("round-trips today", () => {
    const route: AppRoute = "today";
    expect(routeFromPath(pathOf(route))).toBe(route);
  });

  it("round-trips settings", () => {
    const route: AppRoute = "settings";
    expect(routeFromPath(pathOf(route))).toBe(route);
  });
});
