// PRPs/prds/events-and-day-view.prd.md AC-15 Bearer gate
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A7; Task 9 — `app.route("/api/events", eventRoutes)` mounted BELOW the existing
// `app.use("/api/*", requireToken)`; the prefix is the authorization, the router adds no auth
// code of its own).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`). A trap this file is built
// around: the gate already answers 401 for ANY `/api/*` path, mounted or not. So the two
// negative requests below would pass today by accident. Each case therefore ends with a
// positive control, the same request with the right token, which must reach the route and
// succeed. That control answers 404 until the router is mounted, which is the RED reason.
//
// "Nothing is read or written": the database is compared before and after the refused
// requests, and the response body of a refused read must not carry the seeded Event's title.
// Order matters: the refused requests run first, the positive control last, because the
// control for POST, PATCH and DELETE changes the database on purpose.

import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect } from "vitest";
import { EVENTS_URL, allEvents, call, countLinks, saoPaulo, seedTimed } from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const ID = "evt-gated";
const SECRET_TITLE = "Segredo do dentista";
const START = saoPaulo(2026, 10, 20, 9, 30);

beforeEach(resetTaskTables, DRAIN_BUDGET_MS);

/** [label, method, path, JSON body (if any), the status the same request earns WITH the token] */
const ROUTES: Array<[string, string, string, unknown, number]> = [
  ["POST /api/events", "POST", EVENTS_URL, { title: "Intruso", startAt: START }, 201],
  [
    "GET /api/events (a range)",
    "GET",
    `${EVENTS_URL}?from=2026-10-20&to=2026-10-21`,
    undefined,
    200,
  ],
  ["GET /api/events (a search)", "GET", `${EVENTS_URL}?q=segredo`, undefined, 200],
  ["PATCH /api/events/:id", "PATCH", `${EVENTS_URL}/${ID}`, { title: "Sequestrado" }, 200],
  ["DELETE /api/events/:id", "DELETE", `${EVENTS_URL}/${ID}`, undefined, 204],
];

function send(
  method: string,
  path: string,
  body: unknown,
  headers: HeadersInit = {},
): Promise<Response> {
  return exports.default.fetch(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("every /api/events route needs the bearer token (PRD AC-15)", () => {
  it.each(ROUTES)(
    "%s answers 401 with no Authorization header or a wrong token, touching nothing",
    async (_label, method, path, body, withTokenStatus) => {
      await seedTimed({ id: ID, title: SECRET_TITLE, startAt: START });
      const eventsBefore = await allEvents();
      const linksBefore = await countLinks();

      const noHeader = await send(method, path, body);
      const wrongToken = await send(method, path, body, {
        Authorization: "Bearer not-the-token",
        "Content-Type": "application/json",
      });

      expect(noHeader.status).toBe(401);
      expect(wrongToken.status).toBe(401);
      expect(await noHeader.text()).not.toContain(SECRET_TITLE);
      expect(await wrongToken.text()).not.toContain(SECRET_TITLE);
      expect(await allEvents()).toEqual(eventsBefore);
      expect(await countLinks()).toBe(linksBefore);

      // Positive control: the same request WITH the token reaches the route.
      const authorized = await call(method, path, body);
      expect(authorized.status).toBe(withTokenStatus);
    },
  );

  it("does not accept the token without the Bearer scheme", async () => {
    await seedTimed({ id: ID, title: SECRET_TITLE, startAt: START });

    const bareToken = await send("GET", `${EVENTS_URL}?q=segredo`, undefined, {
      Authorization: env.API_BEARER_TOKEN,
    });
    const authorized = await call("GET", `${EVENTS_URL}?q=segredo`);

    expect(bareToken.status).toBe(401);
    expect(authorized.status).toBe(200);
  });
});
