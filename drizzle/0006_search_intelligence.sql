CREATE TABLE IF NOT EXISTS `vii_search_demand_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`world` text NOT NULL,
	`location` text NOT NULL,
	`filters_json` text NOT NULL,
	`page_path` text NOT NULL,
	`result_count` integer NOT NULL,
	`zero_result` integer NOT NULL,
	`has_date` integer DEFAULT 0 NOT NULL,
	`session_id` text,
	`internal` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_search_demand_period` ON `vii_search_demand_events` (`created_at`,`internal`,`opportunity_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vii_search_page_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_key` text NOT NULL,
	`world` text NOT NULL,
	`locale` text DEFAULT 'he' NOT NULL,
	`location` text NOT NULL,
	`filters_json` text NOT NULL,
	`source_path` text NOT NULL,
	`proposed_path` text NOT NULL,
	`suggested_title` text NOT NULL,
	`latest_result_count` integer DEFAULT 0 NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`search_count` integer DEFAULT 0 NOT NULL,
	`zero_result_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assignee` text,
	`title` text,
	`meta_title` text,
	`meta_description` text,
	`h1` text,
	`summary` text,
	`body` text,
	`faq_json` text DEFAULT '[]' NOT NULL,
	`slug` text,
	`canonical_path` text,
	`robots_index` integer DEFAULT 0 NOT NULL,
	`scheduled_at` text,
	`published_at` text,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text,
	`updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_vii_search_opportunity_key` ON `vii_search_page_opportunities` (`canonical_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vii_search_opportunity_status` ON `vii_search_page_opportunities` (`status`,`last_seen_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vii_search_page_opportunity_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`action` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_vii_search_opportunity_version` ON `vii_search_page_opportunity_versions` (`opportunity_id`,`version`);
