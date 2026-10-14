CREATE TABLE `supplier_catalog_retry_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`root_run_id` text NOT NULL,
	`world` text NOT NULL,
	`attempt` integer NOT NULL,
	`due_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`result_status` text,
	`result_run_id` text,
	`error_code` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_supplier_catalog_retry_root_attempt` ON `supplier_catalog_retry_jobs` (`root_run_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_supplier_catalog_retry_due` ON `supplier_catalog_retry_jobs` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_supplier_catalog_retry_world_created` ON `supplier_catalog_retry_jobs` (`world`,`created_at`);
