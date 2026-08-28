import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { eventWindow, toCalendarEventDto } from "../../shared/google-events";
import { buildConsentUrl, GOOGLE_READONLY_SCOPES } from "../../shared/google-oauth";
import { PRAESTO_TIMEZONE, todayIn } from "../../shared/dates";
import { createDb } from "../db/client";
import {
  GOOGLE_CONNECTION_ID,
  googleCalendarSelections,
  googleConnections,
  oauthStates,
} from "../db/schema";
import { toGoogleConnectionDto } from "../dto";
import { listCalendars, listEvents, refreshAccessToken, revokeToken } from "../google/client";

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

/** How many days beyond today the window reaches. Owner decision, 2026-08-28. */
const WINDOW_DAYS = 7;

/**
 * Resolves a usable access token, or the reason there is none.
 *
 * The two failure kinds are kept apart all the way to the caller: `not_connected`
 * (no credential at all) versus whatever Google said. Phase 4 has to tell the
 * owner "connect your calendar" or "try again later", and it can only choose
 * correctly if this function does not flatten them.
 */
async function accessTokenFor(c: {
  env: Env;
}): Promise<
  { ok: true; accessToken: string } | { ok: false; status: 400 | 409 | 502; reason: string }
> {
  const db = createDb(c.env);
  const rows = await db
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.id, GOOGLE_CONNECTION_ID));

  const stored = rows[0];
  if (!stored) return { ok: false, status: 409, reason: "not_connected" };

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { ok: false, status: 400, reason: "not_configured" };

  const refreshed = await refreshAccessToken(stored.refreshToken, { clientId, clientSecret }, {});
  if (!refreshed.ok) {
    // `invalid_grant` means the credential is dead — the owner must reconnect,
    // which is a different sentence from "Google is having a bad minute".
    return { ok: false, status: 502, reason: refreshed.reason };
  }

  return { ok: true, accessToken: refreshed.accessToken };
}

/** The calendar ids to query: the explicit selection, or `primary` when none was ever made. */
async function selectedCalendarIds(env: Env): Promise<string[]> {
  const rows = await createDb(env).select().from(googleCalendarSelections);
  return rows.length > 0 ? rows.map((r) => r.calendarId) : ["primary"];
}

/** FR-027 — which calendars exist, and which feed the day. */
googleRoutes.get("/calendars", async (c) => {
  const token = await accessTokenFor(c);
  if (!token.ok) return c.json({ error: "unavailable", reason: token.reason }, token.status);

  const listed = await listCalendars(token.accessToken);
  if (!listed.ok) return c.json({ error: "unavailable", reason: listed.reason }, 502);

  const selection = await createDb(c.env).select().from(googleCalendarSelections);
  const chosen = new Set(selection.map((r) => r.calendarId));
  // Never chosen resolves to primary — the documented default, applied here
  // rather than left to the absence of rows to imply.
  const neverChosen = chosen.size === 0;

  return c.json({
    calendars: listed.calendars.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary,
      selected: neverChosen ? cal.primary : chosen.has(cal.id),
    })),
  });
});

/** FR-027 — replace the selection. */
googleRoutes.put("/calendars", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { calendarIds?: unknown } | null;
  const ids = Array.isArray(body?.calendarIds) ? body.calendarIds : null;
  if (ids === null) return c.json({ error: "calendarIds must be an array" }, 400);
  if (ids.some((id) => typeof id !== "string" || id.trim() === "")) {
    return c.json({ error: "every calendarId must be a non-empty string" }, 400);
  }

  const token = await accessTokenFor(c);
  if (!token.ok) return c.json({ error: "unavailable", reason: token.reason }, token.status);

  const listed = await listCalendars(token.accessToken);
  if (!listed.ok) return c.json({ error: "unavailable", reason: listed.reason }, 502);

  // Reject an id that is not the owner's. Storing one would produce a
  // selection that queries nothing and reports no error — a silent empty day.
  const known = new Set(listed.calendars.map((cal) => cal.id));
  const unknown = (ids as string[]).filter((id) => !known.has(id));
  if (unknown.length > 0) return c.json({ error: "unknown calendar", unknown }, 400);

  const db = createDb(c.env);
  // Replace, never append: deselecting must actually deselect.
  await db.delete(googleCalendarSelections);
  if (ids.length > 0) {
    await db
      .insert(googleCalendarSelections)
      .values((ids as string[]).map((calendarId) => ({ calendarId })));
  }

  return c.json({ calendarIds: ids });
});

/** FR-027 — the day's real commitments, mapped and narrowed. */
googleRoutes.get("/events", async (c) => {
  const token = await accessTokenFor(c);
  if (!token.ok) return c.json({ error: "unavailable", reason: token.reason }, token.status);

  const window = eventWindow(todayIn(new Date(), PRAESTO_TIMEZONE), WINDOW_DAYS);
  const calendarIds = await selectedCalendarIds(c.env);

  const events = [];
  const failedCalendars: string[] = [];

  for (const calendarId of calendarIds) {
    const listed = await listEvents({ accessToken: token.accessToken, calendarId, ...window });
    if (!listed.ok) {
      // One calendar failing must never shorten the list silently. The events
      // that DID arrive are returned, and the gap is named so the screen can
      // say the day is incomplete.
      failedCalendars.push(calendarId);
      continue;
    }
    for (const raw of listed.items) {
      const dto = toCalendarEventDto(raw, calendarId);
      if (dto !== null) events.push(dto);
    }
  }

  return c.json({ events, failedCalendars, window });
});
