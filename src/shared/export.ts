import type {
  EventDto,
  EventSyncLinkDto,
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

/**
 * The seven data-bearing tables, already mapped through `dto.ts`. `events` and
 * `eventLinks` (the `event_sync_links` table) are required, so a caller that forgets
 * them stops compiling.
 */
export interface ExportTables {
  lifeAreas: LifeAreaDto[];
  recurrenceSeries: RecurrenceSeriesDto[];
  tasks: TaskDto[];
  reminders: ReminderDto[];
  googleCalendarSelections: GoogleCalendarSelectionDto[];
  events: EventDto[];
  eventLinks: EventSyncLinkDto[];
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
    events: EventDto[];
    event_sync_links: EventSyncLinkDto[];
  };
}

/**
 * Assembles the export envelope from the given instant, the already-mapped
 * DTO arrays for the seven dumped tables, and the reasoned exclusion list.
 *
 * `formatVersion` stays 1: unit 14 only ADDED the `events` and `event_sync_links`
 * keys, which no reader of the earlier shape trips on. They come last, `events`
 * before `event_sync_links`, because `scripts/restore-drill.mjs` inserts tables in
 * key order and a link references its Event.
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
      events: tables.events,
      event_sync_links: tables.eventLinks,
    },
  };
}
