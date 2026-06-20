CREATE TABLE `plugin_listings` (
	`plugin_name` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`summary` text,
	`description` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`keywords` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
