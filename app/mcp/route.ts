import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import { catalogStatusMcp } from "../lib/catalog-status-mcp.ts";
import type { D1Database } from "../../types/cloudflare-runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return catalogStatusMcp(request, {
    async adminEmails() {
      try {
        const runtime = await import("cloudflare:workers");
        return (runtime.env as unknown as { VII_ADMIN_EMAILS?: string }).VII_ADMIN_EMAILS || "";
      } catch { return process.env.VII_ADMIN_EMAILS || ""; }
    },
    async database() {
      const runtime = await import("cloudflare:workers");
      const db = (runtime.env as unknown as { DB?: D1Database }).DB;
      if (!db) throw new Error("catalog_database_unavailable");
      return db;
    },
    fallbackCounts: {
      vacations: sergey.places.filter((place) => place.world === "vacations").length,
      events: sergey.places.filter((place) => place.world === "events").length,
      rooms: hourly.places.length,
      spa: spa.sites.length,
    },
  });
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}
