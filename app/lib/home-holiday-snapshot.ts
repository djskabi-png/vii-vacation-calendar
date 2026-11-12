import { firstDealDate, eligibleDealDate, dealClockKey } from "./deal-clock.ts";
import { publicDiscoveryCatalogIndex } from "./discovery-public-index.ts";
import { readCachedDiscovery } from "./discovery-offer-cache.ts";
import { applyHolidayDisplaySettings, readHomeDisplaySettings } from "./home-display-settings.ts";
import { holidayDiscoveryKey, HOLIDAY_DISCOVERY_POLICY } from "./warm-holiday-discovery-cache.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { runtimeDatabase } from "./runtime-database.ts";
import { curateHomeDeals } from "./home-deal-curation.ts";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "./vacation-online-first.ts";
import { compareVacationPriority } from "./vacation-priority.ts";
import { holidayWorldPath } from "./holiday-world.ts";
import { legacyHolidaySearchPath } from "./search-opportunities.ts";
import type { HomeDeal } from "./vii-home-deals.ts";
import type { HomeHoliday } from "./vii-home-holidays.ts";
import type { SiteLanguage } from "../i18n/locale-routing.ts";

export type HomeHolidaySnapshotResponse = {
  cache: { status: "fresh" | "refreshed" | "stale"; checkedAt: string };
  availabilityStatus: "verified";
  locale: SiteLanguage;
  clockKey: string;
  renderedAt: string;
  guests: number;
  holiday: HomeHoliday;
  holidays: HomeHoliday[];
  dates: { from: string; till: string; nights: number };
  deals: HomeDeal[];
};

/** Read-only homepage holiday seed. It never calls the supplier. A missing or
 * expired durable snapshot returns null and the API owns background warming. */
export async function readHomeHolidaySnapshot(options: { guests: number; locale: SiteLanguage; now?: Date }): Promise<HomeHolidaySnapshotResponse | null> {
  const now = options.now ?? new Date();
  const first = firstDealDate(now);
  const dbPromise = runtimeCatalogDatabase();
  const primaryPromise = runtimeDatabase().catch(() => null);
  const [db, primary] = await Promise.all([dbPromise, primaryPromise]);
  if (!db) return null;
  const [calendar, settings, index] = await Promise.all([
    readCachedDiscovery<HomeHoliday[]>({ key: ["holiday-calendar", first], db, validate: Array.isArray }).catch(() => null),
    readHomeDisplaySettings(primary ?? undefined, options.locale).catch(() => readHomeDisplaySettings(undefined, options.locale)),
    publicDiscoveryCatalogIndex("vacations", db),
  ]);
  if (!calendar) return null;
  const holidays = applyHolidayDisplaySettings(calendar.value.filter(item => item.till >= first), settings).map(holiday => ({
    ...holiday,
    href: holidayWorldPath(holiday.name, holiday.id) || legacyHolidaySearchPath(holiday.name) || undefined,
  }));
  const holiday = holidays[0];
  if (!holiday) return null;
  const cached = await readCachedDiscovery<{ holiday: HomeHoliday; dates: { from: string; till: string; nights: number }; deals: HomeDeal[] }>({
    key: holidayDiscoveryKey({
      id: holiday.id,
      from: holiday.from,
      till: holiday.till,
      guests: options.guests,
      part: "all",
      requestedFrom: holiday.exactStay ? holiday.from : undefined,
      requestedTill: holiday.exactStay ? holiday.till : undefined,
      now,
    }),
    db,
    policy: HOLIDAY_DISCOVERY_POLICY,
    validate: value => Boolean(value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals)),
  }).catch(() => null);
  if (!cached) return null;
  const checkedAt = Date.parse(cached.cache.checkedAt);
  if (!Number.isFinite(checkedAt) || Date.now() - checkedAt >= 54 * 60_000) return null;
  const publicIds = index.publishedIds;
  const curated = primary ? await curateHomeDeals(primary, cached.value.deals, "holidays").catch(() => cached.value.deals) : cached.value.deals;
  const deals = prioritizeOnlineFirst(curated.filter(deal => publicIds.has(deal.siteID)
    && deal.priceGuests === options.guests && eligibleDealDate(deal.from, now)),
  deal => isHomeDealOnlineEligible(deal),
  (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `holiday:${holiday.id}:all`));
  return {
    ...cached.value,
    holiday,
    holidays,
    dates: { from: holiday.from, till: holiday.till, nights: holiday.nights },
    deals,
    cache: cached.cache,
    availabilityStatus: "verified",
    locale: options.locale,
    guests: options.guests,
    clockKey: dealClockKey(now),
    renderedAt: now.toISOString(),
  };
}
