// PRPs/prds/repeated-miss-nudge.prd.md AC-1..AC-5 — Phase 1, pure nudge decision
// (`src/shared/nudge.ts`).
//
// Source plan: PRPs/plans/repeated-miss-nudge-phase-1-pure-nudge-decision.plan.md
//
// Authored test-first (per `tdd: true`), before src/shared/nudge.ts existed.
// The contract shape (NUDGE_THRESHOLD / NUDGE_FROM_LOCAL_HOUR / trailingMissStreak /
// decideNudge / NudgeSeries / NudgeDecision) is the plan's declared contract.
//
// The clock and the zone are data: `now` is an argument and the series carries
// its own IANA zone. Instants are written as UTC and chosen so the expected
// local hour is unambiguous (America/Sao_Paulo is UTC-3 all year, no DST).
// The "purity" and "recurrence.ts / adherence.ts unchanged" halves are grep /
// git properties (plan Task 4); only the behavioural half is asserted here.

import { describe, expect, it } from "vitest";
import {
  NUDGE_FROM_LOCAL_HOUR,
  NUDGE_THRESHOLD,
  decideNudge,
  trailingMissStreak,
  type NudgeSeries,
} from "../src/shared/nudge";
import type { AdherenceRow } from "../src/shared/adherence";

type Status = AdherenceRow["status"];

/** Rows on consecutive days starting 2026-10-01, in the given status order. */
function rowsFrom(statuses: Status[], start = "2026-10-01"): AdherenceRow[] {
  const [y, m, d] = start.split("-").map(Number);
  return statuses.map((status, i) => ({
    occurrenceDate: new Date(Date.UTC(y!, m! - 1, d! + i)).toISOString().slice(0, 10),
    status,
  }));
}

const SAO_PAULO = "America/Sao_Paulo";

/** An active, unmuted, not-yet-nudged series in the given zone. */
function series(overrides: Partial<NudgeSeries> = {}): NudgeSeries {
  return {
    status: "active",
    nudgeMuted: false,
    nudgedAt: null,
    timeZone: SAO_PAULO,
    ...overrides,
  };
}

/** `done, missed, missed, missed` — a trailing count of 3. */
const THREE_MISSES = rowsFrom(["done", "missed", "missed", "missed"]);

/** An instant given as a UTC ISO string. */
function at(iso: string): Date {
  return new Date(iso);
}

describe("constants", () => {
  it("the threshold is three consecutive misses and the window opens at 09:00", () => {
    expect(NUDGE_THRESHOLD).toBe(3);
    expect(NUDGE_FROM_LOCAL_HOUR).toBe(9);
  });
});

