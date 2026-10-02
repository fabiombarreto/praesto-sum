// PRPs/prds/missed-sweep.prd.md AC-1..AC-9 — Phase 1, the pure plan
// (`src/shared/missed-sweep.ts`).
//
// Source plan: PRPs/plans/missed-sweep-phase-1-pure-plan.plan.md
//
// This suite was authored test-first (per `tdd: true`), before
// src/shared/missed-sweep.ts existed, and is the contract that module must
// satisfy. Whether it is currently red or green depends on the implementation's
// progress; run `npx vitest run test/missed-sweep.test.ts` for the live state.
//
// AC-1's "imports nothing from src/worker/ or src/app/" half is a compile-time
// / grep property (plan Task 4 and Level 2 validation). It is deliberately NOT
// re-asserted here: this file loads inside the `worker` vitest project (workerd,
// no `node:fs`). Only AC-1's clock-free behavioural half is asserted below.
//
// Every fixture is taken from the PRD's worked examples (AC-2..AC-9). The
// contract shape (planMissedSweep / MissedSweepInput / MissedSweepPlan) is the
// plan's proposed contract.

import { describe, expect, it, vi } from "vitest";
import { planMissedSweep, type MissedSweepInput } from "../src/shared/missed-sweep";
import { PRAESTO_TIMEZONE } from "../src/shared/dates";
import type { RecurrenceRule } from "../src/shared/recurrence";

function baseRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    freq: "daily",
    interval: 1,
    byWeekday: null,
    byMonthday: null,
    dtstart: "2026-08-05",
    timezone: PRAESTO_TIMEZONE,
    anchorMode: "calendar",
    endKind: "never",
    untilDate: null,
    maxCount: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<MissedSweepInput> = {}): MissedSweepInput {
  return {
    rule: baseRule(),
    status: "active",
    doneCount: 0,
    missedCount: 0,
    openOccurrenceDate: null,
    lastClosedOccurrenceDate: null,
    today: "2026-10-01",
    ...overrides,
  };
}

/** Calendar-day arithmetic on `YYYY-MM-DD` strings, from explicit instants only. */
function addDays(day: string, n: number): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const NO_OP = {
  closeOpenAsMissed: false,
  extraMissedDates: [],
  successor: null,
  endSeries: false,
  missedCountDelta: 0,
};

