// PRPs/prds/events-and-day-view.prd.md AC-1 Wall-clock to instant
//
// Source plan: PRPs/plans/events-and-day-view-phase-1-pure-core-and-migration.plan.md
// (AC-A1; Task 2 — `wallClockToInstant` and `instantToWallClock` in src/shared/events.ts).
//
// Written BEFORE the Implementer (test-first, per `tdd: true`): `src/shared/events.ts`
// does not exist yet, so this file is expected to be RED for the right reason — the
// module import cannot be resolved — until plan Task 2 lands. No other RED reason is
// expected.
//
// The vectors that matter are the two America/New_York ones. America/Sao_Paulo has
// carried a fixed -03:00 offset since 2019, so it can never reveal a daylight-saving
// bug; the overlap (an hour that occurs twice) and the gap (an hour that does not
// exist) are where an implementation is actually decided. RFC 5545 section 3.3.5 says
// an overlap resolves to its FIRST occurrence and a gap is read with the UTC offset
// from BEFORE the gap. Every expected instant is spelled with `Date.UTC(...)` so the
// assertion stays legible and independent of the implementation's internals.
//
// The Southern-Hemisphere vectors (Australia/Sydney) are here because the offset moves
// the other way there and the transitions fall on the previous UTC day, which a probe
// that assumed a Northern-Hemisphere shape would get wrong.

import { describe, expect, it } from "vitest";
import { localPartsToInstant } from "../src/shared/dates";
import { instantToWallClock, wallClockToInstant } from "../src/shared/events";

const SAO_PAULO = "America/Sao_Paulo";
const NEW_YORK = "America/New_York";
const SYDNEY = "Australia/Sydney";

/** Epoch seconds of a UTC moment; the month is 1-based, as the PRD writes dates. */
function utc(year: number, month: number, day: number, hour: number, minute: number): number {
  return Date.UTC(year, month - 1, day, hour, minute) / 1000;
}

describe("AC-1 — an ordinary wall-clock time resolves to its instant", () => {
  it("resolves 2026-10-20 09:30 in America/Sao_Paulo to 12:30 UTC of that day", () => {
    expect(wallClockToInstant("2026-10-20", "09:30", SAO_PAULO)).toBe(utc(2026, 10, 20, 12, 30));
  });

  it("carries a late evening time into the next UTC day", () => {
    expect(wallClockToInstant("2026-10-20", "23:30", SAO_PAULO)).toBe(utc(2026, 10, 21, 2, 30));
  });

  it("honours the zone it is given rather than a hard-wired one", () => {
    // Tokyo is a fixed +09:00: 09:30 local is 00:30 UTC of the same day.
    expect(wallClockToInstant("2026-10-20", "09:30", "Asia/Tokyo")).toBe(utc(2026, 10, 20, 0, 30));
    expect(wallClockToInstant("2026-10-20", "09:30", "UTC")).toBe(utc(2026, 10, 20, 9, 30));
  });
});

describe("AC-1 — an hour that occurs twice resolves to its first occurrence", () => {
  it("resolves 2026-11-01 01:30 in America/New_York to 05:30 UTC (EDT), not 06:30 UTC (EST)", () => {
    expect(wallClockToInstant("2026-11-01", "01:30", NEW_YORK)).toBe(utc(2026, 11, 1, 5, 30));
  });

  it.each<[string, string, number]>([
    ["the first minute of the repeated hour", "01:00", utc(2026, 11, 1, 5, 0)],
    ["the last minute of the repeated hour", "01:59", utc(2026, 11, 1, 5, 59)],
  ])("resolves %s to the EDT occurrence", (_label, time, expected) => {
    expect(wallClockToInstant("2026-11-01", time, NEW_YORK)).toBe(expected);
  });

  it("keeps the times just outside the repeated hour on their own side of the change", () => {
    // 00:30 is still EDT (-04:00); 02:30 is already EST (-05:00).
    expect(wallClockToInstant("2026-11-01", "00:30", NEW_YORK)).toBe(utc(2026, 11, 1, 4, 30));
    expect(wallClockToInstant("2026-11-01", "02:30", NEW_YORK)).toBe(utc(2026, 11, 1, 7, 30));
  });

  it("resolves the repeated hour of a Southern-Hemisphere zone to its first occurrence", () => {
    // Sydney leaves daylight time on 2026-04-05 at 03:00 AEDT (+11:00), so 02:30 happens
    // first at +11:00 (15:30 UTC the day before) and again at +10:00 (16:30 UTC).
    expect(wallClockToInstant("2026-04-05", "02:30", SYDNEY)).toBe(utc(2026, 4, 4, 15, 30));
  });
});

