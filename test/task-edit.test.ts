// PRPs/prds/task-detail-and-dates.prd.md AC-8 title-corrected-in-place
//
// Phase 4's DOM half is verified by hand (testing-strategy.md keeps UI
// verification manual, and this project's only test tier — Vitest inside
// workerd — has no DOM). What IS decidable is extracted here per
// docs/context/methodology.md's standing obligation: which keys a patch
// carries, clearing versus omitting, and date exclusivity.
//
// These are the client half of PRD AC-2's omitted-versus-cleared rule. The
// route enforces it server-side; this module is what stops the SPA from
// sending a key the owner never touched.

import { describe, expect, it } from "vitest";
import type { TaskDto } from "../src/shared/api";
import { buildTaskPatch, dateModeOf, type TaskDraft } from "../src/shared/task-edit";

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "task-1",
    title: "Original title",
    description: null,
    status: "open",
    deadline: null,
    scheduledDate: null,
    priority: null,
    lifeAreaId: null,
    seriesId: null,
    occurrenceDate: null,
    completedAt: null,
    createdAt: 1_780_000_000,
    ...overrides,
  };
}

function draftOf(source: TaskDto, overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: source.title,
    description: source.description ?? "",
    dateMode: dateModeOf(source),
    date: source.deadline ?? source.scheduledDate ?? "",
    priority: source.priority,
    ...overrides,
  };
}

describe("dateModeOf reads a Task's current date mode", () => {
  it("reports deadline when the Task carries one", () => {
    expect(dateModeOf(task({ deadline: "2026-09-01" }))).toBe("deadline");
  });

  it("reports scheduled when the Task carries a scheduled date", () => {
    expect(dateModeOf(task({ scheduledDate: "2026-09-01" }))).toBe("scheduled");
  });

  it("reports none when the Task carries neither", () => {
    expect(dateModeOf(task())).toBe("none");
  });
});

describe("buildTaskPatch sends only what changed (PRD AC-8, client half of AC-2)", () => {
  it("returns an empty patch when nothing changed", () => {
    const original = task({ description: "keep", deadline: "2026-09-01", priority: "high" });

    expect(buildTaskPatch(original, draftOf(original))).toEqual({});
  });

  it("includes only the changed key", () => {
    const original = task({ description: "keep", priority: "high" });

    const patch = buildTaskPatch(original, draftOf(original, { title: "New title" }));

    expect(patch).toEqual({ title: "New title" });
  });

  it("trims a changed title", () => {
    const original = task();
    expect(buildTaskPatch(original, draftOf(original, { title: "  Trimmed  " }))).toEqual({
      title: "Trimmed",
    });
  });

  it("treats a whitespace-only retitle as no change at all", () => {
    // An empty title is a 400 and an empty body is a 400; the owner should
    // meet neither. Emitting nothing lets the caller skip the request.
    const original = task();

    expect(buildTaskPatch(original, draftOf(original, { title: "   " }))).toEqual({});
  });

  it("omits a title that differs only by surrounding whitespace", () => {
    const original = task({ title: "Same" });

    expect(buildTaskPatch(original, draftOf(original, { title: "  Same  " }))).toEqual({});
  });
});

describe("buildTaskPatch distinguishes clearing from omitting (PRD AC-8)", () => {
  it("clears a description with an explicit null", () => {
    const original = task({ description: "was here" });

    expect(buildTaskPatch(original, draftOf(original, { description: "" }))).toEqual({
      description: null,
    });
  });

  it("omits description entirely when it was already empty", () => {
    const original = task({ description: null });

    expect(buildTaskPatch(original, draftOf(original, { description: "" }))).toEqual({});
  });

  it("clears a priority with an explicit null", () => {
    const original = task({ priority: "high" });

    expect(buildTaskPatch(original, draftOf(original, { priority: null }))).toEqual({
      priority: null,
    });
  });

  it("omits priority when it was already unset", () => {
    const original = task({ priority: null });

    expect(buildTaskPatch(original, draftOf(original, { priority: null }))).toEqual({});
  });

  it("changes a priority between two levels", () => {
    const original = task({ priority: "low" });

    expect(buildTaskPatch(original, draftOf(original, { priority: "high" }))).toEqual({
      priority: "high",
    });
  });
});

