// The `search` route's own screen (text-search phase 2, plan AC-A1..AC-A7):
// a full-screen route (not a sheet) whose header holds the search field
// itself rather than a title (layout standard §6, "field at the top").
// Mirrors `SettingsScreen`'s shell (100dvh grid, back button, Escape ->
// back()) and reuses `TodayScreen`'s exact grouping (`collectDayItems`),
// row-rendering (`renderDayItems`) and `TaskSheet` wiring verbatim, so a
// search result looks and behaves exactly like the same Task on *Hoje*.

import { ArrowLeft } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ReminderDto, TaskDto } from "../../shared/api";
import { todayIn } from "../../shared/dates";
import { collectDayItems } from "../../shared/day-groups";
import { assertNeverDaySource, dayItemFromTask, type DayItem } from "../../shared/day-item";
import { classifyRequestFailure } from "../../shared/request-failure";
import {
  buildCreateReminderInput,
  buildUpdateReminderInput,
  draftFromReminder,
  type ReminderDraft,
} from "../../shared/reminder-edit";
import { SEARCH_MIN_QUERY_LENGTH, shouldSearch } from "../../shared/search";
import { buildTaskPatch } from "../../shared/task-edit";
import { EMPTY_FILTER } from "../../shared/task-filter";
import { currentDraft, INITIAL_TASK_SHEET_STATE, reduceTaskSheet } from "../../shared/task-sheet";
import {
  ApiError,
  completeTask,
  createReminder,
  deleteReminder,
  deleteTask,
  listReminders,
  listTasks,
  reopenTask,
  updateReminder,
  updateTask,
} from "../api";
import { useConnectivity } from "../hooks/useConnectivity";
import { TaskGroup } from "./TaskGroup";
import { TaskRow } from "./TaskRow";
import { TaskSheet } from "./TaskSheet";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

/** Starting value (plan Notes): confirmed or adjusted on the owner's device, not a measured constant. */
const SEARCH_DEBOUNCE_MS = 300;

