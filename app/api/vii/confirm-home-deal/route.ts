import publicCatalog from "../../../data/sergey-public-catalog.json";
import { confirmHomeDeal } from "../../../lib/vii-confirm-home-deal";
import { supplierToken } from "../../../lib/vii-supplier-token";

const publicSiteIds = new Set(publicCatalog.places.filter((place) => place.world === "vacations").map((place) => place.supplierId));
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siteID = Number(params.get("siteID"));
  const source = params.get("source");
  if ((source !== "home-deals" && source !== "home-holidays") || !Number.isSafeInteger(siteID) || !publicSiteIds.has(siteID)) {
    return Response.json({ error: "invalid_stay" }, { status: 400, headers });
  }
  try {
    return Response.json(await confirmHomeDeal({
      source, siteID, period: params.get("period") || "", from: params.get("from") || "", till: params.get("till") || "",
      token: await supplierToken(), publicSiteIds,
    }), { headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "supplier_unavailable";
    return Response.json({ error: reason }, { status: reason === "invalid_stay" || reason === "invalid_holiday" ? 400 : 503, headers });
  }
}
