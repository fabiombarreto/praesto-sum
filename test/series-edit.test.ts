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
import type { SeriesDto, TaskDto } from "../src/shared/api";
import type { ReminderDraft } from "../src/shared/reminder-edit";
import {
  buildCreateSeriesInput,
  buildUpdateSeriesRule,
  buildUpdateSeriesTemplate,
  dateModeChoices,
  EMPTY_RECURRENCE_DRAFT,
  planSeriesOccurrenceSave,
  recurrenceDraftError,
  reminderWillCarryOver,
  seriesRuleDraftError,
  seriesRuleDraftFromSeries,
  type RecurrenceDraft,
  type SeriesRuleDraft,
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

describe("recurrenceDraftError — a date is required unless the Task is dateless", () => {
  // Owner decision 2026-10-08 (ADR-0014): a dateless Task repeats too.
  it("returns null when the Task carries no date at all (dateMode 'none')", () => {
    expect(
      recurrenceDraftError(
        taskDraft({ dateMode: "none", date: "" }),
        recurrenceDraft({ freq: "monthly" }),
      ),
    ).toBeNull();
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

describe("buildCreateSeriesInput — a dateless Task starts the series today", () => {
  it("sends dateMode 'none' and today (in the series' zone) as dtstart", () => {
    const input = buildCreateSeriesInput(
      taskDraft({ dateMode: "none", date: "" }),
      recurrenceDraft({ freq: "daily" }),
      null,
      "America/Sao_Paulo",
      new Date("2026-10-08T01:30:00Z"), // still 2026-10-07 in Sao Paulo
    );
    expect(input.dateMode).toBe("none");
    expect(input.dtstart).toBe("2026-10-07");
    expect(input.endKind).toBe("never");
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

// ---------------------------------------------------------------------------
// Editing an EXISTING series from an occurrence's sheet (added 2026-09-30).
//
// PRD D11 was amended on 2026-09-29: the rule became editable, applying from the
// next spawn — the open occurrence keeps its date. The creation screen never asked
// for a day of the month or a weekday, because the server derived them from
// `dtstart`; but `dtstart` is now frozen, so without explicit day controls the
// owner could not make the very edit that motivated the amendment ("dia 5 → dia
// 10"). These functions carry that decision, pure and test-first.
// ---------------------------------------------------------------------------

function seriesDto(overrides: Partial<SeriesDto> = {}): SeriesDto {
  return {
    id: "s1",
    kind: "task",
    freq: "monthly",
    interval: 1,
    byWeekday: null,
    byMonthday: null,
    dtstart: "2026-10-05", // a Monday
    timezone: "America/Sao_Paulo",
    anchorMode: "calendar",
    endKind: "never",
    untilDate: null,
    maxCount: null,
    doneCount: 0,
    missedCount: 0,
    status: "active",
    title: "Pagar aluguel",
    description: null,
    priority: null,
    lifeAreaId: null,
    dateMode: "deadline",
    reminderOffsets: null,
    createdAt: 0,
    updatedAt: 0,
    openOccurrenceId: "t1",
    ...overrides,
  };
}

describe("seriesRuleDraftFromSeries — prefills the edit controls from the stored rule", () => {
  it("derives the day of the month from dtstart when byMonthday was never set", () => {
    // Series created by the screen never carried byMonthday: the day lived in dtstart.
    expect(seriesRuleDraftFromSeries(seriesDto()).dayOfMonth).toBe("5");
  });

  it("uses an explicit byMonthday once one exists", () => {
    expect(seriesRuleDraftFromSeries(seriesDto({ byMonthday: 10 })).dayOfMonth).toBe("10");
  });

  it("derives the weekday from dtstart when byWeekday was never set", () => {
    const draft = seriesRuleDraftFromSeries(seriesDto({ freq: "weekly" }));
    expect(draft.weekdays).toEqual([1]); // 2026-10-05 is a Monday
  });

  it("decodes byWeekday from its JSON-text wire form", () => {
    const draft = seriesRuleDraftFromSeries(seriesDto({ freq: "weekly", byWeekday: "[1,4]" }));
    expect(draft.weekdays).toEqual([1, 4]);
  });

  it("carries the end condition into the end controls", () => {
    expect(
      seriesRuleDraftFromSeries(seriesDto({ endKind: "until", untilDate: "2027-01-05" })),
    ).toMatchObject({ endOption: "until", untilDate: "2027-01-05" });
    expect(seriesRuleDraftFromSeries(seriesDto({ endKind: "count", maxCount: 3 }))).toMatchObject({
      endOption: "count",
      maxCount: "3",
    });
  });
});

describe("seriesRuleDraftError — refuses what the route would 400 on", () => {
  const valid = (overrides: Partial<SeriesRuleDraft> = {}): SeriesRuleDraft => ({
    ...seriesRuleDraftFromSeries(seriesDto()),
    ...overrides,
  });

  it("accepts an unchanged, valid rule", () => {
    expect(seriesRuleDraftError(valid())).toBeNull();
  });

  it("refuses a day of the month outside 1..31", () => {
    expect(seriesRuleDraftError(valid({ dayOfMonth: "32" }))).not.toBeNull();
    expect(seriesRuleDraftError(valid({ dayOfMonth: "0" }))).not.toBeNull();
    expect(seriesRuleDraftError(valid({ dayOfMonth: "" }))).not.toBeNull();
  });

  it("refuses a weekly rule with no weekday chosen", () => {
    expect(seriesRuleDraftError(valid({ freq: "weekly", weekdays: [] }))).not.toBeNull();
  });

  it("refuses an end condition missing its value", () => {
    expect(seriesRuleDraftError(valid({ endOption: "until", untilDate: "" }))).not.toBeNull();
    expect(seriesRuleDraftError(valid({ endOption: "count", maxCount: "0" }))).not.toBeNull();
  });
});

describe("buildUpdateSeriesRule — sends only what changed, and never dtstart", () => {
  it("returns null when nothing about the rule changed", () => {
    const series = seriesDto();
    expect(buildUpdateSeriesRule(series, seriesRuleDraftFromSeries(series))).toBeNull();
  });

  it("moves the day of the cycle — the edit that motivated the D11 amendment", () => {
    const series = seriesDto();
    const draft = { ...seriesRuleDraftFromSeries(series), dayOfMonth: "10" };
    expect(buildUpdateSeriesRule(series, draft)).toEqual({ byMonthday: 10 });
  });

  it("switching to weekly sends the weekdays and clears the stale month day", () => {
    const series = seriesDto({ byMonthday: 5 });
    const draft = { ...seriesRuleDraftFromSeries(series), freq: "weekly" as const, weekdays: [4] };
    expect(buildUpdateSeriesRule(series, draft)).toEqual({
      freq: "weekly",
      byWeekday: [4],
      byMonthday: null,
    });
  });

  it("switching the end condition sends it as a coherent unit", () => {
    const series = seriesDto();
    const draft = {
      ...seriesRuleDraftFromSeries(series),
      endOption: "count" as const,
      maxCount: "3",
    };
    expect(buildUpdateSeriesRule(series, draft)).toEqual({ endKind: "count", maxCount: 3 });
  });

  it("never emits dtstart, whatever the draft holds", () => {
    const series = seriesDto();
    const draft = {
      ...seriesRuleDraftFromSeries(series),
      dayOfMonth: "20",
      freq: "yearly" as const,
    };
    const body = buildUpdateSeriesRule(series, draft);
    expect(body).not.toBeNull();
    expect(Object.keys(body as object)).not.toContain("dtstart");
  });
});

describe("buildUpdateSeriesTemplate — the 'toda a série' half of a template edit", () => {
  const task = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
    title: "Pagar aluguel",
    description: "",
    dateMode: "deadline",
    date: "2026-10-05",
    priority: null,
    ...overrides,
  });

  it("returns null when the template fields match the series", () => {
    expect(buildUpdateSeriesTemplate(task(), seriesDto())).toBeNull();
  });

  it("sends the changed template fields only", () => {
    expect(buildUpdateSeriesTemplate(task({ title: "Pagar o aluguel" }), seriesDto())).toEqual({
      title: "Pagar o aluguel",
    });
    expect(buildUpdateSeriesTemplate(task({ priority: "high" }), seriesDto())).toEqual({
      priority: "high",
    });
  });

  it("treats an emptied description as null, never as an empty string", () => {
    const series = seriesDto({ description: "no banco" });
    expect(buildUpdateSeriesTemplate(task({ description: "  " }), series)).toEqual({
      description: null,
    });
  });

  it("ignores the date — a template edit never moves the open occurrence", () => {
    expect(buildUpdateSeriesTemplate(task({ date: "2026-10-10" }), seriesDto())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Where each change goes when a SERIES OCCURRENCE is saved (added 2026-09-30).
//
// One save can touch three things: the series' rule, the series' template, and
// this occurrence. Getting the split wrong either detaches the occurrence silently
// (the defect the owner found) or moves a date the owner planned around (what
// D11 option (a) forbids). The decision is pure, so it is pinned here.
// ---------------------------------------------------------------------------

describe("planSeriesOccurrenceSave — splits one save between the series and the occurrence", () => {
  const occurrence = (overrides: Partial<TaskDto> = {}): TaskDto => ({
    id: "t1",
    title: "Pagar aluguel",
    description: null,
    status: "open",
    deadline: "2026-10-05",
    scheduledDate: null,
    priority: null,
    lifeAreaId: null,
    seriesId: "s1",
    occurrenceDate: "2026-10-05",
    detached: false,
    completedAt: null,
    createdAt: 0,
    ...overrides,
  });
  const draftOf = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
    title: "Pagar aluguel",
    description: "",
    dateMode: "deadline",
    date: "2026-10-05",
    priority: null,
    ...overrides,
  });

  it("toda a série: a template edit goes to the series and does NOT detach the occurrence", () => {
    const plan = planSeriesOccurrenceSave(
      occurrence(),
      draftOf({ title: "Pagar o aluguel" }),
      seriesDto(),
      null,
      "series",
    );
    expect(plan.seriesBody).toEqual({ title: "Pagar o aluguel" });
    // Nothing is sent to the occurrence, so it is never detached; it receives the
    // new title through the route's own template propagation instead.
    expect(plan.taskChanges).toEqual({});
  });

  it("só esta: the same edit goes to the occurrence alone, which detaches it", () => {
    const plan = planSeriesOccurrenceSave(
      occurrence(),
      draftOf({ title: "Pagar o aluguel" }),
      seriesDto(),
      null,
      "occurrence",
    );
    expect(plan.seriesBody).toBeNull();
    expect(plan.taskChanges).toEqual({ title: "Pagar o aluguel" });
  });

  it("an already-detached occurrence takes the template edit itself too, or it would not change", () => {
    const plan = planSeriesOccurrenceSave(
      occurrence({ detached: true }),
      draftOf({ title: "Pagar o aluguel" }),
      seriesDto(),
      null,
      "series",
    );
    expect(plan.seriesBody).toEqual({ title: "Pagar o aluguel" });
    expect(plan.taskChanges).toEqual({ title: "Pagar o aluguel" });
  });

  it("a date change is always an edit to THIS occurrence, whatever applyTo says", () => {
    const plan = planSeriesOccurrenceSave(
      occurrence(),
      draftOf({ date: "2026-10-08" }),
      seriesDto(),
      null,
      "series",
    );
    expect(plan.seriesBody).toBeNull();
    expect(plan.taskChanges).toEqual({ deadline: "2026-10-08" });
  });

  it("a rule edit goes to the series and leaves the open occurrence's date alone (D11 (a))", () => {
    const series = seriesDto();
    const ruleDraft = { ...seriesRuleDraftFromSeries(series), dayOfMonth: "10" };
    const plan = planSeriesOccurrenceSave(occurrence(), draftOf(), series, ruleDraft, "series");
    expect(plan.seriesBody).toEqual({ byMonthday: 10 });
    expect(plan.taskChanges).toEqual({});
  });

  it("a rule edit and a template edit travel in one series body", () => {
    const series = seriesDto();
    const ruleDraft = { ...seriesRuleDraftFromSeries(series), dayOfMonth: "10" };
    const plan = planSeriesOccurrenceSave(
      occurrence(),
      draftOf({ priority: "high" }),
      series,
      ruleDraft,
      "series",
    );
    expect(plan.seriesBody).toEqual({ byMonthday: 10, priority: "high" });
    expect(plan.taskChanges).toEqual({});
  });

  it("nothing changed means nothing is sent anywhere", () => {
    const series = seriesDto();
    const plan = planSeriesOccurrenceSave(
      occurrence(),
      draftOf(),
      series,
      seriesRuleDraftFromSeries(series),
      "series",
    );
    expect(plan.seriesBody).toBeNull();
    expect(plan.taskChanges).toEqual({});
  });
});

// Owner decision 2026-10-08 (ADR-0014), reversing the 2026-09-30 one: "Sem data"
// stays on offer whatever the repetition, because a dateless Task repeats too.
// Withdrawing it left a draft on `none` with nothing selected and a Save that
// silently did nothing.
describe("dateModeChoices — 'Sem data' is always offered", () => {
  it.each(["none", "daily", "weekly", "monthly", "yearly"] as const)(
    "offers none, deadline and scheduled, in that order, for freq %s",
    (freq) => {
      expect(dateModeChoices(freq)).toEqual(["none", "deadline", "scheduled"]);
    },
  );

  it("accepts a repeating draft left on 'Sem data' — nothing is refused", () => {
    const draft: RecurrenceDraft = { ...EMPTY_RECURRENCE_DRAFT, freq: "daily" };
    expect(recurrenceDraftError(taskDraft({ dateMode: "none", date: "" }), draft)).toBeNull();
  });
});
