CREATE TABLE `vii_content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`entity_key` text NOT NULL,
	`world` text NOT NULL,
	`locale` text DEFAULT 'he' NOT NULL,
	`source_label` text NOT NULL,
	`source_json` text NOT NULL,
	`draft_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`published_version` integer,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vii_content_type_key_locale` ON `vii_content_items` (`content_type`,`entity_key`,`locale`);--> statement-breakpoint
CREATE INDEX `idx_vii_content_world_status` ON `vii_content_items` (`world`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `vii_content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`version` integer NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`content_json` text NOT NULL,
	`scheduled_at` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `vii_content_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vii_content_version` ON `vii_content_versions` (`item_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_vii_content_publish` ON `vii_content_versions` (`item_id`,`status`,`scheduled_at`,`version`);
