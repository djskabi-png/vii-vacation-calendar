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
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const [bookings, reviews, bookingTotal, reviewTotal] = await Promise.all([
      db.prepare(`SELECT id, world, place_id AS placeId, place_name AS placeName,
        destination, status, supplier_id AS supplierId, created_at AS createdAt,
        updated_at AS updatedAt FROM vii_booking_audit
        WHERE (? = '' OR id LIKE ? ESCAPE '\\' OR place_name LIKE ? ESCAPE '\\')
        ORDER BY created_at DESC LIMIT 100 OFFSET ?`).bind(query, pattern, pattern, offset).all(),
      db.prepare(`SELECT id, subject_type AS subjectType, subject_id AS subjectId,
        place_name AS placeName, author, rating, status, created_at AS createdAt,
        updated_at AS updatedAt FROM guest_reviews
        WHERE (? = '' OR id LIKE ? ESCAPE '\\' OR place_name LIKE ? ESCAPE '\\')
        ORDER BY created_at DESC LIMIT 100 OFFSET ?`).bind(query, pattern, pattern, offset).all(),
      db.prepare(`SELECT COUNT(*) AS count FROM vii_booking_audit
        WHERE (? = '' OR id LIKE ? ESCAPE '\\' OR place_name LIKE ? ESCAPE '\\')`).bind(query, pattern, pattern).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM guest_reviews
        WHERE (? = '' OR id LIKE ? ESCAPE '\\' OR place_name LIKE ? ESCAPE '\\')`).bind(query, pattern, pattern).first<{ count: number }>(),
    ]);
    return Response.json({ bookings: bookings.results, reviews: reviews.results,
      manualChecks: [{ id: "supplier-delivery-2026-10-13", date: "2026-10-13", reporter: "Adir",
        bookingDelivered: true, reviewDelivered: true, linkedToReferences: false }],
      bookingTotal: bookingTotal?.count || 0, reviewTotal: reviewTotal?.count || 0, offset }, { headers });
  } catch (error) {
    console.error("VII operations report unavailable", error);
    return Response.json({ error: "report_unavailable" }, { status: 503, headers });
  }
}
