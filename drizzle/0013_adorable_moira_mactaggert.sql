CREATE TABLE `supplier_catalog_archive` (
	`id` text PRIMARY KEY NOT NULL,
	`world` text NOT NULL,
	`supplier_id` integer NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`summary_json` text NOT NULL,
	`detail_json` text,
	`legacy_path` text,
	`canonical_path` text NOT NULL,
	`source_url` text,
	`status_source` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_active_at` text,
	`deactivated_at` text NOT NULL,
	`reactivated_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_supplier_catalog_archive_world_supplier` ON `supplier_catalog_archive` (`world`,`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_supplier_catalog_archive_status_updated` ON `supplier_catalog_archive` (`status`,`updated_at`);
