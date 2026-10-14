import { readSession } from "../../../lib/google-auth.ts";
import { operationsDatabase } from "../../../lib/operations-audit.ts";
import { ensureReviewSchema } from "../../../lib/review-storage.ts";
import { whatsappLeadDatabase } from "../../../lib/whatsapp-lead-storage.ts";
import { readSupplierCatalogDashboard } from "../../../lib/supplier-catalog-store.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

type Activity = { id: string; type: string; label: string; detail: string; at: string; href: string };

async function count(db: D1Database, table: string) {
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<{ total: number }>();
  return row?.total ?? 0;
}

async function readActivities(db: D1Database): Promise<Activity[]> {
  const [bookings, reviews, leads, syncs, promotions] = await Promise.allSettled([
    db.prepare(`SELECT id, place_name AS name, created_at AS at FROM vii_booking_audit ORDER BY created_at DESC LIMIT 5`).all<{ id: string; name: string; at: string }>(),
    db.prepare(`SELECT id, place_name AS name, created_at AS at FROM guest_reviews ORDER BY created_at DESC LIMIT 5`).all<{ id: string; name: string; at: string }>(),
    db.prepare(`SELECT submission_id AS id, place_name AS name, created_at AS at FROM whatsapp_leads ORDER BY created_at DESC LIMIT 5`).all<{ id: string; name: string; at: string }>(),
    db.prepare(`SELECT id, world, status, started_at AS at FROM supplier_catalog_runs ORDER BY started_at DESC LIMIT 5`).all<{ id: string; world: string; status: string; at: string }>(),
    db.prepare(`SELECT event_id AS id, place_name AS name, saved_at AS at FROM discovery_promotion_draft_events ORDER BY saved_at DESC LIMIT 5`).all<{ id: string; name: string; at: string }>(),
  ]);
  return [
    ...(bookings.status === "fulfilled" ? bookings.value.results : []).map((entry) => ({ id: entry.id, type: "booking", label: "בקשת הזמנה", detail: entry.name, at: entry.at, href: "/admin/operations" })),
    ...(reviews.status === "fulfilled" ? reviews.value.results : []).map((entry) => ({ id: entry.id, type: "review", label: "חוות דעת", detail: entry.name, at: entry.at, href: "/admin/operations" })),
    ...(leads.status === "fulfilled" ? leads.value.results : []).map((entry) => ({ id: entry.id, type: "whatsapp", label: "פניית וואטסאפ", detail: entry.name, at: entry.at, href: "/admin/whatsapp-leads" })),
    ...(syncs.status === "fulfilled" ? syncs.value.results : []).map((entry) => ({ id: entry.id, type: "sync", label: "משיכת קטלוג", detail: `${entry.world} · ${entry.status}`, at: entry.at, href: "/admin/catalog-sync" })),
    ...(promotions.status === "fulfilled" ? promotions.value.results : []).map((entry) => ({ id: entry.id, type: "promotion", label: "טיוטת קידום", detail: entry.name, at: entry.at, href: "/admin/discovery-promotions" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
}

export async function GET(request: Request) {
  const allowlist = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const session = await readSession(request).catch(() => null);
  if (!session || !allowlist.includes(session.email.toLowerCase())) {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  try {
    const db = await operationsDatabase();
    await Promise.allSettled([ensureReviewSchema(), whatsappLeadDatabase()]);
    const [bookings, reviews, whatsappLeads, catalog, activity] = await Promise.all([
      count(db, "vii_booking_audit").catch(() => null),
      count(db, "guest_reviews").catch(() => null),
      count(db, "whatsapp_leads").catch(() => null),
      readSupplierCatalogDashboard(db).catch(() => null), readActivities(db),
    ]);
    return Response.json({
      account: { name: session.name, email: session.email },
      totals: { bookings, reviews, whatsappLeads },
      catalog: catalog?.states.map((state) => ({ world: state.world, activeCount: state.activeCount, acceptedAt: state.acceptedAt })) ?? null,
      recentActivity: activity,
      generatedAt: new Date().toISOString(),
    }, { headers });
  } catch (error) {
    console.error("VII admin overview unavailable", error);
    return Response.json({ error: "overview_unavailable" }, { status: 503, headers });
  }
}
