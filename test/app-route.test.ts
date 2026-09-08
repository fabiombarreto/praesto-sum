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
//
// --- UPDATE (push-channel-proven phase 4, notifications-settings) ---------
// PRPs/prds/push-channel-proven.prd.md AC-9 (via plan AC-A1) needs two more
// reachable routes: `/settings/notifications` and
// `/settings/notifications/diagnostics`. Source plan:
// PRPs/plans/push-channel-proven-phase-4-notifications-settings.plan.md
// (Task 5 — src/shared/app-route.ts: extend AppRoute to four members,
// checking the most specific path first; no AC of its own, infrastructure
// for AC-A1/AC-A3). Every assertion below this point is ADDITIVE: none of
// the "today"/"settings" cases above changed shape or expectation — the
// module's existing two-member contract stays exactly as it was, and this
// suite only grows the vocabulary the same way the module does.
//
// This file is RED again for a NEW reason once Task 5 lands and before it:
// today `AppRoute` has only two members, so `routeFromPath`/`pathOf` cannot
// yet resolve the two new paths added below.

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

describe("routeFromPath — the two new AppRoute members (PRD AC-9 via plan AC-A1)", () => {
  it("maps /settings/notifications to notifications", () => {
    expect(routeFromPath("/settings/notifications")).toBe("notifications");
  });

  it("accepts a trailing slash on /settings/notifications", () => {
    expect(routeFromPath("/settings/notifications/")).toBe("notifications");
  });

  it("maps /settings/notifications/diagnostics to notifications-diagnostics — the MORE specific path wins", () => {
    expect(routeFromPath("/settings/notifications/diagnostics")).toBe("notifications-diagnostics");
  });

  it("accepts a trailing slash on the diagnostics path", () => {
    expect(routeFromPath("/settings/notifications/diagnostics/")).toBe("notifications-diagnostics");
  });

  it("resolves an unrecognised path nested under /settings/notifications to today, not to notifications", () => {
    expect(routeFromPath("/settings/notifications/unknown")).toBe("today");
  });
});

describe("pathOf — the two new AppRoute members (PRD AC-9 via plan AC-A1)", () => {
  it("maps notifications to /settings/notifications", () => {
    expect(pathOf("notifications")).toBe("/settings/notifications");
  });

  it("maps notifications-diagnostics to /settings/notifications/diagnostics", () => {
    expect(pathOf("notifications-diagnostics")).toBe("/settings/notifications/diagnostics");
  });
});

describe("routeFromPath and pathOf agree — the two new routes round-trip too", () => {
  it("round-trips notifications", () => {
    const route: AppRoute = "notifications";
    expect(routeFromPath(pathOf(route))).toBe(route);
  });

  it("round-trips notifications-diagnostics", () => {
    const route: AppRoute = "notifications-diagnostics";
    expect(routeFromPath(pathOf(route))).toBe(route);
  });
});
