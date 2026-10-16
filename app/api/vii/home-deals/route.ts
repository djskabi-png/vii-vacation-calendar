import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeDeals, homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { readHomeDisplaySettings } from "../../../lib/home-display-settings.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";

const noStore = { "Cache-Control": "no-store" };

async function applyCuration(deals: Awaited<ReturnType<typeof getHomeDeals>>["deals"], period: HomeDealPeriod) {
  try {
    const runtime = await import("cloudflare:workers");
    const db = (runtime.env as unknown as { DB?: D1Database }).DB;
    return db ? await curateHomeDeals(db, deals, period) : deals;
  } catch { return deals; }
}

async function displaySettings(locale: Parameters<typeof readHomeDisplaySettings>[1]) {
  try {
    const runtime = await import("cloudflare:workers");
    return await readHomeDisplaySettings((runtime.env as unknown as { DB?: D1Database }).DB, locale);
  } catch { return readHomeDisplaySettings(undefined, locale); }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = params.get("period");
  const requestedLocale = params.get("locale");
  const locale = isContentLocale(requestedLocale) ? requestedLocale : "he";
  if (!homeDealPeriods.some((item) => item.id === period)) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers: noStore });
  }
  try {
    const displayPromise = displaySettings(locale);
    const [names, publicSiteIds, token] = await Promise.all([
      publicCatalogSummaries<{ supplierId: number; name: string }>("vacations"),
      publishedSupplierIds("vacations"), supplierToken(),
    ]);
    const result = await getHomeDeals({ period: period as HomeDealPeriod, token, publicSiteIds, publicNames: new Map(names.map((place) => [place.supplierId, place.name])) });
    const [deals, display] = await Promise.all([applyCuration(result.deals, period as HomeDealPeriod), displayPromise]);
    return Response.json({ ...result, deals, display: { periods: display.periods, defaultPeriod: display.defaultPeriod } }, { headers: noStore });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
