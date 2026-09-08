// PRPs/prds/push-channel-proven.prd.md AC-3 dead-endpoints-are-pruned,
// AC-4 transient-failures-are-not-pruned
//
// Unit suite for `classifyPushOutcome()` (`src/shared/push-outcome.ts`, phase
// 2 subscription-lifecycle, plan Task 2 / plan AC-A2, AC-A3). Pure, DOM-free
// module classifying `sendPush()`'s own `{ ok, statusCode?, error? }` return
// shape (`src/worker/push/send.ts:24-56`) — never reshaping it, only
// interpreting it — so every case below is constructed as that exact
// duck-typed shape rather than a fabricated one, mirroring
// `test/request-failure.test.ts`'s duck-typed-cause style.
//
// Written BEFORE the Implementer (test-first): `src/shared/push-outcome.ts`
// does not exist yet, so this file is RED for the right reason
// (module-not-found on the import below) until plan Task 2 lands.

import { describe, expect, it } from "vitest";
import { classifyPushOutcome } from "../src/shared/push-outcome";

describe("classifyPushOutcome — delivered (AC-A2, PRD AC-3's '201 is success, nothing deleted')", () => {
  it("classifies ok:true with statusCode 201 as delivered, carrying that status", () => {
    const result = classifyPushOutcome({ ok: true, statusCode: 201 });
    expect(result).toEqual({ kind: "delivered", statusCode: 201 });
  });

  it("classifies ok:true with statusCode 200 as delivered", () => {
    const result = classifyPushOutcome({ ok: true, statusCode: 200 });
    expect(result).toEqual({ kind: "delivered", statusCode: 200 });
  });

  it("defaults statusCode to 200 when ok:true carries none (defensive fallback, never observed from a real sendPush() ok:true branch)", () => {
    const result = classifyPushOutcome({ ok: true });
    expect(result).toEqual({ kind: "delivered", statusCode: 200 });
  });
});

describe("classifyPushOutcome — gone (AC-A2, PRD AC-3: 404/410 classify that endpoint as gone)", () => {
  it("classifies ok:false with statusCode 404 as gone, with no statusCode or error field on the result", () => {
    const result = classifyPushOutcome({ ok: false, statusCode: 404, error: "Not Found" });
    expect(result).toEqual({ kind: "gone" });
    expect("statusCode" in result).toBe(false);
    expect("error" in result).toBe(false);
  });

  it("classifies ok:false with statusCode 410 as gone", () => {
    const result = classifyPushOutcome({ ok: false, statusCode: 410, error: "Gone" });
    expect(result).toEqual({ kind: "gone" });
  });
});

describe("classifyPushOutcome — retryable (AC-A3, PRD AC-4: 429/5xx never silently discard the subscription)", () => {
  it("classifies ok:false with statusCode 429 as retryable, carrying that status and the error", () => {
    const result = classifyPushOutcome({ ok: false, statusCode: 429, error: "Too Many Requests" });
    expect(result).toEqual({ kind: "retryable", error: "Too Many Requests", statusCode: 429 });
  });

  it("classifies ok:false with statusCode 500 as retryable, carrying that status and the error", () => {
    const result = classifyPushOutcome({
      ok: false,
      statusCode: 500,
      error: "Internal Server Error",
    });
    expect(result).toEqual({
      kind: "retryable",
      error: "Internal Server Error",
      statusCode: 500,
    });
  });

  it("classifies ok:false with statusCode 503 as retryable, carrying that status and the error", () => {
    const result = classifyPushOutcome({
      ok: false,
      statusCode: 503,
      error: "Service Unavailable",
    });
    expect(result).toEqual({ kind: "retryable", error: "Service Unavailable", statusCode: 503 });
  });

  it("classifies ok:false with an unrecognized status code (e.g. 400) as retryable, never gone", () => {
    // AC-4's own rationale: an unrecognized failure shape must never be
    // classified as `gone` — only 404/410 may prune the owner's subscription.
    const result = classifyPushOutcome({ ok: false, statusCode: 400, error: "Bad Request" });
    expect(result.kind).toBe("retryable");
  });

  it("classifies ok:false with no statusCode at all (the network call itself failed) as retryable, omitting statusCode entirely", () => {
    const result = classifyPushOutcome({ ok: false, error: "TypeError: Failed to fetch" });
    expect(result).toEqual({ kind: "retryable", error: "TypeError: Failed to fetch" });
    expect("statusCode" in result).toBe(false);
  });

  it("defaults the error message when none is given and no status code exists either", () => {
    const result = classifyPushOutcome({ ok: false });
    expect(result).toEqual({
      kind: "retryable",
      error: "push dispatch failed with no status code",
    });
  });

  it("uses the same default error message even when a status code IS present but no error string was given", () => {
    const result = classifyPushOutcome({ ok: false, statusCode: 503 });
    expect(result).toEqual({
      kind: "retryable",
      error: "push dispatch failed with no status code",
      statusCode: 503,
    });
  });
});
