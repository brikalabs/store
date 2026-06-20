CREATE TABLE `reg_trusted_publishers` (
	`scope` text NOT NULL,
	`repository` text NOT NULL,
	`workflow` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`scope`, `repository`, `workflow`),
	FOREIGN KEY (`scope`) REFERENCES `reg_scopes`(`scope`) ON UPDATE no action ON DELETE cascade
);
