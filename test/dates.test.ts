// PRPs/prds/reminders.prd.md AC-3 Reminder attached to a Task, relative to its deadline
// PRPs/prds/reminders.prd.md AC-14 The offset-to-instant conversion is pure and clock-free
//
// Source plan: PRPs/plans/reminders-phase-1-reminder-api-and-the-time-contract.plan.md
// (Task 1 — src/shared/dates.ts: offsetToInstant + END_OF_DAY_LOCAL_MINUTES).
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// `offsetToInstant` and `END_OF_DAY_LOCAL_MINUTES` do not exist in
// src/shared/dates.ts yet, so this file is expected to be RED for the right
// reason (the named exports are missing) until plan Task 1 is implemented.
//
// Fixtures are pinned against America/Sao_Paulo, which has carried a fixed
// -03:00 offset with no DST since 2019 — the fixture year (2026) is safely
// inside that fixed-offset era, so every expected instant below is computed
// with `Date.UTC(...)` rather than a magic epoch number, keeping the
// assertion legible and independent of the implementation's own internals.

import { describe, expect, it, vi } from "vitest";
import {
  END_OF_DAY_LOCAL_MINUTES,
  instantToLocalParts,
  localPartsToInstant,
  offsetMinutesAt,
  offsetToInstant,
  PRAESTO_TIMEZONE,
} from "../src/shared/dates";

