import type { D1Database } from "../../types/cloudflare-runtime";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import { publishedSupplierIds } from "./published-supplier-ids.ts";
import { supplierToken } from "./vii-supplier-token.ts";
import { discoveryVacationCatalog, type DiscoveryVacationPlace } from "./discovery-vacation-catalog.ts";
import { cachedDiscovery } from "./discovery-offer-cache.ts";
import { getHomeDeals, homeDealDates, homeDealPeriods } from "./vii-home-deals.ts";

export const VACATION_DISCOVERY_POLICY = { freshMs: 30 * 60_000, staleMs: 30 * 86_400_000 } as const;

function hasDeals(value: unknown): value is Awaited<ReturnType<typeof getHomeDeals>> {
  return !!value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals)
    && (value as { deals: unknown[] }).deals.length > 0;
}

export async function warmVacationDiscoveryCache(db: D1Database, now = new Date()) {
  const [places, publicSiteIds, token] = await Promise.all([
    publicCatalogSummaries<DiscoveryVacationPlace>("vacations"),
    publishedSupplierIds("vacations"),
    supplierToken(),
  ]);
  const publicNames = new Map(places.map(place => [place.supplierId, place.name]));
  const resolveCatalog = discoveryVacationCatalog(places);
  const warmed: Array<{ period: string; status: "fresh" | "refreshed" | "stale" | "unavailable"; count: number }> = [];
  const upcomingClocks = [now, new Date(now.getTime() + 86_400_000)];
  const seen = new Set<string>();
  for (const period of homeDealPeriods) for (const clock of upcomingClocks) {
    const dates = homeDealDates(period.id, clock);
    const key = `${dates.from}:${dates.till}:2`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const cached = await cachedDiscovery({
        key: ["vacation-near", dates.from, dates.till, 2],
        db,
        policy: VACATION_DISCOVERY_POLICY,
        load: () => getHomeDeals({ period: period.id, now: clock, guests: 2, token, publicSiteIds, publicNames, resolveCatalog }),
        // An empty refresh is not allowed to erase a known-good discovery rail.
        // The public endpoint only reads accepted snapshots and never calls the
        // supplier during a visitor request.
        validate: hasDeals,
      });
      warmed.push({ period: period.id, status: cached.cache.status, count: cached.value.deals.length });
    } catch {
      // One unavailable date must not prevent the other rails from refreshing.
      warmed.push({ period: period.id, status: "unavailable", count: 0 });
    }
  }
  if (!warmed.some(item => item.count > 0)) throw new Error("vacation_discovery_refresh_unavailable");
  return warmed;
}
