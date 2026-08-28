/**
 * Unit 4 `google-calendar-read`, phase 3 — the three read operations.
 *
 * Covers PRD **AC-6** (the events query is a bounded window carrying no
 * `syncToken`) and **AC-13** (read-only by construction).
 *
 * The most load-bearing assertion in this file is a NEGATIVE one: that
 * `events.list` carries no `syncToken`. Google returns 400 when a sync token
 * accompanies `timeMin`/`timeMax`/`orderBy`, so a bounded window and
 * incremental sync are mutually exclusive — and proving a parameter is ABSENT
 * needs the outbound request itself, which is exactly what the injected
 * `fetch` hands over. `fetchMock` was removed from `cloudflare:test` in pool
 * 0.13.x, so this is the seam, not a workaround.
 */

import { describe, expect, it } from "vitest";
import { listCalendars, listEvents, refreshAccessToken } from "../src/worker/google/client";

const ACCESS = "ya29.access-token";

function recorder(reply: () => Response | Promise<Response>) {
  const calls: Request[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push(new Request(input as RequestInfo, init));
    return reply();
  };
  return { calls, fetchImpl };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("refreshAccessToken", () => {
  const CREDS = { clientId: "cid", clientSecret: "secret" };

  it("sends the refresh_token grant to the token endpoint", async () => {
    const { calls, fetchImpl } = recorder(() => json({ access_token: ACCESS, expires_in: 3599 }));

    await refreshAccessToken("rt", CREDS, { fetchImpl });

    expect(calls[0]!.url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0]!.method).toBe("POST");
    const body = new URLSearchParams(await calls[0]!.text());
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt");
  });

  it("returns the access token", async () => {
    const { fetchImpl } = recorder(() => json({ access_token: ACCESS }));

    const result = await refreshAccessToken("rt", CREDS, { fetchImpl });

    expect(result.ok && result.accessToken).toBe(ACCESS);
  });

  it("distinguishes invalid_grant from a transient failure", async () => {
    // A dead or revoked credential is not "try again later" — it is
    // "reconnect", and only phase 4 can say the right sentence if this
    // function keeps the two apart.
    const { fetchImpl } = recorder(() => json({ error: "invalid_grant" }, 400));

    const result = await refreshAccessToken("rt", CREDS, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("invalid_grant");
  });

  it("reports a transient HTTP failure without throwing", async () => {
    const { fetchImpl } = recorder(() => json({ error: "backend_error" }, 503));

    const result = await refreshAccessToken("rt", CREDS, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).not.toBe("invalid_grant");
  });

  it("reports a network failure without throwing", async () => {
    const fetchImpl = async () => {
      throw new TypeError("network down");
    };

    await expect(refreshAccessToken("rt", CREDS, { fetchImpl })).resolves.toMatchObject({
      ok: false,
    });
  });

  it("never puts the client secret in the URL", async () => {
    const { calls, fetchImpl } = recorder(() => json({ access_token: ACCESS }));

    await refreshAccessToken("rt", CREDS, { fetchImpl });

    expect(calls[0]!.url).not.toContain("secret");
  });
});

describe("listCalendars", () => {
  it("GETs calendarList.list bearing the access token", async () => {
    const { calls, fetchImpl } = recorder(() => json({ items: [] }));

    await listCalendars(ACCESS, { fetchImpl });

    expect(calls[0]!.method).toBe("GET");
    expect(
      calls[0]!.url.startsWith("https://www.googleapis.com/calendar/v3/users/me/calendarList"),
    ).toBe(true);
    expect(calls[0]!.headers.get("authorization")).toBe(`Bearer ${ACCESS}`);
  });

  it("never puts the access token in the query string", async () => {
    // A credential in a URL reaches logs, proxies and history.
    const { calls, fetchImpl } = recorder(() => json({ items: [] }));

    await listCalendars(ACCESS, { fetchImpl });

    expect(calls[0]!.url).not.toContain(ACCESS);
  });

  it("returns the calendars Google listed", async () => {
    const { fetchImpl } = recorder(() =>
      json({ items: [{ id: "primary", summary: "Fabio", primary: true }] }),
    );

    const result = await listCalendars(ACCESS, { fetchImpl });

    expect(result.ok && result.calendars).toHaveLength(1);
  });

  it("reports the 403 that a missing scope produces, rather than throwing", async () => {
    // Measured twice against the real account (C11, C12): calendarList.list
    // answers 403 insufficientPermissions without the calendarlist scope.
    const { fetchImpl } = recorder(() =>
      json({ error: { code: 403, status: "PERMISSION_DENIED" } }, 403),
    );

    const result = await listCalendars(ACCESS, { fetchImpl });

    expect(result.ok).toBe(false);
  });
});

describe("listEvents — the request shape (AC-6)", () => {
  const WINDOW = {
    accessToken: ACCESS,
    calendarId: "primary",
    timeMin: "2026-08-28T00:00:00-03:00",
    timeMax: "2026-09-05T00:00:00-03:00",
  };

  async function requestFor(overrides = {}): Promise<URL> {
    const { calls, fetchImpl } = recorder(() => json({ items: [] }));
    await listEvents({ ...WINDOW, ...overrides }, { fetchImpl });
    return new URL(calls[0]!.url);
  }

  it("carries NO syncToken — the parameter Google 400s on beside a window", async () => {
    // The single most important assertion in this file. Incremental sync and a
    // bounded window are mutually exclusive by Google's own documentation, and
    // this unit takes the window.
    expect((await requestFor()).searchParams.has("syncToken")).toBe(false);
  });

  it("carries timeMin and timeMax verbatim, with their offsets intact", async () => {
    const q = (await requestFor()).searchParams;

    expect(q.get("timeMin")).toBe(WINDOW.timeMin);
    expect(q.get("timeMax")).toBe(WINDOW.timeMax);
  });

  it("sets singleEvents=true, so recurrence never reaches this codebase", async () => {
    expect((await requestFor()).searchParams.get("singleEvents")).toBe("true");
  });

  it("orders by startTime, which singleEvents=true is a precondition for", async () => {
    expect((await requestFor()).searchParams.get("orderBy")).toBe("startTime");
  });

  it("sets an explicit maxResults rather than relying on Google's default", async () => {
    expect((await requestFor()).searchParams.get("maxResults")).not.toBeNull();
  });

  it("targets the calendar it was asked for, URL-encoded", async () => {
    const url = await requestFor({ calendarId: "work@example.com" });

    expect(url.pathname).toContain(encodeURIComponent("work@example.com"));
  });

  it("uses GET — read-only by construction (AC-13)", async () => {
    const { calls, fetchImpl } = recorder(() => json({ items: [] }));
    await listEvents(WINDOW, { fetchImpl });

    expect(calls[0]!.method).toBe("GET");
  });
});

describe("listEvents — the outcome", () => {
  const WINDOW = {
    accessToken: ACCESS,
    calendarId: "primary",
    timeMin: "2026-08-28T00:00:00-03:00",
    timeMax: "2026-09-05T00:00:00-03:00",
  };

  it("returns the raw items for the mapper to interpret", async () => {
    const { fetchImpl } = recorder(() => json({ items: [{ id: "a" }, { id: "b" }] }));

    const result = await listEvents(WINDOW, { fetchImpl });

    expect(result.ok && result.items).toHaveLength(2);
  });

  it("treats a missing items array as an empty day, not as a failure", async () => {
    const { fetchImpl } = recorder(() => json({}));

    const result = await listEvents(WINDOW, { fetchImpl });

    expect(result.ok && result.items).toEqual([]);
  });

  it("reports a non-2xx without throwing", async () => {
    const { fetchImpl } = recorder(() => json({ error: "rateLimitExceeded" }, 429));

    expect((await listEvents(WINDOW, { fetchImpl })).ok).toBe(false);
  });

  it("reports a network failure without throwing", async () => {
    const fetchImpl = async () => {
      throw new TypeError("network down");
    };

    await expect(listEvents(WINDOW, { fetchImpl })).resolves.toMatchObject({ ok: false });
  });
});