describe("buildTaskPatch keeps the two dates exclusive (PRD AC-8, client half of AC-3)", () => {
  it("emits only deadline when switching a scheduled Task to a deadline", () => {
    const original = task({ scheduledDate: "2026-09-05" });

    const patch = buildTaskPatch(
      original,
      draftOf(original, { dateMode: "deadline", date: "2026-09-01" }),
    );

    expect(patch).toEqual({ deadline: "2026-09-01" });
    expect(patch).not.toHaveProperty("scheduledDate");
  });

  it("emits only scheduledDate when switching a deadline Task to a scheduled date", () => {
    const original = task({ deadline: "2026-09-01" });

    const patch = buildTaskPatch(
      original,
      draftOf(original, { dateMode: "scheduled", date: "2026-09-05" }),
    );

    expect(patch).toEqual({ scheduledDate: "2026-09-05" });
    expect(patch).not.toHaveProperty("deadline");
  });

  it("clears the deadline when the owner chooses no date", () => {
    const original = task({ deadline: "2026-09-01" });

    expect(buildTaskPatch(original, draftOf(original, { dateMode: "none", date: "" }))).toEqual({
      deadline: null,
    });
  });

  it("clears the scheduled date when the owner chooses no date", () => {
    const original = task({ scheduledDate: "2026-09-05" });

    expect(buildTaskPatch(original, draftOf(original, { dateMode: "none", date: "" }))).toEqual({
      scheduledDate: null,
    });
  });

  it("omits the date entirely when an undated Task stays undated", () => {
    const original = task();

    expect(buildTaskPatch(original, draftOf(original, { dateMode: "none" }))).toEqual({});
  });

  it("sets a date on a previously undated Task", () => {
    const original = task();

    expect(
      buildTaskPatch(original, draftOf(original, { dateMode: "deadline", date: "2026-09-01" })),
    ).toEqual({ deadline: "2026-09-01" });
  });

  it("omits the date when the same mode keeps the same value", () => {
    const original = task({ deadline: "2026-09-01" });

    expect(
      buildTaskPatch(original, draftOf(original, { dateMode: "deadline", date: "2026-09-01" })),
    ).toEqual({});
  });

  it.each([
    ["an empty value", ""],
    ["an impossible date", "2026-02-31"],
    ["a malformed date", "01/09/2026"],
  ])("emits no date key for %s", (_label, date) => {
    const original = task({ deadline: "2026-09-01" });

    const patch = buildTaskPatch(original, draftOf(original, { dateMode: "deadline", date }));

    expect(patch).not.toHaveProperty("deadline");
    expect(patch).not.toHaveProperty("scheduledDate");
  });

  it("never emits both dates, whatever the draft says", () => {
    const original = task({ deadline: "2026-09-01" });

    for (const dateMode of ["none", "deadline", "scheduled"] as const) {
      const patch = buildTaskPatch(original, draftOf(original, { dateMode, date: "2026-09-09" }));
      const bothSet = patch.deadline != null && patch.scheduledDate != null;
      expect(bothSet).toBe(false);
    }
  });
});

describe("buildTaskPatch never exceeds the editable field set (PRD AC-8)", () => {
  it("emits no key outside EDITABLE_TASK_FIELDS", () => {
    const original = task({ description: "d", deadline: "2026-09-01", priority: "low" });

    const patch = buildTaskPatch(
      original,
      draftOf(original, {
        title: "Everything",
        description: "changed",
        dateMode: "scheduled",
        date: "2026-09-05",
        priority: "high",
      }),
    );

    expect(Object.keys(patch).sort()).toEqual([
      "description",
      "priority",
      "scheduledDate",
      "title",
    ]);
  });
});
