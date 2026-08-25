// Canary for the barrier in test/isolation.ts.
//
// `isolatedIt` reaches through Vitest's own chainable internals to register
// each test body, which is exactly the kind of coupling that breaks quietly on
// an upgrade: registration would stop, `resetTaskTables()` would have nothing
// to wait for, and all five DB suites would go on passing — until a loaded
// machine leaked a row again and the frozen Task read contract reported a
// violation that never happened. These two cases fail loudly instead.
//
// A body is registered by the wrapper only once it yields — before the first
// `await` the body is still running synchronously inside the wrapper — so each
// case yields first and then looks.

import { describe, expect } from "vitest";
import { isolatedIt as it, pendingBodyCount } from "./isolation";

describe("the test-isolation barrier is wired up", () => {
  it("registers the body of a plainly defined test", async () => {
    await Promise.resolve();
    expect(pendingBodyCount()).toBeGreaterThan(0);
  });

  // `it.each` builds its cases through a separate collector, so it is wrapped
  // by a separate path and needs its own canary.
  it.each([1, 2])("registers the body of it.each case %i", async () => {
    await Promise.resolve();
    expect(pendingBodyCount()).toBeGreaterThan(0);
  });
});
