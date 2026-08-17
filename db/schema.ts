import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guestReviews = sqliteTable("guest_reviews", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  placeName: text("place_name").notNull(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  author: text("author").notNull(),
  visitDate: text("visit_date").notNull(),
  bookingReference: text("booking_reference"),
  body: text("body").notNull(),
  rating: integer("rating").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_guest_reviews_owner_subject").on(table.userId, table.subjectType, table.subjectId, table.createdAt),
  index("idx_guest_reviews_status_created").on(table.status, table.createdAt),
]);

export const guestReviewFiles = sqliteTable("guest_review_files", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull().references(() => guestReviews.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  objectKey: text("object_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_guest_review_files_review").on(table.reviewId),
]);
