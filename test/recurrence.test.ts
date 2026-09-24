// PRPs/prds/recurring-tasks.prd.md AC-1..AC-10 — Phase 1, the pure expansion
// function (`src/shared/recurrence.ts`).
//
// Source plan: PRPs/plans/recurring-tasks-phase-1-pure-expansion.plan.md
// (Tasks 1-4 — src/shared/recurrence.ts: RecurrenceRule + firstOccurrence /
// nextOccurrence / expandOccurrences / occurrenceReminderInstants).
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/recurrence.ts does not exist yet, so this file is expected to be
// RED for the right reason (the module itself is missing) until the plan's
// four tasks are implemented.
//
// AC-1's "imports nothing from src/worker/ or src/app/" half is a compile-time
// property (the per-target tsconfig project references make a violation a
// compile error) and is exercised by the plan's own Level 1 (`tsc -b`) and
// Level 3 (`grep -nE '\.\./(worker|app)'`) validation commands. It is
// deliberately NOT re-asserted here: this file loads inside the `worker`
// vitest project, which runs in workerd via @cloudflare/vitest-pool-workers
// and has no `node:fs` (see this repo's vitest.config.ts, which routes the
// only two file-reading suites into a separate `docs`/plain-Node project for
// exactly that reason). Only AC-1's clock-free behavioural half is asserted
// below.
//
// Every fixture below is taken verbatim from the PRD's / plan's own worked
// examples (AC-2..AC-10 / AC-A2..AC-A10) — no input or expected output here is
// invented.

import { describe, expect, it, vi } from "vitest";
import {
  expandOccurrences,
  firstOccurrence,
  nextOccurrence,
  occurrenceReminderInstants,
  type RecurrenceRule,
} from "../src/shared/recurrence";
import { offsetToInstant, PRAESTO_TIMEZONE } from "../src/shared/dates";

/**
 * A calendar-anchored, never-ending daily rule with every field explicit, so
 * each `it()` below only overrides the fields its own AC actually varies —
 * never leaving a reader to guess a default's value.
 */
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

