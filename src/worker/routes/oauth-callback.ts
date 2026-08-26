import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { isNonceUsable } from "../../shared/google-oauth";
import { createDb } from "../db/client";
import { GOOGLE_CONNECTION_ID, googleConnections, oauthStates } from "../db/schema";
import { exchangeCode } from "../google/client";

/**
 * The OAuth callback (unit 4 `google-calendar-read`, phase 2).
 *
 * **This is the project's only route reachable without a bearer token**, and
 * the only place ADR-0003 safeguard 4 is scoped rather than upheld. Two things
 * make that admissible, and both are structural rather than remembered:
 *
 *  1. It lives at `/oauth/*`, OUTSIDE the `/api/*` prefix where `requireToken`
 *     is mounted. The exemption is a routing fact, not a conditional inside
 *     the auth gate — nothing in `auth.ts` knows this route exists.
 *  2. It accepts ONLY a `state` nonce that `/api/google/connect` minted, which
 *     required a bearer token. So it can be reached by anyone and acted on by
 *     nobody but the owner.
 *
 * The order of operations below IS the security property: validate first, and
 * make no outbound request and no write until the nonce has passed. A callback
 * that called Google before validating would be an unauthenticated trigger for
 * traffic to a third party.
 *
 * Note also what is NOT here: `/oauth/*` had to be added to
 * `run_worker_first` in `wrangler.jsonc`, or the SPA's asset router answers
 * Google's redirect with `index.html` and this file never executes — passing
 * every local test while being dead in production.
 */
export const oauthCallbackRoutes = new Hono<{ Bindings: Env }>();

/** Refusals are 4xx and say nothing about why, beyond what the owner needs. */
function refuse(reason: string): Response {
  return new Response(`Não foi possível concluir a conexão com o Google: ${reason}`, {
    status: 400,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

oauthCallbackRoutes.get("/callback", async (c) => {
  const state = c.req.query("state") ?? "";
  const code = c.req.query("code") ?? "";
  const googleError = c.req.query("error") ?? "";

  if (state === "") return refuse("resposta sem identificação");

  // Google's own error redirect — pressing "Cancelar" on the consent screen
  // lands here. Nothing to exchange, so nothing is called and the nonce is
  // left unspent for a genuine retry.
  if (googleError !== "") return refuse("autorização não concedida");

  if (code === "") return refuse("resposta sem código de autorização");

  const db = createDb(c.env);
  const rows = await db.select().from(oauthStates).where(eq(oauthStates.id, state));
  const row = rows[0];

  const nonce = row
    ? {
        expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
        consumedAt: row.consumedAt ? Math.floor(row.consumedAt.getTime() / 1000) : null,
      }
    : null;

  // Everything above this line is free of side effects and of network calls.
  if (!isNonceUsable(nonce, Math.floor(Date.now() / 1000))) {
    return refuse("pedido expirado ou já utilizado");
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return refuse("integração não configurada no servidor");
  }

  const exchanged = await exchangeCode({ code, clientId, clientSecret, redirectUri });
  if (!exchanged.ok) {
    // The nonce is deliberately NOT consumed: the owner did nothing wrong and
    // should be able to retry the same consent URL if Google was merely
    // having a bad moment.
    return refuse("o Google recusou a autorização");
  }

  // ONE operation, not two. Storing the credential and consuming the nonce
  // must not be separable: a termination between two independent awaits would
  // leave the token stored with the nonce still spendable, and the callback
  // URL replayable. `batch()` is D1's only cross-statement atomicity primitive
  // — there is no multi-statement transaction to reach for here.
  await db.batch([
    db
      .insert(googleConnections)
      .values({
        id: GOOGLE_CONNECTION_ID,
        refreshToken: exchanged.refreshToken,
        scope: exchanged.scope,
      })
      .onConflictDoUpdate({
        target: googleConnections.id,
        set: { refreshToken: exchanged.refreshToken, scope: exchanged.scope },
      }),
    db.update(oauthStates).set({ consumedAt: new Date() }).where(eq(oauthStates.id, state)),
  ]);

  // Plain text, and deliberately free of the token. Phase 4 replaces this with
  // a redirect into the app.
  return new Response("Google conectado. Pode fechar esta aba e voltar ao Praesto.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
});
