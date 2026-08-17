CREATE INDEX `idx_guest_review_files_review` ON `guest_review_files` (`review_id`);--> statement-breakpoint
CREATE INDEX `idx_guest_reviews_owner_subject` ON `guest_reviews` (`user_id`,`subject_type`,`subject_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_guest_reviews_status_created` ON `guest_reviews` (`status`,`created_at`);
