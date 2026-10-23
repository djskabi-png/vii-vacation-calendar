import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { whatsappLeadDatabase } from "../../../lib/whatsapp-lead-storage";

export async function GET(request: Request) {
  const session = await authorizedAdminSession(request);
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = await whatsappLeadDatabase();
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || "";
    const till = url.searchParams.get("till") || "";
    const world = url.searchParams.get("world") || "";
    const query = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(500, Math.max(20, Number(url.searchParams.get("limit") || 200)));
    const where: string[] = [];
    const values: unknown[] = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where.push("created_at >= ?"); values.push(`${from}T00:00:00.000Z`); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(till)) { where.push("created_at < ?"); const next = new Date(`${till}T00:00:00.000Z`); next.setUTCDate(next.getUTCDate() + 1); values.push(next.toISOString()); }
    if (world) { where.push("world = ?"); values.push(world.slice(0, 40)); }
    if (query) { where.push("(place_name LIKE ? OR visitor_name LIKE ? OR visitor_phone LIKE ? OR reference LIKE ?)"); const like = `%${query.slice(0, 100)}%`; values.push(like, like, like, like); }
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const [total, byWorld, rows] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS count FROM whatsapp_leads${clause}`).bind(...values).first<{ count: number }>(),
      db.prepare(`SELECT world, COUNT(*) AS count FROM whatsapp_leads${clause} GROUP BY world ORDER BY count DESC`).bind(...values).all<{ world: string; count: number }>(),
      db.prepare(`SELECT submission_id AS submissionId, reference, world, place_id AS placeId,
        place_name AS placeName, visitor_name AS visitorName, visitor_phone AS visitorPhone,
        requested_date AS requestedDate, requested_till AS requestedTill, guests,
        service_name AS serviceName, source_page AS sourcePage, handoff_started_at AS handoffStartedAt,
        created_at AS createdAt FROM whatsapp_leads${clause} ORDER BY created_at DESC LIMIT ?`).bind(...values, limit).all(),
    ]);
    return Response.json({ total: total?.count || 0, byWorld: byWorld.results, leads: rows.results, filters: { from, till, world, query, limit } },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("VII WhatsApp lead report unavailable", error);
    return Response.json({ error: "report_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
