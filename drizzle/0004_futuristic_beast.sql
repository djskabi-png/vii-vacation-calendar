CREATE TABLE `discovery_promotion_draft_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`version` integer NOT NULL,
	`world` text NOT NULL,
	`supplier_id` integer NOT NULL,
	`place_name` text NOT NULL,
	`kind` text NOT NULL,
	`weight` integer NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`contract_ends_on` text,
	`contract_source` text,
	`note` text NOT NULL,
	`status` text NOT NULL,
	`actor_email` text NOT NULL,
	`saved_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_discovery_promotion_draft_version` ON `discovery_promotion_draft_events` (`campaign_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_discovery_promotion_draft_saved` ON `discovery_promotion_draft_events` (`saved_at`);