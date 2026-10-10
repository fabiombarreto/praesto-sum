/**
 * Pure copy of the repeated-miss nudge notification (repeated-miss-nudge,
 * phase 3): the title, the pt-BR body, the per-series tag and the deep link.
 *
 * Environment-agnostic like `./push-payload`: no DOM, Worker or database
 * dependency, so the wording rules are decidable without a database. The
 * vocabulary is the glossary's *não concluída*; the project's banned loose
 * words for a missed occurrence (see the glossary) never appear here.
 */

import { pathOf, taskRouteOf } from "./app-route";

const TITLE_MAX_LENGTH = 30;
const FALLBACK_TITLE = "Tarefa recorrente";

export interface NudgeNotificationInput {
  seriesId: string;
  seriesTitle: string | null;
  streak: number;
  openOccurrenceId: string;
}

export interface NudgeNotification {
  title: string;
  body: string;
  route: string;
  tag: string;
}

/** The series title, cut so the total never exceeds the 30-character header. */
function fitTitle(seriesTitle: string | null): string {
  const trimmed = seriesTitle?.trim() ?? "";
  if (trimmed === "") return FALLBACK_TITLE;
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_MAX_LENGTH - 1)}…`;
}

export function buildNudgeNotification(input: NudgeNotificationInput): NudgeNotification {
  return {
    title: fitTitle(input.seriesTitle),
    body: `${input.streak} não concluídas seguidas. Toque para replanejar ou encerrar.`,
    route: pathOf(taskRouteOf(input.openOccurrenceId)),
    tag: `nudge-${input.seriesId}`,
  };
}
