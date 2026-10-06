import publicCatalog from "../../../data/sergey-public-catalog.json";
import { getHomeHolidayDeals } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";

const publicSiteIds = new Set(publicCatalog.places.filter((place) => place.world === "vacations").map((place) => place.supplierId));
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("id");
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "invalid_holiday" }, { status: 400, headers });
  try {
    const result = await getHomeHolidayDeals({ id, token: await supplierToken(), publicSiteIds });
    return Response.json(result, { headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "supplier_unavailable";
    return Response.json({ error: reason }, { status: reason === "invalid_holiday" ? 404 : reason === "unsupported_holiday_window" ? 422 : 503, headers });
  }
}
