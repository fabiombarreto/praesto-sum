CREATE TABLE `google_connections` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`refresh_token` text NOT NULL,
	`scope` text NOT NULL,
	`connected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "google_connections_singleton" CHECK("google_connections"."id" = 'default'),
	CONSTRAINT "google_connections_token_not_empty" CHECK(length(trim("google_connections"."refresh_token")) > 0)
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	CONSTRAINT "oauth_states_expiry_after_creation" CHECK("oauth_states"."expires_at" > "oauth_states"."created_at")
);
