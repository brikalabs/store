CREATE TABLE `reg_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`package_name` text,
	`version` text,
	`actor` text,
	`detail` text,
	`at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reg_scopes` (
	`scope` text PRIMARY KEY NOT NULL,
	`github_owner` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
