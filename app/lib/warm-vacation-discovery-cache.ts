import type { D1Database } from "../../types/cloudflare-runtime";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import { publishedSupplierIds } from "./published-supplier-ids.ts";
import { supplierToken } from "./vii-supplier-token.ts";
import { discoveryVacationCatalog, type DiscoveryVacationPlace } from "./discovery-vacation-catalog.ts";
import { cachedDiscovery } from "./discovery-offer-cache.ts";
import { getHomeDeals, homeDealDates, homeDealPeriods } from "./vii-home-deals.ts";

export const VACATION_DISCOVERY_POLICY = { freshMs: 5 * 60_000, staleMs: 60 * 60_000 } as const;

export function validVacationDiscoverySnapshot(value: unknown, expected?: { from: string; till: string; nights: number }): value is Awaited<ReturnType<typeof getHomeDeals>> {
  if (!value || typeof value !== "object" || !Array.isArray((value as { deals?: unknown }).deals)) return false;
  const dates = (value as { dates?: unknown }).dates;
  if (!dates || typeof dates !== "object" || Array.isArray(dates)) return false;
  const actual = dates as { from?: unknown; till?: unknown; nights?: unknown };
  if (typeof actual.from !== "string" || typeof actual.till !== "string" || typeof actual.nights !== "number" || !Number.isSafeInteger(actual.nights) || actual.nights < 1 || actual.nights > 31) return false;
  return !expected || (actual.from === expected.from && actual.till === expected.till && actual.nights === expected.nights);
}

export async function refreshVacationDiscoveryPeriod(db: D1Database | null, period: (typeof homeDealPeriods)[number]["id"], guests = 2, now = new Date()) {
  const [places, publicSiteIds, token] = await Promise.all([
    publicCatalogSummaries<DiscoveryVacationPlace>("vacations"),
    publishedSupplierIds("vacations"),
    supplierToken(),
  ]);
  const dates = homeDealDates(period, now);
  return cachedDiscovery({
    key: ["vacation-near", dates.from, dates.till, guests],
    db,
    policy: VACATION_DISCOVERY_POLICY,
    load: () => getHomeDeals({ period, now, guests, token, publicSiteIds, publicNames: new Map(places.map(place => [place.supplierId, place.name])), resolveCatalog: discoveryVacationCatalog(places) }),
    validate: value => validVacationDiscoverySnapshot(value, dates),
  });
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
  // Keep a full rolling week prepared. This avoids a cold key after the Israel
  // date boundary and keeps the rails useful through a multi-day supplier
  // incident without making any visitor wait on the provider.
  const upcomingClocks = Array.from({ length: 7 }, (_, offset) => new Date(now.getTime() + offset * 86_400_000));
  const seen = new Set<string>();
  for (const period of homeDealPeriods) for (const clock of upcomingClocks) {
    const dates = homeDealDates(period.id, clock);
    const key = `${dates.from}:${dates.till}:2`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const cached = await cachedDiscovery({
        key: ["vacation-near", dates.from, dates.till, 2], db, policy: VACATION_DISCOVERY_POLICY,
        load: () => getHomeDeals({ period: period.id, now: clock, guests: 2, token, publicSiteIds, publicNames, resolveCatalog }), validate: value => validVacationDiscoverySnapshot(value, dates),
      });
      warmed.push({ period: period.id, status: cached.cache.status, count: cached.value.deals.length });
    } catch {
      // One unavailable date must not prevent the other rails from refreshing.
      warmed.push({ period: period.id, status: "unavailable", count: 0 });
    }
  }
  return warmed;
}
