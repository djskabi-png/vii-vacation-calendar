CREATE TABLE `guest_review_files` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `guest_reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_review_files_object_key_unique` ON `guest_review_files` (`object_key`);--> statement-breakpoint
CREATE TABLE `guest_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`place_name` text NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`author` text NOT NULL,
	`visit_date` text NOT NULL,
	`booking_reference` text,
	`body` text NOT NULL,
	`rating` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
