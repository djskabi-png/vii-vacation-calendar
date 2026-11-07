import { cachedDiscovery } from "./discovery-offer-cache.ts";
import type { HolidayPart } from "./holiday-deal-selection.ts";
import { getDiscoveryHolidays } from "./discovery-holidays.ts";
import { getHomeHolidayDeals } from "./vii-home-holidays.ts";
import { supplierToken } from "./vii-supplier-token.ts";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import { discoveryVacationCatalog } from "./discovery-vacation-catalog.ts";
import { publicDiscoveryCatalogIndex } from "./discovery-public-index.ts";
import { applyHolidayDisplaySettings, readHomeDisplaySettings, type HomeDisplaySettings } from './home-display-settings.ts';
import type { HomeHoliday } from './vii-home-holidays.ts';
import type { DiscoveryVacationPlace } from './discovery-vacation-catalog.ts';
import type { D1Database } from '../../types/cloudflare-runtime';

export async function runHolidayWarmJobs<T>(items: (() => Promise<T>)[], options: { limit?: number; deadline?: number; now?: () => number } = {}) {
  const now = options.now ?? Date.now; const limit = options.limit ?? 2; const deadline = options.deadline ?? now() + 90_000;
  const out: T[] = []; let cursor = 0;
  async function worker() { while (cursor < items.length && now() < deadline) { const job = items[cursor++]; try { out.push(await job()); } catch { /* one holiday must not block the rest */ } } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out;
}

export const HOLIDAY_DISCOVERY_POLICY = { freshMs: 5 * 60_000, staleMs: 60 * 60_000 } as const;
export function holidayDiscoveryKey(input: { id: number; from: string; till: string; guests: number; part: HolidayPart; requestedFrom?: string; requestedTill?: string; now?: Date }) {
  // Future holiday dates do not change at today's14:00 cutoff. Partition by
  // the actual window instead of discarding every prepared future holiday at
  // that cutoff. A running holiday's changed window still gets a new key;
  // source age and final eligibility/quote checks remain unchanged.
  return ["vacation-holiday-window-v2", input.id, input.from, input.till, input.guests, input.part, input.requestedFrom ?? null, input.requestedTill ?? null] as const;
}
export function cachedHolidayDiscovery<T>(input: { db: D1Database | null; id: number; from: string; till: string; guests: number; part: HolidayPart; requestedFrom?: string; requestedTill?: string; now?: Date; load: () => Promise<T>; validate: (value: unknown) => boolean }) {
  return cachedDiscovery({ key: holidayDiscoveryKey(input), db: input.db, policy: HOLIDAY_DISCOVERY_POLICY, load: input.load, validate: input.validate });
}

export function holidayWarmSelections(holidays: HomeHoliday[], settings: HomeDisplaySettings) {
  const visibleHolidays = applyHolidayDisplaySettings(holidays, settings);
  // Prepare every visible rail before expanding family/group variants. A slow
  // provider must not consume the whole admission budget on the first tabs.
  return [2, 6, 20].flatMap(guests => visibleHolidays.map(visible => {
    const holiday = holidays.find(item => item.id === visible.id)!;
    return { holiday, guests,
      requestedFrom: visible.exactStay ? visible.from : undefined,
      requestedTill: visible.exactStay ? visible.till : undefined };
  }));
}

export async function warmHolidayDiscoveryCache(db: D1Database, now = new Date()) {
  const deadline = Date.now() + 90_000;
  const token = await supplierToken();
  const [holidays, settings] = await Promise.all([getDiscoveryHolidays(token, now), readHomeDisplaySettings(db, 'he')]);
  const index = await publicDiscoveryCatalogIndex("vacations", db);
  const names = new Map(index.places.map(place => [place.supplierId, place.name]));
  const catalog = discoveryVacationCatalog(await publicCatalogSummaries<DiscoveryVacationPlace>("vacations"));
  const jobs = holidayWarmSelections(holidays, settings).map(({ holiday, guests, requestedFrom, requestedTill }) => async () => cachedHolidayDiscovery({ db, id: holiday.id, from: holiday.from, till: holiday.till, guests, part: "all", requestedFrom, requestedTill, now, load: () => getHomeHolidayDeals({ id: holiday.id, token, holidays, now, publicSiteIds: index.publishedIds, publicNames: names, resolveCatalog: catalog, guests, part: "all", from: requestedFrom, till: requestedTill }), validate: value => Boolean(value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals)) }));
  return runHolidayWarmJobs(jobs, { limit: 2, deadline });
}
