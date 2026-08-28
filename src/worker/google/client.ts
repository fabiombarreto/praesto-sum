/**
 * All Google I/O, behind one module (unit 4 `google-calendar-read`, phase 2).
 *
 * Every function takes an injected `fetch`-shaped function, defaulting to the
 * global. That is not ceremony: `fetchMock` was removed from `cloudflare:test`
 * in `@cloudflare/vitest-pool-workers` 0.13.x and this project pins 0.20.1, so
 * the framework offers no interception at all. Injection is also the better
 * seam for what the acceptance criteria actually demand — proving a request
 * did NOT carry something requires the request object, not a canned response.
 *
 * Nothing here throws on a Google failure. Both functions return an outcome
 * the caller decides about, because PRD AC-5 requires disconnect to succeed
 * even when Google refuses, and that is only expressible if a refusal is a
 * value rather than an exception.
 *
 * Read-only by construction: the only two non-GET requests in this whole unit
 * are here, and both act on our own grant rather than on the owner's calendar.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/** The `fetch` signature, so a test can hand over a recorder. */
export type GoogleFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface GoogleDeps {
  fetchImpl?: GoogleFetch;
}

export interface ExchangeInput {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type ExchangeResult =
  { ok: true; refreshToken: string; scope: string } | { ok: false; reason: string };

/**
 * Trades an authorization code for a refresh token.
 *
 * The secret goes in the BODY, never the query string — a credential in a URL
 * reaches logs, proxies and history. A response without a `refresh_token` is
 * treated as a FAILURE rather than a partial success: Google withholds it on a
 * repeat authorization that did not force consent, and storing an absent token
 * would produce a connection that looks live and can never refresh.
 */
export async function exchangeCode(
  { code, clientId, clientSecret, redirectUri }: ExchangeInput,
  deps: GoogleDeps = {},
): Promise<ExchangeResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  let response: Response;
  try {
    response = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    // The network, not Google, said no. Same outcome for the caller.
    return { ok: false, reason: "network" };
  }

  if (!response.ok) return { ok: false, reason: `http_${response.status}` };

  let payload: { refresh_token?: unknown; scope?: unknown };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, reason: "malformed_response" };
  }

  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  if (refreshToken === "") return { ok: false, reason: "no_refresh_token" };

  return {
    ok: true,
    refreshToken,
    scope: typeof payload.scope === "string" ? payload.scope : "",
  };
}

/**
 * Asks Google to revoke a token, and REPORTS rather than throws.
 *
 * Google does not document what revoking an already-dead token returns, so the
 * caller must be safe under every answer. Returning a boolean is what lets
 * `DELETE /api/google/connection` delete locally regardless — the owner must
 * never be unable to disconnect because a third party is unreachable.
 */
export async function revokeToken(token: string, deps: GoogleDeps = {}): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type RefreshResult =
  { ok: true; accessToken: string } | { ok: false; reason: "invalid_grant" | "network" | string };

/**
 * Trades the stored refresh token for a short-lived access token.
 *
 * `invalid_grant` is kept DISTINCT from every other failure on purpose. It is
 * what a revoked, expired or otherwise dead credential looks like, and the
 * owner's action differs: "reconnect your calendar" versus "try again later".
 * Collapsing the two would make the screen give the wrong instruction, which
 * is the same defect that cost real time in phase 2 when a certificate failure
 * was reported as "Google refused".
 */
export async function refreshAccessToken(
  refreshToken: string,
  { clientId, clientSecret }: { clientId: string; clientSecret: string },
  deps: GoogleDeps = {},
): Promise<RefreshResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  let payload: { access_token?: unknown; error?: unknown } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    /* An unparseable body is still a failure; the status decides which. */
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: payload.error === "invalid_grant" ? "invalid_grant" : `http_${response.status}`,
    };
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (accessToken === "") return { ok: false, reason: "no_access_token" };

  return { ok: true, accessToken };
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string;
  primary: boolean;
}

export type ListCalendarsResult =
  { ok: true; calendars: GoogleCalendarSummary[] } | { ok: false; reason: string };

/**
 * Lists the calendars the owner is subscribed to.
 *
 * Requires `calendar.calendarlist.readonly`; without it Google answers 403
 * `insufficientPermissions` — measured by chore C11 on 2026-08-11 and
 * reproduced by C12 on 2026-08-25. That scope was granted for real on
 * 2026-08-28.
 */
export async function listCalendars(
  accessToken: string,
  deps: GoogleDeps = {},
): Promise<ListCalendarsResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  let response: Response;
  try {
    // The token travels in a header, never the query string: a credential in a
    // URL reaches logs, proxies and browser history.
    response = await fetchImpl(`${CALENDAR_API}/users/me/calendarList`, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (!response.ok) return { ok: false, reason: `http_${response.status}` };

  let payload: { items?: unknown } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, reason: "malformed_response" };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    ok: true,
    calendars: items.flatMap((raw) => {
      const item = raw as { id?: unknown; summary?: unknown; primary?: unknown };
      if (typeof item.id !== "string" || item.id === "") return [];
      return [
        {
          id: item.id,
          summary: typeof item.summary === "string" ? item.summary : item.id,
          primary: item.primary === true,
        },
      ];
    }),
  };
}

export type ListEventsResult = { ok: true; items: unknown[] } | { ok: false; reason: string };

/**
 * Reads one calendar's events inside a bounded window.
 *
 * **No `syncToken`, deliberately and permanently for this unit.** Google
 * returns 400 when a sync token accompanies `timeMin`/`timeMax`/`orderBy`, so
 * incremental sync and a bounded window are mutually exclusive — and this unit
 * takes the window. `syncToken` becomes meaningful in unit 15, when a local
 * table exists to keep incrementally.
 *
 * `singleEvents=true` expands recurring series into instances at Google's
 * boundary, which is why this codebase contains zero recurrence code and why
 * `orderBy=startTime` is even legal (Google requires the former for the
 * latter).
 */
export async function listEvents(
  {
    accessToken,
    calendarId,
    timeMin,
    timeMax,
    maxResults = 250,
  }: {
    accessToken: string;
    calendarId: string;
    timeMin: string;
    timeMax: string;
    maxResults?: number;
  },
  deps: GoogleDeps = {},
): Promise<ListEventsResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  const query = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });

  let response: Response;
  try {
    response = await fetchImpl(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
      { method: "GET", headers: { authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    return { ok: false, reason: "network" };
  }

  if (!response.ok) return { ok: false, reason: `http_${response.status}` };

  let payload: { items?: unknown } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, reason: "malformed_response" };
  }

  // A missing `items` is an empty day, not a failure — Google omits it rather
  // than sending `[]` when nothing falls in the window.
  return { ok: true, items: Array.isArray(payload.items) ? payload.items : [] };
}
