import type {
  GoogleCalendarSelectionDto,
  GoogleConnectionDto,
  LifeAreaDto,
  ReminderDto,
  RecurrenceSeriesDto,
  TaskDto,
} from "../shared/api";
import type {
  GoogleCalendarSelection,
  GoogleConnection,
  LifeArea,
  Reminder,
  RecurrenceSeries,
  Task,
} from "./db/schema";

/**
 * The single mapping point between database rows and the wire contract.
 *
 * Every field is written out explicitly on purpose: this is what makes schema
 * drift a compile error instead of a runtime surprise (see src/shared/api.ts).
 */
export function toTaskDto(row: Task): TaskDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: row.deadline,
    scheduledDate: row.scheduledDate,
    priority: row.priority,
    lifeAreaId: row.lifeAreaId,
    seriesId: row.seriesId,
    occurrenceDate: row.occurrenceDate,
    completedAt: toEpochSeconds(row.completedAt),
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
  };
}

function toEpochSeconds(value: Date | null): number | null {
  return value === null ? null : Math.floor(value.getTime() / 1000);
}

/**
 * Maps a stored connection to the wire.
 *
 * Written field by field, like `toTaskDto`, so schema drift breaks the build —
 * and so the ABSENCE of `refreshToken` is a visible, deliberate line in this
 * file rather than an omission someone has to notice.
 */
export function toGoogleConnectionDto(row: GoogleConnection): GoogleConnectionDto {
  return {
    connected: true,
    connectedAt: toEpochSeconds(row.connectedAt) ?? 0,
    scope: row.scope,
  };
}

/**
 * Maps a Life Area row for the FR-042 export. Written field by field, like
 * `toTaskDto`, so schema drift breaks the build.
 */
export function toLifeAreaDto(row: LifeArea): LifeAreaDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
    updatedAt: toEpochSeconds(row.updatedAt) ?? 0,
  };
}

/**
 * Maps a Recurrence Series row for the FR-042 export. `dtstart` and
 * `untilDate` are calendar days and export verbatim (see the conventions
 * header of `db/schema.ts`); `createdAt`/`updatedAt` are genuine instants.
 */
export function toRecurrenceSeriesDto(row: RecurrenceSeries): RecurrenceSeriesDto {
  return {
    id: row.id,
    kind: row.kind,
    freq: row.freq,
    interval: row.interval,
    byWeekday: row.byWeekday,
    byMonthday: row.byMonthday,
    dtstart: row.dtstart,
    timezone: row.timezone,
    anchorMode: row.anchorMode,
    endKind: row.endKind,
    untilDate: row.untilDate,
    maxCount: row.maxCount,
    doneCount: row.doneCount,
    missedCount: row.missedCount,
    status: row.status,
    title: row.title,
    description: row.description,
    priority: row.priority,
    lifeAreaId: row.lifeAreaId,
    dateMode: row.dateMode,
    reminderOffsets: row.reminderOffsets,
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
    updatedAt: toEpochSeconds(row.updatedAt) ?? 0,
  };
}

/**
 * Maps a Reminder row for the FR-042 export. `fireAt` is a genuine instant
 * (the cron scans it directly); `sentAt` is `null` until fired.
 */
export function toReminderDto(row: Reminder): ReminderDto {
  return {
    id: row.id,
    taskId: row.taskId,
    label: row.label,
    fireAt: toEpochSeconds(row.fireAt) ?? 0,
    originOffsetMinutes: row.originOffsetMinutes,
    sentAt: toEpochSeconds(row.sentAt),
    createdAt: toEpochSeconds(row.createdAt) ?? 0,
    updatedAt: toEpochSeconds(row.updatedAt) ?? 0,
  };
}

/**
 * Maps a Google calendar selection row for the FR-042 export. Only the id —
 * never calendar contents, per ADR-0007.
 */
export function toGoogleCalendarSelectionDto(
  row: GoogleCalendarSelection,
): GoogleCalendarSelectionDto {
  return {
    calendarId: row.calendarId,
    selectedAt: toEpochSeconds(row.selectedAt) ?? 0,
  };
}
