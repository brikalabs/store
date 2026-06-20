CREATE TABLE `reg_org_domains` (
	`org_slug` text NOT NULL,
	`domain` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`verified_at` integer,
	PRIMARY KEY(`org_slug`, `domain`),
	FOREIGN KEY (`org_slug`) REFERENCES `reg_orgs`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `reg_orgs` ADD `description` text;--> statement-breakpoint
ALTER TABLE `reg_orgs` ADD `links` text;--> statement-breakpoint
ALTER TABLE `reg_orgs` ADD `icon_key` text;