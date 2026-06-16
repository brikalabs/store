CREATE TABLE `reg_downloads` (
	`name` text NOT NULL,
	`day` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`name`, `day`),
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
