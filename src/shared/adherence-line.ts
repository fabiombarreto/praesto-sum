/**
 * Pure decision of the *Hoje* adherence line (adherence-mirror phase 3, PRD
 * D-E): whether a line is shown at all, which series it names and its text.
 *
 * It is DOM-free and clock-free: it reads only the `AdherenceResponse` it is
 * handed and imports only its same-directory siblings (`./api` for the wire
 * types, `./adherence` for `RECENT_WINDOW_DAYS`). It deliberately ignores
 * `response.ranking` and recomputes the order, so the line and the route that
 * share `orderByMisses` always agree with each other.
 */
import { RECENT_WINDOW_DAYS } from "./adherence";
import type { AdherenceResponse, SeriesAdherenceDto } from "./api";

/** An active series needs at least this many misses in the window to earn the line. */
export const ADHERENCE_LINE_MIN_MISSES = 2;

/** Shown for a series whose title is the empty string. */
export const UNTITLED_SERIES_LABEL = "Sem título";

/** The title to show for a series: its own, or the untitled label. */
export function seriesDisplayTitle(series: SeriesAdherenceDto): string {
  return series.title === "" ? UNTITLED_SERIES_LABEL : series.title;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function newestMiss(series: SeriesAdherenceDto): string {
  return series.recentMisses.reduce((max, d) => (d > max ? d : max), "");
}

/**
 * The active series with at least one recent miss, ordered by recent-miss
 * count descending, then newest miss descending, then title ascending (pt-BR
 * collation), then series id ascending. Returns a new array.
 */
export function orderByMisses(series: SeriesAdherenceDto[]): SeriesAdherenceDto[] {
  return series
    .filter((s) => s.status === "active" && s.recentMisses.length > 0)
    .sort(
      (a, b) =>
        b.recentMisses.length - a.recentMisses.length ||
        compareStrings(newestMiss(b), newestMiss(a)) ||
        seriesDisplayTitle(a).localeCompare(seriesDisplayTitle(b), "pt-BR") ||
        compareStrings(a.seriesId, b.seriesId),
    );
}

/**
 * The line for *Hoje*, or `null` when no active series has at least
 * `ADHERENCE_LINE_MIN_MISSES` misses in the window (an ended series never
 * qualifies).
 */
export function decideAdherenceLine(
  response: AdherenceResponse,
): { text: string; seriesId: string } | null {
  const qualifying = orderByMisses(response.series).filter(
    (s) => s.recentMisses.length >= ADHERENCE_LINE_MIN_MISSES,
  );
  const top = qualifying[0];
  if (top === undefined) return null;

  const others = qualifying.length - 1;
  const base = `${seriesDisplayTitle(top)} · ${top.recentMisses.length} não concluídas em ${RECENT_WINDOW_DAYS} dias`;
  const suffix = others === 0 ? "" : ` · +${others} ${others === 1 ? "série" : "séries"}`;
  return { seriesId: top.seriesId, text: `${base}${suffix}` };
}
