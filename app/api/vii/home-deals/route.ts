import publicCatalog from "../../../data/sergey-public-catalog.json";
import { getHomeDeals, homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { supplierToken } from "../../../lib/vii-supplier-token";

const publicSiteIds = new Set(publicCatalog.places.filter((place) => place.world === "vacations").map((place) => place.supplierId));
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period");
  if (!homeDealPeriods.some((item) => item.id === period)) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers: noStore });
  }
  try {
    const result = await getHomeDeals({ period: period as HomeDealPeriod, token: await supplierToken(), publicSiteIds });
    return Response.json(result, { headers: noStore });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
