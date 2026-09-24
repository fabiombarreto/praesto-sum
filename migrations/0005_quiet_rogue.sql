-- D1 ignores the OFF/ON pragma pair drizzle-kit emits around a table
-- recreation; the supported form is `PRAGMA defer_foreign_keys=ON`, which
-- suspends FK enforcement until the end of the enclosing transaction. That
-- pair was rewritten by hand into the single statement below, mirroring
-- migrations/0001_violet_pretty_boy.sql:1-7. The trailing restore is not
-- needed: defer_foreign_keys resets itself on commit.
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_recurrence_series` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'task' NOT NULL,
	`freq` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`by_weekday` text,
	`by_monthday` integer,
	`dtstart` text NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`anchor_mode` text DEFAULT 'calendar' NOT NULL,
	`end_kind` text DEFAULT 'never' NOT NULL,
	`until_date` text,
	`max_count` integer,
	`done_count` integer DEFAULT 0 NOT NULL,
	`missed_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`title` text,
	`description` text,
	`priority` text,
	`life_area_id` text,
	`date_mode` text DEFAULT 'scheduled' NOT NULL,
	`reminder_offsets` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`life_area_id`) REFERENCES `life_areas`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "recurrence_series_kind_chk" CHECK("__new_recurrence_series"."kind" in ('task','event')),
	CONSTRAINT "recurrence_series_freq_chk" CHECK("__new_recurrence_series"."freq" in ('daily','weekly','monthly','yearly')),
	CONSTRAINT "recurrence_series_interval_chk" CHECK("__new_recurrence_series"."interval" >= 1),
	CONSTRAINT "recurrence_series_anchor_chk" CHECK("__new_recurrence_series"."anchor_mode" in ('calendar','completion')),
	CONSTRAINT "recurrence_series_status_chk" CHECK("__new_recurrence_series"."status" in ('active','ended')),
	CONSTRAINT "recurrence_series_end_chk" CHECK(("__new_recurrence_series"."end_kind" = 'never' and "__new_recurrence_series"."until_date" is null and "__new_recurrence_series"."max_count" is null)
       or ("__new_recurrence_series"."end_kind" = 'until' and "__new_recurrence_series"."until_date" is not null and "__new_recurrence_series"."max_count" is null)
       or ("__new_recurrence_series"."end_kind" = 'count'  and "__new_recurrence_series"."max_count" is not null and "__new_recurrence_series"."until_date" is null)),
	CONSTRAINT "recurrence_series_template_chk" CHECK(("__new_recurrence_series"."kind" = 'task' and "__new_recurrence_series"."title" is not null) or ("__new_recurrence_series"."kind" = 'event' and "__new_recurrence_series"."title" is null)),
	CONSTRAINT "recurrence_series_priority_chk" CHECK("__new_recurrence_series"."priority" is null or "__new_recurrence_series"."priority" in ('high','normal','low'))
);
--> statement-breakpoint
INSERT INTO `__new_recurrence_series`("id", "kind", "freq", "interval", "by_weekday", "by_monthday", "dtstart", "timezone", "anchor_mode", "end_kind", "until_date", "max_count", "done_count", "missed_count", "status", "title", "description", "priority", "life_area_id", "date_mode", "reminder_offsets", "created_at", "updated_at") SELECT "id", "kind", "freq", "interval", "by_weekday", "by_monthday", "dtstart", "timezone", "anchor_mode", "end_kind", "until_date", "max_count", "done_count", "missed_count", "status", "title", "description", "priority", "life_area_id", "date_mode", "reminder_offsets", "created_at", "updated_at" FROM `recurrence_series`;--> statement-breakpoint
DROP TABLE `recurrence_series`;--> statement-breakpoint
ALTER TABLE `__new_recurrence_series` RENAME TO `recurrence_series`;--> statement-breakpoint
CREATE INDEX `recurrence_series_status_idx` ON `recurrence_series` (`status`);