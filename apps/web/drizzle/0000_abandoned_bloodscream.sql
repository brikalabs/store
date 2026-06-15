CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_name` text NOT NULL,
	`parent_id` text,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`plugin_name`) REFERENCES `plugins`(`name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_plugin` ON `comments` (`plugin_name`);--> statement-breakpoint
CREATE TABLE `developers` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`bio` text,
	`website` text,
	`github_login` text,
	`verified` integer DEFAULT false NOT NULL,
	`plugin_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plugin_versions` (
	`plugin_name` text NOT NULL,
	`version` text NOT NULL,
	`published_at` integer,
	`brika_engine` text,
	`changelog` text,
	`deprecated` text,
	PRIMARY KEY(`plugin_name`, `version`),
	FOREIGN KEY (`plugin_name`) REFERENCES `plugins`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plugins` (
	`name` text PRIMARY KEY NOT NULL,
	`scope` text,
	`display_name` text,
	`description` text,
	`latest_version` text NOT NULL,
	`repository` text,
	`homepage` text,
	`license` text,
	`keywords` text DEFAULT '[]' NOT NULL,
	`author_id` text,
	`downloads_weekly` integer DEFAULT 0 NOT NULL,
	`brika_engine` text NOT NULL,
	`capabilities` text,
	`grants` text,
	`icon_r2_key` text,
	`readme_r2_key` text,
	`verified` integer DEFAULT false NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`rating_average` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`first_published_at` integer,
	`last_synced_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plugins_downloads` ON `plugins` (`downloads_weekly`);--> statement-breakpoint
CREATE INDEX `idx_plugins_author` ON `plugins` (`author_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reporter_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_votes` (
	`user_id` text NOT NULL,
	`review_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`user_id`, `review_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_name` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`version_reviewed` text,
	`helpful_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`plugin_name`) REFERENCES `plugins`(`name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_plugin` ON `reviews` (`plugin_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_review_user_plugin` ON `reviews` (`user_id`,`plugin_name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` integer NOT NULL,
	`login` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);