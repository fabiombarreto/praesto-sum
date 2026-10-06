/**
 * Pure adherence of a Recurrence Series (adherence-mirror, phase 1, ADR-0006):
 * the series' record derived from its real occurrence rows, never from the
 * series counters.
 *
 * It is clock-free and database-free: it compares only local `YYYY-MM-DD`
 * strings it is handed (`today` is the series' local day, supplied by the
 * caller), reads no ambient clock, and imports nothing at all.
 */

/** The minimal row shape adherence reads from an occurrence. */
export interface AdherenceRow {
  /** The occurrence's local calendar day (`YYYY-MM-DD`). */
  occurrenceDate: string;
  status: "open" | "done" | "missed";
  /**
   * Pass-through fields a caller may carry on its rows. Adherence never reads
   * them: ordering is by `occurrenceDate` only, and a detached occurrence is an
   * ordinary row.
   */
  completedAt?: string | null;
  detached?: boolean;
}

export interface SeriesAdherence {
  /** Occurrences completed. */
  done: number;
  /** Occurrences closed: `done` plus `missed`. Open rows are not counted. */
  closed: number;
  /** Trailing consecutive `done` rows, by occurrence date; 0 if the latest closed row is `missed`. */
  currentStreak: number;
  /** `missed` dates in `[today - RECENT_WINDOW_DAYS, today)`, newest first. */
  recentMisses: string[];
}

export interface AdherenceRankInput {
  seriesId: string;
  title: string;
  /** As returned by `computeSeriesAdherence`: newest first. */
  recentMisses: string[];
}

/** Length of the recent-misses window, in days, ending yesterday. */
export const RECENT_WINDOW_DAYS = 30;

/** The calendar day `delta` days from `day`, derived from explicit components only. */
function shiftDay(day: string, delta: number): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Derives a series' adherence from its occurrence rows and its local `today`. */
export function computeSeriesAdherence(rows: AdherenceRow[], today: string): SeriesAdherence {
  const closedRows = rows
    .filter((r) => r.status === "done" || r.status === "missed")
    .sort((a, b) => compareStrings(a.occurrenceDate, b.occurrenceDate));

  const done = closedRows.filter((r) => r.status === "done").length;

  let currentStreak = 0;
  for (let i = closedRows.length - 1; i >= 0 && closedRows[i]!.status === "done"; i--) {
    currentStreak++;
  }

  const windowStart = shiftDay(today, -RECENT_WINDOW_DAYS);
  const recentMisses = closedRows
    .filter(
      (r) => r.status === "missed" && r.occurrenceDate >= windowStart && r.occurrenceDate < today,
    )
    .map((r) => r.occurrenceDate)
    .reverse();

  return { done, closed: closedRows.length, currentStreak, recentMisses };
}

/**
 * Series ids ordered by recent misses descending, then most recent miss
 * descending, then title ascending, then id ascending. Series with no recent
 * miss are excluded.
 */
export function rankAdherence(entries: AdherenceRankInput[]): string[] {
  const latest = (e: AdherenceRankInput): string =>
    e.recentMisses.reduce((max, d) => (d > max ? d : max), "");
  return entries
    .filter((e) => e.recentMisses.length > 0)
    .sort(
      (a, b) =>
        b.recentMisses.length - a.recentMisses.length ||
        compareStrings(latest(b), latest(a)) ||
        compareStrings(a.title, b.title) ||
        compareStrings(a.seriesId, b.seriesId),
    )
    .map((e) => e.seriesId);
}
