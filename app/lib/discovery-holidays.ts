import { cachedDiscovery } from "./discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { getHomeHolidays } from "./vii-home-holidays.ts";
import { firstDealDate } from "./deal-clock.ts";

export async function getDiscoveryHolidays(token: string, now = new Date()) {
  const first = firstDealDate(now);
  const result = await cachedDiscovery({ key: ["holiday-calendar", first], db: await runtimeCatalogDatabase(),
    load: () => getHomeHolidays({ token, now }), validate: Array.isArray,
  });
  return result.value.filter(holiday => holiday.till >= first);
}
