import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import { catalogStatusMcp } from "../lib/catalog-status-mcp.ts";
import { adminEmailsCsv, combineAdminEmails } from "../lib/admin-access.ts";
import type { D1Database } from "../../types/cloudflare-runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return catalogStatusMcp(request, {
    async pull(world) {
      // This callback is invoked only after Sites identity, administrator and input checks.
      const runtime = await import("cloudflare:workers");
      const db = (runtime.env as unknown as { DB?: D1Database }).DB;
      if (!db) throw new Error("catalog_database_unavailable");
      const { pullCatalogSlot } = await import("../lib/catalog-pull-mcp.ts");
      const { syncSupplierCatalogWorld } = await import("../lib/supplier-catalog-runtime.ts");
      const value = await pullCatalogSlot(db, world, {
        sync: (runId, selectedWorld, source) => syncSupplierCatalogWorld(db, selectedWorld, source, { runId }),
      });
      console.info("VII authenticated catalog MCP result", { world: value.world, status: value.status });
      return value;
    },
    async adminEmails() {
      try {
        const runtime = await import("cloudflare:workers");
        const env = runtime.env as unknown as { VII_ADMIN_EMAILS?: string; VII_ADMIN_EMAILS_EXTRA?: string };
        return combineAdminEmails(env.VII_ADMIN_EMAILS, env.VII_ADMIN_EMAILS_EXTRA).join(",");
      } catch { return adminEmailsCsv(); }
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
