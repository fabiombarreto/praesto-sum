/**
 * Unit 4 `google-calendar-read`, phase 3 — the calendar and event routes.
 *
 * Covers PRD **AC-15** (the calendar selection is honoured, with `primary` as
 * the documented default) and the route half of **AC-6**, plus the plan's
 * AC-A8: a failure from ONE calendar must never produce a silently shorter
 * list. That last one is the reason this unit exists — a screen showing fewer
 * commitments than exist is worse than a screen showing none, because the
 * owner cannot tell.
 */

import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_READONLY_SCOPES } from "../src/shared/google-oauth";
import { createDb } from "../src/worker/db/client";
import { googleCalendarSelections, googleConnections, oauthStates } from "../src/worker/db/schema";

const CALENDARS = "https://example.com/api/google/calendars";
const EVENTS = "https://example.com/api/google/events";

let outbound: Request[] = [];

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

/**
 * Routes the fake fetch by URL, so one stub can serve the token refresh, the
 * calendar list and per-calendar event queries in a single request cycle.
 */
function stubGoogle(handler: (url: URL, req: Request) => Response) {
  outbound = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as RequestInfo, init);
    outbound.push(req);
    return handler(new URL(req.url), req);
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CALENDAR_LIST = {
  items: [
    { id: "primary", summary: "Fabio", primary: true },
    { id: "work@example.com", summary: "Trabalho" },
  ],
};

/** A default happy path: refresh works, calendars list, every calendar returns one event. */
function happyGoogle(): void {
  stubGoogle((url) => {
    if (url.pathname === "/token") return json({ access_token: "ya29.access" });
    if (url.pathname.includes("calendarList")) return json(CALENDAR_LIST);
    return json({
      items: [
        {
          id: `evt-${url.pathname}`,
          summary: "Compromisso",
          start: { dateTime: "2026-08-28T15:00:00-03:00" },
          end: { dateTime: "2026-08-28T16:00:00-03:00" },
        },
      ],
    });
  });
}

async function connect(): Promise<void> {
  await createDb(env)
    .insert(googleConnections)
    .values({
      id: "default",
      refreshToken: "stored-refresh-token",
      scope: GOOGLE_READONLY_SCOPES.join(" "),
    });
}

beforeEach(async () => {
  const db = createDb(env);
  await db.delete(googleCalendarSelections);
  await db.delete(googleConnections);
  await db.delete(oauthStates);
  happyGoogle();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/google/calendars (AC-15)", () => {
  it("lists the owner's calendars", async () => {
    await connect();

    const res = await exports.default.fetch(CALENDARS, auth());
    const body = (await res.json()) as { calendars: { id: string; selected: boolean }[] };

    expect(res.status).toBe(200);
    expect(body.calendars.map((c) => c.id)).toEqual(["primary", "work@example.com"]);
  });

  it("marks ONLY primary selected when the owner has never chosen", async () => {
    // The documented default. An empty selection table means "never chosen",
    // not "nothing selected" — a distinction the schema cannot express, so the
    // route owns it explicitly.
    await connect();

    const res = await exports.default.fetch(CALENDARS, auth());
    const body = (await res.json()) as { calendars: { id: string; selected: boolean }[] };

    expect(body.calendars.find((c) => c.id === "primary")?.selected).toBe(true);
    expect(body.calendars.find((c) => c.id === "work@example.com")?.selected).toBe(false);
  });

  it("reflects an explicit selection once made", async () => {
    await connect();
    await createDb(env).insert(googleCalendarSelections).values({ calendarId: "work@example.com" });

    const res = await exports.default.fetch(CALENDARS, auth());
    const body = (await res.json()) as { calendars: { id: string; selected: boolean }[] };

    expect(body.calendars.find((c) => c.id === "work@example.com")?.selected).toBe(true);
    expect(body.calendars.find((c) => c.id === "primary")?.selected).toBe(false);
  });

  it("fails CLOSED — not 5xx — when there is no connection at all", async () => {
    const res = await exports.default.fetch(CALENDARS, auth());

    // 4xx, deliberately. A 500 would satisfy `not.toBe(200)` just as well,
    // which is why that weaker assertion was replaced: a crash and a
    // fail-closed answer must not be indistinguishable.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(outbound).toHaveLength(0);
  });

  it("says NOT CONNECTED in a way phase 4 can tell apart from GOOGLE DOWN", async () => {
    // The plan's Task 5 obligation, and it needs BOTH responses to be
    // meaningful: the owner acts differently on "connect your calendar" than
    // on "try again later", and only a machine-readable discriminator lets
    // the screen choose the right sentence.
    const disconnected = await exports.default.fetch(CALENDARS, auth());
    const disconnectedBody = (await disconnected.json()) as { reason?: string };

    await connect();
    stubGoogle((url) =>
      url.pathname === "/token" ? json({ error: "backend_error" }, 503) : json({}, 503),
    );
    const googleDown = await exports.default.fetch(CALENDARS, auth());
    const googleDownBody = (await googleDown.json()) as { reason?: string };

    expect(disconnectedBody.reason).toBe("not_connected");
    expect(googleDownBody.reason).toBeDefined();
    expect(googleDownBody.reason).not.toBe("not_connected");
  });

  it("answers 401 without a bearer token", async () => {
    await connect();

    expect((await exports.default.fetch(CALENDARS)).status).toBe(401);
  });
});

