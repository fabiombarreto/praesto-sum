// The shell grid of the layout standard §2/§4: header / banner / list /
// toast / deck, `100dvh` with `overflow: clip`, the list as its own scroll
// container. Owns the screen state: the Task list, one optimistic status
// change at a time with rollback, connectivity, refetch, the *Concluídas*
// collapse, and the `TaskSheet` state machine (`src/shared/task-sheet.ts`) —
// which Task is open, which view it shows, and the per-Task drafts kept for
// the session.

import { useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { TaskDto } from "../../shared/api";
import { canWrite } from "../../shared/connectivity";
import { todayIn } from "../../shared/dates";
import { googleFailureMessage } from "../../shared/google-failure-copy";
import { classifyRequestFailure } from "../../shared/request-failure";
import type { ShareTarget } from "../../shared/share-target";
import { buildTaskPatch } from "../../shared/task-edit";
import {
  activeCount,
  EMPTY_FILTER,
  toggleChip,
  type QuickChip,
  type TaskFilter,
} from "../../shared/task-filter";
import type { CalendarEventDto } from "../../shared/api";
import { collectDayItems } from "../../shared/day-groups";
import { assertNeverDaySource, dayItemFromTask, type DayItem } from "../../shared/day-item";
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
import { FilterChips } from "./FilterChips";
import { FilterSheet } from "./FilterSheet";
import { TaskGroup } from "./TaskGroup";
import { TaskRow } from "./TaskRow";
import { TaskSheet } from "./TaskSheet";
import { TodayHeader } from "./TodayHeader";
import { CalendarX } from "lucide-react";
import { agendaForToday } from "../../shared/agenda";
import { fetchGoogleEvents } from "../api";
import { EventRow } from "./EventRow";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { Toast } from "./ui/Toast";

const OVERDUE_COLLAPSED_KEY = "praesto.today.collapsed.overdue";
const UPCOMING_COLLAPSED_KEY = "praesto.today.collapsed.upcoming";
const UNDATED_COLLAPSED_KEY = "praesto.today.collapsed.undated";
// The `collapsed.<group>` shape, not the legacy `doneCollapsed` one below —
// a new key has no history to preserve, so it starts on the current scheme.
const AGENDA_COLLAPSED_KEY = "praesto.today.collapsed.agenda";
// Kept exactly as shipped — renaming this literal would migrate (silently
// lose) the owner's existing *Concluídas* preference.
const CLOSED_COLLAPSED_KEY = "praesto.today.doneCollapsed";

/** Guarded like the legacy token storage (`src/app/token-storage.ts`): a denial or a missing API degrades to `fallback`, never throws. */
function readCollapsed(key: string, fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "1";
  } catch {
    return fallback;
  }
}

function writeCollapsed(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Best-effort — a denial or a missing API must never break the toggle.
  }
}

/**
 * What the agenda region knows about itself.
 *
 * Four states, and they must never render the same pixels. `TaskGroup` returns
 * `null` at zero rows, so a failed fetch would otherwise be indistinguishable
 * from a genuinely free day — which is the one outcome the unit's success
 * metric sets to zero.
 */
type AgendaState =
  | { kind: "loading" }
  | { kind: "ready" }
  /** Some calendars answered, at least one did not. A short day, not a free one. */
  | { kind: "partial"; failed: number }
  /** Nothing arrived. `reason` separates "connect" from "reconnect" from "try later". */
  | { kind: "failed"; reason: string | null };

/**
 * The agenda's own copy — the strings only *Hoje* says. Every one is an owner
 * approval (2026-08-28), not an invention.
 *
 * The three failure strings are NOT here: the settings screen says them too,
 * so both the words and the reason that selects them live in
 * `src/shared/google-failure-copy.ts`, where one edit reaches both surfaces
 * and a test can reach the mapping (AC-A7).
 */
const AGENDA = {
  name: "Agenda",
  empty: "Nada na agenda hoje.",
  partial: (n: number) =>
    n === 1
      ? "Um calendário não respondeu — a agenda pode estar incompleta."
      : `${n} calendários não responderam — a agenda pode estar incompleta.`,
} as const;

