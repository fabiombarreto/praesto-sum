// PRPs/prds/ui-design-pass.prd.md AC-12 detail-sheet-close-requests (the decidable
// half: "a draft edited then closed is restored when the same Task is reopened in
// the session"; *Salvar* closes the sheet)
// PRPs/prds/ui-design-pass.prd.md AC-11 delete-confirmation (the decidable half:
// "*Cancelar* returns to the detail with the draft intact", "*Excluir* deletes,
// closes the sheet"; a close request from the confirmation closes without deleting)
//
// Source plan: PRPs/plans/ui-design-pass-phase-3-sheet-confirmation-and-token-gate.plan.md
// (Task 1 — src/shared/task-sheet.ts: SheetView, TaskSheetState,
// INITIAL_TASK_SHEET_STATE, TaskSheetEvent, draftFromTask, currentDraft,
// reduceTaskSheet; plan AC-A8).
//
// Pure, DOM-free unit under test: the sheet's state machine — which Task is open,
// which view the sheet shows, and one draft per Task kept for the session. The
// native <dialog>, the fields and the PATCH / DELETE requests are the exempt glue
// of docs/context/methodology.md ("Browser-API work"), verified in the browser
// pane and on the device. The diff a save sends stays with `buildTaskPatch`
// (test/task-edit.test.ts) — this suite never re-tests it.
//
// This suite runs BEFORE the Implementer (test-first, per `tdd: true`):
// src/shared/task-sheet.ts does not exist yet, so this file is RED for the right
// reason (module-not-found on the import below) until plan Task 1 lands. The
// discriminating cases once it exists: `open` must NOT re-seed a draft that is
// already kept (a reducer that always seeds fails the restore rule), `close`
// must keep every draft (a reducer that clears drafts on close fails), `saved`
// / `deleted` must drop only that Task's draft, and every no-op must return the
// very same state object.

import { describe, expect, it } from "vitest";
import type { TaskDto } from "../src/shared/api";
import type { TaskDraft } from "../src/shared/task-edit";
import {
  INITIAL_TASK_SHEET_STATE,
  currentDraft,
  draftFromTask,
  reduceTaskSheet,
} from "../src/shared/task-sheet";
import type { TaskSheetState } from "../src/shared/task-sheet";

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "task-1",
    title: "Pagar aluguel",
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

const rent = task();
const passport = task({
  id: "task-2",
  title: "Renovar o passaporte",
  description: "Levar duas fotos",
  deadline: "2026-08-18",
  priority: "high",
});

function openedWith(source: TaskDto, overrides: Partial<TaskDraft> = {}): TaskSheetState {
  const opened = reduceTaskSheet(INITIAL_TASK_SHEET_STATE, { type: "open", task: source });
  return Object.keys(overrides).length === 0
    ? opened
    : reduceTaskSheet(opened, { type: "edit", changes: overrides });
}

describe("draftFromTask (PRD AC-12 — the seed of a fresh draft)", () => {
  it("seeds an undated, unprioritised Task as Sem data with empty text fields", () => {
    expect(draftFromTask(rent)).toEqual({
      title: "Pagar aluguel",
      description: "",
      dateMode: "none",
      date: "",
      priority: null,
    });
  });

  it("seeds a deadline as Concluir até with the date and keeps description and priority", () => {
    expect(draftFromTask(passport)).toEqual({
      title: "Renovar o passaporte",
      description: "Levar duas fotos",
      dateMode: "deadline",
      date: "2026-08-18",
      priority: "high",
    });
  });

  it("seeds a scheduled date as Fazer em", () => {
    const draft = draftFromTask(task({ scheduledDate: "2026-08-22" }));
    expect(draft.dateMode).toBe("scheduled");
    expect(draft.date).toBe("2026-08-22");
  });
});

describe("initial state and currentDraft", () => {
  it("starts closed, in the detail view, with no draft kept", () => {
    expect(INITIAL_TASK_SHEET_STATE).toEqual({ taskId: null, view: "detail", drafts: {} });
  });

  it("currentDraft returns the kept draft itself when one exists", () => {
    const state = openedWith(rent, { title: "Pagar o aluguel de setembro" });
    expect(currentDraft(state, rent)).toBe(state.drafts["task-1"]);
    expect(currentDraft(state, rent).title).toBe("Pagar o aluguel de setembro");
  });

  it("currentDraft falls back to a fresh seed when no draft is kept", () => {
    expect(currentDraft(INITIAL_TASK_SHEET_STATE, passport)).toEqual(draftFromTask(passport));
  });
});

