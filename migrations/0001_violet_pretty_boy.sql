-- D1 ignores the OFF/ON pragma pair drizzle-kit emits around a table
-- recreation; the supported form is `PRAGMA defer_foreign_keys=ON`, which
-- suspends FK enforcement until the end of the enclosing transaction. That
-- pair was rewritten by hand into the single statement below, per
-- PRPs/prds/task-detail-and-dates.prd.md (Technical Risks). The trailing
-- restore is not needed: defer_foreign_keys resets itself on commit.
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`deadline` text,
	`scheduled_date` text,
	`priority` text,
	`life_area_id` text,
	`series_id` text,
	`occurrence_date` text,
	`detached` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`life_area_id`) REFERENCES `life_areas`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`series_id`) REFERENCES `recurrence_series`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "tasks_title_not_empty" CHECK(length(trim("__new_tasks"."title")) > 0),
	CONSTRAINT "tasks_status_chk" CHECK("__new_tasks"."status" in ('open','done','missed')),
	CONSTRAINT "tasks_priority_chk" CHECK("__new_tasks"."priority" is null or "__new_tasks"."priority" in ('high','normal','low')),
	CONSTRAINT "tasks_single_date_chk" CHECK("__new_tasks"."deadline" is null or "__new_tasks"."scheduled_date" is null),
	CONSTRAINT "tasks_completed_at_chk" CHECK(("__new_tasks"."status" = 'done' and "__new_tasks"."completed_at" is not null)
       or ("__new_tasks"."status" <> 'done' and "__new_tasks"."completed_at" is null)),
	CONSTRAINT "tasks_occurrence_chk" CHECK(("__new_tasks"."series_id" is null and "__new_tasks"."occurrence_date" is null)
       or ("__new_tasks"."series_id" is not null and "__new_tasks"."occurrence_date" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "description", "status", "deadline", "scheduled_date", "priority", "life_area_id", "series_id", "occurrence_date", "detached", "completed_at", "created_at", "updated_at") SELECT "id", "title", "description", "status", "deadline", "scheduled_date", "priority", "life_area_id", "series_id", "occurrence_date", "detached", "completed_at", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_series_occurrence_unq` ON `tasks` (`series_id`,`occurrence_date`) WHERE "tasks"."series_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_series_single_open_unq` ON `tasks` (`series_id`) WHERE "tasks"."series_id" is not null and "tasks"."status" = 'open';--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_deadline_idx` ON `tasks` (`deadline`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_date_idx` ON `tasks` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX `tasks_life_area_idx` ON `tasks` (`life_area_id`);