// PRPs/prds/adherence-mirror.prd.md AC-1..AC-10 — Phase 1, pure adherence
// (`src/shared/adherence.ts`).
//
// Source plan: PRPs/plans/adherence-mirror-phase-1-pure-adherence.plan.md
//
// Authored test-first (per `tdd: true`), before src/shared/adherence.ts existed.
// The contract shape (computeSeriesAdherence / rankAdherence / AdherenceRow /
// SeriesAdherence / AdherenceRankInput) is the plan's declared contract.
//
// AC-10's "imports nothing" and "recurrence.ts unchanged" halves are grep / git
// properties (plan Task 4 validation); this file loads inside the workerd vitest
// project (no `node:fs`), so only the behavioural half is asserted here: `today`
// is an argument that changes the result, and inputs are never mutated.

import { describe, expect, it } from "vitest";
import {
  computeSeriesAdherence,
  rankAdherence,
  type AdherenceRow,
  type AdherenceRankInput,
} from "../src/shared/adherence";

type Status = AdherenceRow["status"];

/** Rows on consecutive days starting 2026-10-01, in the given status order. */
function rowsFrom(statuses: Status[], start = "2026-10-01"): AdherenceRow[] {
  const [y, m, d] = start.split("-").map(Number);
  return statuses.map((status, i) => ({
    occurrenceDate: new Date(Date.UTC(y!, m! - 1, d! + i)).toISOString().slice(0, 10),
    status,
  }));
}

const TODAY = "2026-12-31";

describe("computeSeriesAdherence — counts (AC-1)", () => {
  it("counts done and closed from closed rows; the open row counts in neither", () => {
    const statuses: Status[] = [
      ...Array<Status>(7).fill("done"),
      ...Array<Status>(3).fill("missed"),
      "open",
    ];
    const result = computeSeriesAdherence(rowsFrom(statuses), TODAY);
    expect(result.done).toBe(7);
    expect(result.closed).toBe(10);
  });
});

describe("computeSeriesAdherence — current streak (AC-2..AC-6)", () => {
  it("counts trailing consecutive dones after the last miss (AC-2)", () => {
    const rows = rowsFrom(["done", "missed", "done", "done", "done"]);
    expect(computeSeriesAdherence(rows, TODAY).currentStreak).toBe(3);
  });

  it("is 0 when the latest closed row is missed (AC-3)", () => {
    const rows = rowsFrom(["done", "done", "missed"]);
    expect(computeSeriesAdherence(rows, TODAY).currentStreak).toBe(0);
  });

  it("ignores an open row after the latest closed one", () => {
    const rows = rowsFrom(["done", "done", "open"]);
    expect(computeSeriesAdherence(rows, TODAY).currentStreak).toBe(2);
  });

  it("follows occurrence date order, not the order rows are supplied (AC-4)", () => {
    // By date: 10-01 done, 10-02 done, 10-03 missed, 10-04 done  => streak 1.
    // Supplied scrambled so the last-supplied row is the missed one: an
    // insertion-order implementation would answer 0.
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-04", status: "done" },
      { occurrenceDate: "2026-10-01", status: "done" },
      { occurrenceDate: "2026-10-03", status: "missed" },
      { occurrenceDate: "2026-10-02", status: "done" },
    ];
    const result = computeSeriesAdherence(rows, TODAY);
    expect(result.currentStreak).toBe(1);
    expect(result.done).toBe(3);
    expect(result.closed).toBe(4);
  });

  it("is not affected by when a row was completed, only by its occurrence date (AC-4)", () => {
    // Rows carry no completion time in the pure contract; extra fields a caller
    // might pass along must not change the ordering.
    const rows = [
      { occurrenceDate: "2026-10-02", status: "done", completedAt: "2026-10-09T10:00:00Z" },
      { occurrenceDate: "2026-10-03", status: "done", completedAt: "2026-10-03T10:00:00Z" },
      { occurrenceDate: "2026-10-01", status: "missed", completedAt: null },
    ] as AdherenceRow[];
    expect(computeSeriesAdherence(rows, TODAY).currentStreak).toBe(2);
  });

  it("is not interrupted by a skipped cycle that left no row (AC-5)", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-01", status: "done" },
      // 2026-10-02 skipped: no row
      { occurrenceDate: "2026-10-03", status: "done" },
    ];
    const result = computeSeriesAdherence(rows, TODAY);
    expect(result.currentStreak).toBe(2);
    expect(result.closed).toBe(2);
  });

  it("counts a detached done row toward done, closed and the streak (AC-6)", () => {
    const rows = [
      { occurrenceDate: "2026-10-01", status: "done" },
      { occurrenceDate: "2026-10-02", status: "done", detached: true },
      { occurrenceDate: "2026-10-03", status: "done" },
    ] as AdherenceRow[];
    const result = computeSeriesAdherence(rows, TODAY);
    expect(result.done).toBe(3);
    expect(result.closed).toBe(3);
    expect(result.currentStreak).toBe(3);
  });
});

