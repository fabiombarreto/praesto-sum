/**
 * Unit 4 `google-calendar-read`, phase 2 — the pure OAuth vocabulary.
 *
 * Covers PRD **AC-1** (the consent URL is minted, scoped and stateful) at the
 * part that needs no Worker, no database and no network: what the URL says,
 * and when a nonce is still usable.
 *
 * The scope set is asserted against a frozen constant rather than against a
 * substring of the URL, because "exactly these two scopes and no other" is the
 * consent boundary of ADR-0007 and CON-005 — a test that merely checks the two
 * are PRESENT would pass on a URL that also asked for write access.
 *
 * `isNonceUsable` takes `now` as an argument, like every other time-dependent
 * function in `src/shared`, so nothing here decays as the calendar moves.
 */

import { describe, expect, it } from "vitest";
import {
  buildConsentUrl,
  GOOGLE_READONLY_SCOPES,
  isNonceUsable,
} from "../src/shared/google-oauth";

const CLIENT_ID = "client-id.apps.googleusercontent.com";
const REDIRECT_URI = "https://praesto.fabiobarreto.workers.dev/oauth/callback";
const STATE = "nonce-abc";

function url(overrides: Partial<Parameters<typeof buildConsentUrl>[0]> = {}): URL {
  return new URL(
    buildConsentUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: STATE,
      ...overrides,
    }),
  );
}

describe("GOOGLE_READONLY_SCOPES", () => {
  it("is exactly the two readonly Calendar scopes, in a fixed order", () => {
    expect([...GOOGLE_READONLY_SCOPES]).toEqual([
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ]);
  });

  it("contains no write-capable scope", () => {
    // The closed consent boundary of ADR-0007. `calendar.events` (no
    // `.readonly`) is the write scope unit 15 will request at an explicit
    // re-consent; it must not leak in early.
    for (const scope of GOOGLE_READONLY_SCOPES) {
      expect(scope.endsWith(".readonly")).toBe(true);
    }
  });
});

describe("buildConsentUrl", () => {
  it("points at Google's authorization endpoint", () => {
    expect(url().origin + url().pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  });

  it("requests exactly the frozen scope set and nothing else", () => {
    const requested = (url().searchParams.get("scope") ?? "").split(" ").filter(Boolean);

    expect(requested.sort()).toEqual([...GOOGLE_READONLY_SCOPES].sort());
  });

  it("asks for offline access, without which there is no refresh token", () => {
    expect(url().searchParams.get("access_type")).toBe("offline");
  });

  it("forces the consent screen, so a re-consent actually re-issues a refresh token", () => {
    // Google omits the refresh token on a repeat authorization unless consent
    // is forced. Phase 2 exists to add a scope, which IS a repeat.
    expect(url().searchParams.get("prompt")).toBe("consent");
  });

  it("uses the authorization-code flow", () => {
    expect(url().searchParams.get("response_type")).toBe("code");
  });

  it("carries the caller's state verbatim", () => {
    expect(url({ state: "a-different-nonce" }).searchParams.get("state")).toBe("a-different-nonce");
  });

  it("carries the caller's redirect URI verbatim", () => {
    expect(url().searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
  });

  it("percent-encodes rather than interpolating, so a hostile state cannot inject a parameter", () => {
    const hostile = "x&scope=https://www.googleapis.com/auth/calendar";
    const built = url({ state: hostile });

    expect(built.searchParams.get("state")).toBe(hostile);
    // The injected `scope` must not have become a second, wider scope value.
    expect(built.searchParams.getAll("scope")).toHaveLength(1);
    expect(built.searchParams.get("scope")).not.toContain("auth/calendar ");
  });
});

describe("isNonceUsable", () => {
  const NOW = 1_800_000_000;

  it("accepts a fresh, unconsumed, unexpired nonce", () => {
    expect(isNonceUsable({ expiresAt: NOW + 60, consumedAt: null }, NOW)).toBe(true);
  });

  it("rejects a nonce that is absent entirely", () => {
    // The callback's most common hostile input: a state we never minted.
    expect(isNonceUsable(null, NOW)).toBe(false);
  });

  it("rejects a nonce that was already consumed", () => {
    expect(isNonceUsable({ expiresAt: NOW + 60, consumedAt: NOW - 10 }, NOW)).toBe(false);
  });

  it("rejects a nonce past its expiry", () => {
    expect(isNonceUsable({ expiresAt: NOW - 1, consumedAt: null }, NOW)).toBe(false);
  });

  it("rejects a nonce expiring exactly now — the boundary is closed, not open", () => {
    expect(isNonceUsable({ expiresAt: NOW, consumedAt: null }, NOW)).toBe(false);
  });

  it("rejects a consumed AND expired nonce without needing an order of checks", () => {
    expect(isNonceUsable({ expiresAt: NOW - 1, consumedAt: NOW - 5 }, NOW)).toBe(false);
  });
});
