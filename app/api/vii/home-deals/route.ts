import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeDeals, homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";

const noStore = { "Cache-Control": "no-store" };

async function applyCuration(deals: Awaited<ReturnType<typeof getHomeDeals>>["deals"], period: HomeDealPeriod) {
  try {
    const runtime = await import("cloudflare:workers");
    const db = (runtime.env as unknown as { DB?: D1Database }).DB;
    return db ? await curateHomeDeals(db, deals, period) : deals;
  } catch { return deals; }
}

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period");
  if (!homeDealPeriods.some((item) => item.id === period)) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers: noStore });
  }
  try {
    const names = await publicCatalogSummaries<{ supplierId: number; name: string }>("vacations");
    const result = await getHomeDeals({ period: period as HomeDealPeriod, token: await supplierToken(), publicSiteIds: await publishedSupplierIds("vacations"), publicNames: new Map(names.map((place) => [place.supplierId, place.name])) });
    return Response.json({ ...result, deals: await applyCuration(result.deals, period as HomeDealPeriod) }, { headers: noStore });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