describe("PUT /api/google/calendars (AC-15)", () => {
  it("replaces the selection with the posted ids", async () => {
    await connect();

    const res = await exports.default.fetch(
      CALENDARS,
      auth({ method: "PUT", body: JSON.stringify({ calendarIds: ["work@example.com"] }) }),
    );

    expect(res.status).toBeLessThan(400);
    const rows = await createDb(env).select().from(googleCalendarSelections);
    expect(rows.map((r) => r.calendarId)).toEqual(["work@example.com"]);
  });

  it("replaces rather than appends, so deselecting actually deselects", async () => {
    await connect();
    await createDb(env).insert(googleCalendarSelections).values({ calendarId: "primary" });

    await exports.default.fetch(
      CALENDARS,
      auth({ method: "PUT", body: JSON.stringify({ calendarIds: ["work@example.com"] }) }),
    );

    const rows = await createDb(env).select().from(googleCalendarSelections);
    expect(rows.map((r) => r.calendarId)).toEqual(["work@example.com"]);
  });

  it("rejects a calendar id that is not the owner's", async () => {
    // Storing an unknown id would produce a selection that queries nothing and
    // reports no error — a silent empty day.
    await connect();

    const res = await exports.default.fetch(
      CALENDARS,
      auth({ method: "PUT", body: JSON.stringify({ calendarIds: ["someone-elses@example.com"] }) }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("rejects an empty calendar id", async () => {
    await connect();

    const res = await exports.default.fetch(
      CALENDARS,
      auth({ method: "PUT", body: JSON.stringify({ calendarIds: [""] }) }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("answers 401 without a bearer token, and stores nothing", async () => {
    await connect();

    const res = await exports.default.fetch(CALENDARS, {
      method: "PUT",
      body: JSON.stringify({ calendarIds: ["work@example.com"] }),
    });

    expect(res.status).toBe(401);
    expect(await createDb(env).select().from(googleCalendarSelections)).toHaveLength(0);
  });
});

describe("GET /api/google/events (AC-6)", () => {
  it("queries only the selected calendars", async () => {
    await connect();
    await createDb(env).insert(googleCalendarSelections).values({ calendarId: "work@example.com" });

    await exports.default.fetch(EVENTS, auth());

    const eventCalls = outbound.filter((r) => r.url.includes("/events"));
    expect(eventCalls).toHaveLength(1);
    expect(eventCalls[0]!.url).toContain(encodeURIComponent("work@example.com"));
  });

  it("queries primary alone when the owner has never chosen", async () => {
    await connect();

    await exports.default.fetch(EVENTS, auth());

    const eventCalls = outbound.filter((r) => r.url.includes("/events"));
    expect(eventCalls).toHaveLength(1);
    expect(eventCalls[0]!.url).toContain("primary");
  });

  it("returns mapped events, never Google's raw payload", async () => {
    await connect();

    const res = await exports.default.fetch(EVENTS, auth());
    const body = (await res.json()) as { events: { title: string | null; allDay: boolean }[] };

    expect(res.status).toBe(200);
    expect(body.events[0]).toMatchObject({ title: "Compromisso", allDay: false });
  });

  it("carries no syncToken on any outbound events call", async () => {
    await connect();

    await exports.default.fetch(EVENTS, auth());

    for (const call of outbound.filter((r) => r.url.includes("/events"))) {
      expect(new URL(call.url).searchParams.has("syncToken")).toBe(false);
    }
  });

  it("answers 401 without a bearer token", async () => {
    await connect();

    expect((await exports.default.fetch(EVENTS)).status).toBe(401);
  });
});

describe("GET /api/google/events — a partial failure is never a shorter list (AC-A8)", () => {
  it("returns the healthy calendar's events AND reports the failed one", async () => {
    await connect();
    await createDb(env)
      .insert(googleCalendarSelections)
      .values([{ calendarId: "primary" }, { calendarId: "work@example.com" }]);

    stubGoogle((url) => {
      if (url.pathname === "/token") return json({ access_token: "ya29.access" });
      if (url.pathname.includes("calendarList")) return json(CALENDAR_LIST);
      if (url.pathname.includes(encodeURIComponent("work@example.com"))) {
        return json({ error: "backendError" }, 503);
      }
      return json({
        items: [
          {
            id: "evt-ok",
            summary: "Sobreviveu",
            start: { dateTime: "2026-08-28T15:00:00-03:00" },
            end: { dateTime: "2026-08-28T16:00:00-03:00" },
          },
        ],
      });
    });

    const res = await exports.default.fetch(EVENTS, auth());
    const body = (await res.json()) as {
      events: { title: string | null }[];
      failedCalendars: string[];
    };

    // Both halves matter: the events that DID arrive are returned...
    expect(body.events.map((e) => e.title)).toEqual(["Sobreviveu"]);
    // ...and the failure is visible, so the screen can say the day is
    // incomplete rather than quietly showing less than exists.
    expect(body.failedCalendars).toContain("work@example.com");
  });

  it("reports a dead credential distinguishably from a transient outage", async () => {
    await connect();
    stubGoogle((url) => {
      if (url.pathname === "/token") return json({ error: "invalid_grant" }, 400);
      return json({}, 500);
    });

    const res = await exports.default.fetch(EVENTS, auth());

    // A revoked or expired credential is "reconnect", not "try again later".
    expect(res.status).not.toBe(200);
    expect(await res.text()).toMatch(/invalid_grant|reconnect|reconect/i);
  });
});
