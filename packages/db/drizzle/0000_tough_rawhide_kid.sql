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
CREATE TABLE `reg_dist_tags` (
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`version` text NOT NULL,
	PRIMARY KEY(`name`, `tag`),
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_downloads` (
	`name` text NOT NULL,
	`day` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`name`, `day`),
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_packages` (
	`name` text PRIMARY KEY NOT NULL,
	`scope` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reg_scope_domains` (
	`scope` text NOT NULL,
	`domain` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`verified_at` integer,
	PRIMARY KEY(`scope`, `domain`),
	FOREIGN KEY (`scope`) REFERENCES `reg_scopes`(`scope`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_scope_members` (
	`scope` text NOT NULL,
	`provider` text DEFAULT 'github' NOT NULL,
	`member_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`scope`, `provider`, `member_id`),
	FOREIGN KEY (`scope`) REFERENCES `reg_scopes`(`scope`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_scopes` (
	`scope` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`description` text,
	`links` text,
	`icon_key` text,
	`takedown` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reg_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'github' NOT NULL,
	`github_login` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE TABLE `reg_trusted_publishers` (
	`scope` text NOT NULL,
	`provider` text DEFAULT 'github' NOT NULL,
	`repository` text NOT NULL,
	`workflow` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`scope`, `provider`, `repository`, `workflow`),
	FOREIGN KEY (`scope`) REFERENCES `reg_scopes`(`scope`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_versions` (
	`name` text NOT NULL,
	`version` text NOT NULL,
	`manifest` text NOT NULL,
	`integrity` text NOT NULL,
	`shasum` text NOT NULL,
	`size` integer NOT NULL,
	`published_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deprecated` text,
	`yanked` integer DEFAULT false NOT NULL,
	`takedown` text,
	`provenance` text,
	PRIMARY KEY(`name`, `version`),
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
