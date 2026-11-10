// PRPs/prds/events-and-day-view.prd.md AC-5 Capabilities by source
//
// Source plan: PRPs/plans/events-and-day-view-phase-1-pure-core-and-migration.plan.md
// (AC-A5; Task 1 — `EVENT_SOURCES`, `eventCapabilities` and `assertNeverEventSource`
// in src/shared/events.ts).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `src/shared/events.ts`
// does not exist yet, so this file is expected to be RED for the right reason — the
// module import cannot be resolved — until plan Task 1 lands.
//
// What the PRD asks for here has two halves, and only one of them is a runtime fact:
//
//   * RUNTIME: a `local` event is editable and deletable and does not open in Google; a
//     `google` event is neither editable nor deletable and does open in Google; and a
//     source the function was never taught about is a loud failure, not a silent answer.
//   * COMPILE TIME: "the function is an exhaustive switch over `EventSource`, so adding a
//     value stops compiling". No runtime assertion can observe that. It is pinned from
//     the test side by the `expectTypeOf` lines below — those are checked by `tsc -b`
//     (`npm run check`), not by Vitest — so widening the union breaks this file's type
//     check and forces whoever adds a source to come back here and decide what it can
//     do. The production half (the `never` assertion in the switch's default) is the
//     implementation's own compile-time guarantee, mirrored from
//     `assertNeverDaySource`, and `tsc -b` enforces it on the Implementer's code.

import { describe, expect, expectTypeOf, it } from "vitest";
import { assertNeverEventSource, EVENT_SOURCES, eventCapabilities } from "../src/shared/events";
import type { EventSource } from "../src/shared/events";

describe("AC-5 — a local event", () => {
  it("is editable and deletable and does not open in Google", () => {
    expect(eventCapabilities("local")).toEqual({
      editable: true,
      deletable: true,
      opensInGoogle: false,
    });
  });
});

describe("AC-5 — a google event", () => {
  it("is neither editable nor deletable and opens in Google", () => {
    expect(eventCapabilities("google")).toEqual({
      editable: false,
      deletable: false,
      opensInGoogle: true,
    });
  });
});

describe("AC-5 — the set of sources", () => {
  it("is exactly local and google", () => {
    expect([...EVENT_SOURCES]).toEqual(["local", "google"]);
  });

  it("answers every source it lists with all three capabilities as booleans", () => {
    for (const source of EVENT_SOURCES) {
      const capabilities = eventCapabilities(source);
      expect(Object.keys(capabilities).sort()).toEqual(["deletable", "editable", "opensInGoogle"]);
      expect(typeof capabilities.editable).toBe("boolean");
      expect(typeof capabilities.deletable).toBe("boolean");
      expect(typeof capabilities.opensInGoogle).toBe("boolean");
    }
  });
});

describe("AC-5 — a source outside the union fails loudly", () => {
  it("throws from the exhaustiveness assertion instead of returning undefined", () => {
    expect(() => assertNeverEventSource("outlook" as never)).toThrow();
  });

  it("throws from eventCapabilities when handed a source it was never taught", () => {
    expect(() => eventCapabilities("outlook" as unknown as EventSource)).toThrow();
  });
});

describe("AC-5 — compile-time pins, checked by tsc -b", () => {
  it("keeps EventSource the union of exactly local and google", () => {
    expectTypeOf<EventSource>().toEqualTypeOf<"local" | "google">();
    expectTypeOf(eventCapabilities).parameter(0).toEqualTypeOf<EventSource>();
  });
});