describe("AC-1 — an hour that does not exist resolves with the offset before the gap", () => {
  it("resolves 2026-03-08 02:30 in America/New_York to 07:30 UTC (the EST offset)", () => {
    expect(wallClockToInstant("2026-03-08", "02:30", NEW_YORK)).toBe(utc(2026, 3, 8, 7, 30));
  });

  it.each<[string, string, number]>([
    ["the first minute of the gap", "02:00", utc(2026, 3, 8, 7, 0)],
    ["the last minute of the gap", "02:59", utc(2026, 3, 8, 7, 59)],
  ])("resolves %s with the offset before the gap", (_label, time, expected) => {
    expect(wallClockToInstant("2026-03-08", time, NEW_YORK)).toBe(expected);
  });

  it("keeps the times just outside the gap on their own side of the change", () => {
    // 01:30 is still EST (-05:00); 03:30 is already EDT (-04:00).
    expect(wallClockToInstant("2026-03-08", "01:30", NEW_YORK)).toBe(utc(2026, 3, 8, 6, 30));
    expect(wallClockToInstant("2026-03-08", "03:30", NEW_YORK)).toBe(utc(2026, 3, 8, 7, 30));
  });

  it("resolves the gap of a Southern-Hemisphere zone with the offset before it", () => {
    // Sydney enters daylight time on 2026-10-04 at 02:00 AEST (+10:00), so 02:30 does
    // not exist and is read at +10:00: 16:30 UTC on 2026-10-03.
    expect(wallClockToInstant("2026-10-04", "02:30", SYDNEY)).toBe(utc(2026, 10, 3, 16, 30));
  });
});

describe("AC-1 — the inverse split of an instant", () => {
  it("returns the same day and time for an ordinary instant", () => {
    expect(instantToWallClock(utc(2026, 10, 20, 12, 30), SAO_PAULO)).toEqual({
      day: "2026-10-20",
      time: "09:30",
    });
  });

  it("moves back to the previous local day when the UTC day has already rolled over", () => {
    expect(instantToWallClock(utc(2026, 10, 21, 2, 30), SAO_PAULO)).toEqual({
      day: "2026-10-20",
      time: "23:30",
    });
  });

  it("reads local midnight as 00:00", () => {
    expect(instantToWallClock(utc(2026, 10, 21, 3, 0), SAO_PAULO)).toEqual({
      day: "2026-10-21",
      time: "00:00",
    });
  });

  it("round-trips every ordinary wall-clock time in several zones", () => {
    const cases: Array<[string, string, string]> = [
      ["2026-10-20", "09:30", SAO_PAULO],
      ["2026-10-20", "00:00", SAO_PAULO],
      ["2026-12-31", "23:59", SAO_PAULO],
      ["2026-07-15", "13:45", NEW_YORK],
      ["2026-01-15", "13:45", NEW_YORK],
      ["2026-07-15", "13:45", SYDNEY],
      ["2026-01-15", "13:45", SYDNEY],
    ];
    for (const [day, time, zone] of cases) {
      expect(instantToWallClock(wallClockToInstant(day, time, zone), zone)).toEqual({ day, time });
    }
  });
});

describe("AC-1 — the shipped localPartsToInstant is left as it was", () => {
  // Reminders still depend on `localPartsToInstant`, which is why the RFC 5545 rule lives
  // in a NEW function rather than in `dates.ts`. The two agree on an ordinary time; inside
  // a gap the shipped function answers with the offset AFTER it (06:30 UTC), which is
  // precisely the answer the Event helper must not give.
  it("still resolves an ordinary time exactly as before", () => {
    expect(localPartsToInstant("2026-10-20", "09:30", SAO_PAULO)).toBe(utc(2026, 10, 20, 12, 30));
  });

  it("still answers inside a gap as it always did, which differs from the Event rule", () => {
    expect(localPartsToInstant("2026-03-08", "02:30", NEW_YORK)).toBe(utc(2026, 3, 8, 6, 30));
    expect(wallClockToInstant("2026-03-08", "02:30", NEW_YORK)).not.toBe(
      localPartsToInstant("2026-03-08", "02:30", NEW_YORK),
    );
  });
});
