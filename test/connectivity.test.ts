// PRPs/prds/ui-design-pass.prd.md AC-7 connectivity-reducer
//
// Source plan: PRPs/plans/ui-design-pass-phase-1-chrome-fonts-and-foundation.plan.md
// (Task 3 — src/shared/connectivity.ts: reduceConnectivity(state, event) and
// canWrite(state); plan AC-A4).
//
// This is a pure, DOM-free unit under test (src/shared/connectivity.ts must stay
// environment-agnostic and dual-compiled into both the browser and Worker targets —
// tsconfig.test.json's `include` lists `test`, `src/worker`, `src/shared` but NOT
// `src/app`). The browser events that feed the reducer (`online`, `offline`,
// `visibilitychange`) live in the Phase 2 hook, which is the exempt adapter under
// docs/context/methodology.md's "Browser-API work: split the logic out, then the glue
// is exempt" rule; this suite never touches them and never mocks anything — the
// reducer is called directly with plain event objects.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/connectivity.ts does not exist yet, so this file is expected to be RED for
// the right reason (module-not-found on the import below) until plan Task 3 is
// implemented. The discriminating cases once it exists: `offline` winning over a
// server-unreachable failure (a naive "last event wins" reducer returns `unreachable`),
// an http-error leaving every state untouched (the server answered), and `canWrite`
// being true for `online` only.

import { describe, expect, it } from "vitest";
import { canWrite, reduceConnectivity } from "../src/shared/connectivity";
import type { ConnectivityEvent, ConnectivityState } from "../src/shared/connectivity";

const STATES: ConnectivityState[] = ["online", "offline", "unreachable"];

const unreachable: ConnectivityEvent = { type: "request-failed", kind: "server-unreachable" };
const httpError: ConnectivityEvent = { type: "request-failed", kind: "http-error" };

describe("reduceConnectivity — browser events (PRD AC-7 connectivity-reducer)", () => {
  it.each(STATES)("browser-offline moves %s to offline", (state) => {
    expect(reduceConnectivity(state, { type: "browser-offline" })).toBe("offline");
  });

  it.each(STATES)("browser-online moves %s to online", (state) => {
    expect(reduceConnectivity(state, { type: "browser-online" })).toBe("online");
  });
});

describe("reduceConnectivity — request outcomes (PRD AC-7 connectivity-reducer)", () => {
  it("a server-unreachable failure marks the server unreachable from online", () => {
    expect(reduceConnectivity("online", unreachable)).toBe("unreachable");
  });

  it("a server-unreachable failure keeps an already unreachable server unreachable", () => {
    expect(reduceConnectivity("unreachable", unreachable)).toBe("unreachable");
  });

  it("offline wins: a server-unreachable failure while offline leaves the state offline", () => {
    // Airplane mode makes every request fail; the honest state is still "sem conexão",
    // not "servidor inacessível".
    expect(reduceConnectivity("offline", unreachable)).toBe("offline");
  });

  it.each(STATES)("an http-error failure leaves %s unchanged — the server answered", (state) => {
    expect(reduceConnectivity(state, httpError)).toBe(state);
  });

  it.each(STATES)("a succeeded request moves %s to online", (state) => {
    expect(reduceConnectivity(state, { type: "request-succeeded" })).toBe("online");
  });
});

describe("reduceConnectivity — sequences the banner will see (PRD AC-7)", () => {
  function run(initial: ConnectivityState, events: ConnectivityEvent[]): ConnectivityState[] {
    const trail: ConnectivityState[] = [];
    let state = initial;
    for (const event of events) {
      state = reduceConnectivity(state, event);
      trail.push(state);
    }
    return trail;
  }

  it("airplane mode, a failed refetch, reconnect, then a successful refetch", () => {
    expect(
      run("online", [
        { type: "browser-offline" },
        unreachable,
        { type: "browser-online" },
        { type: "request-succeeded" },
      ]),
    ).toEqual(["offline", "offline", "online", "online"]);
  });

  it("the server goes down and comes back while the browser stays online", () => {
    expect(run("online", [unreachable, httpError, { type: "request-succeeded" }])).toEqual([
      "unreachable",
      "unreachable",
      "online",
    ]);
  });

  it("a 4xx/5xx after reconnecting does not fake an outage", () => {
    expect(run("offline", [{ type: "browser-online" }, httpError])).toEqual(["online", "online"]);
  });
});

describe("canWrite (PRD AC-7 connectivity-reducer)", () => {
  it("allows writes only when online", () => {
    expect(canWrite("online")).toBe(true);
    expect(canWrite("offline")).toBe(false);
    expect(canWrite("unreachable")).toBe(false);
  });
});
