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
