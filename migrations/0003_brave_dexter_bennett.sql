CREATE TABLE `google_calendar_selections` (
	`calendar_id` text PRIMARY KEY NOT NULL,
	`selected_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "google_calendar_selections_id_not_empty" CHECK(length(trim("google_calendar_selections"."calendar_id")) > 0)
);
