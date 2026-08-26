/**
 * The pure OAuth vocabulary (unit 4 `google-calendar-read`, phase 2).
 *
 * What a consent URL says, and when a nonce is still usable. Neither question
 * needs a Worker, a database or a network, so both live here where they are
 * cheap to test and impossible to get subtly wrong under load.
 *
 * Like every other module in `src/shared`, this compiles into BOTH the browser
 * and the Worker projects: no DOM globals, no runtime dependencies, and no
 * reads of the clock — `now` is always an argument.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * The consent boundary of ADR-0007 and CON-005, as a value rather than a
 * convention.
 *
 * Read-only, Calendar-only, and closed: `calendar.events` (without
 * `.readonly`) is the WRITE scope unit 15 will request at an explicit
 * re-consent, and it must not arrive early by someone widening a string.
 * `calendar.calendarlist.readonly` is here because `calendarList.list` answers
 * 403 without it — measured by chore C11 on 2026-08-11 and reproduced by C12
 * on 2026-08-25 — and FR-027's calendar picker cannot be served otherwise.
 */
export const GOOGLE_READONLY_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const);

/** The row shape `isNonceUsable` judges. Deliberately narrower than the table. */
export interface NonceRecord {
  /** Epoch seconds. */
  expiresAt: number;
  /** Epoch seconds, or `null` while unspent. */
  consumedAt: number | null;
}

/**
 * Builds Google's authorization URL.
 *
 * `URLSearchParams` does the encoding, so a hostile `state` cannot smuggle in
 * a second `scope` parameter — it is percent-encoded into the one value it
 * belongs to. `prompt=consent` is not decoration: without it Google omits the
 * refresh token on a repeat authorization, and phase 2 exists precisely to
 * perform a repeat (adding the calendarlist scope).
 */
export function buildConsentUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_READONLY_SCOPES.join(" "),
    state,
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Whether a `state` nonce may still be spent.
 *
 * Three ways to say no, and they are checked without ordering because all
 * three are equally disqualifying: it was never minted (`null`), it was
 * already spent, or it has expired. The expiry boundary is CLOSED — a nonce
 * expiring exactly `now` is already gone, because "expires at T" reads more
 * naturally as "is dead at T" than "survives T".
 */
export function isNonceUsable(nonce: NonceRecord | null, now: number): boolean {
  if (nonce === null) return false;
  if (nonce.consumedAt !== null) return false;
  return nonce.expiresAt > now;
}
