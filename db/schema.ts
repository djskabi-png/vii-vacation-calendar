import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const discoveryOfferCache = sqliteTable("vii_discovery_offer_cache_v1", {
  cacheKey: text("cache_key").primaryKey().notNull(),
  payload: text("payload"),
  checkedAt: integer("checked_at").notNull().default(0),
  staleUntil: integer("stale_until").notNull().default(0),
  retryAfter: integer("retry_after").notNull().default(0),
  leaseUntil: integer("lease_until").notNull().default(0),
  leaseToken: text("lease_token"),
});

export const bizConversionSnapshots = sqliteTable("vii_biz_conversion_snapshots_v1", {
  cacheKey: text("cache_key").primaryKey().notNull(),
  world: text("world").notNull(),
  siteId: integer("site_id").notNull(),
  fromDay: text("from_day").notNull(),
  tillDay: text("till_day").notNull(),
  payload: text("payload").notNull(),
  supplierCreatedAt: text("supplier_created_at").notNull(),
  savedAt: text("saved_at").notNull(),
  staleAfter: text("stale_after").notNull(),
}, (table) => [
  index("idx_vii_biz_conversion_range").on(table.fromDay, table.tillDay, table.world, table.siteId),
]);

export const mapSnapshots = sqliteTable("vii_map_snapshots_v1", {
  entityKey: text("entity_key").primaryKey().notNull(),
  world: text("world").notNull(),
  placeId: text("place_id").notNull(),
  placeName: text("place_name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  precision: text("precision").notNull(),
  zoom: integer("zoom").notNull(),
  sourceHash: text("source_hash").notNull(),
  status: text("status").notNull().default("missing"),
  objectKey: text("object_key"),
  contentType: text("content_type"),
  byteSize: integer("byte_size"),
  width: integer("width"),
  height: integer("height"),
  provider: text("provider"),
  attribution: text("attribution"),
  generatedAt: text("generated_at"),
  checkedAt: text("checked_at").notNull(),
  retryAfter: text("retry_after"),
  leaseUntil: text("lease_until"),
  leaseToken: text("lease_token"),
  lastError: text("last_error"),
}, (table) => [
  index("idx_vii_map_snapshots_status_retry").on(table.status, table.retryAfter),
  index("idx_vii_map_snapshots_world_place").on(table.world, table.placeId),
]);

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

export const supplierCatalogRuns = sqliteTable("supplier_catalog_runs", {
  id: text("id").primaryKey(),
  world: text("world").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  beforeCount: integer("before_count"),
  candidateCount: integer("candidate_count"),
  addedCount: integer("added_count"),
  changedCount: integer("changed_count"),
  removedCount: integer("removed_count"),
  errorCode: text("error_code"),
  diagnosticsJson: text("diagnostics_json"),
}, (table) => [
  index("idx_supplier_catalog_runs_world_started").on(table.world, table.startedAt),
]);

export const supplierCatalogEntries = sqliteTable("supplier_catalog_entries", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => supplierCatalogRuns.id),
  world: text("world").notNull(),
  supplierId: integer("supplier_id").notNull(),
  summaryJson: text("summary_json").notNull(),
  detailJson: text("detail_json"),
}, (table) => [
  index("idx_supplier_catalog_entries_run_world").on(table.runId, table.world),
  index("idx_supplier_catalog_entries_world_supplier").on(table.world, table.supplierId),
]);

export const supplierCatalogState = sqliteTable("supplier_catalog_state", {
  world: text("world").primaryKey(),
  activeRunId: text("active_run_id").references(() => supplierCatalogRuns.id),
  acceptedAt: text("accepted_at"),
  activeCount: integer("active_count").notNull().default(0),
  lockRunId: text("lock_run_id"),
  lockUntil: text("lock_until"),
});

export const discoveryPromotionDraftEvents = sqliteTable("discovery_promotion_draft_events", {
  eventId: text("event_id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  version: integer("version").notNull(),
  world: text("world").notNull(),
  supplierId: integer("supplier_id").notNull(),
  placeName: text("place_name").notNull(),
  kind: text("kind").notNull(),
  weight: integer("weight").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  contractEndsOn: text("contract_ends_on"),
  contractSource: text("contract_source"),
  note: text("note").notNull(),
  status: text("status").notNull(),
  actorEmail: text("actor_email").notNull(),
  savedAt: text("saved_at").notNull(),
}, (table) => [
  uniqueIndex("idx_discovery_promotion_draft_version").on(table.campaignId, table.version),
  index("idx_discovery_promotion_draft_saved").on(table.savedAt),
]);
