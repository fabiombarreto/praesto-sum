// PRPs/prds/google-calendar-read.prd.md AC-11 (the dead-credential state the owner can act on).
//
// Source plan: PRPs/plans/google-calendar-read-phase-5-consent-made-visible.plan.md
// AC-A7 — "Given the refresh token is dead, when the owner sees the state on *Hoje* and
// on the settings screen, then both name the condition with the same words and offer the
// same next step — one condition, one vocabulary."
//
// The plan's own risk table (line 349) proposed to enforce AC-A7 by having the settings
// screen "reuse the `AGENDA.*` copy constants verbatim", noting agreement would then hold
// "at the strings the owner reads". `AGENDA` turned out to be module-local and unexported,
// so the implementer pasted the three strings instead and left a comment asking the next
// reader to keep both copies in sync by hand. That made AC-A7 true by coincidence: two
// byte-identical literals and two identical three-way branches, with nothing to catch a
// one-sided edit. `googleFailureMessage` is now the single definition of BOTH halves, and
// this file is what would fail if the mapping changed.
//
// This is a pure, DOM-free unit under test (src/shared/google-failure-copy.ts must stay
// environment-agnostic and dual-compiled into both the browser and Worker targets — see
// tsconfig.test.json's `include` list, which lists `test`, `src/worker`, `src/shared` but
// NOT `src/app`). That boundary is the reason the mapping lives in src/shared at all:
// docs/context/methodology.md:48 names "the error mapping" as the decidable part to
// extract, citing src/shared/request-failure.ts — whose test this file mirrors in shape.
//
// The wording is pinned in Portuguese per ADR-0009, exactly as request-failure.test.ts
// pins its two messages: these strings are owner approvals of 2026-08-28, so a silent
// rewording is a defect, not a refactor.
//
// Scope note: what this file CANNOT reach is the rendering — that both components call
// this function and put the result on screen. src/app is outside this project, and there
// is no browser tier (docs/context/testing.md). That half stays manual, and is covered by
// the UI checklist run in PRPs/reports/google-calendar-read/phase-5/ui-checklist-run.md.

import { describe, expect, it } from "vitest";
import { googleFailureMessage } from "../src/shared/google-failure-copy";

const NOT_CONNECTED = "Google não conectado.";
const RECONNECT = "A conexão com o Google expirou. Reconecte para ver a agenda.";
const TRY_LATER = "Não foi possível carregar a agenda agora. Tente novamente mais tarde.";

describe("googleFailureMessage — the named reasons (plan AC-A7, PRD AC-11)", () => {
  it("names a missing credential with the connect wording", () => {
    expect(googleFailureMessage("not_connected")).toBe(NOT_CONNECTED);
  });

  it("names a refused credential with the reconnect wording, the next step AC-11 exists for", () => {
    expect(googleFailureMessage("invalid_grant")).toBe(RECONNECT);
  });
});

describe("googleFailureMessage — everything else is transient (plan AC-A7)", () => {
  it("falls back to try-later when no reason arrived at all", () => {
    expect(googleFailureMessage(null)).toBe(TRY_LATER);
  });

  // Every reason the Worker can actually emit that is NOT one of the two named ones.
  // `not_configured` comes from accessTokenFor, the rest from the google/client.ts
  // helpers (src/worker/routes/google.ts:159-181, src/worker/google/client.ts).
  it.each([
    "not_configured",
    "network",
    "http_400",
    "http_500",
    "malformed_response",
    "no_access_token",
    "no_refresh_token",
  ])(
    "falls back to try-later for the server reason %s, which the owner cannot act on",
    (reason) => {
      expect(googleFailureMessage(reason)).toBe(TRY_LATER);
    },
  );

  it("falls back to try-later for a reason this screen has never heard of", () => {
    expect(googleFailureMessage("a_reason_invented_after_this_test_was_written")).toBe(TRY_LATER);
  });

  it("treats an empty reason as unnamed rather than matching a named branch", () => {
    expect(googleFailureMessage("")).toBe(TRY_LATER);
  });
});

describe("googleFailureMessage — one condition, one vocabulary (plan AC-A7)", () => {
  // The point of AC-A7. Two screens may not describe one condition differently, and
  // three conditions may not collapse into one message — a dead credential the owner
  // must reconnect has to read differently from a Google outage he can only wait out.
  it("gives each of the three conditions its own distinct words", () => {
    const messages = [
      googleFailureMessage("not_connected"),
      googleFailureMessage("invalid_grant"),
      googleFailureMessage(null),
    ];
    expect(new Set(messages).size).toBe(3);
  });

  it("is a pure function of the reason, so both screens reading it cannot diverge", () => {
    for (const reason of ["not_connected", "invalid_grant", "network", null]) {
      expect(googleFailureMessage(reason)).toBe(googleFailureMessage(reason));
    }
  });
});