describe("reduceTaskSheet — open", () => {
  it("opens the Task in the detail view and seeds its draft", () => {
    const state = reduceTaskSheet(INITIAL_TASK_SHEET_STATE, { type: "open", task: rent });
    expect(state.taskId).toBe("task-1");
    expect(state.view).toBe("detail");
    expect(state.drafts["task-1"]).toEqual(draftFromTask(rent));
  });

  it("restores a kept draft untouched instead of re-seeding it — the AC-12 rule", () => {
    const edited = openedWith(rent, { title: "Pagar o aluguel de setembro", priority: "low" });
    const closed = reduceTaskSheet(edited, { type: "close" });
    const reopened = reduceTaskSheet(closed, { type: "open", task: rent });
    expect(reopened.taskId).toBe("task-1");
    expect(reopened.view).toBe("detail");
    expect(reopened.drafts["task-1"]).toBe(edited.drafts["task-1"]);
    expect(reopened.drafts["task-1"]).toEqual({
      title: "Pagar o aluguel de setembro",
      description: "",
      dateMode: "none",
      date: "",
      priority: "low",
    });
  });

  it("keeps the drafts of other Tasks when another one opens", () => {
    const first = openedWith(rent, { description: "Transferência no dia 5" });
    const second = reduceTaskSheet(first, { type: "open", task: passport });
    expect(second.taskId).toBe("task-2");
    expect(second.drafts["task-1"]).toBe(first.drafts["task-1"]);
    expect(second.drafts["task-2"]).toEqual(draftFromTask(passport));
  });

  it("always lands in the detail view, even when the previous view was the confirmation", () => {
    const confirming = reduceTaskSheet(openedWith(rent), { type: "request-delete" });
    const reopened = reduceTaskSheet(confirming, { type: "open", task: passport });
    expect(reopened.view).toBe("detail");
  });
});

describe("reduceTaskSheet — edit", () => {
  it("merges the changes into the open Task's draft and keeps the other fields", () => {
    const state = reduceTaskSheet(openedWith(passport), {
      type: "edit",
      changes: { dateMode: "scheduled", date: "2026-08-22" },
    });
    expect(state.drafts["task-2"]).toEqual({
      title: "Renovar o passaporte",
      description: "Levar duas fotos",
      dateMode: "scheduled",
      date: "2026-08-22",
      priority: "high",
    });
  });

  it("accepts clearing the priority (no chip selected = no priority)", () => {
    const state = reduceTaskSheet(openedWith(passport), {
      type: "edit",
      changes: { priority: null },
    });
    expect(state.drafts["task-2"]?.priority).toBeNull();
  });

  it("does not touch the draft of a Task that is not open", () => {
    const first = openedWith(rent, { title: "Pagar o aluguel de setembro" });
    const second = reduceTaskSheet(first, { type: "open", task: passport });
    const edited = reduceTaskSheet(second, { type: "edit", changes: { title: "Passaporte" } });
    expect(edited.drafts["task-1"]).toBe(first.drafts["task-1"]);
    expect(edited.drafts["task-2"]?.title).toBe("Passaporte");
  });

  it("is a no-op while the sheet is closed, returning the same state object", () => {
    const closed = reduceTaskSheet(openedWith(rent), { type: "close" });
    expect(reduceTaskSheet(closed, { type: "edit", changes: { title: "x" } })).toBe(closed);
    expect(
      reduceTaskSheet(INITIAL_TASK_SHEET_STATE, { type: "edit", changes: { title: "x" } }),
    ).toBe(INITIAL_TASK_SHEET_STATE);
  });
});

describe("reduceTaskSheet — request-delete / cancel-delete (PRD AC-11)", () => {
  it("request-delete switches to the confirmation without touching the draft", () => {
    const opened = openedWith(rent, { title: "Pagar o aluguel de setembro" });
    const confirming = reduceTaskSheet(opened, { type: "request-delete" });
    expect(confirming.view).toBe("confirm");
    expect(confirming.taskId).toBe("task-1");
    expect(confirming.drafts).toBe(opened.drafts);
  });

  it("cancel-delete returns to the detail with the draft intact", () => {
    const opened = openedWith(rent, { title: "Pagar o aluguel de setembro" });
    const confirming = reduceTaskSheet(opened, { type: "request-delete" });
    const back = reduceTaskSheet(confirming, { type: "cancel-delete" });
    expect(back.view).toBe("detail");
    expect(back.taskId).toBe("task-1");
    expect(back.drafts["task-1"]).toBe(opened.drafts["task-1"]);
  });

  it("both are no-ops while the sheet is closed", () => {
    expect(reduceTaskSheet(INITIAL_TASK_SHEET_STATE, { type: "request-delete" })).toBe(
      INITIAL_TASK_SHEET_STATE,
    );
    expect(reduceTaskSheet(INITIAL_TASK_SHEET_STATE, { type: "cancel-delete" })).toBe(
      INITIAL_TASK_SHEET_STATE,
    );
  });
});