export function TodayScreen({
  onUnauthorized,
  initialShare,
  onOpenSettings,
}: {
  onUnauthorized: () => void;
  initialShare: ShareTarget | null;
  /** Threaded from `App.tsx` (plan Task 8) so `TodayHeader`'s settings icon button (Task 7) can navigate. */
  onOpenSettings: () => void;
}) {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Google lives in its OWN atoms, never folded into `tasks`, `loadError` or
  // `busy`. Three things depend on that separation: a failed events fetch must
  // not blank the Task list, a task PATCH's optimistic rollback (which
  // captures `previous = tasks`) must not discard events, and the global
  // `busy` gate must never be held by a Google request.
  const [events, setEvents] = useState<CalendarEventDto[] | null>(null);
  const [eventsState, setEventsState] = useState<AgendaState>({ kind: "loading" });
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialShare?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [sheet, dispatchSheet] = useReducer(reduceTaskSheet, INITIAL_TASK_SHEET_STATE);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overdueCollapsed, setOverdueCollapsed] = useState(() =>
    readCollapsed(OVERDUE_COLLAPSED_KEY, false),
  );
  const [upcomingCollapsed, setUpcomingCollapsed] = useState(() =>
    readCollapsed(UPCOMING_COLLAPSED_KEY, true),
  );
  const [undatedCollapsed, setUndatedCollapsed] = useState(() =>
    readCollapsed(UNDATED_COLLAPSED_KEY, true),
  );
  const [agendaCollapsed, setAgendaCollapsed] = useState(() =>
    readCollapsed(AGENDA_COLLAPSED_KEY, true),
  );
  const [doneCollapsed, setDoneCollapsed] = useState(() =>
    readCollapsed(CLOSED_COLLAPSED_KEY, false),
  );
  // Seeded from the constant and never from storage, and never written to
  // storage — the deliberate asymmetry against the collapse state above,
  // which layout standard §2.3 requires: a narrowing filter must never
  // survive a cold start.
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);

  const today = todayIn(new Date());
  const now = new Date();

  const { state: connectivity, report } = useConnectivity({
    onOnline: () => {
      void refresh();
      void refreshEvents();
    },
  });
  const toast = useToast();
  const writable = canWrite(connectivity);
  // ONE source today, a list of sources by construction: unit 4 phase 3 adds
  // the Google stream here and nothing below this line has to change.
  const groups = collectDayItems(
    [{ id: "tasks", items: (tasks ?? []).map(dayItemFromTask) }],
    today,
  );
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

  /**
   * Fetches the agenda.
   *
   * It deliberately does NOT call `report(...)`. `useConnectivity`'s reducer is
   * global: `server-unreachable` disables capture and completion app-wide, so
   * routing a Google failure through it would let Google being down stop the
   * owner writing his own Tasks — the opposite of AC-11. The reverse matters
   * too: `request-succeeded` would clear the offline banner while
   * `/api/tasks` is still failing.
   */
  async function refreshEvents(): Promise<void> {
    try {
      const payload = await fetchGoogleEvents();
      setEvents(payload.events);
      setEventsState(
        payload.failedCalendars.length > 0
          ? { kind: "partial", failed: payload.failedCalendars.length }
          : { kind: "ready" },
      );
    } catch (cause) {
      // A 401 is the app's token, not Google's — route it like any other.
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setEvents(null);
      setEventsState({ kind: "failed", reason: cause instanceof ApiError ? cause.reason : null });
    }
  }

  async function refresh(): Promise<void> {
    try {
      const next = await listTasks(filter);
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

  function toggleAgendaCollapsed(): void {
    setAgendaCollapsed((current) => {
      writeCollapsed(AGENDA_COLLAPSED_KEY, !current);

      return !current;
    });
  }

  function toggleOverdueCollapsed(): void {
    setOverdueCollapsed((current) => {
      const next = !current;
      writeCollapsed(OVERDUE_COLLAPSED_KEY, next);
      return next;
    });
  }

  function toggleUpcomingCollapsed(): void {
    setUpcomingCollapsed((current) => {
      const next = !current;
      writeCollapsed(UPCOMING_COLLAPSED_KEY, next);
      return next;
    });
  }

  function toggleUndatedCollapsed(): void {
    setUndatedCollapsed((current) => {
      const next = !current;
      writeCollapsed(UNDATED_COLLAPSED_KEY, next);
      return next;
    });
  }

  function toggleDoneCollapsed(): void {
    setDoneCollapsed((current) => {
      const next = !current;
      writeCollapsed(CLOSED_COLLAPSED_KEY, next);
      return next;
    });
  }

  // The chip row's own handler: flips exactly `chip`'s own dimension via
  // `toggleChip` (`src/shared/task-filter.ts`) — the functional update reads
  // the latest filter regardless of render timing, so this never races the
  // `[filter]` effect below that re-reads on every change.
  function handleToggleChip(chip: QuickChip): void {
    setFilter((current) => toggleChip(current, chip, today));
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
    // Runs on mount AND on every filter change (the chip row, the sheet and
    // *Limpar filtros* all only call `setFilter` — this is the one place
    // that turns a new filter into the read, so a chip tap issues exactly
    // one `GET /api/tasks`). Every OTHER refetch is triggered explicitly (a
    // mutation, `visibilitychange`, or reconnecting).
    void refresh();
  }, [filter]);

  useEffect(() => {
    // Mount only. Deliberately NOT keyed on `filter`: the chips and the sheet
    // narrow Tasks, and the owner's 2026-08-28 decision keeps them off the
    // agenda — refetching Google on a chip tap would spend a request to
    // produce the identical list.
    void refreshEvents();
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState !== "visible") return;
      void refresh();
      // The agenda goes stale on wall-clock time rather than on anything the
      // owner did, so coming back to the app is exactly when it is worth
      // re-reading (guidelines §12.4 — there is no manual refresh gesture).
      void refreshEvents();
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

  /**
   * The `<ul>` shared by every group — five callers, one shape. Since unit 4
   * phase 1 it takes day items rather than Tasks and dispatches on their
   * `source`; the `task` branch is byte-for-byte what the screen rendered
   * before, and the `google` branch is unreachable here because this screen
   * feeds `collectDayItems` a single Task source. It exists so that adding a
   * source — unit 14's local Events next — is a compile error at `default`
   * until this switch handles it.
   */
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
                  busy={busy || !writable}
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
              // Unreachable: the agenda renders Google events in its own group
              // (see `agenda` below), and this screen feeds `collectDayItems` a
              // single Task source. Loud rather than a blank row if that ever
              // changes. NOT `assertNeverDaySource` — `item` is narrowed to the
              // google variant here, not `never`, and the cast that used to
              // bridge that gap silenced the compiler in this branch. The
              // exhaustiveness guarantee lives in `default`, where the narrowing
              // is genuinely `never`.
              throw new Error(`Unhandled day item source: ${item.source}`);
            default:
              return assertNeverDaySource(item);
          }
        })}
      </ul>
    );
  }

  const agenda = events === null ? [] : agendaForToday(events, today);

  /**
   * The agenda region: the group when there is something to show, and an
   * explicit line when there is not.
   *
   * The line is NOT optional. `TaskGroup` returns `null` at zero rows, so
   * without it a failed fetch renders as nothing at all — pixel-identical to a
   * genuinely free day, which the PRD's success metrics set to zero
   * occurrences. It is also not a toast: `src/shared/toast.ts` auto-dismisses
   * an actionless toast after 4 s, and guidelines §10 (2.2.1) forbids putting
   * a time limit on a state the owner has to read.
   */
  const agendaNotice = ((): string | null => {
    switch (eventsState.kind) {
      case "loading":
        return null;
      case "partial":
        return AGENDA.partial(eventsState.failed);
      case "failed":
        return googleFailureMessage(eventsState.reason);
      case "ready":
        return agenda.length === 0 ? AGENDA.empty : null;
    }
  })();

  const agendaRegion =
    agenda.length === 0 && agendaNotice === null ? null : (
      <section aria-label={AGENDA.name}>
        {agenda.length > 0 && (
          <TaskGroup
            name={AGENDA.name}
            count={agenda.length}
            collapsed={agendaCollapsed}
            onToggle={toggleAgendaCollapsed}
          >
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {agenda.map((event) => (
                // Prefixed: ids are unique per SOURCE, not across sources.
                <EventRow key={`google-${event.id}`} event={event} />
              ))}
            </ul>
          </TaskGroup>
        )}
        {agendaNotice !== null && (
          <p role="status" className="mt-2 font-text text-t1 text-muted">
            {agendaNotice}
          </p>
        )}
      </section>
    );

  return (
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_auto_1fr_auto_auto] overflow-clip bg-bg"
    >
      <TodayHeader
        now={now}
        remaining={
          // Tasks only. `groups` will carry events the moment a second source
          // is fed to `collectDayItems`, and *N restantes* means "things you
          // still have to do" — an event is not one of them.
          groups.today.length +
          groups.overdue.length +
          groups.upcoming.length +
          groups.undated.length
        }
        activeFilterCount={activeCount(filter)}
        onOpenFilters={() => setFiltersOpen(true)}
        onOpenSettings={onOpenSettings}
      />

      {/* One slot, two conditions, with a stated precedence: being offline
          explains the Google failure too, so showing both would say the same
          thing twice (guidelines §1, principle 4). */}
      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : eventsState.kind === "failed" ? (
        <Banner
          icon={CalendarX}
          lead="Agenda indisponível."
          body="Suas tarefas estão aqui; os compromissos do Google não carregaram."
        />
      ) : (
        <div />
      )}

      <FilterChips filter={filter} today={today} onToggleChip={handleToggleChip} />

      <main className="flex flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-2">
        {/* The agenda comes FIRST in the DOM — §10 1.3.2 makes DOM order the
            reading order, so it is never CSS-reordered above *Atrasadas*. It
            renders independently of `tasks`: a failed Task load must not hide
            the agenda, and a zero-Task day must not either. */}
        {agendaRegion}

        {tasks === null && loadError === null && <Skeleton slow={slow} />}

        {tasks === null && loadError !== null && (
          <>
            {/* Scoped to the TASK list. The agenda is rendered above this
                branch and survives it — a failed `GET /api/tasks` says nothing
                about whether the owner's commitments loaded. */}
            <p role="alert" className="font-text text-t2 text-overdue">
              {loadError}
            </p>
            {/* prettier-ignore */}
            <Button variant="secondary" onClick={() => void refresh()}>Tentar de novo</Button>
          </>
        )}

        {tasks !== null && tasks.length === 0 && (
          <EmptyState
            onCapture={() => captureRef.current?.focus()}
            filtered={activeCount(filter) > 0}
            onClearFilters={() => setFilter(EMPTY_FILTER)}
          />
        )}

        {tasks !== null && tasks.length > 0 && (
          <>
            <TaskGroup
              name="Atrasadas"
              count={groups.overdue.length}
              collapsed={overdueCollapsed}
              onToggle={toggleOverdueCollapsed}
            >
              {renderDayItems(groups.overdue)}
            </TaskGroup>

            {/* Never collapsible (layout standard §2.5): no `onToggle`, so `TaskGroup` renders no control at all. */}
            <TaskGroup name="Hoje" count={groups.today.length}>
              {renderDayItems(groups.today)}
            </TaskGroup>

            <TaskGroup
              name="Próximas"
              count={groups.upcoming.length}
              collapsed={upcomingCollapsed}
              onToggle={toggleUpcomingCollapsed}
            >
              {renderDayItems(groups.upcoming)}
            </TaskGroup>

            <TaskGroup
              name="Sem data"
              count={groups.undated.length}
              collapsed={undatedCollapsed}
              onToggle={toggleUndatedCollapsed}
            >
              {renderDayItems(groups.undated)}
            </TaskGroup>

            <TaskGroup
              name="Concluídas"
              count={groups.closed.length}
              collapsed={doneCollapsed}
              onToggle={toggleDoneCollapsed}
            >
              {renderDayItems(groups.closed)}
            </TaskGroup>
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

      {/* Never stack sheets (layout standard §3): gated on the same
          condition the toast slot above already uses. */}
      <FilterSheet
        open={filtersOpen && sheet.taskId === null}
        onOpenChange={setFiltersOpen}
        filter={filter}
        onChange={setFilter}
      />
    </div>
  );
}
