CREATE TABLE `reg_org_members` (
	`org_slug` text NOT NULL,
	`provider` text DEFAULT 'github' NOT NULL,
	`member_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`org_slug`, `provider`, `member_id`),
	FOREIGN KEY (`org_slug`) REFERENCES `reg_orgs`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_orgs` (
	`slug` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `reg_scopes` ADD `org_id` text REFERENCES reg_orgs(slug);
--> statement-breakpoint
-- ORG-001/002 backfill: reshape the 1:1 scope-ownership model into the 1:N org model.
-- One org per existing scope (slug = scope without '@'), carrying its display name +
-- creation time. Order matters: orgs first (FK target), then point scopes at them, then
-- move membership.
INSERT INTO `reg_orgs` (`slug`, `display_name`, `created_at`)
SELECT substr(`scope`, 2), `display_name`, `created_at` FROM `reg_scopes`;
--> statement-breakpoint
UPDATE `reg_scopes` SET `org_id` = substr(`scope`, 2);
--> statement-breakpoint
INSERT INTO `reg_org_members` (`org_slug`, `provider`, `member_id`, `role`, `created_at`)
SELECT substr(`scope`, 2), `provider`, `member_id`, `role`, `created_at` FROM `reg_scope_members`;