describe("trailingMissStreak — consecutive count (AC-1)", () => {
  it("is 3 for done, missed, missed, missed", () => {
    expect(trailingMissStreak(rowsFrom(["done", "missed", "missed", "missed"]))).toBe(3);
  });

  it("is 1 for missed, missed, done, missed", () => {
    expect(trailingMissStreak(rowsFrom(["missed", "missed", "done", "missed"]))).toBe(1);
  });

  it("is 0 for only open rows", () => {
    expect(trailingMissStreak(rowsFrom(["open"]))).toBe(0);
  });

  it("is 0 for no rows", () => {
    expect(trailingMissStreak([])).toBe(0);
  });

  it("counts every trailing miss beyond the threshold", () => {
    const rows = rowsFrom(["done", "missed", "missed", "missed", "missed", "missed"]);
    expect(trailingMissStreak(rows)).toBe(5);
  });

  it("ignores an open row after the latest closed one (neither counted nor a reset)", () => {
    expect(trailingMissStreak(rowsFrom(["done", "missed", "missed", "open"]))).toBe(2);
  });

  it("follows occurrence date order, not the order rows are supplied", () => {
    // By date: 10-01 done, 10-02 missed, 10-03 missed, 10-04 missed => 3.
    // Supplied scrambled so the last-supplied row is the 10-02 missed one and
    // the done row sits third: an insertion-order implementation would read
    // missed, missed, done, missed and answer 1 (only the last miss, before
    // the done row resets the run).
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-03", status: "missed" },
      { occurrenceDate: "2026-10-04", status: "missed" },
      { occurrenceDate: "2026-10-01", status: "done" },
      { occurrenceDate: "2026-10-02", status: "missed" },
    ];
    expect(trailingMissStreak(rows)).toBe(3);
  });

  it("does not reorder the rows it is given", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-03", status: "missed" },
      { occurrenceDate: "2026-10-01", status: "done" },
      { occurrenceDate: "2026-10-02", status: "missed" },
    ];
    const snapshot = JSON.parse(JSON.stringify(rows));
    trailingMissStreak(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe("trailingMissStreak — a completion resets (AC-2)", () => {
  it("is 0 for missed, missed, missed, done", () => {
    expect(trailingMissStreak(rowsFrom(["missed", "missed", "missed", "done"]))).toBe(0);
  });

  it("is 2 after the series then misses twice more", () => {
    expect(
      trailingMissStreak(rowsFrom(["missed", "missed", "missed", "done", "missed", "missed"])),
    ).toBe(2);
  });
});

describe("trailingMissStreak — skipped cycles leave no row (AC-3)", () => {
  it("is 3 for missed, missed, a skipped day with no row, then a third missed", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-01", status: "missed" },
      { occurrenceDate: "2026-10-02", status: "missed" },
      // 2026-10-03: the open occurrence was deleted — no row exists.
      { occurrenceDate: "2026-10-04", status: "missed" },
    ];
    expect(trailingMissStreak(rows)).toBe(3);
  });

  it("a gap after a done does not reset or inflate the count", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-01", status: "done" },
      { occurrenceDate: "2026-10-02", status: "missed" },
      { occurrenceDate: "2026-10-05", status: "missed" },
    ];
    expect(trailingMissStreak(rows)).toBe(2);
  });
});

describe("decideNudge — due decision (AC-4)", () => {
  // 2026-10-10T15:00Z is 12:00 in America/Sao_Paulo: well inside the window.
  const NOON_SP = at("2026-10-10T15:00:00Z");

  it("is due for an active, unmuted, unmarked series at count 3 inside the window", () => {
    expect(decideNudge(series(), THREE_MISSES, NOON_SP)).toEqual({
      due: true,
      streak: 3,
      reason: "due",
    });
  });

  it("is still due at count 5 (the run continues; the marker, not the count, silences it)", () => {
    const rows = rowsFrom(["done", "missed", "missed", "missed", "missed", "missed"]);
    const decision = decideNudge(series(), rows, NOON_SP);
    expect(decision.due).toBe(true);
    expect(decision.streak).toBe(5);
    expect(decision.reason).toBe("due");
  });

  it("is not due for an ended series", () => {
    expect(decideNudge(series({ status: "ended" }), THREE_MISSES, NOON_SP)).toEqual({
      due: false,
      streak: 3,
      reason: "ended",
    });
  });

  it("is not due once the series was already nudged", () => {
    const decision = decideNudge(series({ nudgedAt: 1_760_000_000 }), THREE_MISSES, NOON_SP);
    expect(decision).toEqual({ due: false, streak: 3, reason: "already-nudged" });
  });

  it("is not due at a count of 2", () => {
    const rows = rowsFrom(["done", "missed", "missed"]);
    expect(decideNudge(series(), rows, NOON_SP)).toEqual({
      due: false,
      streak: 2,
      reason: "below-threshold",
    });
  });

  it("is not due with no rows at all", () => {
    expect(decideNudge(series(), [], NOON_SP)).toEqual({
      due: false,
      streak: 0,
      reason: "below-threshold",
    });
  });

  it("is not due for a muted series, with its own reason, and still reports the streak", () => {
    expect(decideNudge(series({ nudgeMuted: true }), THREE_MISSES, NOON_SP)).toEqual({
      due: false,
      streak: 3,
      reason: "muted",
    });
  });

  it("is not due when a completion reset the run, even after earlier long runs", () => {
    const rows = rowsFrom(["missed", "missed", "missed", "missed", "done"]);
    expect(decideNudge(series(), rows, NOON_SP)).toEqual({
      due: false,
      streak: 0,
      reason: "below-threshold",
    });
  });

  it("counts from the date-ordered rows, not insertion order", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-04", status: "missed" },
      { occurrenceDate: "2026-10-01", status: "done" },
      { occurrenceDate: "2026-10-03", status: "missed" },
      { occurrenceDate: "2026-10-02", status: "missed" },
    ];
    expect(decideNudge(series(), rows, NOON_SP).reason).toBe("due");
  });

  describe("reason precedence: ended, already-nudged, below-threshold, muted, before-window", () => {
    // 2026-10-10T06:00Z is 03:00 in Sao Paulo: before the window.
    const BEFORE_WINDOW = at("2026-10-10T06:00:00Z");
    const TWO_MISSES = rowsFrom(["done", "missed", "missed"]);

    it("ended wins over already-nudged, muted, below-threshold and before-window", () => {
      const s = series({ status: "ended", nudgedAt: 1_760_000_000, nudgeMuted: true });
      expect(decideNudge(s, TWO_MISSES, BEFORE_WINDOW).reason).toBe("ended");
    });

    it("already-nudged wins over below-threshold, muted and before-window", () => {
      const s = series({ nudgedAt: 1_760_000_000, nudgeMuted: true });
      expect(decideNudge(s, TWO_MISSES, BEFORE_WINDOW).reason).toBe("already-nudged");
    });

    it("below-threshold wins over muted and before-window", () => {
      const s = series({ nudgeMuted: true });
      expect(decideNudge(s, TWO_MISSES, BEFORE_WINDOW).reason).toBe("below-threshold");
    });

    it("muted wins over before-window: a muted run at count >= 3 is reported even before 09:00", () => {
      const s = series({ nudgeMuted: true });
      expect(decideNudge(s, THREE_MISSES, BEFORE_WINDOW)).toEqual({
        due: false,
        streak: 3,
        reason: "muted",
      });
    });
  });
});

