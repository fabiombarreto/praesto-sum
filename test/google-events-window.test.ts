// PRPs/prds/events-and-day-view.prd.md AC-18 Google window and frozen contracts
//
// Source plan: PRPs/plans/events-and-day-view-phase-2-events-api-export-and-search.plan.md
// (AC-A10; Task 10 — optional `from` and `to` on `GET /api/google/events`, validated by the
// shared range module with a 31-day cap; Task 2 — that module).
//
// A NEW file on purpose (orchestrator clarification 4): test/task-list-contract.test.ts and
// the shipped Google route suites (test/google-calendar-routes.test.ts, test/google-routes.test.ts,
// test/google-events.test.ts) are the unmodified guard for the frozen contracts and must stay
// byte-identical to the fork point from `main`. This file only ADDS what the new parameters do.
//
// Written BEFORE the Implementer (test-first, per `tdd: true`). Which cases are RED today and
// which are not, said plainly:
//
//   * RED: every case that sends `from` and/or `to`. The shipped route ignores both and
//     answers its 7-day window, so the window assertions and the 400 assertions fail.
//   * GREEN today, by design: "with no parameters the window is the same 7-day window as
//     before". That is the frozen half of AC-18 — a guard that must still hold after the
//     Implementer's edit, not a missing-implementation case. It is derived INDEPENDENTLY of
//     the code (today plus eight local days, São Paulo UTC-3), so it fails if the default
//     window moves by even a day.
//
// "Span" is the INCLUSIVE count of calendar days: 2026-10-01 to 2026-10-31 is 31 and is
// accepted, 2026-11-01 is 32 and is refused. The window is exactly `from` through `to`
// inclusive: `timeMin` is the start of `from`, `timeMax` the start of the day AFTER `to`
// (Google treats `timeMax` as exclusive).
//
// The Google network is a stubbed `fetch`, the pattern of test/google-calendar-routes.test.ts
// (the pool offers no interception). Nothing here reaches Google.

import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { PRAESTO_TIMEZONE, todayIn } from "../src/shared/dates";
import { GOOGLE_READONLY_SCOPES } from "../src/shared/google-oauth";
import { createDb } from "../src/worker/db/client";
import { googleCalendarSelections, googleConnections, oauthStates } from "../src/worker/db/schema";
import { errorOf, names } from "./event-fixtures";
import { DRAIN_BUDGET_MS, isolatedIt as it, resetTaskTables } from "./isolation";

const EVENTS = "https://example.com/api/google/events";

let outbound: Request[] = [];

