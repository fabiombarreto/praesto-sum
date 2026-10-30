// The `/day/AAAA-MM-DD` route (unit 14 `events-and-day-view` phase 3, PRD AC-24
// and AC-25): any one date, with that day's commitments from Praesto and from
// Google together and the open Tasks dated that day. It copies the shell of
// `AdherenceScreen` (100dvh grid, header with *Voltar*, `Esc` -> `back()`, the
// always-render-a-slot banner row) and adds a stepper row.
//
// Every DECISION lives in `src/shared` and is tested there (`day-view.ts`,
// `day-range.ts`, `agenda.ts`); this file is the glue that fetches and renders.
//
// **Three sources, three isolated atoms.** The owner's commitments, the open
// Tasks of the day and Google's events are each fetched on their own and none
// is folded into another or reported to `useConnectivity`'s reducer: Google being
// down must not disable anything, and a failed commitments request must not
// blank the Tasks. Nothing is ever "a free day" by default — `decideAgendaNotice`
// speaks the empty text only when Google answered AND the other two did.
//
// **The screen stays mounted while the owner steps** (`App.tsx` gives it no
// `key`), so the load effect is keyed on `day` and every request carries a
// per-source counter plus the day it was issued for: a slow response for
// yesterday can never paint over today.
//
// **The Compromisso sheet** (phase 4) opens from *Novo compromisso*, the screen's one
// primary action, and by tapping a local row; `useEventSheet` holds it and refetches
// the commitments through `loadLocal` after every accepted write. A sheet still open
// when the date changes (a history pop) is closed.

import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { decideAgendaNotice, type AgendaState } from "../../shared/agenda";
import type { CalendarEventDto, EventDto, TaskDto } from "../../shared/api";
import { dayRouteOf, taskRouteOf, type AppRoute } from "../../shared/app-route";
import { canWrite } from "../../shared/connectivity";
import { todayIn } from "../../shared/dates";
import {
  assertNeverDaySource,
  dayItemFromEvent,
  dayItemFromLocalEvent,
  dayItemFromTask,
  type DayItem,
} from "../../shared/day-item";
import { itemsInRange } from "../../shared/day-range";
import {
  adjacentDays,
  DAY_VIEW_EMPTY,
  formatDayHeading,
  formatDayItemTime,
  showTodayControl,
  splitDayItems,
} from "../../shared/day-view";
import { NEW_EVENT_LABEL } from "../../shared/event-view";
import { lifeAreaNameOf } from "../../shared/life-area-assign";
import { classifyRequestFailure } from "../../shared/request-failure";
import { EMPTY_FILTER } from "../../shared/task-filter";
import {
  ApiError,
  completeTask,
  fetchGoogleEvents,
  listEvents,
  listTasks,
  reopenTask,
  updateTask,
} from "../api";
import { useConnectivity } from "../hooks/useConnectivity";
import { useEventSheet } from "../hooks/useEventSheet";
import { useLifeAreas } from "../hooks/useLifeAreas";
import { CompromissoSheet } from "./CompromissoSheet";
import { EventRow } from "./EventRow";
import { LocalEventRow } from "./LocalEventRow";
import { TaskRow } from "./TaskRow";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

/**
 * What one source knows: the last good answer and the failure of the newest
 * request, kept apart. Not loaded yet is `data === null && error === null`; the
 * source has answered successfully only when `data !== null && error === null`.
 */
interface SourceAtom<T> {
  data: T | null;
  error: string | null;
}

function emptyAtom<T>(): SourceAtom<T> {
  return { data: null, error: null };
}

function answered<T>(atom: SourceAtom<T>): boolean {
  return atom.data !== null && atom.error === null;
}

