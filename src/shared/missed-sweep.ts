/**
 * Pure planning of the missed sweep (unit 10, ADR-0006): decides whether a
 * Recurrence Series' open occurrence has been superseded, which whole cycles
 * were missed, where the successor falls and whether the series ends.
 *
 * It is clock-free and database-free: it compares only local `YYYY-MM-DD`
 * strings it is handed (`today` is the series' local day, supplied by the
 * caller), reads no ambient clock, and imports only its same-directory sibling
 * `./recurrence`, whose `nextOccurrence` it composes without changing.
 */
import { nextOccurrence, type RecurrenceRule } from "./recurrence";

/** Upper bound on missed cycles recorded by a single planning call. */
const MAX_MISSED_PER_RUN = 366;

export interface MissedSweepInput {
  rule: RecurrenceRule;
  status: "active" | "ended";
  doneCount: number;
  missedCount: number;
  /** Date of the series' open occurrence, or `null` when it has none. */
  openOccurrenceDate: string | null;
  /** Date of the last closed occurrence; part of the contract but not read by `planMissedSweep` (the repair derives the successor from `today` only). */
  lastClosedOccurrenceDate: string | null;
  /** The series' local calendar day (`YYYY-MM-DD`). */
  today: string;
}

export interface MissedSweepPlan {
  closeOpenAsMissed: boolean;
  extraMissedDates: string[];
  successor: { date: string; armReminders: boolean } | null;
  endSeries: boolean;
  /** The open occurrence's miss (when closed) plus `extraMissedDates.length`. */
  missedCountDelta: number;
}

const NO_CHANGE: MissedSweepPlan = {
  closeOpenAsMissed: false,
  extraMissedDates: [],
  successor: null,
  endSeries: false,
  missedCountDelta: 0,
};

function noChange(): MissedSweepPlan {
  return { ...NO_CHANGE, extraMissedDates: [] };
}

/** The calendar day before `day`, derived from an explicit instant only. */
function previousDay(day: string): string {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** Next date after `after` (completion anchor: counted from `after` itself). */
function stepFrom(rule: RecurrenceRule, after: string, closedCount: number): string | null {
  return nextOccurrence(rule, { after, completedOn: after, closedCount });
}

export function planMissedSweep(input: MissedSweepInput): MissedSweepPlan {
  const { rule, status, doneCount, missedCount, openOccurrenceDate, today } = input;

  if (openOccurrenceDate === null) {
    // Repair (D-F): an active series with no open occurrence starts fresh.
    if (status !== "active") return noChange();
    const first = stepFrom(rule, previousDay(today), doneCount + missedCount);
    if (first === null) return { ...noChange(), endSeries: true };
    return { ...noChange(), successor: { date: first, armReminders: true } };
  }

  // The supersede date ignores the end condition so the last allowed
  // occurrence can still be recorded as missed.
  const neverEnding: RecurrenceRule = { ...rule, endKind: "never" };
  const isSuperseded = (date: string): boolean => {
    const supersedeDate = stepFrom(neverEnding, date, 0);
    return supersedeDate !== null && supersedeDate <= today;
  };
  if (!isSuperseded(openOccurrenceDate)) return noChange();

  if (status === "ended") {
    return { ...noChange(), closeOpenAsMissed: true, missedCountDelta: 1 };
  }

  const extraMissedDates: string[] = [];
  let planned = 1; // the open occurrence
  let current = stepFrom(rule, openOccurrenceDate, doneCount + missedCount + planned);
  // A cycle is missed only once today reaches the next date the rule would
  // produce (D-A); the first cycle not yet superseded becomes the successor.
  while (current !== null && isSuperseded(current) && planned < MAX_MISSED_PER_RUN) {
    extraMissedDates.push(current);
    planned += 1;
    current = stepFrom(rule, current, doneCount + missedCount + planned);
  }

  return {
    closeOpenAsMissed: true,
    extraMissedDates,
    successor: current === null ? null : { date: current, armReminders: current >= today },
    endSeries: current === null,
    missedCountDelta: planned,
  };
}
