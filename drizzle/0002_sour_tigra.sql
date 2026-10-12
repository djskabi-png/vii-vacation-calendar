CREATE TABLE `supplier_catalog_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`world` text NOT NULL,
	`supplier_id` integer NOT NULL,
	`summary_json` text NOT NULL,
	`detail_json` text,
	FOREIGN KEY (`run_id`) REFERENCES `supplier_catalog_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_supplier_catalog_entries_run_world` ON `supplier_catalog_entries` (`run_id`,`world`);--> statement-breakpoint
CREATE INDEX `idx_supplier_catalog_entries_world_supplier` ON `supplier_catalog_entries` (`world`,`supplier_id`);--> statement-breakpoint
CREATE TABLE `supplier_catalog_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`world` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`before_count` integer,
	`candidate_count` integer,
	`added_count` integer,
	`changed_count` integer,
	`removed_count` integer,
	`error_code` text
);
--> statement-breakpoint
CREATE INDEX `idx_supplier_catalog_runs_world_started` ON `supplier_catalog_runs` (`world`,`started_at`);--> statement-breakpoint
CREATE TABLE `supplier_catalog_state` (
	`world` text PRIMARY KEY NOT NULL,
	`active_run_id` text,
	`accepted_at` text,
	`active_count` integer DEFAULT 0 NOT NULL,
	`lock_run_id` text,
	`lock_until` text,
	FOREIGN KEY (`active_run_id`) REFERENCES `supplier_catalog_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
