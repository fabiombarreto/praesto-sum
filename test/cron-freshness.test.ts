// PRPs/prds/push-channel-proven.prd.md AC-6 freshness-classification-at-the-10-minute-threshold
//
// Pure `src/shared` module suite for `classifyCronFreshness` (phase 3
// cron-heartbeat, plan Task 3 / plan AC-A2), mirroring
// `src/shared/push-outcome.ts`'s environment-agnostic, DOM-free shape. Three
// distinct states are required — `fresh`, `stale`, `unknown` — and `stale`
// must never stand in for `unknown` (a `null` last-run instant means no run
// was EVER recorded, which is categorically different from a very old one).
// The boundary is tested at exactly 10 minutes, not near it, per the
// dispatch's own warning that an off-by-one here is invisible until the
// owner is misled about whether the assistant is alive.
//
// Written BEFORE the Implementer (test-first): `src/shared/cron-freshness.ts`
// does not exist yet, so this file is RED for the right reason (unresolved
// import) until plan Task 3 lands.

import { describe, expect, it } from "vitest";
import { classifyCronFreshness, FRESHNESS_THRESHOLD_MS } from "../src/shared/cron-freshness";

const NOW = new Date("2026-09-07T12:00:00.000Z");

describe("classifyCronFreshness — AC-A2 (PRD AC-6)", () => {
  it("returns unknown when no run has ever been recorded (null lastRunAt)", () => {
    expect(classifyCronFreshness(null, NOW)).toBe("unknown");
  });

  it("returns fresh when the gap is just under the 10-minute threshold", () => {
    const lastRunAt = new Date(NOW.getTime() - (FRESHNESS_THRESHOLD_MS - 1));
    expect(classifyCronFreshness(lastRunAt, NOW)).toBe("fresh");
  });

  it("returns fresh for a run that just happened (zero gap)", () => {
    expect(classifyCronFreshness(NOW, NOW)).toBe("fresh");
  });

  it("returns stale at EXACTLY the 10-minute boundary — the closed boundary is on the stale side", () => {
    const lastRunAt = new Date(NOW.getTime() - FRESHNESS_THRESHOLD_MS);
    expect(classifyCronFreshness(lastRunAt, NOW)).toBe("stale");
  });

  it("returns stale for a gap one millisecond past the boundary", () => {
    const lastRunAt = new Date(NOW.getTime() - (FRESHNESS_THRESHOLD_MS + 1));
    expect(classifyCronFreshness(lastRunAt, NOW)).toBe("stale");
  });

  it("returns stale when the gap is far beyond 10 minutes", () => {
    const lastRunAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(classifyCronFreshness(lastRunAt, NOW)).toBe("stale");
  });

  it("never collapses unknown into stale, even though both are 'not fresh'", () => {
    const veryStale = classifyCronFreshness(new Date(0), NOW);
    const neverRun = classifyCronFreshness(null, NOW);
    expect(veryStale).toBe("stale");
    expect(neverRun).toBe("unknown");
    expect(neverRun).not.toBe(veryStale);
  });

  it("FRESHNESS_THRESHOLD_MS is exactly 10 minutes in milliseconds", () => {
    expect(FRESHNESS_THRESHOLD_MS).toBe(10 * 60 * 1000);
  });
});
