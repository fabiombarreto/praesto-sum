/**
 * The Compromisso sheet's and the search's copy and decisions (unit 14
 * `events-and-day-view` phase 4, PRD AC-27 to AC-30): the pt-BR sentences a
 * function chooses for them, kept here so they are tested in Portuguese (ADR-0009,
 * guidelines §12.3) instead of re-typed in a component, like `life-areas-view.ts` and
 * `day-view.ts`; the generic failure line stays in `request-failure.ts`. Also the
 * request path of the *Compromissos* search, the label of a search row and the one
 * place that decides when the search may say that nothing was found.
 *
 * Like `request-failure.ts` it duck-types a numeric `status` rather than importing
 * `ApiError`, which `src/shared` cannot see. Clock-free, compiled into every target:
 * no DOM globals and no Worker globals.
 */

import type { EventDto } from "./api";
import { PRAESTO_TIMEZONE } from "./dates";
import type { EventDraftError } from "./event-edit";
import {
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  instantToWallClock,
  isValidLocalDay,
} from "./events";
import { ALL_DAY_LABEL } from "./format";
import { classifyRequestFailure } from "./request-failure";

/** The button that opens an empty sheet and the sheet's title for a new commitment. */
export const NEW_EVENT_LABEL = "Novo compromisso";

/** The heading of the search group (`SearchScreen`'s *Compromissos* group; `/day` keeps its own literal section label). */
export const EVENT_SEARCH_GROUP = "Compromissos";

function tooLong(limit: number): string {
  return `Use no máximo ${limit} caracteres.`;
}

/** The sentence shown for one draft error, in the pt-BR the owner reads (AC-27, AC-28). */
export function eventDraftErrorMessage(error: EventDraftError): string {
  switch (error.field) {
    case "title":
      return error.code === "blank" ? "Informe o título." : tooLong(EVENT_TITLE_MAX);
    case "description":
      return tooLong(EVENT_DESCRIPTION_MAX);
    case "location":
      return tooLong(EVENT_LOCATION_MAX);
    case "start":
      return error.code === "day_required"
        ? "Informe o dia de início."
        : "Informe a hora de início.";
    case "end":
      return "O fim não pode ser antes do início.";
  }
}

/** `YYYY-MM-DD` as `dd/MM/aaaa`, assembled from the string with no `Intl` and no zone. */
function formatDay(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/**
 * The end the owner has not fully typed, as the sheet shows it before saving:
 * `Termina em 20/10/2026 às 10:30.` for a timed end, `Termina em 20/10/2026.` when
 * there is no time (an all-day last day).
 */
export function formatDraftEnd(end: { day: string; time: string | null }): string {
  const day = formatDay(end.day);
  return end.time === null ? `Termina em ${day}.` : `Termina em ${day} às ${end.time}.`;
}

/** The numeric `status` of a caught cause, duck-typed exactly as `classifyRequestFailure` does. */
function statusOf(cause: unknown): number | null {
  if (typeof cause !== "object" || cause === null || !("status" in cause)) return null;
  const { status } = cause as { status: unknown };
  return typeof status === "number" ? status : null;
}

/**
 * Maps a failed create, edit or delete to a fixed pt-BR sentence and says whether
 * the list on screen can no longer be trusted (AC-30). The server's own error text
 * carries a field marker meant for tools, so it is never shown. A 404 means another
 * device deleted the commitment first, hence `staleList`: the screen shows the reason
 * and refetches. A 401 never reaches this function — the hook routes it to the token
 * gate first.
 */
export function eventWriteFailure(cause: unknown): { message: string; staleList: boolean } {
  if (statusOf(cause) === 404) {
    return {
      message: "Este compromisso não existe mais. A lista foi atualizada.",
      staleList: true,
    };
  }
  return { message: classifyRequestFailure(cause).message, staleList: false };
}

/** The `GET /api/events` path of the *Compromissos* search: trimmed text in `q`, no range. */
export function eventsSearchPath(q: string): string {
  return `/api/events?q=${encodeURIComponent(q.trim())}`;
}

/**
 * The date and time a search row shows, in the OWNER's zone like every day screen:
 * `dd/MM/aaaa · HH:mm` for a timed Event, `dd/MM/aaaa · dia todo` for an all-day one
 * (its first day verbatim, no zone conversion). An Event lacking the start its kind
 * needs reads an empty string.
 */
export function formatEventSearchWhen(event: EventDto): string {
  if (event.allDay) {
    if (event.startDate === null || !isValidLocalDay(event.startDate)) return "";
    return `${formatDay(event.startDate)} · ${ALL_DAY_LABEL}`;
  }
  if (event.startAt === null) return "";
  const start = instantToWallClock(event.startAt, PRAESTO_TIMEZONE);
  return `${formatDay(start.day)} · ${start.time}`;
}

/** What the search's results region shows. */
export type SearchBodyKind = "offline" | "hint" | "loading" | "task-error" | "empty" | "results";

/**
 * Which body the search shows, evaluated in order: offline; a hint while the query
 * is too short; the Task search's error; loading until the Tasks answered; results
 * as soon as anything was found; results when the commitments search failed (its own
 * failure line shows, and nothing claims that nothing was found); loading until the
 * commitments answered; otherwise empty. The commitments request is isolated: it
 * never turns a Task result into an error, and the screen never says "nothing found"
 * while it is unanswered or failed (AC-29).
 */
export function decideSearchBody(input: {
  online: boolean;
  queryReady: boolean;
  tasksAnswered: boolean;
  tasksFailed: boolean;
  taskCount: number;
  eventsAnswered: boolean;
  eventsFailed: boolean;
  eventCount: number;
}): SearchBodyKind {
  if (!input.online) return "offline";
  if (!input.queryReady) return "hint";
  if (input.tasksFailed) return "task-error";
  if (!input.tasksAnswered) return "loading";
  if (input.taskCount > 0 || input.eventCount > 0) return "results";
  if (input.eventsFailed) return "results";
  if (!input.eventsAnswered) return "loading";
  return "empty";
}
