CREATE TABLE IF NOT EXISTS `vii_admin_report_cache_v1` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`parameters` text NOT NULL,
	`payload` text NOT NULL,
	`saved_at` text NOT NULL,
	`fresh_until` text NOT NULL,
	`stale_until` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_admin_report_cache_family` ON `vii_admin_report_cache_v1` (`family`,`saved_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vii_biz_conversion_contacts_v1` (
	`contact_key` text PRIMARY KEY NOT NULL,
	`world` text NOT NULL,
	`site_id` integer NOT NULL,
	`source` text NOT NULL,
	`contact_id` integer NOT NULL,
	`contact_day` text NOT NULL,
	`identified` integer NOT NULL,
	`order_id` text,
	`order_price` real NOT NULL,
	`customer_key` text,
	`delay` integer,
	`supplier_created_at` text NOT NULL,
	`saved_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_biz_conversion_contacts_range` ON `vii_biz_conversion_contacts_v1` (`contact_day`,`world`,`site_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vii_biz_conversion_coverage_v1` (
	`coverage_key` text PRIMARY KEY NOT NULL,
	`world` text NOT NULL,
	`site_id` integer NOT NULL,
	`from_day` text NOT NULL,
	`till_day` text NOT NULL,
	`supplier_created_at` text NOT NULL,
	`saved_at` text NOT NULL,
	`stale_after` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_biz_conversion_coverage_range` ON `vii_biz_conversion_coverage_v1` (`from_day`,`till_day`,`world`,`site_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vii_biz_conversion_failures_v1` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`world` text NOT NULL,
	`site_id` integer NOT NULL,
	`from_day` text NOT NULL,
	`till_day` text NOT NULL,
	`error_code` text NOT NULL,
	`saved_at` text NOT NULL,
	`retry_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_biz_conversion_failure_range` ON `vii_biz_conversion_failures_v1` (`from_day`,`till_day`,`world`,`site_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vii_biz_conversion_snapshots_v1` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`world` text NOT NULL,
	`site_id` integer NOT NULL,
	`from_day` text NOT NULL,
	`till_day` text NOT NULL,
	`payload` text NOT NULL,
	`supplier_created_at` text NOT NULL,
	`saved_at` text NOT NULL,
	`stale_after` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_biz_conversion_range` ON `vii_biz_conversion_snapshots_v1` (`from_day`,`till_day`,`world`,`site_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vii_biz_report_runs_v1` (
	`job_id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`from_day` text NOT NULL,
	`till_day` text NOT NULL,
	`scope` text NOT NULL,
	`force_refresh` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	`succeeded` integer DEFAULT 0 NOT NULL,
	`unsupported_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_biz_report_runs_actor_time` ON `vii_biz_report_runs_v1` (`actor_email`,`started_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_biz_report_runs_time` ON `vii_biz_report_runs_v1` (`started_at`);
