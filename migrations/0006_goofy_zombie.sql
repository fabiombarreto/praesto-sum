ALTER TABLE `recurrence_series` ADD `nudged_at` integer;--> statement-breakpoint
ALTER TABLE `recurrence_series` ADD `nudge_muted` integer DEFAULT false NOT NULL;