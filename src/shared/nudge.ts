/**
 * Pure repeated-miss nudge decision (repeated-miss-nudge, phase 1, ADR-0006):
 * how many occurrences of a Recurrence Series were missed in a row, and whether
 * the "you keep missing this" notification is due.
 *
 * It is clock-free, database-free and Worker/DOM-free: `now` is always an
 * argument, the series' time zone is data the caller resolved, and the row
 * shape is imported as a type from `./adherence`, never redeclared.
 */

import type { AdherenceRow } from "./adherence";
import { instantToLocalParts } from "./dates";

/** Consecutive trailing `missed` occurrences at which the nudge becomes due. */
export const NUDGE_THRESHOLD = 3;

/** The local hour (in the series' own zone) from which the nudge may be sent. */
export const NUDGE_FROM_LOCAL_HOUR = 9;

/** The minimal series shape the nudge decision reads. */
export interface NudgeSeries {
  status: "active" | "ended";
  /** The owner silenced this series' nudge. */
  nudgeMuted: boolean;
  /** Epoch seconds of the claim marker, or null when not yet nudged. */
  nudgedAt: number | null;
  /** An already-resolved IANA zone; the caller applies any fallback. */
  timeZone: string;
}

export interface NudgeDecision {
  due: boolean;
  /** The trailing consecutive `missed` count. */
  streak: number;
  reason: "due" | "ended" | "already-nudged" | "below-threshold" | "muted" | "before-window";
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Counts the trailing consecutive `missed` rows by occurrence date, stopping at
 * the first `done`. Open rows are ignored (neither counted nor a reset); skipped
 * cycles leave no row, so they neither break nor inflate the run.
 */
export function trailingMissStreak(rows: AdherenceRow[]): number {
  const closedRows = rows
    .filter((r) => r.status === "done" || r.status === "missed")
    .sort((a, b) => compareStrings(a.occurrenceDate, b.occurrenceDate));

  let streak = 0;
  for (let i = closedRows.length - 1; i >= 0 && closedRows[i]!.status === "missed"; i--) {
    streak++;
  }
  return streak;
}

/**
 * Decides whether the repeated-miss nudge is due for a series at `now`. The
 * first matching reason wins, in this order: ended, already-nudged,
 * below-threshold, muted, before-window. A muted run at or above the threshold
 * with no marker is reported as `muted` so the caller can consume it.
 */
export function decideNudge(series: NudgeSeries, rows: AdherenceRow[], now: Date): NudgeDecision {
  const streak = trailingMissStreak(rows);

  if (series.status === "ended") return { due: false, streak, reason: "ended" };
  if (series.nudgedAt !== null) return { due: false, streak, reason: "already-nudged" };
  if (streak < NUDGE_THRESHOLD) return { due: false, streak, reason: "below-threshold" };
  if (series.nudgeMuted) return { due: false, streak, reason: "muted" };

  const { time } = instantToLocalParts(now.getTime() / 1000, series.timeZone);
  const localHour = Number(time.slice(0, 2));
  if (localHour < NUDGE_FROM_LOCAL_HOUR) return { due: false, streak, reason: "before-window" };

  return { due: true, streak, reason: "due" };
}