export function SearchScreen({
  onUnauthorized,
  back,
}: {
  onUnauthorized: () => void;
  back: () => void;
}) {
  const { state: connectivity } = useConnectivity();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<TaskDto[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderDto[] | null>(null);
  const [sheet, dispatchSheet] = useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [taskReminderDraft, setTaskReminderDraft] = useState<ReminderDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = todayIn(new Date());
  const groups = collectDayItems(
    [{ id: "tasks", items: (results ?? []).map(dayItemFromTask) }],
    today,
  );
  const sheetTask = results?.find((task) => task.id === sheet.taskId) ?? null;
  const sheetTaskReminder =
    sheetTask === null ? null : ((reminders ?? []).find((r) => r.taskId === sheetTask.id) ?? null);

  /** A 401 routes to the token gate; otherwise returns the failure's message. */
  function handleFailure(cause: unknown): string | null {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return null;
    }
    return classifyRequestFailure(cause).message;
  }

  /** Issues one `GET /api/tasks?q=` for `q`, aborted via `signal` (AC-A3). */
  async function search(q: string, signal: AbortSignal): Promise<void> {
    try {
      const next = await listTasks({ ...EMPTY_FILTER, q }, undefined, signal);
      setResults(next);
      setSearchError(null);
    } catch (cause) {
      // An aborted request is a superseded one, not a real failure.
      if (signal.aborted) return;
      const message = handleFailure(cause);
      if (message !== null) setSearchError(message);
    }
  }

  /** Re-issues the current debounced search — the sheet's own post-mutation refresh, never a full list fetch. */
  function rerunSearch(): Promise<void> {
    if (!shouldSearch(debounced)) return Promise.resolve();
    return search(debounced, new AbortController().signal);
  }

  async function refreshReminders(): Promise<void> {
    try {
      setReminders(await listReminders());
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setReminders(null);
    }
  }

  // Debounce: the raw `query` lands in `debounced` 300 ms after the owner
  // stops typing — never one request per keystroke (AC-A3).
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // The actual request effect, keyed on the debounced value. Below the
  // minimum length (AC-A2) it clears any stale results/error and fires no
  // request at all — a newer keystroke's cleanup aborts whatever request the
  // previous debounced value was still waiting on (AC-A3).
  useEffect(() => {
    if (!shouldSearch(debounced)) {
      setResults(null);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    void search(debounced, controller.signal);
    return () => controller.abort();
  }, [debounced]);

  useEffect(() => {
    void refreshReminders();
  }, []);

  useEffect(() => {
    document.title = "Pesquisar · Praesto Sum";
  }, []);

  useEffect(() => {
    // Gated on the sheet: an open TaskSheet is a native <dialog> with its own
    // Escape/back-gesture handling, which this listener must never double-fire
    // underneath.
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      if (sheet.taskId !== null) return;
      back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back, sheet.taskId]);

  async function runSheet(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      setSheetError(null);
      await rerunSearch();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setSheetError(message);
    } finally {
      setBusy(false);
    }
  }

  async function runTaskReminder(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      setSheetError(null);
      await refreshReminders();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setSheetError(message);
    } finally {
      setBusy(false);
    }
  }

  async function complete(id: string): Promise<void> {
    try {
      await completeTask(id);
      await rerunSearch();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setSearchError(message);
    }
  }

  async function reopen(id: string): Promise<void> {
    try {
      await reopenTask(id);
      await rerunSearch();
    } catch (cause) {
      const message = handleFailure(cause);
      if (message !== null) setSearchError(message);
    }
  }

  function commitTitle(id: string, newTitle: string): void {
    setEditingId(null);
    void (async () => {
      try {
        await updateTask(id, { title: newTitle });
        await rerunSearch();
      } catch (cause) {
        const message = handleFailure(cause);
        if (message !== null) setSearchError(message);
      }
    })();
  }

  function openSheet(task: TaskDto): void {
    setSheetError(null);
    dispatchSheet({ type: "open", task });
  }

  function saveSheet(): void {
    if (sheetTask === null) return;
    const changes = buildTaskPatch(sheetTask, currentDraft(sheet, sheetTask));
    if (Object.keys(changes).length === 0) {
      dispatchSheet({ type: "close" });
      return;
    }
    void runSheet(async () => {
      await updateTask(sheetTask.id, changes);
      dispatchSheet({ type: "saved", taskId: sheetTask.id });
    });
  }

  function deleteSheetTask(): void {
    if (sheet.taskId === null) return;
    const id = sheet.taskId;
    void runSheet(async () => {
      await deleteTask(id);
      dispatchSheet({ type: "deleted", taskId: id });
    });
  }

  /** Byte-for-byte the switch `TodayScreen` uses (AC-A4) — one shared row shape for any Task, wherever it is found. */
  function renderDayItems(rows: DayItem[]): ReactNode {
    return (
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((item) => {
          switch (item.source) {
            case "task": {
              const task = item.task;
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  busy={busy}
                  editing={editingId === task.id}
                  onToggle={(next) => void (next ? complete(task.id) : reopen(task.id))}
                  onOpen={() => openSheet(task)}
                  onEdit={() => setEditingId(task.id)}
                  onCommitTitle={(newTitle) => commitTitle(task.id, newTitle)}
                  onCancelEdit={() => setEditingId(null)}
                />
              );
            }
            case "google":
              // Unreachable: this screen feeds `collectDayItems` a single Task
              // source, exactly like `TodayScreen`.
              throw new Error(`Unhandled day item source: ${item.source}`);
            default:
              return assertNeverDaySource(item);
          }
        })}
      </ul>
    );
  }

  return (
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_1fr] overflow-clip bg-bg"
    >
      <header className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
          <ArrowLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        <input
          ref={inputRef}
          type="text"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar tarefas…"
          enterKeyHint="search"
          aria-label="Pesquisar tarefas"
          className="min-h-12 flex-1 rounded-control border border-line-strong bg-surface-1 px-4 font-text text-t3 text-ink shadow-field"
        />
      </header>

      {/* Mandatory on every screen (guidelines §8) — search cannot even read
          without the network, unlike *Hoje*'s cached list, so the copy names
          that condition rather than reusing *Hoje*'s "não para salvar" text. */}
      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Não é possível pesquisar sem conexão." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-2">
        {/* AC-A7 / ADR-0003: search has no offline copy. While offline this
            results region renders nothing — `results` is left untouched in
            state (so the same list reappears the instant the network
            returns, with no extra fetch), but a list fetched before the
            drop is never rendered here as current. The header above (back
            button, field) stays visible and usable regardless. */}
        {connectivity !== "online" ? null : !shouldSearch(debounced) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p className="m-0 font-text text-t2 text-muted">
              Digite pelo menos {SEARCH_MIN_QUERY_LENGTH} letras para buscar.
            </p>
          </div>
        ) : results === null && searchError === null ? (
          <Skeleton />
        ) : searchError !== null ? (
          <>
            <p role="alert" className="font-text text-t2 text-overdue">
              {searchError}
            </p>
            {/* prettier-ignore */}
            <Button variant="secondary" onClick={() => void rerunSearch()}>Tentar de novo</Button>
          </>
        ) : (results ?? []).length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p className="m-0 font-display text-t4 font-extrabold text-ink">
              Nenhuma tarefa encontrada para “{debounced}”.
            </p>
          </div>
        ) : (
          <>
            <TaskGroup name="Atrasadas" count={groups.overdue.length}>
              {renderDayItems(groups.overdue)}
            </TaskGroup>
            <TaskGroup name="Hoje" count={groups.today.length}>
              {renderDayItems(groups.today)}
            </TaskGroup>
            <TaskGroup name="Próximas" count={groups.upcoming.length}>
              {renderDayItems(groups.upcoming)}
            </TaskGroup>
            <TaskGroup name="Sem data" count={groups.undated.length}>
              {renderDayItems(groups.undated)}
            </TaskGroup>
            <TaskGroup name="Concluídas" count={groups.closed.length}>
              {renderDayItems(groups.closed)}
            </TaskGroup>
          </>
        )}
      </main>

      <TaskSheet
        task={sheetTask}
        open={sheet.taskId !== null}
        view={sheet.view}
        draft={sheetTask === null ? null : currentDraft(sheet, sheetTask)}
        busy={busy}
        error={sheetError}
        toastSlot={null}
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
        reminder={sheetTaskReminder}
        reminderDraft={taskReminderDraft}
        onOpenReminder={() => {
          setTaskReminderDraft(draftFromReminder(sheetTaskReminder));
          dispatchSheet({ type: "open-reminder" });
        }}
        onCloseReminder={() => {
          setTaskReminderDraft(null);
          dispatchSheet({ type: "close-reminder" });
        }}
        onReminderDraftChange={(changes) =>
          setTaskReminderDraft((prev) => (prev === null ? prev : { ...prev, ...changes }))
        }
        onReminderSave={() => {
          if (sheetTask === null || taskReminderDraft === null) return;
          void runTaskReminder(async () => {
            if (sheetTaskReminder === null) {
              await createReminder(buildCreateReminderInput(taskReminderDraft, sheetTask.id));
            } else {
              await updateReminder(
                sheetTaskReminder.id,
                buildUpdateReminderInput(sheetTaskReminder, taskReminderDraft),
              );
            }
            setTaskReminderDraft(null);
            dispatchSheet({ type: "close-reminder" });
          });
        }}
        onReminderDeleteRequest={() => dispatchSheet({ type: "request-delete-reminder" })}
        onReminderDeleteCancel={() => dispatchSheet({ type: "cancel-delete-reminder" })}
        onReminderDeleteConfirm={() => {
          if (sheetTaskReminder === null) return;
          void runTaskReminder(async () => {
            await deleteReminder(sheetTaskReminder.id);
            dispatchSheet({ type: "close-reminder" });
          });
        }}
      />
    </div>
  );
}