function auth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env.API_BEARER_TOKEN}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A Google that refreshes tokens and answers every calendar with one event. */
function happyGoogle(): void {
  outbound = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as RequestInfo, init);
    outbound.push(req);
    const url = new URL(req.url);
    if (url.pathname === "/token") return json({ access_token: "ya29.access" });
    if (url.pathname.includes("calendarList")) return json({ items: [] });
    return json({
      items: [
        {
          id: `evt-${url.pathname}`,
          summary: "Compromisso",
          start: { dateTime: "2026-10-20T15:00:00-03:00" },
          end: { dateTime: "2026-10-20T16:00:00-03:00" },
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

/** Every events.list call the route made, as the query it sent. */
function eventListCalls(): URL[] {
  return outbound
    .map((req) => new URL(req.url))
    .filter((url) => url.pathname.includes("/calendars/") && url.pathname.endsWith("/events"));
}

function get(query: string): Promise<Response> {
  return exports.default.fetch(query === "" ? EVENTS : `${EVENTS}?${query}`, auth());
}

interface WindowBody {
  events: Array<{ title: string | null }>;
  failedCalendars: string[];
  window: { timeMin: string; timeMax: string };
}

/** `day` shifted by `delta` calendar days, as YYYY-MM-DD. */
function shiftDay(day: string, delta: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

// `resetTaskTables()` drains abandoned work and wipes the Task and Event tables; the Google
// tables this suite writes are not its tables, so they are wiped here, after the drain.
beforeEach(async () => {
  await resetTaskTables();
  const db = createDb(env);
  await db.delete(googleCalendarSelections);
  await db.delete(googleConnections);
  await db.delete(oauthStates);
  happyGoogle();
}, DRAIN_BUDGET_MS);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/google/events — with no parameters the window is the same 7-day window (PRD AC-18)", () => {
  it("covers today through seven days later: timeMin today 00:00, timeMax the start of day +8", async () => {
    await connect();
    const today = todayIn(new Date(), PRAESTO_TIMEZONE);

    const res = await get("");
    const body = (await res.json()) as WindowBody;

    expect(res.status).toBe(200);
    expect(body.window).toEqual({
      timeMin: `${today}T00:00:00-03:00`,
      timeMax: `${shiftDay(today, 8)}T00:00:00-03:00`,
    });
  });

  it("asks Google for exactly the window it reports", async () => {
    await connect();

    const body = (await (await get("")).json()) as WindowBody;
    const [call] = eventListCalls();

    expect(eventListCalls()).toHaveLength(1);
    expect(call?.searchParams.get("timeMin")).toBe(body.window.timeMin);
    expect(call?.searchParams.get("timeMax")).toBe(body.window.timeMax);
  });

  it("still answers the same three keys", async () => {
    await connect();

    const body = (await (await get("")).json()) as WindowBody;

    expect(Object.keys(body).sort()).toEqual(["events", "failedCalendars", "window"]);
  });
});

describe("GET /api/google/events — with from and to the window is exactly that window (PRD AC-18)", () => {
  it("answers 2026-10-20 to 2026-10-21 as timeMin the 20th 00:00 and timeMax the 22nd 00:00", async () => {
    await connect();

    const res = await get("from=2026-10-20&to=2026-10-21");
    const body = (await res.json()) as WindowBody;

    expect(res.status).toBe(200);
    expect(body.window).toEqual({
      timeMin: "2026-10-20T00:00:00-03:00",
      timeMax: "2026-10-22T00:00:00-03:00",
    });
  });

  it("covers a single day: from = to ends at the start of the next day", async () => {
    await connect();

    const body = (await (await get("from=2026-10-20&to=2026-10-20")).json()) as WindowBody;

    expect(body.window).toEqual({
      timeMin: "2026-10-20T00:00:00-03:00",
      timeMax: "2026-10-21T00:00:00-03:00",
    });
  });

  it("asks Google for exactly that window, once per selected calendar", async () => {
    await connect();
    await createDb(env)
      .insert(googleCalendarSelections)
      .values([{ calendarId: "primary" }, { calendarId: "work@example.com" }]);

    const res = await get("from=2026-10-20&to=2026-10-21");
    const calls = eventListCalls();

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.searchParams.get("timeMin")).toBe("2026-10-20T00:00:00-03:00");
      expect(call.searchParams.get("timeMax")).toBe("2026-10-22T00:00:00-03:00");
    }
  });

  it("answers the same three keys and maps events as it always did", async () => {
    await connect();

    const body = (await (await get("from=2026-10-20&to=2026-10-21")).json()) as WindowBody;

    expect(Object.keys(body).sort()).toEqual(["events", "failedCalendars", "window"]);
    expect(body.events.map((event) => event.title)).toEqual(["Compromisso"]);
    expect(body.failedCalendars).toEqual([]);
  });

  it("reaches a window far from today, which the default window never could", async () => {
    await connect();

    const body = (await (await get("from=2027-03-01&to=2027-03-03")).json()) as WindowBody;

    expect(body.window).toEqual({
      timeMin: "2027-03-01T00:00:00-03:00",
      timeMax: "2027-03-04T00:00:00-03:00",
    });
  });

  it("accepts a span of exactly 31 days: 2026-10-01 to 2026-10-31", async () => {
    await connect();

    const res = await get("from=2026-10-01&to=2026-10-31");
    const body = (await res.json()) as WindowBody;

    expect(res.status).toBe(200);
    expect(body.window).toEqual({
      timeMin: "2026-10-01T00:00:00-03:00",
      timeMax: "2026-11-01T00:00:00-03:00",
    });
  });
});

describe("GET /api/google/events — a window the route refuses is a 400 naming the parameter (PRD AC-18)", () => {
  /** [what is wrong, the query string, the parameter keys at least one of which must be named] */
  const REFUSED: Array<[string, string, string[]]> = [
    ["a span of 32 days", "from=2026-10-01&to=2026-11-01", ["from", "to"]],
    ["a span of a year", "from=2026-01-01&to=2026-12-31", ["from", "to"]],
    ["a to before the from", "from=2026-10-21&to=2026-10-20", ["from", "to"]],
    ["only a from", "from=2026-10-20", ["to"]],
    ["only a to", "to=2026-10-21", ["from"]],
    ["a from that is not a date", "from=abc&to=2026-10-21", ["from"]],
    ["a to that is not a date", "from=2026-10-20&to=abc", ["to"]],
    ["a from of 2026-02-30", "from=2026-02-30&to=2026-03-02", ["from"]],
  ];

  it.each(REFUSED)("rejects %s with 400", async (_label, query, keys) => {
    await connect();

    const res = await get(query);

    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(keys.some((key) => names(error, key))).toBe(true);
  });

  it.each(REFUSED)(
    "rejects %s without calling Google at all: no token refresh, no events.list",
    async (_label, query) => {
      await connect();

      await get(query);

      expect(outbound).toHaveLength(0);
    },
  );

  it("rejects a bad window with 400 even when Google is not connected, not with 409", async () => {
    const res = await get("from=2026-10-01&to=2026-11-01");

    expect(res.status).toBe(400);
    expect(outbound).toHaveLength(0);
  });

  it("still answers 409 not_connected for a good window when nothing is connected", async () => {
    const res = await get("from=2026-10-20&to=2026-10-21");

    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("not_connected");
  });
});
