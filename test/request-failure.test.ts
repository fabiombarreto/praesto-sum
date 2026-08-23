// PRPs/prds/install-and-quick-capture.prd.md AC-4 unreachable-server-is-explicit
// PRPs/prds/ui-design-pass.prd.md AC-4 pt-br-shared-messages (the wording block at the
// end of this file — the two messages are pinned in Portuguese per ADR-0009 from the
// ui-design-pass phase 1 on; the structural cases above it are unchanged).
//
// Source plan: PRPs/plans/install-and-quick-capture-phase-4-network-honesty.plan.md
// (Task 1 — classifyRequestFailure(cause: unknown): { kind: "server-unreachable" | "http-error"; message: string }).
//
// This is a pure, DOM-free unit under test (src/shared/request-failure.ts must stay
// environment-agnostic and dual-compiled into both the browser and Worker targets — see
// docs/context/architecture.md's per-target tsconfig boundary and tsconfig.test.json's
// `include` list, which lists `test`, `src/worker`, `src/shared` but NOT `src/app`). It
// needs neither the D1 fixture nor the bearer-token auth helpers that test/tasks.test.ts
// uses, mirroring test/share-target.test.ts's shape.
//
// Cross-boundary note: src/shared/ cannot import `ApiError` from src/app/api.ts (a compile
// error under tsconfig.test.json's project boundary), so every "http-error" case below
// constructs a PLAIN OBJECT carrying a numeric `status` field — exactly the shape
// `classifyRequestFailure` duck-types against, never an `ApiError` instance.
//
// Scope note (see PRPs/reports/install-and-quick-capture/test-suite-phase-4.diff for the
// full per-AC outcome record): this file covers only the classification decision itself
// (plan AC-A1, AC-A2). The DOM-rendered slice of AC-4 — the message actually rendering in
// `<p style={styles.error}>`, the 401 short-circuit staying untouched, and the typed text
// visibly surviving a failed save — is unreachable from the workerd-only Vitest tier (no
// browser/DOM tier exists — docs/context/testing.md) and is verified manually per the
// plan's Level 3 MANUAL steps, plus its own Level 2 content-invariant grep checks.

import { describe, expect, it } from "vitest";
import { classifyRequestFailure } from "../src/shared/request-failure";

describe("classifyRequestFailure — HTTP-level failures (PRD AC-4, plan AC-A2)", () => {
  it("classifies a cause carrying numeric status 401 as http-error naming that status", () => {
    const result = classifyRequestFailure({ status: 401 });
    expect(result.kind).toBe("http-error");
    expect(result.message).toContain("401");
  });

  it("classifies a cause carrying numeric status 500 as http-error naming that status", () => {
    const result = classifyRequestFailure({ status: 500 });
    expect(result.kind).toBe("http-error");
    expect(result.message).toContain("500");
  });

  it("produces a distinct message per status, not one message hard-coded regardless of status", () => {
    const at401 = classifyRequestFailure({ status: 401 });
    const at500 = classifyRequestFailure({ status: 500 });
    expect(at401.message).not.toBe(at500.message);
  });

  it("classifies an ApiError-shaped plain object (status + message + name) by structure, not by instanceof", () => {
    // Duck-typed on purpose: src/shared/ cannot import the ApiError class at all (tsconfig
    // boundary above), so the classifier must key off the numeric `status` field, not
    // `cause instanceof ApiError` — this is impossible to satisfy any other way given the
    // compile boundary, but the case still discriminates an implementation that requires an
    // extra field (e.g. `name === "ApiError"`) before classifying as http-error.
    const apiErrorShaped = { status: 404, message: "Task not found", name: "ApiError" };
    expect(classifyRequestFailure(apiErrorShaped).kind).toBe("http-error");
  });
});

describe("classifyRequestFailure — network-unreachable failures (PRD AC-4, plan AC-A1)", () => {
  it("classifies a raw fetch()-style TypeError (no status) as server-unreachable", () => {
    // Per MDN (the plan's own research-web citation): fetch() rejects with a TypeError and
    // no Response — hence no `status` — when the network itself fails, never on an HTTP
    // error status.
    const result = classifyRequestFailure(new TypeError("Failed to fetch"));
    expect(result.kind).toBe("server-unreachable");
  });

  it("classifies a generic Error with no status field as server-unreachable, not only a TypeError", () => {
    // Guards against an implementation that special-cases `instanceof TypeError` instead of
    // the documented structural check (presence of a numeric `status`) — a real fetch
    // failure could surface as a plain Error in some environments too.
    const result = classifyRequestFailure(new Error("network request failed"));
    expect(result.kind).toBe("server-unreachable");
  });

  it("classifies a plain object with no status field at all as server-unreachable", () => {
    expect(classifyRequestFailure({}).kind).toBe("server-unreachable");
  });

  it("the server-unreachable message is distinct from any http-error message", () => {
    const unreachable = classifyRequestFailure(new TypeError("Failed to fetch"));
    const httpError = classifyRequestFailure({ status: 500 });
    expect(unreachable.message).not.toBe(httpError.message);
  });
});

describe("classifyRequestFailure — boundary and malformed causes (PRD AC-4)", () => {
  it("does not classify a non-numeric status field as http-error (typeof check, not just key presence)", () => {
    // A cause carrying `status` as a STRING (not a number) must not be duck-typed as
    // ApiError-shaped — this catches an implementation that only checks `"status" in cause`
    // without also checking `typeof cause.status === "number"`.
    const result = classifyRequestFailure({ status: "500" });
    expect(result.kind).toBe("server-unreachable");
  });

  it("classifies a non-object primitive cause (string) as server-unreachable without throwing", () => {
    expect(() => classifyRequestFailure("boom")).not.toThrow();
    expect(classifyRequestFailure("boom").kind).toBe("server-unreachable");
  });

  it("classifies null and undefined causes as server-unreachable without throwing", () => {
    // A naive `cause.status` property access on null/undefined would crash instead of
    // classifying — this is the case that catches that bug.
    expect(() => classifyRequestFailure(null)).not.toThrow();
    expect(() => classifyRequestFailure(undefined)).not.toThrow();
    expect(classifyRequestFailure(null).kind).toBe("server-unreachable");
    expect(classifyRequestFailure(undefined).kind).toBe("server-unreachable");
  });
});

// ui-design-pass phase 1 (PRPs/plans/ui-design-pass-phase-1-chrome-fonts-and-foundation.plan.md,
// Task 4; plan AC-A1). Written BEFORE the Implementer: the module still carries the
// English sentences, so these two cases are RED for the right reason — a behavioural
// red, not a missing module — until the wording is translated. They pin the exact
// sentence the owner reads (ADR-0009: tests that pin owner-facing messages pin the
// Portuguese wording from A5 on); the cases above keep asserting the structure.
describe("classifyRequestFailure — pt-BR wording (ui-design-pass PRD AC-4 pt-br-shared-messages)", () => {
  it("pins the http-error sentence with the status code inside it, never a bare code", () => {
    expect(classifyRequestFailure({ status: 500 }).message).toBe(
      "O servidor recusou a operação (código 500). Tente de novo.",
    );
    expect(classifyRequestFailure({ status: 401 }).message).toBe(
      "O servidor recusou a operação (código 401). Tente de novo.",
    );
  });

  it("pins the server-unreachable sentence", () => {
    expect(classifyRequestFailure(new TypeError("Failed to fetch")).message).toBe(
      "Sem conexão com o servidor. Nada se perdeu — tente de novo quando a conexão voltar.",
    );
  });
});
