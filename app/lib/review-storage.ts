export type PendingReviewRecord = { id: string; author: string; body: string; rating: number; createdAt: string; photoCount: number };

export async function reviewRuntimeEnv() {
  const runtime = await import("cloudflare:workers");
  return runtime.env as unknown as { DB: D1Database; UPLOADS: R2Bucket };
}

export async function ensureReviewSchema() {
  const env = await reviewRuntimeEnv();
  const db = env.DB;
  if (!db) throw new Error("Review database is unavailable");
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS guest_reviews (
      id TEXT PRIMARY KEY NOT NULL,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      place_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      author TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      booking_reference TEXT,
      body TEXT NOT NULL,
      rating INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS guest_review_files (
      id TEXT PRIMARY KEY NOT NULL,
      review_id TEXT NOT NULL REFERENCES guest_reviews(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_guest_reviews_owner_subject ON guest_reviews(user_id, subject_type, subject_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_guest_reviews_status_created ON guest_reviews(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_guest_review_files_review ON guest_review_files(review_id)"),
  ]);
}

export async function latestPendingReview(userId: string, subjectType: string, subjectId: string): Promise<PendingReviewRecord | null> {
  await ensureReviewSchema();
  const env = await reviewRuntimeEnv();
  const row = await env.DB.prepare(`SELECT r.id, r.author, r.body, r.rating, r.created_at AS createdAt,
    (SELECT COUNT(*) FROM guest_review_files f WHERE f.review_id = r.id AND f.kind = 'photo') AS photoCount
    FROM guest_reviews r WHERE r.user_id = ? AND r.subject_type = ? AND r.subject_id = ? AND r.status = 'pending'
    ORDER BY r.created_at DESC LIMIT 1`).bind(userId, subjectType, subjectId).first<PendingReviewRecord>();
  return row || null;
}

export async function uploadsBucket() {
  const env = await reviewRuntimeEnv();
  if (!env.UPLOADS) throw new Error("Review upload storage is unavailable");
  return env.UPLOADS;
}
