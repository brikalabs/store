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
-- Backfill: every existing scope's owner becomes its first admin member, so
-- membership-based publish authorization preserves current ownership.
INSERT INTO `reg_scope_members` (`scope`, `provider`, `member_id`, `role`, `created_at`)
SELECT `scope`, `owner_provider`, `github_owner`, 'admin', `created_at` FROM `reg_scopes`;
