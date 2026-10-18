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
import { EDITABLE_TASK_FIELDS, type TaskDto } from "../src/shared/api";
import {
  buildTaskPatch,
  dateModeOf,
  effectiveLifeAreaId,
  type TaskDraft,
} from "../src/shared/task-edit";

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
    detached: false,
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

// ---------------------------------------------------------------------------
// The Life Area key (added 2026-10-12, unit 13 life-areas, phase 3).
//
// PRPs/prds/life-areas.prd.md AC-9 Task edit carries the area — the client half: the
// server accepts `lifeAreaId` on PATCH /api/tasks/:id and detaches an occurrence on ANY
// key, so the SPA must never send the area unless the owner chose a different one.
// PRPs/prds/life-areas.prd.md AC-20 Task sheet — "saving persists the choice".
//
// Source plan: PRPs/plans/life-areas-phase-3-assign-and-show.plan.md (Task 1;
// plan AC-A4, AC-A5, AC-A6).
//
// These cases are appended beside the key-set check above and change none of its
// assertions: a draft built WITHOUT an area decision (every `draftOf` call above) still
// emits exactly the four keys it always did. `TaskDraft.lifeAreaId` is optional and is
// deliberately not seeded from the Task — present only once the owner has chosen — so
// "absent" below means "the owner never touched the control".
// ---------------------------------------------------------------------------

describe("buildTaskPatch sends the area only when the owner chose a different one (life-areas PRD AC-9, AC-20)", () => {
  it("sends no area key when the owner made no area choice, even for a Task that has an area", () => {
    // The re-save of an occurrence: any key on the Task PATCH detaches it (ADR-0006).
    const original = task({ lifeAreaId: "area-a" });

    const patch = buildTaskPatch(original, draftOf(original));

    expect(patch).toEqual({});
    expect(patch).not.toHaveProperty("lifeAreaId");
  });

  it("keeps an unrelated edit free of the area key", () => {
    const original = task({ lifeAreaId: "area-a" });

    const patch = buildTaskPatch(original, draftOf(original, { title: "New title" }));

    expect(patch).toEqual({ title: "New title" });
  });

  it("sends no area key when the chosen area is the one the Task already has", () => {
    const original = task({ lifeAreaId: "area-a" });

    const patch = buildTaskPatch(original, draftOf(original, { lifeAreaId: "area-a" }));

    expect(patch).toEqual({});
  });

  it("sends no area key when the owner chooses Sem área on a Task that has none", () => {
    const original = task({ lifeAreaId: null });

    const patch = buildTaskPatch(original, draftOf(original, { lifeAreaId: null }));

    expect(patch).toEqual({});
  });

  it("sets an area on an area-less Task", () => {
    const original = task({ lifeAreaId: null });

    expect(buildTaskPatch(original, draftOf(original, { lifeAreaId: "area-a" }))).toEqual({
      lifeAreaId: "area-a",
    });
  });

  it("changes the area between two areas", () => {
    const original = task({ lifeAreaId: "area-a" });

    expect(buildTaskPatch(original, draftOf(original, { lifeAreaId: "area-b" }))).toEqual({
      lifeAreaId: "area-b",
    });
  });

  it("clears the area with an explicit null", () => {
    const original = task({ lifeAreaId: "area-a" });

    expect(buildTaskPatch(original, draftOf(original, { lifeAreaId: null }))).toEqual({
      lifeAreaId: null,
    });
  });

  it("carries the area beside another changed key without disturbing it", () => {
    const original = task({ lifeAreaId: null });

    const patch = buildTaskPatch(
      original,
      draftOf(original, { title: "New title", lifeAreaId: "area-b" }),
    );

    expect(patch).toEqual({ title: "New title", lifeAreaId: "area-b" });
  });
});

describe("buildTaskPatch's key set with the area stays inside the editable field set (life-areas PRD AC-9)", () => {
  it("emits no key outside EDITABLE_TASK_FIELDS when every editable field changes with the area", () => {
    const original = task({
      description: "d",
      deadline: "2026-09-01",
      priority: "low",
      lifeAreaId: "area-a",
    });

    const patch = buildTaskPatch(
      original,
      draftOf(original, {
        title: "Everything",
        description: "changed",
        dateMode: "scheduled",
        date: "2026-09-05",
        priority: "high",
        lifeAreaId: "area-b",
      }),
    );

    expect(Object.keys(patch).sort()).toEqual([
      "description",
      "lifeAreaId",
      "priority",
      "scheduledDate",
      "title",
    ]);
    for (const key of Object.keys(patch)) expect(EDITABLE_TASK_FIELDS).toContain(key);
  });
});

describe("effectiveLifeAreaId — the area the sheet shows selected and a series conversion carries (life-areas PRD AC-20)", () => {
  const withArea = task({ lifeAreaId: "area-a" });
  const withoutArea = task({ lifeAreaId: null });

  it("falls back to the Task's own area when the draft carries no choice", () => {
    expect(effectiveLifeAreaId({}, withArea)).toBe("area-a");
    expect(effectiveLifeAreaId({}, withoutArea)).toBeNull();
  });

  it("is null when the owner chose Sem área on a Task that has an area", () => {
    expect(effectiveLifeAreaId({ lifeAreaId: null }, withArea)).toBeNull();
  });

  it("is the chosen area when it differs from the Task's own", () => {
    expect(effectiveLifeAreaId({ lifeAreaId: "area-b" }, withArea)).toBe("area-b");
    expect(effectiveLifeAreaId({ lifeAreaId: "area-b" }, withoutArea)).toBe("area-b");
  });

  it("agrees with buildTaskPatch: the patch carries the area exactly when the effective area differs", () => {
    const choices: Array<string | null | undefined> = [undefined, null, "area-a", "area-b"];

    for (const lifeAreaId of [null, "area-a"]) {
      for (const choice of choices) {
        const original = task({ lifeAreaId });
        const draft =
          choice === undefined ? draftOf(original) : draftOf(original, { lifeAreaId: choice });

        const effective = effectiveLifeAreaId(draft, original);
        const patch = buildTaskPatch(original, draft);

        if (effective === original.lifeAreaId) {
          expect(patch).not.toHaveProperty("lifeAreaId");
        } else {
          expect(patch).toHaveProperty("lifeAreaId", effective);
        }
      }
    }
  });
});
