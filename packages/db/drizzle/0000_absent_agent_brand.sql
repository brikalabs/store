CREATE TABLE `reg_dist_tags` (
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`version` text NOT NULL,
	PRIMARY KEY(`name`, `tag`),
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_packages` (
	`name` text PRIMARY KEY NOT NULL,
	`scope` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
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
	PRIMARY KEY(`name`, `version`),
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
