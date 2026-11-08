import { readActivePromotionWeights } from "../../lib/discovery-promotion-drafts.ts";
import { runtimeCatalogDatabase } from "../../lib/published-supplier-ids.ts";

export async function GET() {
  try {
    const db = await runtimeCatalogDatabase();
    if (!db) return Response.json({ weights: [], status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const rows = await readActivePromotionWeights(db);
    return Response.json({ weights: rows.map(({ world, supplierId, weight, featured, turboEligible }) => ({ world, supplierId, weight, ...(featured ? { featured: true } : {}), ...(turboEligible ? { turboEligible: true } : {}) })) }, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
    });
  } catch {
    return Response.json({ weights: [], status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
