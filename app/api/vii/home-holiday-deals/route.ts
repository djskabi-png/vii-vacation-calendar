import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeHolidayDeals } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";

const headers = { "Cache-Control": "no-store" };

async function applyCuration(deals: Awaited<ReturnType<typeof getHomeHolidayDeals>>["deals"]) {
  try {
    const runtime = await import("cloudflare:workers");
    const db = (runtime.env as unknown as { DB?: D1Database }).DB;
    return db ? await curateHomeDeals(db, deals, "holidays") : deals;
  } catch { return deals; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("id");
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "invalid_holiday" }, { status: 400, headers });
  try {
    const names = await publicCatalogSummaries<{ supplierId: number; name: string }>("vacations");
    const result = await getHomeHolidayDeals({ id, token: await supplierToken(), publicSiteIds: await publishedSupplierIds("vacations"), publicNames: new Map(names.map((place) => [place.supplierId, place.name])), from: params.get("from") ?? undefined, till: params.get("till") ?? undefined });
    return Response.json({ ...result, deals: await applyCuration(result.deals) }, { headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "supplier_unavailable";
    return Response.json({ error: reason }, { status: reason === "invalid_holiday" ? 404 : reason === "invalid_stay" ? 400 : 503, headers });
  }
}
