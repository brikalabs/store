ALTER TABLE `user_profiles` DROP COLUMN `avatar_url`;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `avatar_version` text;
