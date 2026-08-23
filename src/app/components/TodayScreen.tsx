// The shell grid of the layout standard §2/§4: header / banner / list /
// toast / deck, `100dvh` with `overflow: clip`, the list as its own scroll
// container. Owns the screen state: the Task list, one optimistic status
// change at a time with rollback, connectivity, refetch, the *Concluídas*
// collapse, and the `TaskSheet` state machine (`src/shared/task-sheet.ts`) —
// which Task is open, which view it shows, and the per-Task drafts kept for
// the session.

import { ChevronDown } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import type { TaskDto } from "../../shared/api";
import { canWrite } from "../../shared/connectivity";
import { todayIn } from "../../shared/dates";
import { classifyRequestFailure } from "../../shared/request-failure";
import type { ShareTarget } from "../../shared/share-target";
import { buildTaskPatch } from "../../shared/task-edit";
import { currentDraft, INITIAL_TASK_SHEET_STATE, reduceTaskSheet } from "../../shared/task-sheet";
import {
  ApiError,
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  reopenTask,
  updateTask,
} from "../api";
import { useConnectivity } from "../hooks/useConnectivity";
import { dismissToast, showToast, useToast } from "../toast-store";
import { CaptureDeck } from "./CaptureDeck";
import { EmptyState } from "./EmptyState";
import { TaskRow } from "./TaskRow";
import { TaskSheet } from "./TaskSheet";
import { TodayHeader } from "./TodayHeader";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { cn } from "./ui/cn";
import { Skeleton } from "./ui/Skeleton";
import { Toast } from "./ui/Toast";

const DONE_COLLAPSED_KEY = "praesto.today.doneCollapsed";

