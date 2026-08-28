import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { buildConsentUrl, GOOGLE_READONLY_SCOPES } from "../../shared/google-oauth";
import { createDb } from "../db/client";
import { GOOGLE_CONNECTION_ID, googleConnections, oauthStates } from "../db/schema";
import { toGoogleConnectionDto } from "../dto";
import { revokeToken } from "../google/client";

/**
 * Google connection routes (unit 4 `google-calendar-read`, phase 2 — FR-030).
 *
 * Mounted under `/api/google`, so these are behind the existing bearer gate
 * with no middleware of their own — the prefix IS the authorization. Its
 * sibling `/oauth/callback` deliberately lives elsewhere; see
 * `src/worker/routes/oauth-callback.ts` for why.
 *
 * Nothing here ever returns the refresh token. `GoogleConnectionDto` carries
 * status only, and that is enforced by the mapper in `dto.ts` rather than by
 * remembering.
 */
export const googleRoutes = new Hono<{ Bindings: Env }>();

/**
 * How long a consent URL stays usable.
 *
 * Raised from 10 to 30 minutes on 2026-08-26, after the first real consent
 * round-trip expired mid-flow. 10 was a guess made before the flow existed;
 * the measured path is longer than it, because this app is published
 * UNVERIFIED (chore C11), so Google interposes a warning screen that costs the
 * owner two extra clicks — *Avançado* then *Ir para praesto-sum* — on top of a
 * possible sign-in. That interstitial is a permanent property of the
 * deployment, not a one-off.
 *
 * 30 minutes is still short-lived, and the nonce was never the primary control
 * anyway: it proves the callback was initiated by an authenticated request. A
 * leaked consent URL is inert to anyone who cannot also pass Google's own
 * sign-in as the owner. Widening a security parameter for convenience deserves
 * suspicion, so the reasoning is recorded rather than the number quietly
 * changed.
 */
const NONCE_TTL_SECONDS = 30 * 60;

/**
 * FR-030 — begin the connection.
 *
 * Mints a single-use `state` nonce and hands back Google's consent URL. This
 * is the ONLY place a nonce is created, and it requires a bearer token, which
 * is what lets the unauthenticated callback accept nothing the owner did not
 * personally initiate.
 *
 * No outbound call happens here: building a URL requires talking to nobody.
 */
googleRoutes.post("/connect", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    // Fail closed and say which half is missing — the same posture as
    // `requireToken`, because an unconfigured integration must never look
    // like a broken one.
    return c.json(
      { error: "Server misconfigured: GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI is not set" },
      500,
    );
  }

  const db = createDb(c.env);
  const state = crypto.randomUUID();
  const now = Date.now();

  await db.insert(oauthStates).values({
    id: state,
    createdAt: new Date(now),
    expiresAt: new Date(now + NONCE_TTL_SECONDS * 1000),
  });

  return c.json({ consentUrl: buildConsentUrl({ clientId, redirectUri, state }) });
});

/** The connection's status — never its credential. */
googleRoutes.get("/connection", async (c) => {
  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.id, GOOGLE_CONNECTION_ID));

  return c.json({ connection: rows[0] ? toGoogleConnectionDto(rows[0]) : null });
});

/**
 * FR-030 — disconnect, revoking access while preserving 100% of local data.
 *
 * The local deletion is UNCONDITIONAL. Google's answer is asked for and then
 * deliberately ignored, because the owner must never be unable to disconnect
 * because a third party is unreachable or because a token was already dead —
 * a case Google does not document. Only Google's own rows are removed; not one
 * Task, Reminder or Life Area is touched.
 */
googleRoutes.delete("/connection", async (c) => {
  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.id, GOOGLE_CONNECTION_ID));

  const stored = rows[0];
  const revoked = stored ? await revokeToken(stored.refreshToken) : false;

  await db.delete(googleConnections).where(eq(googleConnections.id, GOOGLE_CONNECTION_ID));

  // `revoked` is reported so the UI can say "revoked at Google" versus
  // "disconnected locally; Google may still list the grant" — an honest
  // distinction the owner can act on by visiting his Google account page.
  return c.json({ disconnected: true, revokedAtGoogle: revoked });
});

export { GOOGLE_READONLY_SCOPES };
