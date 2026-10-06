/**
 * Pure content of the *Aderência* route (adherence-mirror phase 3, PRD D-G):
 * the three sections and the per-series copy.
 *
 * It is DOM-free and clock-free and imports only its same-directory siblings
 * (`./api` types, `./adherence-line` for the ordering and the display title).
 * Completion is always a count, never a ratio: no division, no percentage.
 */
import { orderByMisses, seriesDisplayTitle } from "./adherence-line";
import type { AdherenceResponse, SeriesAdherenceDto } from "./api";

export interface AdherenceSections {
  /** Active series with misses in the window, in ranking order. */
  missed: SeriesAdherenceDto[];
  /** The remaining active series, by title. */
  otherActive: SeriesAdherenceDto[];
  /** Every ended series, by title (including ones with misses). */
  ended: SeriesAdherenceDto[];
}

function byTitle(a: SeriesAdherenceDto, b: SeriesAdherenceDto): number {
  return (
    seriesDisplayTitle(a).localeCompare(seriesDisplayTitle(b), "pt-BR") ||
    (a.seriesId < b.seriesId ? -1 : a.seriesId > b.seriesId ? 1 : 0)
  );
}

/** Splits the response into the route's three sections; each series lands in exactly one. */
export function adherenceSections(response: AdherenceResponse): AdherenceSections {
  const missed = orderByMisses(response.series);
  const missedIds = new Set(missed.map((s) => s.seriesId));
  const otherActive = response.series
    .filter((s) => s.status === "active" && !missedIds.has(s.seriesId))
    .sort(byTitle);
  const ended = response.series.filter((s) => s.status === "ended").sort(byTitle);
  return { missed, otherActive, ended };
}

/** `<done> de <closed> feitas`, with zero closed special-cased. */
export function formatDoneOfClosed(done: number, closed: number): string {
  if (closed === 0) return "Nenhuma ocorrência concluída ainda";
  return `${done} de ${closed} feitas`;
}

/** The current streak of completed occurrences. */
export function formatStreak(currentStreak: number): string {
  return currentStreak >= 1 ? `Sequência atual: ${currentStreak}` : "Sem sequência";
}

function dayMonth(day: string): string {
  const [, month = "", dayOfMonth = ""] = day.split("-");
  return `${dayOfMonth}/${month}`;
}

/** The recent misses as `dd/mm` dates in the given (newest-first) order. */
export function formatMissDates(recentMisses: string[]): string {
  if (recentMisses.length === 0) return "Nenhuma não concluída em 30 dias";
  const label = recentMisses.length === 1 ? "Não concluída em" : "Não concluídas em";
  return `${label} ${recentMisses.map(dayMonth).join(", ")}`;
}
