// PRPs/prds/reminders.prd.md AC-3 Reminder attached to a Task, relative to its deadline (client-side mirror)
// PRPs/prds/reminders.prd.md AC-2 Standalone Reminder must say what it is about (client-side mirror, via plan AC-A4)
//
// Source plan: PRPs/plans/reminders-phase-3-per-task-route-and-reminder-ui.plan.md
// (Task 5 — src/shared/reminder-edit.ts: ReminderTimeMode, ReminderDraft,
// draftFromReminder, buildCreateReminderInput, buildUpdateReminderInput;
// plan AC-A2/AC-A3/AC-A4 scaffolding).
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// `src/shared/reminder-edit.ts` does not exist at all yet, so this file is
// RED for the right reason (module-not-found on the import below) until
// plan Task 5 lands.
//
// Pure, DOM-free unit under test: the same "only the changed keys" diff
// contract `src/shared/task-edit.ts`'s `buildTaskPatch` already established
// (test/task-edit.test.ts), adapted to a Reminder's two shapes (standalone:
// label + absolute instant; Task-linked: absolute or offset-in-minutes). The
// route's own server-side validation (`src/worker/routes/reminders.ts`) is
// covered by test/reminders.test.ts and is never re-tested here — this suite
// only tests the CLIENT-SIDE mirror of that precedence (offset with a Task
// with a deadline, else a finite absolute instant), so the owner never
// submits a request the route would 400.
//
// Fixtures reuse dates.test.ts's own fixed-offset property: America/Sao_Paulo
// has carried a fixed -03:00 offset since 2019, so every expected local
// day/time pair below is derived by hand via `Date.UTC(...)` +/- 3 hours,
// independent of `instantToLocalParts`/`localPartsToInstant`'s own internals
// (those two functions get their own dedicated coverage in test/dates.test.ts).

import { describe, expect, it } from "vitest";
import type { ReminderDto } from "../src/shared/api";
import {
  buildCreateReminderInput,
  buildUpdateReminderInput,
  draftFromReminder,
  type ReminderDraft,
} from "../src/shared/reminder-edit";

// 2026-09-20T17:30:00Z -03:00 -> 2026-09-20 14:30 local.
const EPOCH_1 = Date.UTC(2026, 8, 20, 17, 30, 0) / 1000;
const EPOCH_1_DAY = "2026-09-20";
const EPOCH_1_TIME = "14:30";

// 2026-09-21T18:00:00Z -03:00 -> 2026-09-21 15:00 local.
const EPOCH_2 = Date.UTC(2026, 8, 21, 18, 0, 0) / 1000;
const EPOCH_2_DAY = "2026-09-21";
const EPOCH_2_TIME = "15:00";

function reminder(overrides: Partial<ReminderDto> = {}): ReminderDto {
  return {
    id: "reminder-1",
    taskId: null,
    label: "Beber água",
    fireAt: EPOCH_1,
    originOffsetMinutes: null,
    sentAt: null,
    createdAt: 1_780_000_000,
    updatedAt: 1_780_000_000,
    ...overrides,
  };
}

describe("draftFromReminder — the seed of a fresh draft (create)", () => {
  it("seeds an empty absolute draft with a 60-minute default offset when there is no existing Reminder", () => {
    expect(draftFromReminder(null)).toEqual({
      label: "",
      timeMode: "absolute",
      absoluteDay: "",
      absoluteTime: "",
      offsetMinutes: 60,
    });
  });
});

describe("draftFromReminder — restoring an existing Reminder", () => {
  it("restores a Task-linked, offset-mode Reminder: timeMode offset, offsetMinutes from the row", () => {
    const existing = reminder({
      taskId: "task-1",
      label: "Chamar médico",
      fireAt: EPOCH_1,
      originOffsetMinutes: 60,
    });
    const draft = draftFromReminder(existing);
    expect(draft.label).toBe("Chamar médico");
    expect(draft.timeMode).toBe("offset");
    expect(draft.offsetMinutes).toBe(60);
    expect(draft.absoluteDay).toBe(EPOCH_1_DAY);
    expect(draft.absoluteTime).toBe(EPOCH_1_TIME);
  });

  it("restores a standalone, absolute-mode Reminder: timeMode absolute, day/time derived from fireAt", () => {
    const existing = reminder({
      taskId: null,
      label: "Beber água",
      fireAt: EPOCH_1,
      originOffsetMinutes: null,
    });
    const draft = draftFromReminder(existing);
    expect(draft.timeMode).toBe("absolute");
    expect(draft.absoluteDay).toBe(EPOCH_1_DAY);
    expect(draft.absoluteTime).toBe(EPOCH_1_TIME);
    expect(draft.label).toBe("Beber água");
    expect(typeof draft.offsetMinutes).toBe("number");
  });

  it("restores a Task-linked, absolute-mode Reminder (originOffsetMinutes null) as timeMode absolute", () => {
    const existing = reminder({ taskId: "task-1", originOffsetMinutes: null, fireAt: EPOCH_2 });
    const draft = draftFromReminder(existing);
    expect(draft.timeMode).toBe("absolute");
    expect(draft.absoluteDay).toBe(EPOCH_2_DAY);
    expect(draft.absoluteTime).toBe(EPOCH_2_TIME);
  });

  it("maps a null label to an empty string draft field — the draft always holds a string", () => {
    const existing = reminder({ taskId: "task-1", label: null, originOffsetMinutes: 30 });
    expect(draftFromReminder(existing).label).toBe("");
  });
});