describe("computeSeriesAdherence — recent misses window (AC-7)", () => {
  it("lists missed dates in [today-30, today) newest first", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-09-30", status: "missed" },
      { occurrenceDate: "2026-10-01", status: "missed" },
      { occurrenceDate: "2026-10-30", status: "missed" },
    ];
    expect(computeSeriesAdherence(rows, "2026-10-31").recentMisses).toEqual([
      "2026-10-30",
      "2026-10-01",
    ]);
  });

  it("includes the day exactly 30 days before today and excludes 31 days before", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-09-30", status: "missed" }, // today - 31
      { occurrenceDate: "2026-10-01", status: "missed" }, // today - 30
    ];
    expect(computeSeriesAdherence(rows, "2026-10-31").recentMisses).toEqual(["2026-10-01"]);
  });

  it("excludes a miss dated today (the window ends yesterday)", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-30", status: "missed" },
      { occurrenceDate: "2026-10-31", status: "missed" },
    ];
    expect(computeSeriesAdherence(rows, "2026-10-31").recentMisses).toEqual(["2026-10-30"]);
  });

  it("does not list done or open rows as recent misses", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-28", status: "done" },
      { occurrenceDate: "2026-10-29", status: "open" },
      { occurrenceDate: "2026-10-30", status: "missed" },
    ];
    expect(computeSeriesAdherence(rows, "2026-10-31").recentMisses).toEqual(["2026-10-30"]);
  });

  it("still counts out-of-window misses in closed", () => {
    const rows: AdherenceRow[] = [{ occurrenceDate: "2026-01-05", status: "missed" }];
    const result = computeSeriesAdherence(rows, "2026-10-31");
    expect(result.closed).toBe(1);
    expect(result.recentMisses).toEqual([]);
  });

  it("measures the window from the supplied today, across a year boundary", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2025-12-02", status: "missed" }, // today - 30
      { occurrenceDate: "2025-12-01", status: "missed" }, // today - 31
    ];
    expect(computeSeriesAdherence(rows, "2026-01-01").recentMisses).toEqual(["2025-12-02"]);
  });

  it("uses the same rows differently under a different today (today is an argument)", () => {
    const rows: AdherenceRow[] = [{ occurrenceDate: "2026-10-10", status: "missed" }];
    expect(computeSeriesAdherence(rows, "2026-10-11").recentMisses).toEqual(["2026-10-10"]);
    expect(computeSeriesAdherence(rows, "2026-12-01").recentMisses).toEqual([]);
  });
});

describe("computeSeriesAdherence — empty history (AC-8)", () => {
  it("returns zeros and an empty list for no rows", () => {
    expect(computeSeriesAdherence([], TODAY)).toEqual({
      done: 0,
      closed: 0,
      currentStreak: 0,
      recentMisses: [],
    });
  });

  it("returns zeros and an empty list when only an open occurrence exists, with no NaN", () => {
    const result = computeSeriesAdherence(
      [{ occurrenceDate: "2026-10-30", status: "open" }],
      TODAY,
    );
    expect(result).toEqual({ done: 0, closed: 0, currentStreak: 0, recentMisses: [] });
    for (const n of [result.done, result.closed, result.currentStreak]) {
      expect(Number.isNaN(n)).toBe(false);
    }
  });
});

describe("computeSeriesAdherence — purity (AC-10, behavioural half)", () => {
  it("does not mutate the rows it is given", () => {
    const rows: AdherenceRow[] = [
      { occurrenceDate: "2026-10-03", status: "missed" },
      { occurrenceDate: "2026-10-01", status: "done" },
    ];
    const snapshot = JSON.parse(JSON.stringify(rows));
    computeSeriesAdherence(rows, TODAY);
    expect(rows).toEqual(snapshot);
  });

  it("is deterministic for the same input", () => {
    const rows = rowsFrom(["done", "missed", "done"]);
    expect(computeSeriesAdherence(rows, "2026-10-31")).toEqual(
      computeSeriesAdherence(rows, "2026-10-31"),
    );
  });
});

describe("rankAdherence (AC-9)", () => {
  const A: AdherenceRankInput = {
    seriesId: "A",
    title: "Gym",
    recentMisses: ["2026-10-20", "2026-10-10", "2026-10-05"],
  };
  const B: AdherenceRankInput = {
    seriesId: "B",
    title: "Read",
    recentMisses: ["2026-10-28", "2026-10-15", "2026-10-02"],
  };
  const C: AdherenceRankInput = { seriesId: "C", title: "Water", recentMisses: ["2026-10-25"] };
  const D: AdherenceRankInput = { seriesId: "D", title: "Floss", recentMisses: [] };

  it("orders by misses desc, then most recent miss desc, and omits zero-miss series", () => {
    expect(rankAdherence([A, B, C, D])).toEqual(["B", "A", "C"]);
  });

  it("gives the same order regardless of input order", () => {
    expect(rankAdherence([D, C, A, B])).toEqual(["B", "A", "C"]);
  });

  it("ranks more misses above a more recent single miss", () => {
    expect(rankAdherence([C, A])).toEqual(["A", "C"]);
  });

  it("breaks a full tie on misses and last miss by title ascending", () => {
    const x: AdherenceRankInput = { seriesId: "1", title: "Zebra", recentMisses: ["2026-10-20"] };
    const y: AdherenceRankInput = { seriesId: "2", title: "Apple", recentMisses: ["2026-10-20"] };
    expect(rankAdherence([x, y])).toEqual(["2", "1"]);
  });

  it("breaks a tie on title by series id ascending", () => {
    const x: AdherenceRankInput = { seriesId: "b", title: "Same", recentMisses: ["2026-10-20"] };
    const y: AdherenceRankInput = { seriesId: "a", title: "Same", recentMisses: ["2026-10-20"] };
    expect(rankAdherence([x, y])).toEqual(["a", "b"]);
  });

  it("returns an empty list when nobody has a recent miss, or for no input", () => {
    expect(rankAdherence([D])).toEqual([]);
    expect(rankAdherence([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [C, D, A, B];
    const before = input.map((e) => e.seriesId);
    rankAdherence(input);
    expect(input.map((e) => e.seriesId)).toEqual(before);
  });
});
