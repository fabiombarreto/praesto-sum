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
import {
  pathOf,
  routeFromPath,
  taskIdFromRoute,
  taskRouteOf,
  type AppRoute,
} from "../src/shared/app-route";

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

// --- UPDATE (reminders phase 3, per-Task route) ----------------------------
// PRPs/prds/reminders.prd.md AC-8 The payload deep-links to the Task, not to
// the home screen (via plan AC-A1). Source plan:
// PRPs/plans/reminders-phase-3-per-task-route-and-reminder-ui.plan.md
// (Task 1 — src/shared/app-route.ts: widen AppRoute with a template-literal
// `` `task/${string}` `` member; add taskRouteOf/taskIdFromRoute; extend
// routeFromPath to match `/tasks/:id` before falling through to `today`,
// checking the most specific path first, the same convention already used
// for the three settings routes above).
//
// This file is RED again for a NEW reason once Task 1 lands and before it:
// today `taskRouteOf`/`taskIdFromRoute` do not exist at all (a compile-time
// import error on the two names added to the import above), and
// `routeFromPath`/`pathOf` do not recognise a `/tasks/:id` path or a `task/`
// route at all — every assertion below fails for one of those two reasons
// until Task 1 lands. Every assertion ABOVE this point is untouched: the
// existing four-member contract keeps exactly its prior shape and expectation.

describe("taskRouteOf / taskIdFromRoute", () => {
  it("taskRouteOf builds a task/<id> route from a Task id", () => {
    expect(taskRouteOf("abc-123")).toBe("task/abc-123");
  });

  it("taskIdFromRoute recovers the id from a task/<id> route", () => {
    expect(taskIdFromRoute(taskRouteOf("abc-123"))).toBe("abc-123");
  });

  it("taskIdFromRoute returns null for every non-Task route", () => {
    expect(taskIdFromRoute("today")).toBeNull();
    expect(taskIdFromRoute("settings")).toBeNull();
    expect(taskIdFromRoute("notifications")).toBeNull();
    expect(taskIdFromRoute("notifications-diagnostics")).toBeNull();
  });
});

describe("routeFromPath — the Task route (PRD AC-8 via plan AC-A1)", () => {
  it("maps /tasks/:id to the corresponding Task route", () => {
    expect(routeFromPath("/tasks/abc-123")).toBe(taskRouteOf("abc-123"));
  });

  it("accepts a trailing slash on a Task path", () => {
    expect(routeFromPath("/tasks/abc-123/")).toBe(taskRouteOf("abc-123"));
  });

  it("resolves the bare /tasks path (no id segment) to today, not to an empty Task route", () => {
    expect(routeFromPath("/tasks/")).toBe("today");
    expect(routeFromPath("/tasks")).toBe("today");
  });

  it("resolves a Task path with a further nested segment to today — there is exactly one segment", () => {
    expect(routeFromPath("/tasks/abc-123/extra")).toBe("today");
  });
});

describe("pathOf — the Task route (PRD AC-8 via plan AC-A1)", () => {
  it("maps a Task route back to /tasks/:id", () => {
    expect(pathOf(taskRouteOf("abc-123"))).toBe("/tasks/abc-123");
  });
});

describe("routeFromPath and pathOf agree — the Task route round-trips (AC-8's own headline contract)", () => {
  it("round-trips a Task path: pathOf(routeFromPath(p)) === p", () => {
    const p = "/tasks/abc-123";
    expect(pathOf(routeFromPath(p))).toBe(p);
  });

  it("round-trips a Task path built from a UUID-shaped id", () => {
    const p = "/tasks/3f6e6b0a-8c1a-4e2d-9a4f-2b6a7c8d9e0f";
    expect(pathOf(routeFromPath(p))).toBe(p);
  });

  it("round-trips a Task AppRoute value itself, not just its path", () => {
    const route: AppRoute = taskRouteOf("abc-123");
    expect(routeFromPath(pathOf(route))).toBe(route);
  });
});
