import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeDeals, homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { supplierToken } from "../../../lib/vii-supplier-token";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period");
  if (!homeDealPeriods.some((item) => item.id === period)) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers: noStore });
  }
  try {
    const result = await getHomeDeals({ period: period as HomeDealPeriod, token: await supplierToken(), publicSiteIds: await publishedSupplierIds("vacations") });
    return Response.json(result, { headers: noStore });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