export function DayScreen({
  day,
  onUnauthorized,
  back,
  navigate,
}: {
  /** The validated local day to show, `YYYY-MM-DD` (from `dayFromRoute`). */
  day: string;
  onUnauthorized: () => void;
  back: () => void;
  navigate: (route: AppRoute) => void;
}) {
  const { state: connectivity } = useConnectivity({ onOnline: () => reloadAllRef.current() });
  const writable = canWrite(connectivity);
  const { lifeAreas } = useLifeAreas(onUnauthorized);

  const [local, setLocal] = useState<SourceAtom<EventDto[]>>(emptyAtom);
  const [taskAtom, setTaskAtom] = useState<SourceAtom<TaskDto[]>>(emptyAtom);
  // Google keeps the shape *Hoje* gives it (`AgendaState` beside the events), so
  // the unit-4 notices are reused rather than reinvented.
  const [googleEvents, setGoogleEvents] = useState<CalendarEventDto[] | null>(null);
  const [google, setGoogle] = useState<AgendaState>({ kind: "loading" });
  // A failed Task write is shown inline and persistently, never as a toast.
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Stepping to another date resets all three atoms IN THE RENDER that first sees
  // the new `day` (React's documented "adjust state when a prop changes" pattern),
  // not in an effect: an effect runs after paint, so the new heading would first
  // be painted over the previous date's answered state — a flash of *Nada neste
  // dia.* for a day whose data has not been asked for yet.
  const [shownDay, setShownDay] = useState(day);
  if (shownDay !== day) {
    setShownDay(day);
    setLocal({ data: null, error: null });
    setTaskAtom({ data: null, error: null });
    setGoogleEvents(null);
    setGoogle({ kind: "loading" });
    setActionError(null);
    setEditingId(null);
  }

  // The newest request per source, and the day the screen is on RIGHT NOW. A
  // response counts only when it is the newest of its source and was issued for
  // the day still on screen.
  const requests = useRef({ local: 0, tasks: 0, google: 0 });
  const dayRef = useRef(day);
  dayRef.current = day;

  function isCurrent(source: keyof typeof requests.current, mine: number, forDay: string): boolean {
    return requests.current[source] === mine && dayRef.current === forDay;
  }

  async function loadLocal(forDay: string): Promise<void> {
    const mine = ++requests.current.local;
    try {
      const events = await listEvents({ from: forDay, to: forDay });
      if (isCurrent("local", mine, forDay)) setLocal({ data: events, error: null });
    } catch (cause) {
      if (!isCurrent("local", mine, forDay)) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setLocal((previous) => ({
        data: previous.data,
        error: classifyRequestFailure(cause).message,
      }));
    }
  }

  // The Compromisso sheet. Its `onChanged` is the stale-guarded commitments loader
  // above, so a created, edited or deleted commitment shows on the day without a
  // reload; Task writes keep their own path (`runWrite`).
  const eventSheet = useEventSheet({
    onUnauthorized,
    writable,
    onChanged: () => loadLocal(dayRef.current),
  });

  async function loadTasks(forDay: string): Promise<void> {
    const mine = ++requests.current.tasks;
    try {
      // `status=open&from=D&to=D` selects the open Tasks whose
      // `coalesce(deadline, scheduled_date)` is D, so no Task endpoint is added
      // and an undated Task is never in range.
      const tasks = await listTasks({ ...EMPTY_FILTER, status: "open", from: forDay, to: forDay });
      if (isCurrent("tasks", mine, forDay)) setTaskAtom({ data: tasks, error: null });
    } catch (cause) {
      if (!isCurrent("tasks", mine, forDay)) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setTaskAtom((previous) => ({
        data: previous.data,
        error: classifyRequestFailure(cause).message,
      }));
    }
  }

  async function loadGoogle(forDay: string): Promise<void> {
    const mine = ++requests.current.google;
    try {
      const payload = await fetchGoogleEvents({ from: forDay, to: forDay });
      if (!isCurrent("google", mine, forDay)) return;
      setGoogleEvents(payload.events);
      setGoogle(
        payload.failedCalendars.length > 0
          ? { kind: "partial", failed: payload.failedCalendars.length }
          : { kind: "ready" },
      );
    } catch (cause) {
      if (!isCurrent("google", mine, forDay)) return;
      // A 401 is the app's token, not Google's — route it like any other.
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setGoogleEvents(null);
      setGoogle({ kind: "failed", reason: cause instanceof ApiError ? cause.reason : null });
    }
  }

  function reloadAll(): void {
    const current = dayRef.current;
    void loadLocal(current);
    void loadTasks(current);
    void loadGoogle(current);
  }

  // The registrations below are made once, so they read the latest render's
  // function through a ref — the idiom `useConnectivity` uses for `onOnline`.
  const reloadAllRef = useRef(reloadAll);
  reloadAllRef.current = reloadAll;

  // Keyed on `day`: stepping to another date re-issues all three requests (the
  // atoms were reset above); the counters drop whatever the previous day still
  // has in flight.
  useEffect(() => {
    reloadAllRef.current();
  }, [day]);

  // Re-read on returning to the foreground (guidelines §12.4: there is no manual
  // refresh gesture). Reconnecting is the `onOnline` above.
  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") reloadAllRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      // The inline title editor claims `Esc` for itself (it cancels the edit and
      // calls `preventDefault`), so that keystroke must not also leave the day.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // An open Compromisso sheet is a native <dialog> that closes itself on Escape:
      // the keystroke that closes it must not also leave the day (the gating
      // `SearchScreen` already has for its Task sheet).
      if (eventSheet.isOpen) return;
      back();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back, eventSheet.isOpen]);

  // A sheet still open when the date changes (a history pop, the desktop Back button)
  // is closed; a new-commitment draft is kept under its own day and is restored if the
  // owner returns to it.
  const closeEventSheet = eventSheet.close;
  useEffect(() => {
    closeEventSheet();
  }, [day, closeEventSheet]);

  const today = todayIn(new Date());
  const heading = formatDayHeading(day, today);

  useEffect(() => {
    document.title = `${heading} · Praesto Sum`;
  }, [heading]);

  // The server-first path for Task writes (the pattern of `SearchScreen`): wait
  // for the server, then reload the day's Tasks. A failure is inline and
  // persistent.
  async function runWrite(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      setActionError(null);
      await loadTasks(dayRef.current);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      setActionError(classifyRequestFailure(cause).message);
    } finally {
      setBusy(false);
    }
  }

  function commitTitle(id: string, newTitle: string): void {
    setEditingId(null);
    void runWrite(() => updateTask(id, { title: newTitle }));
  }

  /** Retries only the sources that failed — one button, however many did. */
  function retryFailed(): void {
    const current = dayRef.current;
    if (local.error !== null) void loadLocal(current);
    if (taskAtom.error !== null) void loadTasks(current);
    if (google.kind === "failed") void loadGoogle(current);
  }

  // One range function for the day, exactly as *Hoje*'s Agenda uses it.
  const entries = itemsInRange(
    [
      { id: "local", items: (local.data ?? []).map(dayItemFromLocalEvent) },
      { id: "google", items: (googleEvents ?? []).map(dayItemFromEvent) },
      { id: "tasks", items: (taskAtom.data ?? []).map(dayItemFromTask) },
    ],
    { from: day, to: day },
  );
  const dayItems = entries[0]?.items ?? [];
  const sections = splitDayItems(dayItems);

  const notice = decideAgendaNotice({
    google,
    othersReady: answered(local) && answered(taskAtom),
    rowCount: dayItems.length,
    emptyText: DAY_VIEW_EMPTY,
  });

  // The same failure sentence for two sources is said once.
  const failures = [...new Set([local.error, taskAtom.error].filter((m) => m !== null))];
  const loading =
    (local.data === null && local.error === null) ||
    (taskAtom.data === null && taskAtom.error === null);

  const { previous, next } = adjacentDays(day);

  function renderEventRow(item: DayItem) {
    // Prefixed: ids are unique per SOURCE, not across sources.
    const key = `${item.source}-${item.id}`;
    switch (item.source) {
      case "local":
        return (
          <LocalEventRow
            key={key}
            event={item.event}
            timeLabel={formatDayItemTime(item, day, "range")}
            wideTime
            onOpen={() => eventSheet.openEvent(item.event)}
          />
        );
      case "google":
        return (
          <EventRow
            key={key}
            event={item.payload}
            timeLabel={formatDayItemTime(item, day, "range")}
            wideTime
          />
        );
      case "task":
        // Unreachable: `splitDayItems` files a Task under `tasks` and never
        // under an event section. Loud rather than a blank row.
        throw new Error(`Unhandled day item source: ${item.source}`);
      default:
        return assertNeverDaySource(item);
    }
  }

  const openTasks = sections.tasks.flatMap((item) => (item.source === "task" ? [item.task] : []));

  return (
    <div
      data-shell
      className="mx-auto grid h-dvh w-full max-w-[640px] grid-rows-[auto_auto_auto_1fr] overflow-clip bg-bg"
    >
      <header className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Button type="button" variant="icon" aria-label="Voltar" onClick={back}>
          <ArrowLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        <h1
          aria-live="polite"
          className="m-0 min-w-0 flex-1 font-text text-t4 font-bold break-words text-ink"
        >
          {heading}
        </h1>
      </header>

      <nav
        aria-label="Navegar entre dias"
        className="flex items-center justify-between gap-2 px-4 pb-2"
      >
        <Button
          type="button"
          variant="icon"
          aria-label="Dia anterior"
          onClick={() => navigate(dayRouteOf(previous))}
        >
          <ChevronLeft className="size-[22px]" aria-hidden="true" />
        </Button>
        {showTodayControl(day, today) && (
          <Button type="button" variant="ghost" onClick={() => navigate("today")}>
            Hoje
          </Button>
        )}
        <Button
          type="button"
          variant="icon"
          aria-label="Próximo dia"
          onClick={() => navigate(dayRouteOf(next))}
        >
          <ChevronRight className="size-[22px]" aria-hidden="true" />
        </Button>
      </nav>

      {connectivity !== "online" ? (
        <Banner lead="Sem conexão." body="Dá para ler, mas não para salvar por enquanto." />
      ) : (
        <div />
      )}

      <main className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-2">
        {/* The screen's one primary action (guidelines §3.1). */}
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={!writable}
          onClick={() => eventSheet.openNew(day)}
        >
          <Plus className="size-5" aria-hidden="true" />
          {NEW_EVENT_LABEL}
        </Button>

        {failures.length > 0 && (
          <div className="flex flex-col items-start gap-2">
            {failures.map((message) => (
              <p key={message} role="alert" className="m-0 font-text text-t2 text-overdue">
                {message}
              </p>
            ))}
            <Button type="button" variant="secondary" onClick={retryFailed}>
              Tentar de novo
            </Button>
          </div>
        )}

        {actionError !== null && (
          <p role="alert" className="m-0 font-text text-t2 text-overdue">
            {actionError}
          </p>
        )}

        {notice !== null && (
          <p role="status" className="m-0 font-text text-t2 text-muted">
            {notice}
          </p>
        )}

        {loading && <Skeleton />}

        {sections.allDay.length > 0 && (
          <section aria-label="Dia inteiro">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {sections.allDay.map(renderEventRow)}
            </ul>
          </section>
        )}

        {sections.timed.length > 0 && (
          <section aria-label="Compromissos">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {sections.timed.map(renderEventRow)}
            </ul>
          </section>
        )}

        {openTasks.length > 0 && (
          <section aria-label="Tarefas">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {openTasks.map((task) => (
                <TaskRow
                  key={`task-${task.id}`}
                  task={task}
                  today={today}
                  busy={busy || !writable}
                  editing={editingId === task.id}
                  areaName={lifeAreaNameOf(lifeAreas, task.lifeAreaId)}
                  onToggle={(checked) =>
                    void runWrite(() => (checked ? completeTask(task.id) : reopenTask(task.id)))
                  }
                  // Reuses the notification deep link: the Task opens in its
                  // sheet over *Hoje*, and Android back returns to this day.
                  onOpen={() => navigate(taskRouteOf(task.id))}
                  onEdit={() => setEditingId(task.id)}
                  onCommitTitle={(newTitle) => commitTitle(task.id, newTitle)}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      <CompromissoSheet {...eventSheet.sheetProps} />
    </div>
  );
}
