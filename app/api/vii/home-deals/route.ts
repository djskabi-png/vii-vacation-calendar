import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeDeals, homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { readHomeDisplaySettings } from "../../../lib/home-display-settings.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";

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
  const region = regionalAvailabilityRegion(params.get("region"));
  if (params.has("region") && !region) return Response.json({ error: "invalid_region" }, { status: 400, headers: noStore });
  const guests = Number(params.get("guests") ?? 2);
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 50) return Response.json({ error: "invalid_guests" }, { status: 400, headers: noStore });
  if (!homeDealPeriods.some((item) => item.id === period)) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers: noStore });
  }
  try {
    const displayPromise = displaySettings(locale);
    const [names, publicSiteIds, token] = await Promise.all([
      publicCatalogSummaries<{ supplierId: number; name: string; area?: string; location?: string; lat?: number; lng?: number }>("vacations"),
      publishedSupplierIds("vacations"), supplierToken(),
    ]);
    const result = await getHomeDeals({ period: period as HomeDealPeriod, guests, token, publicSiteIds, publicNames: new Map(names.map((place) => [place.supplierId, place.name])) });
    const [curated, display] = await Promise.all([applyCuration(result.deals, period as HomeDealPeriod), displayPromise]);
    const regionalPool = region ? [...curated].sort((a, b) => (a.curatedRank ?? 500) - (b.curatedRank ?? 500) || a.total - b.total || a.siteID - b.siteID) : curated;
    const selected = region ? selectRegionalOffers(regionalPool, names.filter(place => publicSiteIds.has(place.supplierId)), region.label, { placeId: deal => deal.siteID, key: deal => String(deal.siteID) }) : null;
    const deals = selected?.offers ?? curated;
    return Response.json({ ...result, ...(region ? { region: region.label, expandedRegion: selected!.expanded, regionalOrder: selected!.order } : {}), deals, display: { periods: display.periods, defaultPeriod: display.defaultPeriod } }, { headers: noStore });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
