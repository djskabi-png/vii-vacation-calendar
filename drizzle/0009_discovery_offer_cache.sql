CREATE TABLE `vii_discovery_offer_cache_v1` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`payload` text,
	`checked_at` integer DEFAULT 0 NOT NULL,
	`stale_until` integer DEFAULT 0 NOT NULL,
	`retry_after` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text
);
