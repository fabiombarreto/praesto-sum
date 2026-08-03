CREATE TABLE `life_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "life_areas_name_not_empty" CHECK(length(trim("life_areas"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `life_areas_name_unq` ON `life_areas` (`name`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`device_label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unq` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `recurrence_series` (
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
	`priority` integer,
	`life_area_id` text,
	`date_mode` text DEFAULT 'scheduled' NOT NULL,
	`reminder_offsets` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`life_area_id`) REFERENCES `life_areas`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "recurrence_series_kind_chk" CHECK("recurrence_series"."kind" in ('task','event')),
	CONSTRAINT "recurrence_series_freq_chk" CHECK("recurrence_series"."freq" in ('daily','weekly','monthly','yearly')),
	CONSTRAINT "recurrence_series_interval_chk" CHECK("recurrence_series"."interval" >= 1),
	CONSTRAINT "recurrence_series_anchor_chk" CHECK("recurrence_series"."anchor_mode" in ('calendar','completion')),
	CONSTRAINT "recurrence_series_status_chk" CHECK("recurrence_series"."status" in ('active','ended')),
	CONSTRAINT "recurrence_series_end_chk" CHECK(("recurrence_series"."end_kind" = 'never' and "recurrence_series"."until_date" is null and "recurrence_series"."max_count" is null)
       or ("recurrence_series"."end_kind" = 'until' and "recurrence_series"."until_date" is not null and "recurrence_series"."max_count" is null)
       or ("recurrence_series"."end_kind" = 'count'  and "recurrence_series"."max_count" is not null and "recurrence_series"."until_date" is null)),
	CONSTRAINT "recurrence_series_template_chk" CHECK(("recurrence_series"."kind" = 'task' and "recurrence_series"."title" is not null) or ("recurrence_series"."kind" = 'event' and "recurrence_series"."title" is null))
);
--> statement-breakpoint
CREATE INDEX `recurrence_series_status_idx` ON `recurrence_series` (`status`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`label` text,
	`fire_at` integer NOT NULL,
	`origin_offset_minutes` integer,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "reminders_label_chk" CHECK("reminders"."task_id" is not null or ("reminders"."label" is not null and length(trim("reminders"."label")) > 0))
);
--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminders` (`sent_at`,`fire_at`);--> statement-breakpoint
CREATE INDEX `reminders_task_idx` ON `reminders` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`deadline` text,
	`scheduled_date` text,
	`priority` integer,
	`life_area_id` text,
	`series_id` text,
	`occurrence_date` text,
	`detached` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`life_area_id`) REFERENCES `life_areas`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`series_id`) REFERENCES `recurrence_series`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "tasks_title_not_empty" CHECK(length(trim("tasks"."title")) > 0),
	CONSTRAINT "tasks_status_chk" CHECK("tasks"."status" in ('open','done','missed')),
	CONSTRAINT "tasks_single_date_chk" CHECK("tasks"."deadline" is null or "tasks"."scheduled_date" is null),
	CONSTRAINT "tasks_completed_at_chk" CHECK(("tasks"."status" = 'done' and "tasks"."completed_at" is not null)
       or ("tasks"."status" <> 'done' and "tasks"."completed_at" is null)),
	CONSTRAINT "tasks_occurrence_chk" CHECK(("tasks"."series_id" is null and "tasks"."occurrence_date" is null)
       or ("tasks"."series_id" is not null and "tasks"."occurrence_date" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_series_occurrence_unq` ON `tasks` (`series_id`,`occurrence_date`) WHERE "tasks"."series_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_series_single_open_unq` ON `tasks` (`series_id`) WHERE "tasks"."series_id" is not null and "tasks"."status" = 'open';--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_deadline_idx` ON `tasks` (`deadline`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_date_idx` ON `tasks` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX `tasks_life_area_idx` ON `tasks` (`life_area_id`);