import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import { catalogStatusMcp } from "../lib/catalog-status-mcp.ts";
import { adminEmailsCsv, combineAdminEmails } from "../lib/admin-access.ts";
import { requiredRuntimeDatabase } from "../lib/runtime-database.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return catalogStatusMcp(request, {
    async pull(world) {
      // This callback is invoked only after Sites identity, administrator and input checks.
      const db = await requiredRuntimeDatabase("catalog_database_unavailable");
      const { pullCatalogSlot } = await import("../lib/catalog-pull-mcp.ts");
      const { syncSupplierCatalogWorld } = await import("../lib/supplier-catalog-runtime.ts");
      const value = await pullCatalogSlot(db, world, {
        sync: (runId, selectedWorld, source) => syncSupplierCatalogWorld(db, selectedWorld, source, { runId }),
      });
      if (world === "vacations") {
        const { cachedOnlineCapabilities } = await import("../lib/online-booking-capability-cache.ts");
        const { warmVacationDiscoveryCache } = await import("../lib/warm-vacation-discovery-cache.ts");
        await Promise.all([
          cachedOnlineCapabilities(db),
          warmVacationDiscoveryCache(db),
        ]).catch(() => console.error("VII scheduled discovery refresh unavailable"));
      }
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
      return requiredRuntimeDatabase("catalog_database_unavailable");
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
