import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Praesto Sum — D1 schema, Phase 1 (Tasks).
 *
 * Authoritative sources: documentation/30-architecture/domain-model.md and
 * documentation/60-decisions/ADR-0006-recurrence-model.md. Entity names follow
 * the canonical glossary exactly (Task, Reminder, Life Area, Recurrence Series).
 *
 * Conventions (docs/context/conventions.md):
 * - Column names written explicitly in snake_case; properties in camelCase.
 * - The 3rd argument of `sqliteTable` returns an ARRAY (object form deprecated).
 * - Calendar dates (deadline, scheduled date, occurrence date) are stored as
 *   text `YYYY-MM-DD`: they are LOCAL days, not instants. Only genuine instants
 *   (timestamps, fire times) use integer epoch seconds.
 * - `text(..., { enum })` is TypeScript-only; every domain enum is additionally
 *   enforced with a CHECK constraint so the database rejects bad rows too.
 *
 * Phase 2 (Calendar) will add: events, event_exceptions, task_events (N:N) and
 * the reminders.event_id column. They are deliberately absent here.
 */

export const lifeAreas = sqliteTable(
  "life_areas",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("life_areas_name_unq").on(t.name),
    check("life_areas_name_not_empty", sql`length(trim(${t.name})) > 0`),
  ],
);

/**
 * The shared recurrence rule (ADR-0006). One row per recurring series.
 *
 * `kind` distinguishes the instantiation strategy: 'task' series materialize
 * their current occurrence as a real Task row; 'event' series (Phase 2) govern
 * a single master Event expanded virtually. The template columns below stamp
 * each spawned Task occurrence and stay NULL for 'event' series.
 */
export const recurrenceSeries = sqliteTable(
  "recurrence_series",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["task", "event"] })
      .notNull()
      .default("task"),

    // Rule (shared vocabulary — expanded by one pure function in src/shared).
    freq: text("freq", { enum: ["daily", "weekly", "monthly", "yearly"] }).notNull(),
    interval: integer("interval").notNull().default(1),
    /** JSON array of ISO weekday numbers (1 = Monday … 7 = Sunday), or NULL. */
    byWeekday: text("by_weekday"),
    byMonthday: integer("by_monthday"),
    /** First date of the series, local calendar day. */
    dtstart: text("dtstart").notNull(),
    /** IANA zone the rule is resolved in before converting to instants. */
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    /**
     * 'calendar' keeps the original track and skips missed dates;
     * 'completion' computes the next date from the actual completion date.
     */
    anchorMode: text("anchor_mode", { enum: ["calendar", "completion"] })
      .notNull()
      .default("calendar"),

    // End condition.
    endKind: text("end_kind", { enum: ["never", "until", "count"] })
      .notNull()
      .default("never"),
    untilDate: text("until_date"),
    maxCount: integer("max_count"),
    doneCount: integer("done_count").notNull().default(0),
    missedCount: integer("missed_count").notNull().default(0),

    status: text("status", { enum: ["active", "ended"] })
      .notNull()
      .default("active"),

    // Task template (kind = 'task' only).
    title: text("title"),
    description: text("description"),
    priority: integer("priority"),
    lifeAreaId: text("life_area_id").references(() => lifeAreas.id, {
      onUpdate: "cascade",
      onDelete: "set null",
    }),
    /** Which date field the spawned occurrence carries. */
    dateMode: text("date_mode", { enum: ["deadline", "scheduled"] })
      .notNull()
      .default("scheduled"),
    /** JSON array of reminder offsets in minutes relative to the occurrence date. */
    reminderOffsets: text("reminder_offsets"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("recurrence_series_status_idx").on(t.status),
    check("recurrence_series_kind_chk", sql`${t.kind} in ('task','event')`),
    check("recurrence_series_freq_chk", sql`${t.freq} in ('daily','weekly','monthly','yearly')`),
    check("recurrence_series_interval_chk", sql`${t.interval} >= 1`),
    check("recurrence_series_anchor_chk", sql`${t.anchorMode} in ('calendar','completion')`),
    check("recurrence_series_status_chk", sql`${t.status} in ('active','ended')`),
    // The end condition must carry the field it needs, and only that field.
    check(
      "recurrence_series_end_chk",
      sql`(${t.endKind} = 'never' and ${t.untilDate} is null and ${t.maxCount} is null)
       or (${t.endKind} = 'until' and ${t.untilDate} is not null and ${t.maxCount} is null)
       or (${t.endKind} = 'count'  and ${t.maxCount} is not null and ${t.untilDate} is null)`,
    ),
    // A task series must carry its template; an event series must not.
    check(
      "recurrence_series_template_chk",
      sql`(${t.kind} = 'task' and ${t.title} is not null) or (${t.kind} = 'event' and ${t.title} is null)`,
    ),
  ],
);

