CREATE TABLE `cron_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`outcome` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`error_message` text,
	CONSTRAINT "cron_runs_outcome_chk" CHECK("cron_runs"."outcome" in ('success', 'failure'))
);
--> statement-breakpoint
CREATE INDEX `cron_runs_started_at_idx` ON `cron_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `push_dispatch_attempts` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`attempted_at` integer NOT NULL,
	`results` text NOT NULL,
	CONSTRAINT "push_dispatch_attempts_singleton" CHECK("push_dispatch_attempts"."id" = 'default')
);