describe("buildCreateReminderInput — standalone Reminder (absolute only, PRD AC-1/AC-2)", () => {
  it("builds fireAt from the absolute day/time when there is no Task target", () => {
    const draft: ReminderDraft = {
      label: "Beber água",
      timeMode: "absolute",
      absoluteDay: EPOCH_1_DAY,
      absoluteTime: EPOCH_1_TIME,
      offsetMinutes: 999,
    };
    const input = buildCreateReminderInput(draft, null);
    expect(input.fireAt).toBe(EPOCH_1);
    expect(input.originOffsetMinutes).toBeUndefined();
  });

  it("trims the label, turning an empty/whitespace-only value into null (AC-2's client-side mirror)", () => {
    const draft: ReminderDraft = {
      label: "   ",
      timeMode: "absolute",
      absoluteDay: EPOCH_1_DAY,
      absoluteTime: EPOCH_1_TIME,
      offsetMinutes: 60,
    };
    const input = buildCreateReminderInput(draft, null);
    expect(input.label).toBeNull();
  });

  it("does not set originOffsetMinutes for a standalone Reminder even when timeMode is offset — an offset with no target is meaningless", () => {
    const draft: ReminderDraft = {
      label: "Beber água",
      timeMode: "offset",
      absoluteDay: EPOCH_1_DAY,
      absoluteTime: EPOCH_1_TIME,
      offsetMinutes: 90,
    };
    const input = buildCreateReminderInput(draft, null);
    expect(input.originOffsetMinutes).toBeUndefined();
    expect(input.fireAt).toBe(EPOCH_1);
  });
});

describe("buildCreateReminderInput — Task-linked Reminder (absolute or offset, PRD AC-3)", () => {
  it("sets originOffsetMinutes and no fireAt when timeMode is offset and a Task target is given", () => {
    const draft: ReminderDraft = {
      label: "",
      timeMode: "offset",
      absoluteDay: "",
      absoluteTime: "",
      offsetMinutes: 90,
    };
    const input = buildCreateReminderInput(draft, "task-9");
    expect(input.originOffsetMinutes).toBe(90);
    expect(input.fireAt).toBeUndefined();
    expect(input.taskId).toBe("task-9");
  });

  it("sets fireAt and no originOffsetMinutes when timeMode is absolute even with a Task target", () => {
    const draft: ReminderDraft = {
      label: "",
      timeMode: "absolute",
      absoluteDay: EPOCH_1_DAY,
      absoluteTime: EPOCH_1_TIME,
      offsetMinutes: 90,
    };
    const input = buildCreateReminderInput(draft, "task-9");
    expect(input.fireAt).toBe(EPOCH_1);
    expect(input.originOffsetMinutes).toBeUndefined();
    expect(input.taskId).toBe("task-9");
  });
});

describe("buildUpdateReminderInput — only the changed keys (mirrors buildTaskPatch's diff contract)", () => {
  it("returns an empty patch when the draft matches the original Reminder exactly", () => {
    const original = reminder({
      taskId: "task-1",
      label: "Chamar médico",
      originOffsetMinutes: 60,
    });
    const draft = draftFromReminder(original);
    expect(buildUpdateReminderInput(original, draft)).toEqual({});
  });

  it("emits only the changed label", () => {
    const original = reminder({ label: "Beber água" });
    const draft = draftFromReminder(original);
    const changed: ReminderDraft = { ...draft, label: "Beber bastante água" };
    expect(buildUpdateReminderInput(original, changed)).toEqual({ label: "Beber bastante água" });
  });

  it("emits only the changed fireAt when the absolute day/time changes and mode stays absolute", () => {
    const original = reminder({ taskId: null, label: "Beber água", fireAt: EPOCH_1 });
    const draft = draftFromReminder(original);
    const changed: ReminderDraft = {
      ...draft,
      absoluteDay: EPOCH_2_DAY,
      absoluteTime: EPOCH_2_TIME,
    };
    expect(buildUpdateReminderInput(original, changed)).toEqual({ fireAt: EPOCH_2 });
  });

  it("clears originOffsetMinutes to null when the draft moves from offset mode back to an absolute time", () => {
    const original = reminder({ taskId: "task-1", fireAt: EPOCH_1, originOffsetMinutes: 60 });
    const draft: ReminderDraft = {
      label: original.label ?? "",
      timeMode: "absolute",
      absoluteDay: EPOCH_2_DAY,
      absoluteTime: EPOCH_2_TIME,
      offsetMinutes: 60,
    };
    const patch = buildUpdateReminderInput(original, draft);
    expect(patch.originOffsetMinutes).toBeNull();
    expect(patch.fireAt).toBe(EPOCH_2);
  });

  it("emits the new originOffsetMinutes when the draft moves from an absolute time to offset mode", () => {
    const original = reminder({ taskId: "task-1", fireAt: EPOCH_1, originOffsetMinutes: null });
    const draft: ReminderDraft = {
      label: original.label ?? "",
      timeMode: "offset",
      absoluteDay: EPOCH_1_DAY,
      absoluteTime: EPOCH_1_TIME,
      offsetMinutes: 45,
    };
    const patch = buildUpdateReminderInput(original, draft);
    expect(patch.originOffsetMinutes).toBe(45);
    expect(patch.fireAt).toBeUndefined();
  });

  it("does not emit a key for a field that did not change", () => {
    const original = reminder({
      taskId: "task-1",
      label: "Chamar médico",
      originOffsetMinutes: 60,
    });
    const draft = draftFromReminder(original);
    const changed: ReminderDraft = { ...draft, offsetMinutes: 90 };
    const patch = buildUpdateReminderInput(original, changed);
    expect(patch).toEqual({ originOffsetMinutes: 90 });
    expect(patch).not.toHaveProperty("label");
  });
});
