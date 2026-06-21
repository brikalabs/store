ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `website` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_version` text;--> statement-breakpoint
ALTER TABLE `users` ADD `links` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `users` SET
	`display_name` = (SELECT `display_name` FROM `user_profiles` WHERE `user_profiles`.`user_id` = `users`.`id`),
	`bio` = (SELECT `bio` FROM `user_profiles` WHERE `user_profiles`.`user_id` = `users`.`id`),
	`website` = (SELECT `website` FROM `user_profiles` WHERE `user_profiles`.`user_id` = `users`.`id`),
	`avatar_version` = (SELECT `avatar_version` FROM `user_profiles` WHERE `user_profiles`.`user_id` = `users`.`id`),
	`links` = COALESCE((SELECT `links` FROM `user_profiles` WHERE `user_profiles`.`user_id` = `users`.`id`), '[]')
	WHERE `id` IN (SELECT `user_id` FROM `user_profiles`);--> statement-breakpoint
DROP TABLE `user_profiles`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `login`;
