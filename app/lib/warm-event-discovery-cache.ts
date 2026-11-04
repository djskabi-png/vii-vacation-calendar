import type { D1Database } from "../../types/cloudflare-runtime";
import { eventDealPresets } from "./event-deal-dates.ts";
import { cachedDiscovery } from "./discovery-offer-cache.ts";
import { publishedSupplierIds } from "./published-supplier-ids.ts";
import { supplierToken } from "./vii-supplier-token.ts";
import { eventDiscoveryKey, eventDiscoveryValidator, loadEventDiscovery, EVENT_DISCOVERY_POLICY } from "./event-discovery-offers.ts";
export { EVENT_DISCOVERY_POLICY, validEventDiscoveryResult } from "./event-discovery-offers.ts";

/**
 * Prepare every date shown by the public event rail before a visitor asks for
 * it. Seven rolling clocks keep tomorrow/Thursday/Friday available through a
 * supplier outage and across the Israel date boundary.
 */
export async function warmEventDiscoveryCache(db: D1Database, now = new Date(), guests = 20) {
  const [publishedIds, token] = await Promise.all([publishedSupplierIds("events", db), supplierToken()]);
  const dates = new Set<string>();
  for (let offset = 0; offset < 7; offset += 1) {
    const clock = new Date(now.getTime() + offset * 86_400_000);
    for (const preset of eventDealPresets(clock)) dates.add(preset.date);
  }
  const warmed: Array<{ date: string; status: "fresh" | "refreshed" | "stale" | "unavailable"; count: number }> = [];
  for (const date of dates) {
    try {
      const cached = await cachedDiscovery({
        key: eventDiscoveryKey(date, guests),
        db,
        policy: EVENT_DISCOVERY_POLICY,
        load: () => loadEventDiscovery({ date, guests, token, publishedIds }),
        // A successful supplier response with no available venue is a valid
        // empty business result, not an infrastructure failure. Persist it so
        // the public rail can explain the empty date and offer truthful browse
        // alternatives instead of oscillating between cards and a 503 panel.
        validate: eventDiscoveryValidator(date, guests),
      });
      warmed.push({ date, status: cached.cache.status, count: cached.value.results.filter((offer) => offer.available === true).length });
    } catch {
      warmed.push({ date, status: "unavailable", count: 0 });
    }
  }
  if (warmed.every((item) => item.status === "unavailable")) throw new Error("event_discovery_refresh_unavailable");
  return warmed;
}