describe("decideNudge — time-of-day gate in the series' own zone (AC-5)", () => {
  // America/Sao_Paulo is UTC-3: local 00:00 = 03:00Z, 03:00 = 06:00Z,
  // 08:55 = 11:55Z, 09:00 = 12:00Z, 15:00 = 18:00Z.
  describe("America/Sao_Paulo", () => {
    const cases: Array<[string, string, boolean]> = [
      ["00:00 (midnight, must not read as hour 24)", "2026-10-10T03:00:00Z", false],
      ["03:00", "2026-10-10T06:00:00Z", false],
      ["08:55", "2026-10-10T11:55:00Z", false],
      ["09:00", "2026-10-10T12:00:00Z", true],
      ["15:00", "2026-10-10T18:00:00Z", true],
    ];
    for (const [local, iso, due] of cases) {
      it(`${local} local is ${due ? "due" : "not due"}`, () => {
        const decision = decideNudge(series({ timeZone: SAO_PAULO }), THREE_MISSES, at(iso));
        expect(decision.due).toBe(due);
        expect(decision.reason).toBe(due ? "due" : "before-window");
        expect(decision.streak).toBe(3);
      });
    }
  });

  describe("UTC", () => {
    const cases: Array<[string, string, boolean]> = [
      ["00:00 (midnight, must not read as hour 24)", "2026-10-10T00:00:00Z", false],
      ["03:00", "2026-10-10T03:00:00Z", false],
      ["08:55", "2026-10-10T08:55:00Z", false],
      ["09:00", "2026-10-10T09:00:00Z", true],
      ["15:00", "2026-10-10T15:00:00Z", true],
    ];
    for (const [local, iso, due] of cases) {
      it(`${local} local is ${due ? "due" : "not due"}`, () => {
        const decision = decideNudge(series({ timeZone: "UTC" }), THREE_MISSES, at(iso));
        expect(decision.due).toBe(due);
        expect(decision.reason).toBe(due ? "due" : "before-window");
        expect(decision.streak).toBe(3);
      });
    }
  });

  it("a UTC series and a Sao Paulo series at the same instant are each judged on their own local hour", () => {
    // 11:00Z is 11:00 in UTC (inside the window) and 08:00 in Sao Paulo (before it).
    const now = at("2026-10-10T11:00:00Z");
    const utc = decideNudge(series({ timeZone: "UTC" }), THREE_MISSES, now);
    const saoPaulo = decideNudge(series({ timeZone: SAO_PAULO }), THREE_MISSES, now);
    expect(utc.reason).toBe("due");
    expect(saoPaulo.reason).toBe("before-window");
  });
});
