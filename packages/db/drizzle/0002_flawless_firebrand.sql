CREATE TABLE `reg_device_auth` (
	`device_code` text PRIMARY KEY NOT NULL,
	`user_code` text NOT NULL,
	`github_login` text,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reg_device_auth_user_code_unique` ON `reg_device_auth` (`user_code`);--> statement-breakpoint
CREATE TABLE `reg_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`github_login` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer
);
