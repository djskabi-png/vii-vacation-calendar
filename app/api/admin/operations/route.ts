import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { operationsDatabase } from "../../../lib/operations-audit.ts";
import { ensureReviewSchema } from "../../../lib/review-storage.ts";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  try {
    const db = await operationsDatabase();
    await ensureReviewSchema();
    const params = new URL(request.url).searchParams;
    const offset = Math.min(100_000, Math.max(0, Number.parseInt(params.get("offset") || "0", 10) || 0));
    const query = (params.get("q") || "").trim().slice(0, 100);
    const pattern = `%${query}%`;
    const world = (params.get("world") || "").trim().slice(0, 40);
    const status = (params.get("status") || "").trim().slice(0, 40);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get("from") || "") ? `${params.get("from")}T00:00:00.000Z` : "";
    const till = /^\d{4}-\d{2}-\d{2}$/.test(params.get("till") || "") ? `${params.get("till")}T23:59:59.999Z` : "";
    const bookingFilters: string[] = [];
    const bookingArgs: unknown[] = [];
    if (query) { bookingFilters.push("(b.id LIKE ? OR b.place_name LIKE ? OR b.supplier_id LIKE ?)"); bookingArgs.push(pattern, pattern, pattern); }
    if (world) { bookingFilters.push("b.world = ?"); bookingArgs.push(world); }
    if (status) { bookingFilters.push("b.status = ?"); bookingArgs.push(status); }
    if (from) { bookingFilters.push("b.created_at >= ?"); bookingArgs.push(from); }
    if (till) { bookingFilters.push("b.created_at <= ?"); bookingArgs.push(till); }
    const bookingWhere = bookingFilters.length ? ` WHERE ${bookingFilters.join(" AND ")}` : "";
    const reviewWhere = query ? " WHERE (id LIKE ? OR place_name LIKE ?)" : "";
    const bookingRows = db.prepare(`SELECT b.id, b.world, b.place_id AS placeId, b.place_name AS placeName,
      b.destination, b.status, b.supplier_id AS supplierId, b.created_at AS createdAt, b.updated_at AS updatedAt,
      c.arrival_date AS arrivalDate, c.departure_date AS departureDate,
      f.amount, f.currency
      FROM vii_booking_audit b LEFT JOIN vii_booking_context c ON c.id = b.id
      LEFT JOIN vii_booking_financials f ON f.id = b.id
      ${bookingWhere} ORDER BY b.created_at DESC LIMIT 100 OFFSET ?`);
    const reviewRows = db.prepare(`SELECT id, subject_type AS subjectType, subject_id AS subjectId,
      place_name AS placeName, author, rating, status, created_at AS createdAt
      FROM guest_reviews${reviewWhere} ORDER BY created_at DESC LIMIT 100 OFFSET ?`);
    const bookingCount = db.prepare(`SELECT COUNT(*) AS count FROM vii_booking_audit b${bookingWhere}`);
    const reviewCount = db.prepare(`SELECT COUNT(*) AS count FROM guest_reviews${reviewWhere}`);
    const [bookings, reviews, bookingTotal, reviewTotal] = await Promise.allSettled([
      bookingRows.bind(...bookingArgs, offset).all(),
      query ? reviewRows.bind(pattern, pattern, offset).all() : reviewRows.bind(offset).all(),
      bookingCount.bind(...bookingArgs).first<{ count: number }>(),
      query ? reviewCount.bind(pattern, pattern).first<{ count: number }>() : reviewCount.first<{ count: number }>(),
    ]);
    if (bookings.status === "rejected" && reviews.status === "rejected") throw bookings.reason;
    const bookingResults = bookings.status === "fulfilled" ? bookings.value.results : [];
    const reviewResults = reviews.status === "fulfilled" ? reviews.value.results : [];
    const warnings = [
      ...(bookings.status === "rejected" ? ["bookings_unavailable"] : []),
      ...(reviews.status === "rejected" ? ["reviews_unavailable"] : []),
    ];
    return Response.json({ bookings: bookingResults, reviews: reviewResults, warnings,
      integrationStatus: { spa: { requestCapture: "vii_leads", providerBookingConfirmation: (process.env.VII_SPAPLUS_BOOKING_WEBHOOK_SECRET?.trim().length || 0) >= 32 ? "receiver_configured" : "receiver_credential_missing",
        conversionMeasurement: "server_receipt_only", requiredFromGal: ["כתובת callback מאובטחת או webhook", "מזהה הזמנה יציב", "מצב הזמנה וביטול", "סכום ומטבע", "חתימה ואופן אימותה"] } },
      manualChecks: [{ id: "supplier-delivery-2026-10-13", date: "2026-10-13", reporter: "Adir",
        bookingDelivered: true, reviewDelivered: true, linkedToReferences: false }],
      bookingTotal: bookingTotal.status === "fulfilled" ? bookingTotal.value?.count || 0 : bookingResults.length,
      reviewTotal: reviewTotal.status === "fulfilled" ? reviewTotal.value?.count || 0 : reviewResults.length,
      offset, filters: { query, world, status, from: params.get("from") || "", till: params.get("till") || "" } }, { headers });
  } catch (error) {
    console.error("VII operations report unavailable", error);
    return Response.json({ error: "report_unavailable" }, { status: 503, headers });
  }
}

export async function PATCH(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  let payload: { id?: unknown; status?: unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers }); }
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const status = payload.status === "approved" || payload.status === "rejected" ? payload.status : "";
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || !status) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  try {
    const db = await operationsDatabase();
    await ensureReviewSchema();
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE guest_reviews SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(status, now, id),
      db.prepare("UPDATE guest_review_files SET status = ? WHERE review_id = ? AND status = 'pending'").bind(status, id),
    ]);
    return Response.json({ success: true, id, status, updatedAt: now }, { headers });
  } catch (error) {
    console.error("V review moderation unavailable", error);
    return Response.json({ error: "moderation_unavailable" }, { status: 503, headers });
  }
}
