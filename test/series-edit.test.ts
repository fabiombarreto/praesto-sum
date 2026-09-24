// PRPs/prds/recurring-tasks.prd.md AC-26 Create and recognize a series on
// screen (decidable half: src/shared/series-edit.ts)
//
// Source plan: PRPs/plans/recurring-tasks-phase-4-the-screen.plan.md
// (Task 1 — src/shared/series-edit.ts: RecurrenceDraft, EMPTY_RECURRENCE_DRAFT,
// recurrenceDraftError, buildCreateSeriesInput, reminderWillCarryOver; plan
// AC-A1).
//
// AC-26 itself is manual/device verification (docs/context/methodology.md's
// UI split; PRD "Phase 4 — the screen (manual / device)") and the screen half
// of it — TaskSheet, TaskRow, TodayScreen — produces no test file here, since
// the only test tier is Vitest inside workerd, which has no DOM. This suite
// covers only the one decidable piece the plan carves out of AC-26: assembling
// a valid `CreateSeriesInput` from the sheet's existing Task/Reminder drafts
// plus the chosen recurrence rule — pure, DOM-free, clock-free
// (docs/context/methodology.md, "Browser-API work: split the logic out, then
// the glue is exempt").
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// `src/shared/series-edit.ts` does not exist yet, so this file is RED for the
// right reason (module-not-found on the import below) until plan Task 1 lands.
//
// byMonthday/byWeekday are never asked for on this screen — the server derives
// them from the rule's own `dtstart` (`src/shared/recurrence.ts:164-168,196-223`,
// confirmed directly, cited in the plan's "Patterns to Mirror") — so this
// module never emits them; asserted below rather than assumed.
//
// Validation messages are asserted only as "a non-null pt-BR string was
// returned" (never an exact wording): the plan pins WHEN
// `recurrenceDraftError` must fire and WHAT it mirrors
// (`src/worker/routes/series.ts:106-132`'s validation order), not its literal
// copy — pinning exact text here would invent an implementation detail the
// plan deliberately left to the Implementer.

import { describe, expect, it } from "vitest";
import type { ReminderDraft } from "../src/shared/reminder-edit";
import {
  buildCreateSeriesInput,
  EMPTY_RECURRENCE_DRAFT,
  recurrenceDraftError,
  reminderWillCarryOver,
  type RecurrenceDraft,
} from "../src/shared/series-edit";
import type { TaskDraft } from "../src/shared/task-edit";

function taskDraft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: "Pagar aluguel",
    description: "",
    dateMode: "deadline",
    date: "2026-10-05",
    priority: null,
    ...overrides,
  };
}

function recurrenceDraft(overrides: Partial<RecurrenceDraft> = {}): RecurrenceDraft {
  return {
    freq: "monthly",
    endOption: "never",
    untilDate: "",
    maxCount: "",
    ...overrides,
  };
}

function reminderDraft(overrides: Partial<ReminderDraft> = {}): ReminderDraft {
  return {
    label: "",
    timeMode: "offset",
    absoluteDay: "",
    absoluteTime: "",
    offsetMinutes: 1440,
    ...overrides,
  };
}

describe("EMPTY_RECURRENCE_DRAFT — the seed before the owner picks anything", () => {
  it("defaults freq to 'none' (matches the sheet's default 'Não repete' selection)", () => {
    expect(EMPTY_RECURRENCE_DRAFT.freq).toBe("none");
  });

  it("carries string values for untilDate and maxCount, never undefined — a form always has a value", () => {
    expect(typeof EMPTY_RECURRENCE_DRAFT.untilDate).toBe("string");
    expect(typeof EMPTY_RECURRENCE_DRAFT.maxCount).toBe("string");
  });

  it("passes recurrenceDraftError with no error: freq 'none' needs no Task date and no end condition", () => {
    expect(
      recurrenceDraftError(taskDraft({ dateMode: "none", date: "" }), EMPTY_RECURRENCE_DRAFT),
    ).toBeNull();
  });
});

describe("recurrenceDraftError — freq 'none' needs no validation at all", () => {
  it("returns null when freq is 'none', regardless of task date or a half-filled end condition", () => {
    const draft = recurrenceDraft({ freq: "none", endOption: "until", untilDate: "" });
    expect(recurrenceDraftError(taskDraft({ dateMode: "none", date: "" }), draft)).toBeNull();
  });
});

