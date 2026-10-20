CREATE TABLE `vii_map_snapshots_v1` (
	`entity_key` text PRIMARY KEY NOT NULL,
	`world` text NOT NULL,
	`place_id` text NOT NULL,
	`place_name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`precision` text NOT NULL,
	`zoom` integer NOT NULL,
	`source_hash` text NOT NULL,
	`status` text DEFAULT 'missing' NOT NULL,
	`object_key` text,
	`content_type` text,
	`byte_size` integer,
	`width` integer,
	`height` integer,
	`provider` text,
	`attribution` text,
	`generated_at` text,
	`checked_at` text NOT NULL,
	`retry_after` text,
	`lease_until` text,
	`lease_token` text,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_vii_map_snapshots_status_retry` ON `vii_map_snapshots_v1` (`status`,`retry_after`);
--> statement-breakpoint
CREATE INDEX `idx_vii_map_snapshots_world_place` ON `vii_map_snapshots_v1` (`world`,`place_id`);
