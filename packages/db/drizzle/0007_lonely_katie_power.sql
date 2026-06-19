ALTER TABLE `reg_scopes` ADD `owner_provider` text DEFAULT 'github' NOT NULL;--> statement-breakpoint
ALTER TABLE `reg_tokens` ADD `provider` text DEFAULT 'github' NOT NULL;