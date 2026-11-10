CREATE TABLE `event_sync_links` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`calendar_id` text NOT NULL,
	`external_event_id` text NOT NULL,
	`etag` text,
	`synced_content_hash` text,
	`synced_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_sync_links_event_id_unq` ON `event_sync_links` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_sync_links_external_unq` ON `event_sync_links` (`calendar_id`,`external_event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`all_day` integer NOT NULL,
	`start_at` integer,
	`end_at` integer,
	`start_date` text,
	`end_date` text,
	`timezone` text NOT NULL,
	`source` text DEFAULT 'local' NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "events_title_not_empty" CHECK(length(trim("events"."title", char(32, 9, 10, 13))) > 0),
	CONSTRAINT "events_source_chk" CHECK("events"."source" in ('local','google')),
	CONSTRAINT "events_shape_chk" CHECK(("events"."all_day" = 1 and "events"."start_at" is null and "events"."end_at" is null
         and "events"."start_date" is not null and "events"."end_date" is not null and "events"."end_date" > "events"."start_date")
       or ("events"."all_day" = 0 and "events"."start_date" is null and "events"."end_date" is null
         and "events"."start_at" is not null and "events"."end_at" is not null and "events"."end_at" >= "events"."start_at"))
);
--> statement-breakpoint
CREATE INDEX `events_start_at_idx` ON `events` (`start_at`);--> statement-breakpoint
CREATE INDEX `events_start_date_idx` ON `events` (`start_date`);