/**
 * Task — something the owner intends to do (glossary).
 *
 * A Task carries EITHER a deadline (complete by) OR a scheduled date (do on) —
 * never both (resolved 2026-08-03). Recurring occurrences are real rows linked
 * to their series; at most one may be open per active series, which the partial
 * unique index below enforces structurally (ADR-0006 invariant 5).
 */
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    /** 'missed' is terminal and system-written by the recurrence sweep. */
    status: text("status", { enum: ["open", "done", "missed"] })
      .notNull()
      .default("open"),
    /** Local calendar day to complete BY. Mutually exclusive with scheduledDate. */
    deadline: text("deadline"),
    /** Local calendar day to do it ON. Mutually exclusive with deadline. */
    scheduledDate: text("scheduled_date"),
    /** Optional (FR-006). NULL means "not set", and sorts as 'normal'. */
    priority: text("priority", { enum: ["high", "normal", "low"] }),
    lifeAreaId: text("life_area_id").references(() => lifeAreas.id, {
      onUpdate: "cascade",
      onDelete: "set null",
    }),

    // Recurrence (ADR-0006). NULL for one-off Tasks.
    seriesId: text("series_id").references(() => recurrenceSeries.id, {
      onUpdate: "cascade",
      onDelete: "set null",
    }),
    /** The series date this row instantiates. */
    occurrenceDate: text("occurrence_date"),
    /** True once the occurrence is edited individually; series edits stop propagating. */
    detached: integer("detached", { mode: "boolean" }).notNull().default(false),

    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // ADR-0006 invariant 5: one row per (series, occurrence date) — the
    // structural guard against double-spawn by the sweep.
    uniqueIndex("tasks_series_occurrence_unq")
      .on(t.seriesId, t.occurrenceDate)
      .where(sql`${t.seriesId} is not null`),
    // Same invariant, other half: at most ONE open occurrence per series.
    uniqueIndex("tasks_series_single_open_unq")
      .on(t.seriesId)
      .where(sql`${t.seriesId} is not null and ${t.status} = 'open'`),

    index("tasks_status_idx").on(t.status),
    index("tasks_deadline_idx").on(t.deadline),
    index("tasks_scheduled_date_idx").on(t.scheduledDate),
    index("tasks_life_area_idx").on(t.lifeAreaId),

    check("tasks_title_not_empty", sql`length(trim(${t.title})) > 0`),
    check("tasks_status_chk", sql`${t.status} in ('open','done','missed')`),
    check(
      "tasks_priority_chk",
      sql`${t.priority} is null or ${t.priority} in ('high','normal','low')`,
    ),
    // Deadline XOR scheduled date (either may be absent; never both present).
    check("tasks_single_date_chk", sql`${t.deadline} is null or ${t.scheduledDate} is null`),
    // A closed Task records when it closed; an open one does not.
    check(
      "tasks_completed_at_chk",
      sql`(${t.status} = 'done' and ${t.completedAt} is not null)
       or (${t.status} <> 'done' and ${t.completedAt} is null)`,
    ),
    // Occurrence rows belong to a series and vice versa.
    check(
      "tasks_occurrence_chk",
      sql`(${t.seriesId} is null and ${t.occurrenceDate} is null)
       or (${t.seriesId} is not null and ${t.occurrenceDate} is not null)`,
    ),
  ],
);

/**
 * Reminder — a notification at a chosen moment about a Task, or standalone
 * (FR-044). `fireAt` is an absolute instant in UTC: the cron scans it directly,
 * so no rule expansion ever happens on the hot path.
 *
 * Phase 2 adds an `event_id` column for Event reminders.
 */
export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
    /** Required for standalone reminders; optional label override otherwise. */
    label: text("label"),
    fireAt: integer("fire_at", { mode: "timestamp" }).notNull(),
    /** Minutes relative to the target's date, when derived rather than absolute. */
    originOffsetMinutes: integer("origin_offset_minutes"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    /** The cron's only scan: due and not yet sent. */
    index("reminders_due_idx").on(t.sentAt, t.fireAt),
    index("reminders_task_idx").on(t.taskId),
    // A standalone Reminder must say what it is about.
    check(
      "reminders_label_chk",
      sql`${t.taskId} is not null or (${t.label} is not null and length(trim(${t.label})) > 0)`,
    ),
  ],
);

/**
 * Web Push subscription (FR-041). One row per installed PWA instance; the
 * endpoint is the natural key. Dead subscriptions are pruned when the push
 * service rejects them.
 */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** Free-text hint so the owner can tell devices apart. */
    deviceLabel: text("device_label"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_unq").on(t.endpoint)],
);

// Types flow OUT of the schema — never hand-duplicated (docs/anti-patterns.md).
export type LifeArea = typeof lifeAreas.$inferSelect;
export type NewLifeArea = typeof lifeAreas.$inferInsert;
export type RecurrenceSeries = typeof recurrenceSeries.$inferSelect;
export type NewRecurrenceSeries = typeof recurrenceSeries.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