describe("offsetToInstant (PRD AC-3, AC-14)", () => {
  it("returns the epoch instant N minutes before 23:59 local America/Sao_Paulo (PRD AC-3 worked example)", () => {
    // 2026-09-20, 60 minutes before 23:59 local -> 22:59 local -03:00 -> 2026-09-21T01:59:00Z.
    const expected = Date.UTC(2026, 8, 21, 1, 59, 0) / 1000;
    expect(offsetToInstant("2026-09-20", 60)).toBe(expected);
  });

  it("computes a zero offset as exactly 23:59 local -> 2026-09-21T02:59:00Z", () => {
    const expected = Date.UTC(2026, 8, 21, 2, 59, 0) / 1000;
    expect(offsetToInstant("2026-09-20", 0)).toBe(expected);
  });

  it("defaults the timezone argument to America/Sao_Paulo (AC-14)", () => {
    const withDefault = offsetToInstant("2026-09-20", 60);
    const withExplicitDefault = offsetToInstant("2026-09-20", 60, PRAESTO_TIMEZONE);
    expect(withDefault).toBe(withExplicitDefault);
  });

  it("takes the timezone as an argument that changes the result (AC-14)", () => {
    // In UTC, "local" IS UTC, so 60 minutes before 23:59 UTC on 2026-09-20 is
    // 22:59:00Z the same day — three hours away from the -03:00 answer above.
    const utcInstant = offsetToInstant("2026-09-20", 60, "UTC");
    const saoPauloInstant = offsetToInstant("2026-09-20", 60);
    expect(utcInstant).toBe(Date.UTC(2026, 8, 20, 22, 59, 0) / 1000);
    expect(saoPauloInstant - utcInstant).toBe(3 * 60 * 60);
  });

  it("reads no ambient clock: mocking the system clock does not change the result (AC-14)", () => {
    const before = offsetToInstant("2026-09-20", 60);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      const after = offsetToInstant("2026-09-20", 60);
      expect(after).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("END_OF_DAY_LOCAL_MINUTES (PRD AC-3, AC-14)", () => {
  it("names 23:59 as the single source of the 'meaning of a deadline' convention", () => {
    expect(END_OF_DAY_LOCAL_MINUTES).toBe(23 * 60 + 59);
  });
});

// --- UPDATE (reminders phase 3, absolute-Reminder local-datetime helpers) --
// PRPs/prds/reminders.prd.md AC-14 The offset-to-instant conversion is pure
// and clock-free — the SAME convention this phase's two new helpers must
// hold, since they back the absolute-Reminder date/time form inputs
// (plan AC-A2/AC-A3 scaffolding). Source plan:
// PRPs/plans/reminders-phase-3-per-task-route-and-reminder-ui.plan.md
// (Task 4 — src/shared/dates.ts: export `offsetMinutesAt`; add
// `instantToLocalParts`/`localPartsToInstant`, reusing the exact two-pass
// DST-refinement shape `offsetToInstant` already uses, generalised to an
// explicit `HH:mm` instead of `END_OF_DAY_LOCAL_MINUTES`).
//
// This file is RED again for a NEW reason once Task 4 lands and before it:
// today `offsetMinutesAt` is not exported at all and `instantToLocalParts`/
// `localPartsToInstant` do not exist — a compile-time import error on all
// three names added to the import above — until Task 4 lands. Every
// assertion ABOVE this point is untouched: `offsetToInstant`'s own contract
// keeps exactly its prior shape and expectation.
//
// Fixtures reuse the same fixed-offset property as above: America/Sao_Paulo
// has carried a fixed -03:00 offset with no DST since 2019, so every expected
// local/instant pair below is derived by hand via `Date.UTC(...)` +/- 3
// hours, independent of the implementation's own internals.

describe("offsetMinutesAt (Task 4 — newly exported, no behavioural change)", () => {
  it("returns -180 minutes east-of-UTC for America/Sao_Paulo (fixed since 2019)", () => {
    const instant = new Date(Date.UTC(2026, 8, 20, 12, 0, 0));
    expect(offsetMinutesAt(instant, PRAESTO_TIMEZONE)).toBe(-180);
  });

  it("returns 0 minutes for UTC itself", () => {
    const instant = new Date(Date.UTC(2026, 8, 20, 12, 0, 0));
    expect(offsetMinutesAt(instant, "UTC")).toBe(0);
  });
});

describe("instantToLocalParts (Task 4)", () => {
  it("splits an epoch instant into the local calendar day and HH:mm in America/Sao_Paulo", () => {
    // 2026-09-20T17:30:00Z -03:00 -> 2026-09-20 14:30 local.
    const epochSeconds = Date.UTC(2026, 8, 20, 17, 30, 0) / 1000;
    expect(instantToLocalParts(epochSeconds)).toEqual({ day: "2026-09-20", time: "14:30" });
  });

  it("defaults the timezone argument to America/Sao_Paulo", () => {
    const epochSeconds = Date.UTC(2026, 8, 20, 17, 30, 0) / 1000;
    expect(instantToLocalParts(epochSeconds)).toEqual(
      instantToLocalParts(epochSeconds, PRAESTO_TIMEZONE),
    );
  });

  it("takes the timezone as an argument that changes the result", () => {
    const epochSeconds = Date.UTC(2026, 8, 20, 17, 30, 0) / 1000;
    expect(instantToLocalParts(epochSeconds, "UTC")).toEqual({ day: "2026-09-20", time: "17:30" });
  });

  it("crosses a local day boundary correctly (a late-UTC instant is the next local day when the offset is west)", () => {
    // 2026-09-20T02:00:00Z -03:00 -> 2026-09-19 23:00 local — still the day before.
    const epochSeconds = Date.UTC(2026, 8, 20, 2, 0, 0) / 1000;
    expect(instantToLocalParts(epochSeconds)).toEqual({ day: "2026-09-19", time: "23:00" });
  });
});

describe("localPartsToInstant (Task 4)", () => {
  it("converts a local calendar day plus HH:mm into the matching epoch instant", () => {
    const expected = Date.UTC(2026, 8, 20, 17, 30, 0) / 1000;
    expect(localPartsToInstant("2026-09-20", "14:30")).toBe(expected);
  });

  it("defaults the timezone argument to America/Sao_Paulo", () => {
    const withDefault = localPartsToInstant("2026-09-20", "14:30");
    const withExplicitDefault = localPartsToInstant("2026-09-20", "14:30", PRAESTO_TIMEZONE);
    expect(withDefault).toBe(withExplicitDefault);
  });

  it("takes the timezone as an argument that changes the result", () => {
    const utcInstant = localPartsToInstant("2026-09-20", "14:30", "UTC");
    const saoPauloInstant = localPartsToInstant("2026-09-20", "14:30");
    expect(utcInstant).toBe(Date.UTC(2026, 8, 20, 14, 30, 0) / 1000);
    expect(saoPauloInstant - utcInstant).toBe(3 * 60 * 60);
  });

  it("reads no ambient clock: mocking the system clock does not change the result", () => {
    const before = localPartsToInstant("2026-09-20", "14:30");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      const after = localPartsToInstant("2026-09-20", "14:30");
      expect(after).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("instantToLocalParts and localPartsToInstant agree — a whole-minute instant round-trips", () => {
  it("round-trips a whole-minute instant through both directions", () => {
    const instant = Date.UTC(2026, 8, 20, 17, 30, 0) / 1000;
    const parts = instantToLocalParts(instant);
    expect(localPartsToInstant(parts.day, parts.time)).toBe(instant);
  });
});
