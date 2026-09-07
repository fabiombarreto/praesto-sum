import type {
  GoogleCalendarSelectionDto,
  LifeAreaDto,
  ReminderDto,
  RecurrenceSeriesDto,
  TaskDto,
} from "./api";
import { PRAESTO_TIMEZONE } from "./dates";

/**
 * Pure, DB-free assembly of the export document (FR-042, data-export PRD
 * AC-5). Reads no clock — like every other module in `src/shared/` — so the
 * generation instant is a parameter, never `Date.now()`.
 */

/** The five data-bearing tables, already mapped through `dto.ts`. */
export interface ExportTables {
  lifeAreas: LifeAreaDto[];
  recurrenceSeries: RecurrenceSeriesDto[];
  tasks: TaskDto[];
  reminders: ReminderDto[];
  googleCalendarSelections: GoogleCalendarSelectionDto[];
}

export interface ExcludedTableEntry {
  name: string;
  reason: string;
}

/** The self-describing document `GET /api/export` returns. */
export interface ExportEnvelope {
  formatVersion: 1;
  /** Epoch seconds of the instant the export was generated. */
  generatedAt: number;
  /** The IANA zone the app's calendar days are expressed in. */
  timezone: string;
  excludedTables: readonly ExcludedTableEntry[];
  tables: {
    life_areas: LifeAreaDto[];
    recurrence_series: RecurrenceSeriesDto[];
    tasks: TaskDto[];
    reminders: ReminderDto[];
    google_calendar_selections: GoogleCalendarSelectionDto[];
  };
}

/**
 * Assembles the export envelope from the given instant, the already-mapped
 * DTO arrays for the five dumped tables, and the reasoned exclusion list.
 *
 * `now` is a parameter, not read from the clock, matching every other
 * `src/shared/` module (`dates.ts`, `day-item.ts`, `agenda.ts`).
 */
export function buildExportEnvelope(
  now: Date,
  tables: ExportTables,
  excluded: readonly ExcludedTableEntry[],
): ExportEnvelope {
  return {
    formatVersion: 1,
    generatedAt: Math.floor(now.getTime() / 1000),
    timezone: PRAESTO_TIMEZONE,
    excludedTables: excluded,
    tables: {
      life_areas: tables.lifeAreas,
      recurrence_series: tables.recurrenceSeries,
      tasks: tables.tasks,
      reminders: tables.reminders,
      google_calendar_selections: tables.googleCalendarSelections,
    },
  };
}