describe("recurrenceDraftError — a Task date is required once a repetition is chosen", () => {
  it("returns a non-null message when the Task carries no date at all", () => {
    const error = recurrenceDraftError(
      taskDraft({ dateMode: "none", date: "" }),
      recurrenceDraft({ freq: "monthly" }),
    );
    expect(error).not.toBeNull();
    expect(typeof error).toBe("string");
  });

  it("returns a non-null message when dateMode is set but the date string is not a valid calendar date", () => {
    const error = recurrenceDraftError(
      taskDraft({ dateMode: "deadline", date: "" }),
      recurrenceDraft({ freq: "monthly" }),
    );
    expect(error).not.toBeNull();
  });

  it("returns null once the Task carries a valid deadline and the end condition is 'never'", () => {
    expect(
      recurrenceDraftError(
        taskDraft({ dateMode: "deadline", date: "2026-10-05" }),
        recurrenceDraft({ freq: "monthly", endOption: "never" }),
      ),
    ).toBeNull();
  });

  it("returns null once the Task carries a valid scheduled date", () => {
    expect(
      recurrenceDraftError(
        taskDraft({ dateMode: "scheduled", date: "2026-10-05" }),
        recurrenceDraft({ freq: "weekly", endOption: "never" }),
      ),
    ).toBeNull();
  });
});

describe("recurrenceDraftError — endOption 'until' requires a valid calendar untilDate", () => {
  it("returns non-null when untilDate is empty", () => {
    const error = recurrenceDraftError(
      taskDraft(),
      recurrenceDraft({ endOption: "until", untilDate: "" }),
    );
    expect(error).not.toBeNull();
  });

  it("returns non-null when untilDate is not a real calendar date", () => {
    const error = recurrenceDraftError(
      taskDraft(),
      recurrenceDraft({ endOption: "until", untilDate: "2026-13-05" }),
    );
    expect(error).not.toBeNull();
  });

  it("returns null when untilDate is a valid calendar date", () => {
    expect(
      recurrenceDraftError(
        taskDraft(),
        recurrenceDraft({ endOption: "until", untilDate: "2026-12-05" }),
      ),
    ).toBeNull();
  });
});

describe("recurrenceDraftError — endOption 'count' requires maxCount to parse as an integer >= 1", () => {
  it.each([
    ["an empty string", ""],
    ["a non-numeric string", "abc"],
    ["zero", "0"],
    ["a negative number", "-1"],
    ["a decimal", "1.5"],
  ])("returns non-null for %s", (_label, maxCount) => {
    const error = recurrenceDraftError(
      taskDraft(),
      recurrenceDraft({ endOption: "count", maxCount }),
    );
    expect(error).not.toBeNull();
  });

  it("returns null when maxCount parses as a positive integer", () => {
    expect(
      recurrenceDraftError(taskDraft(), recurrenceDraft({ endOption: "count", maxCount: "3" })),
    ).toBeNull();
  });
});

describe("recurrenceDraftError — endOption 'never' needs neither untilDate nor maxCount", () => {
  it("returns null with both end-condition fields left empty", () => {
    expect(
      recurrenceDraftError(
        taskDraft(),
        recurrenceDraft({ endOption: "never", untilDate: "", maxCount: "" }),
      ),
    ).toBeNull();
  });
});

describe("buildCreateSeriesInput — maps the Task's own date field to dtstart/dateMode", () => {
  it("carries a deadline Task's date as dtstart with dateMode 'deadline'", () => {
    const input = buildCreateSeriesInput(
      taskDraft({ dateMode: "deadline", date: "2026-10-05" }),
      recurrenceDraft({ freq: "monthly" }),
      null,
      "America/Sao_Paulo",
    );
    expect(input.dtstart).toBe("2026-10-05");
    expect(input.dateMode).toBe("deadline");
  });

  it("carries a scheduled Task's date as dtstart with dateMode 'scheduled'", () => {
    const input = buildCreateSeriesInput(
      taskDraft({ dateMode: "scheduled", date: "2026-11-01" }),
      recurrenceDraft({ freq: "weekly" }),
      null,
      "America/Sao_Paulo",
    );
    expect(input.dtstart).toBe("2026-11-01");
    expect(input.dateMode).toBe("scheduled");
  });
});

