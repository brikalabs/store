CREATE TABLE `reg_search` (
	`name` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`display_name` text,
	`description` text,
	`keywords` text DEFAULT '' NOT NULL,
	`tools` integer DEFAULT 0 NOT NULL,
	`blocks` integer DEFAULT 0 NOT NULL,
	`bricks` integer DEFAULT 0 NOT NULL,
	`sparks` integer DEFAULT 0 NOT NULL,
	`pages` integer DEFAULT 0 NOT NULL,
	`published_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reg_keywords` (
	`name` text NOT NULL,
	`keyword` text NOT NULL,
	PRIMARY KEY(`name`, `keyword`),
	FOREIGN KEY (`name`) REFERENCES `reg_packages`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reg_keywords_keyword_idx` ON `reg_keywords` (`keyword`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `reg_search_fts` USING fts5(
	name, display_name, description, keywords,
	content='reg_search', content_rowid='rowid', tokenize='unicode61'
);
--> statement-breakpoint
CREATE TRIGGER `reg_search_ai` AFTER INSERT ON `reg_search` BEGIN
	INSERT INTO reg_search_fts(rowid, name, display_name, description, keywords)
	VALUES (new.rowid, new.name, new.display_name, new.description, new.keywords);
END;
--> statement-breakpoint
CREATE TRIGGER `reg_search_ad` AFTER DELETE ON `reg_search` BEGIN
	INSERT INTO reg_search_fts(reg_search_fts, rowid, name, display_name, description, keywords)
	VALUES ('delete', old.rowid, old.name, old.display_name, old.description, old.keywords);
END;
--> statement-breakpoint
CREATE TRIGGER `reg_search_au` AFTER UPDATE ON `reg_search` BEGIN
	INSERT INTO reg_search_fts(reg_search_fts, rowid, name, display_name, description, keywords)
	VALUES ('delete', old.rowid, old.name, old.display_name, old.description, old.keywords);
	INSERT INTO reg_search_fts(rowid, name, display_name, description, keywords)
	VALUES (new.rowid, new.name, new.display_name, new.description, new.keywords);
END;
--> statement-breakpoint
INSERT INTO reg_search (name, version, display_name, description, keywords, tools, blocks, bricks, sparks, pages, published_at)
SELECT p.name, dt.version,
	json_extract(v.manifest, '$.displayName'),
	json_extract(v.manifest, '$.description'),
	COALESCE((SELECT group_concat(je.value, ' ') FROM json_each(v.manifest, '$.keywords') je WHERE je.type = 'text'), ''),
	COALESCE(json_array_length(v.manifest, '$.tools'), 0),
	COALESCE(json_array_length(v.manifest, '$.blocks'), 0),
	COALESCE(json_array_length(v.manifest, '$.bricks'), 0),
	COALESCE(json_array_length(v.manifest, '$.sparks'), 0),
	COALESCE(json_array_length(v.manifest, '$.pages'), 0),
	v.published_at
FROM reg_dist_tags dt
JOIN reg_versions v ON v.name = dt.name AND v.version = dt.version
JOIN reg_packages p ON p.name = dt.name
WHERE dt.tag = 'latest' AND v.yanked = 0 AND v.takedown IS NULL;
--> statement-breakpoint
INSERT INTO reg_keywords (name, keyword)
SELECT DISTINCT dt.name, lower(je.value)
FROM reg_dist_tags dt
JOIN reg_versions v ON v.name = dt.name AND v.version = dt.version
JOIN json_each(v.manifest, '$.keywords') je
WHERE dt.tag = 'latest' AND v.yanked = 0 AND v.takedown IS NULL
	AND je.type = 'text' AND je.value <> '';
