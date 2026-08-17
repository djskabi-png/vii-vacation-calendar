import { readSession } from "../../lib/google-auth";
import { ensureReviewSchema, latestPendingReview, reviewRuntimeEnv, uploadsBucket } from "../../lib/review-storage";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const RECEIPT_TYPES = new Set([...PHOTO_TYPES, "application/pdf"]);
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;

function textValue(data: FormData, key: string) { return String(data.get(key) || "").trim(); }
function invalid(message: string, status = 400) { return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } }); }
function safeSegment(value: string) { return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item"; }

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return invalid("נדרשת התחברות לחשבון", 401);
  const url = new URL(request.url);
  const subjectType = url.searchParams.get("subjectType") === "trail" ? "trail" : "place";
  const subjectId = (url.searchParams.get("subjectId") || "").trim().slice(0, 160);
  if (!subjectId) return invalid("חסר מזהה מקום");
  return Response.json({ review: await latestPendingReview(session.sub, subjectType, subjectId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return invalid("כדי לשלוח חוות דעת ותמונות יש להתחבר עם גוגל", 401);

  let data: FormData;
  try { data = await request.formData(); } catch { return invalid("לא הצלחנו לקרוא את הקבצים שנבחרו"); }
  const subjectType = textValue(data, "subjectType") === "trail" ? "trail" : "place";
  const subjectId = textValue(data, "subjectId").slice(0, 160);
  const placeName = textValue(data, "placeName").slice(0, 160);
  const author = textValue(data, "author").slice(0, 80);
  const visitDate = textValue(data, "visitDate");
  const bookingReference = textValue(data, "booking").slice(0, 100) || null;
  const body = textValue(data, "review").slice(0, 4000);
  const rating = Number(textValue(data, "rating"));
  const consent = textValue(data, "consent") === "yes";
  if (!subjectId || !placeName || author.length < 2 || body.length < 20 || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !Number.isInteger(rating) || rating < 1 || rating > 5 || !consent) return invalid("יש להשלים את כל שדות החובה ולאשר את תנאי השליחה");
  if (visitDate > new Date().toISOString().slice(0, 10)) return invalid("תאריך הביקור לא יכול להיות בעתיד");

  const photos = data.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const receiptEntry = data.get("receipt");
  const receipt = receiptEntry instanceof File && receiptEntry.size > 0 ? receiptEntry : null;
  if (photos.length > MAX_PHOTOS) return invalid("אפשר לצרף עד 8 תמונות");
  if (photos.some((file) => !PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_BYTES)) return invalid("כל תמונה חייבת להיות מסוג נתמך ובגודל של עד 8 מגה");
  if (receipt && (!RECEIPT_TYPES.has(receipt.type) || receipt.size > MAX_RECEIPT_BYTES)) return invalid("האסמכתה חייבת להיות תמונה או מסמך בגודל של עד 10 מגה");
  if ([...photos, ...(receipt ? [receipt] : [])].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) return invalid("הגודל הכולל של הקבצים גדול מדי");

  await ensureReviewSchema();
  const env = await reviewRuntimeEnv();
  const reviewId = crypto.randomUUID();
  const now = new Date().toISOString();
  const bucket = await uploadsBucket();
  const storedKeys: string[] = [];
  try {
    const files = [...photos.map((file) => ({ file, kind: "photo" })), ...(receipt ? [{ file: receipt, kind: "receipt" }] : [])];
    const fileRows: { id: string; key: string; kind: string; file: File }[] = [];
    for (const { file, kind } of files) {
      const fileId = crypto.randomUUID();
      const extension = file.name.includes(".") ? `.${safeSegment(file.name.split(".").pop() || "file")}` : "";
      const key = `guest-reviews/${safeSegment(subjectType)}/${safeSegment(subjectId)}/${reviewId}/${fileId}${extension}`;
      await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { reviewId, kind, owner: session.sub } });
      storedKeys.push(key);
      fileRows.push({ id: fileId, key, kind, file });
    }
    const statements = [env.DB.prepare(`INSERT INTO guest_reviews
      (id, subject_type, subject_id, place_name, user_id, user_email, author, visit_date, booking_reference, body, rating, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
      .bind(reviewId, subjectType, subjectId, placeName, session.sub, session.email, author, visitDate, bookingReference, body, rating, now, now)];
    for (const row of fileRows) statements.push(env.DB.prepare(`INSERT INTO guest_review_files
      (id, review_id, kind, object_key, original_name, content_type, byte_size, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
      .bind(row.id, reviewId, row.kind, row.key, row.file.name.slice(0, 240), row.file.type, row.file.size, now));
    await env.DB.batch(statements);
    return Response.json({ review: { id: reviewId, author, body, rating, createdAt: now, photoCount: photos.length } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await Promise.all(storedKeys.map((key) => bucket.delete(key).catch(() => undefined)));
    console.error("Guest review submission failed", error);
    return invalid("השליחה לא הושלמה. אפשר לנסות שוב בעוד רגע", 500);
  }
}
