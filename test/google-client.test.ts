/**
 * Unit 4 `google-calendar-read`, phase 2 — the Google client.
 *
 * Covers PRD **AC-3** (the code is exchanged at Google's token endpoint) and
 * **AC-5** (disconnect succeeds even when Google refuses).
 *
 * Every test injects its own `fetch`-shaped function and captures the
 * `Request` the client built. That is deliberate and is the phase's recorded
 * test seam: `fetchMock` was removed from `cloudflare:test` in
 * vitest-pool-workers 0.13.x and this project pins 0.20.1, so the framework
 * offers no interception. Injection is also strictly better here — asserting
 * what a request DID NOT carry is the only way to prove a closed boundary, and
 * that needs the request object itself, not a canned response.
 */

import { describe, expect, it } from "vitest";
import { exchangeCode, revokeToken } from "../src/worker/google/client";

const CREDS = {
  code: "auth-code-123",
  clientId: "client-id.apps.googleusercontent.com",
  clientSecret: "client-secret",
  redirectUri: "https://praesto.fabiobarreto.workers.dev/oauth/callback",
};

/** A fake `fetch` that records every call and replies with what the test dictates. */
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

describe("exchangeCode — the request", () => {
  it("posts to Google's documented token endpoint", async () => {
    const { calls, fetchImpl } = recorder(() => json({ refresh_token: "rt", access_token: "at" }));

    await exchangeCode(CREDS, { fetchImpl });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0]!.method).toBe("POST");
  });

  it("sends the authorization_code grant with every field Google requires", async () => {
    const { calls, fetchImpl } = recorder(() => json({ refresh_token: "rt" }));

    await exchangeCode(CREDS, { fetchImpl });

    const body = new URLSearchParams(await calls[0]!.text());
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe(CREDS.code);
    expect(body.get("client_id")).toBe(CREDS.clientId);
    expect(body.get("client_secret")).toBe(CREDS.clientSecret);
    expect(body.get("redirect_uri")).toBe(CREDS.redirectUri);
  });

  it("never puts the client secret in the URL, only in the body", async () => {
    // A secret in a query string reaches logs, proxies and browser history.
    const { calls, fetchImpl } = recorder(() => json({ refresh_token: "rt" }));

    await exchangeCode(CREDS, { fetchImpl });

    expect(calls[0]!.url).not.toContain(CREDS.clientSecret);
  });
});

describe("exchangeCode — the outcome", () => {
  it("returns the refresh token Google issued", async () => {
    const { fetchImpl } = recorder(() => json({ refresh_token: "the-refresh-token" }));

    const result = await exchangeCode(CREDS, { fetchImpl });

    expect(result.ok && result.refreshToken).toBe("the-refresh-token");
  });

  it("fails rather than succeeding emptily when Google omits the refresh token", async () => {
    // Google withholds it on a repeat authorization without prompt=consent.
    // Storing "undefined" would produce a connection that looks live and can
    // never refresh — the worst of both outcomes.
    const { fetchImpl } = recorder(() => json({ access_token: "at-only" }));

    const result = await exchangeCode(CREDS, { fetchImpl });

    expect(result.ok).toBe(false);
  });

  it("fails on a non-2xx without throwing", async () => {
    const { fetchImpl } = recorder(() => json({ error: "invalid_grant" }, 400));

    const result = await exchangeCode(CREDS, { fetchImpl });

    expect(result.ok).toBe(false);
  });

  it("fails on a network error without throwing", async () => {
    const fetchImpl = async () => {
      throw new TypeError("network down");
    };

    const result = await exchangeCode(CREDS, { fetchImpl });

    expect(result.ok).toBe(false);
  });
});

describe("revokeToken", () => {
  it("posts the token to Google's documented revoke endpoint", async () => {
    const { calls, fetchImpl } = recorder(() => new Response("", { status: 200 }));

    await revokeToken("the-token", { fetchImpl });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.startsWith("https://oauth2.googleapis.com/revoke")).toBe(true);
    expect(calls[0]!.method).toBe("POST");
  });

  it("reports acknowledgement when Google answers 2xx", async () => {
    const { fetchImpl } = recorder(() => new Response("", { status: 200 }));

    expect(await revokeToken("t", { fetchImpl })).toBe(true);
  });

  it("reports non-acknowledgement on a non-2xx, and does NOT throw", async () => {
    // Google does not document what revoking an already-dead token returns.
    // AC-5 makes the product safe either way, which is only possible if this
    // function reports rather than throws.
    const { fetchImpl } = recorder(() => new Response("", { status: 400 }));

    expect(await revokeToken("t", { fetchImpl })).toBe(false);
  });

  it("reports non-acknowledgement on a network error, and does NOT throw", async () => {
    const fetchImpl = async () => {
      throw new TypeError("network down");
    };

    await expect(revokeToken("t", { fetchImpl })).resolves.toBe(false);
  });
});