describe("reduceTaskSheet — close (PRD AC-12 — the draft stays in memory)", () => {
  it("closes the sheet and keeps every draft — the very same drafts object", () => {
    const opened = openedWith(rent, { title: "Pagar o aluguel de setembro" });
    const closed = reduceTaskSheet(opened, { type: "close" });
    expect(closed.taskId).toBeNull();
    expect(closed.view).toBe("detail");
    expect(closed.drafts).toBe(opened.drafts);
  });

  it("a close request from the confirmation closes the whole sheet without deleting", () => {
    const opened = openedWith(rent, { description: "Transferência no dia 5" });
    const confirming = reduceTaskSheet(opened, { type: "request-delete" });
    const closed = reduceTaskSheet(confirming, { type: "close" });
    expect(closed.taskId).toBeNull();
    expect(closed.view).toBe("detail");
    expect(closed.drafts["task-1"]).toBe(opened.drafts["task-1"]);
  });

  it("is a no-op when already closed", () => {
    expect(reduceTaskSheet(INITIAL_TASK_SHEET_STATE, { type: "close" })).toBe(
      INITIAL_TASK_SHEET_STATE,
    );
  });
});

describe("reduceTaskSheet — saved / deleted", () => {
  it("saved drops that Task's draft and closes the sheet", () => {
    const opened = openedWith(rent, { title: "Pagar o aluguel de setembro" });
    const saved = reduceTaskSheet(opened, { type: "saved", taskId: "task-1" });
    expect(saved.taskId).toBeNull();
    expect(saved.view).toBe("detail");
    expect(saved.drafts).not.toHaveProperty("task-1");
  });

  it("after saved, reopening seeds a fresh draft from the updated Task", () => {
    const saved = reduceTaskSheet(openedWith(rent, { title: "Pagar o aluguel de setembro" }), {
      type: "saved",
      taskId: "task-1",
    });
    const updated = task({ title: "Pagar o aluguel de setembro" });
    const reopened = reduceTaskSheet(saved, { type: "open", task: updated });
    expect(reopened.drafts["task-1"]).toEqual(draftFromTask(updated));
  });

  it("deleted drops only that Task's draft, keeps the others and closes", () => {
    const first = openedWith(rent, { title: "Pagar o aluguel de setembro" });
    const second = reduceTaskSheet(first, { type: "open", task: passport });
    const confirming = reduceTaskSheet(second, { type: "request-delete" });
    const deleted = reduceTaskSheet(confirming, { type: "deleted", taskId: "task-2" });
    expect(deleted.taskId).toBeNull();
    expect(deleted.view).toBe("detail");
    expect(deleted.drafts).not.toHaveProperty("task-2");
    expect(deleted.drafts["task-1"]).toBe(first.drafts["task-1"]);
  });
});

describe("reduceTaskSheet — purity", () => {
  it("never mutates the state, the drafts or the changes it is given", () => {
    const opened = openedWith(rent);
    const frozen: TaskSheetState = Object.freeze({
      taskId: opened.taskId,
      view: opened.view,
      drafts: Object.freeze({ "task-1": Object.freeze({ ...opened.drafts["task-1"]! }) }),
    });
    const changes = Object.freeze({ title: "Pagar o aluguel de setembro" });
    expect(() => reduceTaskSheet(frozen, { type: "edit", changes })).not.toThrow();
    expect(() => reduceTaskSheet(frozen, { type: "request-delete" })).not.toThrow();
    expect(() => reduceTaskSheet(frozen, { type: "close" })).not.toThrow();
    expect(() => reduceTaskSheet(frozen, { type: "saved", taskId: "task-1" })).not.toThrow();
    expect(frozen.drafts["task-1"]?.title).toBe("Pagar aluguel");
    expect(frozen.taskId).toBe("task-1");
    expect(frozen.view).toBe("detail");
  });
});
