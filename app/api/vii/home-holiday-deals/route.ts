import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeHolidayDeals } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { holidayParts, type HolidayPart } from "../../../lib/holiday-deal-selection.ts";

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
  const guests = params.has("guests") ? Number(params.get("guests")) : 2;
  const part = params.get("part") ?? "all";
  if (![2, 6, 20].includes(guests) || !holidayParts.includes(part as HolidayPart)) return Response.json({ error: "invalid_selection" }, { status: 400, headers });
  try {
    const [names, publicSiteIds, token] = await Promise.all([
      publicCatalogSummaries<{ supplierId: number; name: string }>("vacations"),
      publishedSupplierIds("vacations"), supplierToken(),
    ]);
    const result = await getHomeHolidayDeals({ id, token, publicSiteIds, publicNames: new Map(names.map((place) => [place.supplierId, place.name])), from: params.get("from") ?? undefined, till: params.get("till") ?? undefined, guests, part: part as HolidayPart });
    return Response.json({ ...result, deals: await applyCuration(result.deals) }, { headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "supplier_unavailable";
    return Response.json({ error: reason }, { status: reason === "invalid_holiday" ? 404 : ["invalid_stay", "invalid_selection"].includes(reason) ? 400 : 503, headers });
  }
}