describe("buildCreateSeriesInput — freq, title and priority carried verbatim", () => {
  it("carries the chosen freq", () => {
    const input = buildCreateSeriesInput(
      taskDraft(),
      recurrenceDraft({ freq: "yearly" }),
      null,
      "America/Sao_Paulo",
    );
    expect(input.freq).toBe("yearly");
  });

  it("carries the Task's title verbatim", () => {
    const input = buildCreateSeriesInput(
      taskDraft({ title: "Pagar aluguel" }),
      recurrenceDraft(),
      null,
      "America/Sao_Paulo",
    );
    expect(input.title).toBe("Pagar aluguel");
  });

  it("carries the Task's priority verbatim, including a null priority", () => {
    const withPriority = buildCreateSeriesInput(
      taskDraft({ priority: "high" }),
      recurrenceDraft(),
      null,
      "America/Sao_Paulo",
    );
    expect(withPriority.priority).toBe("high");

    const withoutPriority = buildCreateSeriesInput(
      taskDraft({ priority: null }),
      recurrenceDraft(),
      null,
      "America/Sao_Paulo",
    );
    expect(withoutPriority.priority).toBeNull();
  });
});

describe("buildCreateSeriesInput — never sends byMonthday/byWeekday (server derives them from dtstart)", () => {
  it("omits byMonthday and byWeekday entirely", () => {
    const input = buildCreateSeriesInput(
      taskDraft(),
      recurrenceDraft({ freq: "monthly" }),
      null,
      "America/Sao_Paulo",
    );
    expect(input).not.toHaveProperty("byMonthday");
    expect(input).not.toHaveProperty("byWeekday");
  });
});

describe("buildCreateSeriesInput — end condition maps to endKind plus exactly the matching field", () => {
  it("maps endOption 'never' to endKind 'never' with no untilDate/maxCount", () => {
    const input = buildCreateSeriesInput(
      taskDraft(),
      recurrenceDraft({ endOption: "never" }),
      null,
      "America/Sao_Paulo",
    );
    expect(input.endKind).toBe("never");
    expect(input.untilDate ?? null).toBeNull();
    expect(input.maxCount ?? null).toBeNull();
  });

  it("maps endOption 'until' to endKind 'until' with the untilDate string, and no maxCount", () => {
    const input = buildCreateSeriesInput(
      taskDraft(),
      recurrenceDraft({ endOption: "until", untilDate: "2026-12-05" }),
      null,
      "America/Sao_Paulo",
    );
    expect(input.endKind).toBe("until");
    expect(input.untilDate).toBe("2026-12-05");
    expect(input.maxCount ?? null).toBeNull();
  });

  it("maps endOption 'count' to endKind 'count' with maxCount parsed as an integer, and no untilDate", () => {
    const input = buildCreateSeriesInput(
      taskDraft(),
      recurrenceDraft({ endOption: "count", maxCount: "3" }),
      null,
      "America/Sao_Paulo",
    );
    expect(input.endKind).toBe("count");
    expect(input.maxCount).toBe(3);
    expect(input.untilDate ?? null).toBeNull();
  });
});

describe("buildCreateSeriesInput — reminderOffsets derives from the sheet's existing Reminder draft (silent-drop guard)", () => {
  it("carries the offset as a single-element array when the existing Reminder is offset-mode", () => {
    const input = buildCreateSeriesInput(
      taskDraft(),
      recurrenceDraft(),
      reminderDraft({ timeMode: "offset", offsetMinutes: 1440 }),
      "America/Sao_Paulo",
    );
    expect(input.reminderOffsets).toEqual([1440]);
  });

  it("is null when there is no existing Reminder at all", () => {
    const input = buildCreateSeriesInput(taskDraft(), recurrenceDraft(), null, "America/Sao_Paulo");
    expect(input.reminderOffsets ?? null).toBeNull();
  });

  it("is null when the existing Reminder is absolute-time — it has no offset to repeat, and is never silently carried over", () => {
    const input = buildCreateSeriesInput(
      taskDraft(),
      recurrenceDraft(),
      reminderDraft({ timeMode: "absolute" }),
      "America/Sao_Paulo",
    );
    expect(input.reminderOffsets ?? null).toBeNull();
  });
});

describe("reminderWillCarryOver — whether the screen must show the drop notice", () => {
  it("is false when there is no existing Reminder", () => {
    expect(reminderWillCarryOver(null)).toBe(false);
  });

  it("is true when the existing Reminder is offset-mode (it carries over into the series template)", () => {
    expect(reminderWillCarryOver(reminderDraft({ timeMode: "offset" }))).toBe(true);
  });

  it("is false when the existing Reminder is absolute-time — the exact silent-drop case this flag exists to surface", () => {
    expect(reminderWillCarryOver(reminderDraft({ timeMode: "absolute" }))).toBe(false);
  });
});

describe("buildCreateSeriesInput — timezone is carried through to the wire body", () => {
  it("carries the timezone argument verbatim", () => {
    const input = buildCreateSeriesInput(taskDraft(), recurrenceDraft(), null, "America/New_York");
    expect(input.timezone).toBe("America/New_York");
  });
});