/** Guarded like the legacy token storage (`src/app/token-storage.ts`): a denial or a missing API degrades to the default, never throws. */
function readDoneCollapsed(): boolean {
  try {
    return window.localStorage.getItem(DONE_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDoneCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(DONE_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Best-effort — a denial or a missing API must never break the toggle.
  }
}

export function TodayScreen({
  onUnauthorized,
  initialShare,
}: {
  onUnauthorized: () => void;
  initialShare: ShareTarget | null;
}) {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialShare?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [sheet, dispatchSheet] = useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(readDoneCollapsed);
  const captureRef = useRef<HTMLInputElement>(null);

  const today = todayIn(new Date());
  const now = new Date();

  const { state: connectivity, report } = useConnectivity({ onOnline: () => void refresh() });
  const toast = useToast();
  const writable = canWrite(connectivity);
  const open = tasks?.filter((task) => task.status === "open") ?? [];
  const closed = tasks?.filter((task) => task.status !== "open") ?? [];
  const sheetTask = tasks?.find((task) => task.id === sheet.taskId) ?? null;

  /** A 401 routes to the token gate; otherwise reports the failure kind and returns its message (`null` on the 401 route, since the caller is about to unmount). */
  function handleFailure(cause: unknown): string | null {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return null;
    }
    const failure = classifyRequestFailure(cause);
    report({ type: "request-failed", kind: failure.kind });
    return failure.message;
  }

  async function refresh(): Promise<void> {
    try {
      const next = await listTasks();
      setTasks(next);
      setLoadError(null);
      report({ type: "request-succeeded" });
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setLoadError(message);
    }
  }

  /** The server-first mutation path (busy → action → refresh) — capture and inline title edits. */
  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      setCaptureError(null);
      await refresh();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setCaptureError(message);
    } finally {
      setBusy(false);
    }
  }

  /** The sheet's server-first mutation path — mirrors `run`, with the failure message landing under *Salvar* or the confirmation instead of the capture field. */
  async function runSheet(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      setSheetError(null);
      await refresh();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setSheetError(message);
    } finally {
      setBusy(false);
    }
  }

  function submitCapture(): void {
    const trimmed = title.trim();
    if (trimmed === "" || busy) return;
    void run(async () => {
      await createTask({ title: trimmed });
      // FR-045 invariant, locked in explicitly: `setTitle("")` is sequenced
      // AFTER the awaited `createTask(...)` call above, never before or
      // unconditionally — a thrown failure exits this callback before this
      // line runs, so a failed save never loses what the owner typed.
      setTitle("");
      showToast({ key: "task-saved", text: "Tarefa salva" });
    });
  }

  function commitTitle(id: string, newTitle: string): void {
    setEditingId(null);
    void run(() => updateTask(id, { title: newTitle }));
  }

  // Complete / reopen are optimistic (AC-A3): the local status flips first,
  // the request follows, and a failure restores the array captured before
  // the change — the only behavioural change in how writes are made here.
  async function complete(id: string): Promise<void> {
    const previous = tasks;
    setTasks((current) =>
      current === null
        ? current
        : current.map((task): TaskDto =>
            task.id === id
              ? { ...task, status: "done", completedAt: Math.floor(Date.now() / 1000) }
              : task,
          ),
    );
    try {
      await completeTask(id);
      showToast({
        key: "task-done",
        text: "Tarefa concluída",
        action: { label: "Desfazer", run: () => void reopen(id) },
      });
      await refresh();
    } catch (cause) {
      setTasks(previous);
      const message = handleFailure(cause);
      if (message !== null) showToast({ key: "task-error", tone: "error", text: message });
    }
  }

  async function reopen(id: string): Promise<void> {
    const previous = tasks;
    setTasks((current) =>
      current === null
        ? current
        : current.map((task): TaskDto =>
            task.id === id ? { ...task, status: "open", completedAt: null } : task,
          ),
    );
    try {
      await reopenTask(id);
      showToast({
        key: "task-reopened",
        text: "Tarefa reaberta",
        action: { label: "Desfazer", run: () => void complete(id) },
      });
      await refresh();
    } catch (cause) {
      setTasks(previous);
      const message = handleFailure(cause);
      if (message !== null) showToast({ key: "task-error", tone: "error", text: message });
    }
  }

  function toggleDoneCollapsed(): void {
    setDoneCollapsed((current) => {
      const next = !current;
      writeDoneCollapsed(next);
      return next;
    });
  }

  function openSheet(task: TaskDto): void {
    setSheetError(null);
    dispatchSheet({ type: "open", task });
  }

  function saveSheet(): void {
    if (sheetTask === null) return;
    const changes = buildTaskPatch(sheetTask, currentDraft(sheet, sheetTask));
    // Nothing changed: the route rejects an empty body by design, so never
    // issue the request at all (the empty-diff rule the sheet inherits).
    if (Object.keys(changes).length === 0) {
      dispatchSheet({ type: "close" });
      return;
    }
    void runSheet(async () => {
      await updateTask(sheetTask.id, changes);
      // The dispatch sits AFTER the awaited call, so a failed save leaves
      // the sheet open with the draft intact and the message under *Salvar*.
      dispatchSheet({ type: "saved", taskId: sheetTask.id });
      showToast({ key: "task-saved", text: "Tarefa salva" });
    });
  }

  function deleteSheetTask(): void {
    if (sheet.taskId === null) return;
    const id = sheet.taskId;
    void runSheet(async () => {
      await deleteTask(id);
      dispatchSheet({ type: "deleted", taskId: id });
      // No action on the toast — the delete is irreversible (guidelines §8).
      showToast({ key: "task-deleted", text: "Tarefa excluída" });
    });
  }

  useEffect(() => {
    // Runs once, on mount — every later refetch is triggered explicitly
    // (a mutation, `visibilitychange`, or reconnecting).
    void refresh();
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    document.title = "Hoje · Praesto Sum";
  }, []);

  useEffect(() => {
    if (tasks !== null) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, [tasks]);

  const currentToast = toast.current;
  const toastElement =
    currentToast !== null ? (
      <Toast
        toast={currentToast}
        onAction={() => {
          currentToast.action?.run?.();
          dismissToast(currentToast.key);
        }}
        onSecondary={() => {
          currentToast.secondary?.run?.();
          dismissToast(currentToast.key, true);
        }}
        onDismiss={() => dismissToast(currentToast.key)}
      />
    ) : null;

  return (
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr_auto_auto] overflow-clip bg-bg"
    >
      <TodayHeader now={now} remaining={open.length} />

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-2">
        {tasks === null && loadError === null && <Skeleton slow={slow} />}

        {tasks === null && loadError !== null && (
          <>
            <p role="alert" className="font-text text-t2 text-overdue">
              {loadError}
            </p>
            {/* prettier-ignore */}
            <Button variant="secondary" onClick={() => void refresh()}>Tentar de novo</Button>
          </>
        )}

        {tasks !== null && tasks.length === 0 && (
          <EmptyState onCapture={() => captureRef.current?.focus()} />
        )}

        {tasks !== null && tasks.length > 0 && (
          <>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {open.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  busy={busy || !writable}
                  editing={editingId === task.id}
                  onToggle={(next) => void (next ? complete(task.id) : reopen(task.id))}
                  onOpen={() => openSheet(task)}
                  onEdit={() => setEditingId(task.id)}
                  onCommitTitle={(newTitle) => commitTitle(task.id, newTitle)}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </ul>

            {closed.length > 0 && (
              <section aria-label="Concluídas">
                <button
                  type="button"
                  aria-expanded={!doneCollapsed}
                  onClick={toggleDoneCollapsed}
                  className="flex min-h-12 w-full items-center gap-2 rounded-control text-left"
                >
                  {/* prettier-ignore */}
                  <h2 className="m-0 font-text text-t2 font-semibold text-ink">Concluídas</h2>
                  <span className="font-data text-t1 font-semibold text-muted tabular-nums">
                    {closed.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-auto size-4 transition-transform",
                      !doneCollapsed && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {!doneCollapsed && (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {closed.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        today={today}
                        busy={busy || !writable}
                        editing={editingId === task.id}
                        onToggle={(next) => void (next ? complete(task.id) : reopen(task.id))}
                        onOpen={() => openSheet(task)}
                        onEdit={() => setEditingId(task.id)}
                        onCommitTitle={(newTitle) => commitTitle(task.id, newTitle)}
                        onCancelEdit={() => setEditingId(null)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {sheet.taskId === null && toastElement !== null ? (
        <div className="px-4 pb-2">{toastElement}</div>
      ) : (
        <div />
      )}

      <CaptureDeck
        value={title}
        onChange={setTitle}
        onSubmit={submitCapture}
        busy={busy}
        canWrite={writable}
        error={captureError}
        autoFocus={true}
        inputRef={captureRef}
      />

      <TaskSheet
        task={sheetTask}
        open={sheet.taskId !== null}
        view={sheet.view}
        draft={sheetTask === null ? null : currentDraft(sheet, sheetTask)}
        busy={busy}
        error={sheetError}
        toastSlot={sheet.taskId !== null ? toastElement : null}
        onDraftChange={(changes) => dispatchSheet({ type: "edit", changes })}
        onClose={() => dispatchSheet({ type: "close" })}
        onSave={saveSheet}
        onDeleteRequest={() => {
          setSheetError(null);
          dispatchSheet({ type: "request-delete" });
        }}
        onDeleteCancel={() => {
          setSheetError(null);
          dispatchSheet({ type: "cancel-delete" });
        }}
        onDeleteConfirm={deleteSheetTask}
      />
    </div>
  );
}
