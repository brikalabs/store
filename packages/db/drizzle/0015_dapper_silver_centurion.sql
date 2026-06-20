PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
CREATE TABLE `__new_reg_scopes` (
	`scope` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`description` text,
	`links` text,
	`icon_key` text,
	`takedown` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_reg_scopes`("scope", "created_at") SELECT "scope", "created_at" FROM `reg_scopes`;--> statement-breakpoint
DROP TABLE `reg_scopes`;--> statement-breakpoint
ALTER TABLE `__new_reg_scopes` RENAME TO `reg_scopes`;--> statement-breakpoint
DROP TABLE `reg_org_domains`;--> statement-breakpoint
DROP TABLE `reg_org_members`;--> statement-breakpoint
DROP TABLE `reg_orgs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
