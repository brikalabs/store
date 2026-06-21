CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`bio` text,
	`website` text,
	`links` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `developers`;