describe("AC-1 Clock-free", () => {
  it("returns identical nextOccurrence/expandOccurrences results across two calls a year apart on the system clock", () => {
    const rule = baseRule({ freq: "monthly", byMonthday: 5, dtstart: "2026-08-05" });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const nextBefore = nextOccurrence(rule, { after: "2026-08-05" });
      const expandBefore = expandOccurrences(rule, { from: "2026-08-05", to: "2026-11-05" });

      vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
      const nextAfter = nextOccurrence(rule, { after: "2026-08-05" });
      const expandAfter = expandOccurrences(rule, { from: "2026-08-05", to: "2026-11-05" });

      expect(nextAfter).toBe(nextBefore);
      expect(expandAfter).toEqual(expandBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("AC-2 Monthly by month day", () => {
  const rule = baseRule({ freq: "monthly", interval: 1, byMonthday: 5, dtstart: "2026-08-05" });

  it("firstOccurrence returns the dtstart itself", () => {
    expect(firstOccurrence(rule)).toBe("2026-08-05");
  });

  it("nextOccurrence after the dtstart returns next month's 5th", () => {
    expect(nextOccurrence(rule, { after: "2026-08-05" })).toBe("2026-09-05");
  });
});

describe("AC-3 Month-day overflow clamps backward (D1)", () => {
  const rule = baseRule({ freq: "monthly", byMonthday: 31, dtstart: "2026-01-31" });

  it("clamps Jan-Apr 2026 without drifting the track (March is the 31st, never the 28th)", () => {
    const occurrences = expandOccurrences(rule, { from: "2026-01-31", to: "2026-04-30" });
    expect(occurrences).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("clamps to Feb 29 in the 2028 leap year, re-derived from the same rule", () => {
    const occurrences = expandOccurrences(rule, { from: "2028-01-31", to: "2028-02-29" });
    expect(occurrences).toEqual(["2028-01-31", "2028-02-29"]);
  });
});

describe("AC-4 Weekly with weekdays and interval", () => {
  it("expands Mon/Thu every 2 weeks starting on a Monday", () => {
    const rule = baseRule({
      freq: "weekly",
      interval: 2,
      byWeekday: [1, 4],
      dtstart: "2026-09-21",
    });
    const occurrences = expandOccurrences(rule, { from: "2026-09-21", to: "2026-10-09" });
    expect(occurrences).toEqual(["2026-09-21", "2026-09-24", "2026-10-05", "2026-10-08"]);
  });
});

describe("AC-5 Daily and yearly", () => {
  it("daily interval 3: the occurrence after dtstart is 3 days later", () => {
    const rule = baseRule({ freq: "daily", interval: 3, dtstart: "2026-09-01" });
    expect(nextOccurrence(rule, { after: "2026-09-01" })).toBe("2026-09-04");
  });

  it("yearly on Feb 29 follows the PRD's own worked sequence through leap and non-leap years", () => {
    const rule = baseRule({ freq: "yearly", dtstart: "2028-02-29" });
    expect(firstOccurrence(rule)).toBe("2028-02-29");

    const second = nextOccurrence(rule, { after: "2028-02-29" });
    expect(second).toBe("2029-02-28");
    if (second === null) throw new Error("expected a date, got null");

    const third = nextOccurrence(rule, { after: second });
    expect(third).toBe("2030-02-28");
    if (third === null) throw new Error("expected a date, got null");

    const fourth = nextOccurrence(rule, { after: third });
    expect(fourth).toBe("2031-02-28");
    if (fourth === null) throw new Error("expected a date, got null");

    // Back to the 29th: the track is re-derived from the rule each year, so a leap
    // year restores the real month day instead of inheriting the clamped one.
    const fifth = nextOccurrence(rule, { after: fourth });
    expect(fifth).toBe("2032-02-29");
  });
});

describe("AC-6 Calendar anchor keeps the track", () => {
  it("returns the next track date even when completedOn is later than it, appearing overdue rather than hidden", () => {
    const rule = baseRule({
      freq: "monthly",
      byMonthday: 5,
      dtstart: "2026-08-05",
      anchorMode: "calendar",
    });
    const result = nextOccurrence(rule, { after: "2026-08-05", completedOn: "2026-09-20" });
    expect(result).toBe("2026-09-05");
  });
});

describe("AC-7 Completion anchor counts from the completion day (D5)", () => {
  const rule = baseRule({
    freq: "daily",
    interval: 3,
    anchorMode: "completion",
    dtstart: "2026-09-05",
  });

  it("computes the next date from completedOn, not from after", () => {
    const result = nextOccurrence(rule, { after: "2026-09-05", completedOn: "2026-09-10" });
    expect(result).toBe("2026-09-13");
  });

  it("throws TypeError rather than silently reading the clock when completedOn is missing", () => {
    expect(() => nextOccurrence(rule, { after: "2026-09-05" })).toThrow(TypeError);
  });
});

describe("AC-8 End conditions (D6)", () => {
  it("endKind 'until' returns null once the next track date is after untilDate", () => {
    const rule = baseRule({
      freq: "monthly",
      byMonthday: 5,
      dtstart: "2026-08-05",
      endKind: "until",
      untilDate: "2026-12-05",
    });
    expect(nextOccurrence(rule, { after: "2026-12-05" })).toBeNull();
  });

  it("endKind 'count' returns null once closedCount reaches maxCount, and a date when it has not", () => {
    const rule = baseRule({
      freq: "monthly",
      byMonthday: 5,
      dtstart: "2026-08-05",
      endKind: "count",
      maxCount: 3,
    });
    expect(nextOccurrence(rule, { after: "2026-08-05", closedCount: 3 })).toBeNull();
    expect(nextOccurrence(rule, { after: "2026-08-05", closedCount: 2 })).not.toBeNull();
  });
});

describe("AC-9 Bounded window expansion for unit 17", () => {
  it("returns every occurrence date in [from, to] ascending", () => {
    const rule = baseRule({ freq: "daily", interval: 1, dtstart: "2026-09-01" });
    const occurrences = expandOccurrences(rule, { from: "2026-09-01", to: "2026-09-05" });
    expect(occurrences).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
  });

  it("refuses a window longer than 366 days as a runaway-loop guard", () => {
    const rule = baseRule({ freq: "daily", interval: 1, dtstart: "2026-01-01" });
    expect(() => expandOccurrences(rule, { from: "2026-01-01", to: "2027-01-03" })).toThrow(
      RangeError,
    );
  });
});

describe("AC-10 Reminder instants for an occurrence", () => {
  it("returns exactly offsetToInstant per offset, composing rather than reimplementing the DST-aware conversion", () => {
    const day = "2026-09-20";
    const offsets = [1440, 60];
    const result = occurrenceReminderInstants(day, offsets, PRAESTO_TIMEZONE);
    expect(result).toEqual([
      offsetToInstant(day, 1440, PRAESTO_TIMEZONE),
      offsetToInstant(day, 60, PRAESTO_TIMEZONE),
    ]);
  });

  it("matches offsetToInstant's own DST handling for America/New_York on a transition day", () => {
    const day = "2026-03-08";
    const offsets = [1440, 60];
    const tz = "America/New_York";
    const result = occurrenceReminderInstants(day, offsets, tz);
    expect(result).toEqual([offsetToInstant(day, 1440, tz), offsetToInstant(day, 60, tz)]);
  });
});
