/**
 * The sheet's state machine (PRD AC-11, AC-12) — which Task the detail sheet
 * is editing, which view it shows, and one draft per Task kept for the
 * session. Total and side-effect free, like `src/shared/connectivity.ts` and
 * `src/shared/toast.ts`: it only reduces the events it is handed and never
 * touches the DOM, a timer or the network.
 *
 * The native `<dialog>`, the fields and the `updateTask` / `deleteTask`
 * requests are React glue in `src/app/components/TaskSheet.tsx` and
 * `src/app/components/TodayScreen.tsx` — the exempt half of
 * `docs/context/methodology.md`'s "Browser-API work" split. This module is
 * the decidable half, authored test-first (`test/task-sheet.test.ts`).
 *
 * A close request from the confirmation view is just `close`: there is only
 * ever one sheet (layout standard §3, "never stack sheets"), so cancelling a
 * delete by closing the whole sheet is not a distinct event — it is the same
 * `close` a Task detail's own close request sends, and it never deletes.
 *
 * Drafts are per session only — kept in memory in `drafts`, never persisted
 * (guidelines §8, "dirty editor closed": the owner's edits survive closing
 * the sheet and reopening the same Task in the same session, and nothing
 * more). `saved` and `deleted` drop the edited Task's draft because the
 * server now holds the truth; every other Task's draft survives untouched.
 */

import type { TaskDto } from "./api";
import { dateModeOf, type TaskDraft } from "./task-edit";

export type SheetView = "detail" | "confirm";

export interface TaskSheetState {
  taskId: string | null;
  view: SheetView;
  drafts: Readonly<Record<string, TaskDraft>>;
}

export const INITIAL_TASK_SHEET_STATE: TaskSheetState = {
  taskId: null,
  view: "detail",
  drafts: {},
};

export type TaskSheetEvent =
  | { type: "open"; task: TaskDto }
  | { type: "edit"; changes: Partial<TaskDraft> }
  | { type: "request-delete" }
  | { type: "cancel-delete" }
  | { type: "close" }
  | { type: "saved"; taskId: string }
  | { type: "deleted"; taskId: string };

/**
 * The seed of a fresh draft — moved from `TaskDetail.tsx:37-43` — every field
 * the sheet edits, computed from the Task as it stands on the server.
 */
export function draftFromTask(task: TaskDto): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    dateMode: dateModeOf(task),
    date: task.deadline ?? task.scheduledDate ?? "",
    priority: task.priority,
  };
}

/** The draft `TaskSheet` renders: the kept draft when the session has one, otherwise a fresh seed — never a mix of the two. */
export function currentDraft(state: TaskSheetState, task: TaskDto): TaskDraft {
  return state.drafts[task.id] ?? draftFromTask(task);
}

export function reduceTaskSheet(state: TaskSheetState, event: TaskSheetEvent): TaskSheetState {
  switch (event.type) {
    case "open":
      // An existing draft is restored untouched — the AC-12 rule — so only a
      // Task with no kept draft yet gets seeded here.
      return {
        taskId: event.task.id,
        view: "detail",
        drafts: {
          ...state.drafts,
          [event.task.id]: state.drafts[event.task.id] ?? draftFromTask(event.task),
        },
      };
    case "edit": {
      const { taskId } = state;
      if (taskId === null) return state;
      const draft = state.drafts[taskId];
      if (draft === undefined) return state;
      return {
        ...state,
        drafts: { ...state.drafts, [taskId]: { ...draft, ...event.changes } },
      };
    }
    case "request-delete":
      if (state.taskId === null) return state;
      return { ...state, view: "confirm" };
    case "cancel-delete":
      if (state.taskId === null) return state;
      return { ...state, view: "detail" };
    case "close":
      if (state.taskId === null) return state;
      return { ...state, taskId: null, view: "detail" };
    case "saved":
    case "deleted": {
      // Drop only `event.taskId`'s draft — a fresh copy via `Object.entries`,
      // never a mutation of `state.drafts`; every other draft keeps its exact
      // reference, since `Object.fromEntries` re-maps entries, it does not
      // clone their values.
      const drafts = Object.fromEntries(
        Object.entries(state.drafts).filter(([id]) => id !== event.taskId),
      );
      return { taskId: null, view: "detail", drafts };
    }
  }
}
