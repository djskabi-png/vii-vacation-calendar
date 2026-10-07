import { readSession } from "../../../lib/google-auth";
import { whatsappLeadDatabase } from "../../../lib/whatsapp-lead-storage";

export async function GET(request: Request) {
  const session = await readSession(request);
  const allowedEmails = (process.env.VII_ADMIN_EMAILS || "")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!session || !allowedEmails.includes(session.email.toLowerCase())) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = await whatsappLeadDatabase();
    const [total, byWorld, rows] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM whatsapp_leads").first<{ count: number }>(),
      db.prepare("SELECT world, COUNT(*) AS count FROM whatsapp_leads GROUP BY world ORDER BY count DESC").all<{ world: string; count: number }>(),
      db.prepare(`SELECT submission_id AS submissionId, reference, world, place_id AS placeId,
        place_name AS placeName, visitor_name AS visitorName, visitor_phone AS visitorPhone,
        requested_date AS requestedDate, requested_till AS requestedTill, guests,
        service_name AS serviceName, source_page AS sourcePage, created_at AS createdAt
        FROM whatsapp_leads ORDER BY created_at DESC LIMIT 100`).all(),
    ]);
    return Response.json({ total: total?.count || 0, byWorld: byWorld.results, leads: rows.results },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("VII WhatsApp lead report unavailable", error);
    return Response.json({ error: "report_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
