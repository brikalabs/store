PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reg_trusted_publishers` (
	`scope` text NOT NULL,
	`provider` text DEFAULT 'github' NOT NULL,
	`repository` text NOT NULL,
	`workflow` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`scope`, `provider`, `repository`, `workflow`),
	FOREIGN KEY (`scope`) REFERENCES `reg_scopes`(`scope`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reg_trusted_publishers`("scope", "repository", "workflow", "created_at") SELECT "scope", "repository", "workflow", "created_at" FROM `reg_trusted_publishers`;--> statement-breakpoint
DROP TABLE `reg_trusted_publishers`;--> statement-breakpoint
ALTER TABLE `__new_reg_trusted_publishers` RENAME TO `reg_trusted_publishers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;