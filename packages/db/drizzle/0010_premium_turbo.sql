DROP TABLE `reg_scope_members`;--> statement-breakpoint
ALTER TABLE `reg_scopes` DROP COLUMN `owner_provider`;--> statement-breakpoint
ALTER TABLE `reg_scopes` DROP COLUMN `github_owner`;--> statement-breakpoint
ALTER TABLE `reg_scopes` DROP COLUMN `display_name`;