describe("AC-1 Pure and clock-free", () => {
  it("returns identical plans across two calls a year apart on the system clock", () => {
    const input = baseInput({ openOccurrenceDate: "2026-10-01", today: "2026-10-04" });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const before = planMissedSweep(input);
      vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
      const after = planMissedSweep(input);
      expect(after).toEqual(before);
      expect(before.closeOpenAsMissed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("AC-2 Not yet superseded is a no-op", () => {
  it("changes nothing for a daily open occurrence on its own day", () => {
    const plan = planMissedSweep(
      baseInput({ openOccurrenceDate: "2026-10-01", today: "2026-10-01" }),
    );
    expect(plan).toEqual(NO_OP);
  });

  const monthly = baseRule({ freq: "monthly", byMonthday: 5, dtstart: "2026-08-05" });

  it("changes nothing for a monthly-on-the-5th occurrence the day before the next one", () => {
    const plan = planMissedSweep(
      baseInput({ rule: monthly, openOccurrenceDate: "2026-10-05", today: "2026-11-04" }),
    );
    expect(plan).toEqual(NO_OP);
  });

  it("marks the occurrence missed with the successor on the next date when it arrives", () => {
    const plan = planMissedSweep(
      baseInput({ rule: monthly, openOccurrenceDate: "2026-10-05", today: "2026-11-05" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual([]);
    expect(plan.successor).toEqual({ date: "2026-11-05", armReminders: true });
    expect(plan.endSeries).toBe(false);
    expect(plan.missedCountDelta).toBe(1);
  });
});

describe("AC-3 Catch-up leaves one row per whole cycle", () => {
  it("closes the open occurrence, adds the skipped cycles and names today's successor", () => {
    const plan = planMissedSweep(
      baseInput({ openOccurrenceDate: "2026-10-01", today: "2026-10-04" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual(["2026-10-02", "2026-10-03"]);
    expect(plan.successor).toEqual({ date: "2026-10-04", armReminders: true });
    expect(plan.endSeries).toBe(false);
    expect(plan.missedCountDelta).toBe(3);
  });
});

// PRPs/prds/missed-sweep.prd.md D-A / AC-3 — a cycle is missed only once `today`
// reaches the NEXT occurrence's date, so the cycle still running at `today` is the
// open successor, not a missed row (owner-confirmed correction, 2026-10-02).
describe("D-A / AC-3 Catch-up never marks the still-running cycle as missed", () => {
  it("leaves the current monthly cycle open when the gap spans whole months", () => {
    const rule = baseRule({ freq: "monthly", byMonthday: 5, dtstart: "2026-08-05" });
    const plan = planMissedSweep(
      baseInput({ rule, openOccurrenceDate: "2026-10-05", today: "2026-12-10" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual(["2026-11-05"]);
    // 12-05 runs until 2027-01-05: late completion stays possible. It is dated
    // before today, so it is an open occurrence without Reminders (D-B, AC-4).
    expect(plan.successor).toEqual({ date: "2026-12-05", armReminders: false });
    expect(plan.endSeries).toBe(false);
    expect(plan.missedCountDelta).toBe(2);
  });

  it("leaves the current week's occurrence open after a multi-week gap", () => {
    // Mondays; 2026-10-14 is a Wednesday, so the 10-12 occurrence is still running.
    const rule = baseRule({ freq: "weekly", dtstart: "2026-09-07" });
    const plan = planMissedSweep(
      baseInput({ rule, openOccurrenceDate: "2026-09-21", today: "2026-10-14" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual(["2026-09-28", "2026-10-05"]);
    expect(plan.successor).toEqual({ date: "2026-10-12", armReminders: false });
    expect(plan.endSeries).toBe(false);
    expect(plan.missedCountDelta).toBe(3);
  });

  it("keeps a series open on its last allowed occurrence while that cycle is still running", () => {
    // D-D: the last occurrence turns missed on the date the rule would have
    // produced next (10-19); on 10-14 it is still running, so the series lives.
    const rule = baseRule({
      freq: "weekly",
      dtstart: "2026-09-07",
      endKind: "until",
      untilDate: "2026-10-13",
    });
    const plan = planMissedSweep(
      baseInput({ rule, openOccurrenceDate: "2026-09-21", today: "2026-10-14" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual(["2026-09-28", "2026-10-05"]);
    expect(plan.successor).toEqual({ date: "2026-10-12", armReminders: false });
    expect(plan.endSeries).toBe(false);
    expect(plan.missedCountDelta).toBe(3);
  });
});

describe("AC-4 Catch-up is bounded", () => {
  const today = "2026-10-04";
  const open = addDays(today, -400);
  // The series starts at its open occurrence: an occurrence never precedes its own dtstart.
  const rule = baseRule({ dtstart: open });

  it("covers at most 366 missed cycles and names an unswept successor without Reminders", () => {
    const plan = planMissedSweep(baseInput({ rule, openOccurrenceDate: open, today }));
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.missedCountDelta).toBeLessThanOrEqual(366);
    expect(plan.missedCountDelta).toBe(1 + plan.extraMissedDates.length);
    // The successor is the day right after the last missed cycle, still before today.
    expect(plan.successor).toEqual({
      date: addDays(open, plan.missedCountDelta),
      armReminders: false,
    });
    expect(plan.successor!.date < today).toBe(true);
    expect(plan.endSeries).toBe(false);
  });

  it("reaches today's occurrence when repeated, losing no cycle and looping a bounded number of times", () => {
    const missed: string[] = [];
    let openDate: string | null = open;
    let missedCount = 0;
    let finalPlan = null as ReturnType<typeof planMissedSweep> | null;

    for (let run = 0; run < 10 && openDate !== null; run++) {
      const plan = planMissedSweep(
        baseInput({ rule, openOccurrenceDate: openDate, missedCount, today }),
      );
      finalPlan = plan;
      if (plan.closeOpenAsMissed) missed.push(openDate);
      missed.push(...plan.extraMissedDates);
      missedCount += plan.missedCountDelta;
      openDate = plan.successor === null ? null : plan.successor.date;
      if (openDate === today) break;
    }

    expect(openDate).toBe(today);
    expect(finalPlan!.successor).toEqual({ date: today, armReminders: true });
    const expected: string[] = [];
    for (let i = 0; i < 400; i++) expected.push(addDays(open, i));
    expect(missed).toEqual(expected);
    expect(missedCount).toBe(400);
  });
});

describe("AC-5 Completion anchor", () => {
  const rule = baseRule({ interval: 3, anchorMode: "completion" });

  it("changes nothing before the completion-anchored date arrives", () => {
    const plan = planMissedSweep(
      baseInput({ rule, openOccurrenceDate: "2026-10-01", today: "2026-10-03" }),
    );
    expect(plan).toEqual(NO_OP);
  });

  it("marks the occurrence missed with the successor three days after it", () => {
    const plan = planMissedSweep(
      baseInput({ rule, openOccurrenceDate: "2026-10-01", today: "2026-10-04" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual([]);
    expect(plan.successor).toEqual({ date: "2026-10-04", armReminders: true });
    expect(plan.missedCountDelta).toBe(1);
  });
});

describe("AC-6 A count series ends on its last miss", () => {
  it("marks the last allowed occurrence missed, plans no successor and ends the series", () => {
    const rule = baseRule({
      freq: "monthly",
      byMonthday: 5,
      dtstart: "2026-08-05",
      endKind: "count",
      maxCount: 3,
    });
    const plan = planMissedSweep(
      baseInput({
        rule,
        doneCount: 1,
        missedCount: 1,
        openOccurrenceDate: "2026-10-05",
        today: "2026-11-05",
      }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual([]);
    expect(plan.successor).toBeNull();
    expect(plan.endSeries).toBe(true);
    expect(plan.missedCountDelta).toBe(1);
  });
});

describe("AC-7 An until series stops at its limit", () => {
  it("records the cycles up to the limit, plans nothing after it and ends the series", () => {
    const rule = baseRule({ endKind: "until", untilDate: "2026-10-03" });
    const plan = planMissedSweep(
      baseInput({ rule, openOccurrenceDate: "2026-10-01", today: "2026-10-10" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual(["2026-10-02", "2026-10-03"]);
    expect(plan.successor).toBeNull();
    expect(plan.endSeries).toBe(true);
    expect(plan.missedCountDelta).toBe(3);
  });
});

describe("AC-8 A series the owner ended", () => {
  it("closes only the open occurrence, with no intermediate rows and no successor", () => {
    const rule = baseRule({ freq: "monthly", byMonthday: 5, dtstart: "2026-08-05" });
    const plan = planMissedSweep(
      baseInput({ rule, status: "ended", openOccurrenceDate: "2026-10-05", today: "2026-11-05" }),
    );
    expect(plan.closeOpenAsMissed).toBe(true);
    expect(plan.extraMissedDates).toEqual([]);
    expect(plan.successor).toBeNull();
    expect(plan.missedCountDelta).toBe(1);
  });
});

describe("AC-9 Repair starts fresh", () => {
  it("plans exactly one open occurrence on today and no missed rows", () => {
    const plan = planMissedSweep(
      baseInput({ lastClosedOccurrenceDate: "2026-09-01", today: "2026-10-04" }),
    );
    expect(plan.closeOpenAsMissed).toBe(false);
    expect(plan.extraMissedDates).toEqual([]);
    expect(plan.successor).toEqual({ date: "2026-10-04", armReminders: true });
    expect(plan.endSeries).toBe(false);
    expect(plan.missedCountDelta).toBe(0);
  });

  it("plans no occurrence and ends the series when an until limit is in the past", () => {
    const rule = baseRule({ endKind: "until", untilDate: "2026-09-30" });
    const plan = planMissedSweep(
      baseInput({ rule, lastClosedOccurrenceDate: "2026-09-01", today: "2026-10-04" }),
    );
    expect(plan.closeOpenAsMissed).toBe(false);
    expect(plan.extraMissedDates).toEqual([]);
    expect(plan.successor).toBeNull();
    expect(plan.endSeries).toBe(true);
    expect(plan.missedCountDelta).toBe(0);
  });

  it("plans no occurrence and ends the series when its count is already reached", () => {
    const rule = baseRule({ endKind: "count", maxCount: 3 });
    const plan = planMissedSweep(
      baseInput({
        rule,
        doneCount: 2,
        missedCount: 1,
        lastClosedOccurrenceDate: "2026-09-01",
        today: "2026-10-04",
      }),
    );
    expect(plan.closeOpenAsMissed).toBe(false);
    expect(plan.extraMissedDates).toEqual([]);
    expect(plan.successor).toBeNull();
    expect(plan.endSeries).toBe(true);
    expect(plan.missedCountDelta).toBe(0);
  });
});
