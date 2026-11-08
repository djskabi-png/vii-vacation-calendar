ALTER TABLE `discovery_promotion_draft_events` ADD COLUMN `featured` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `discovery_promotion_draft_events` ADD COLUMN `turbo_eligible` integer NOT NULL DEFAULT 0;
