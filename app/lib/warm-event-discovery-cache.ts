import type { D1Database } from "../../types/cloudflare-runtime";
import { eventDealPresets } from "./event-deal-dates.ts";
import { cachedDiscovery } from "./discovery-offer-cache.ts";
import { publishedSupplierIds } from "./published-supplier-ids.ts";
import { supplierToken } from "./vii-supplier-token.ts";
import { liveSupplierSearch } from "./vii-live-search.ts";

export const EVENT_DISCOVERY_POLICY = { freshMs: 30 * 60_000, staleMs: 30 * 86_400_000 } as const;

function hasAvailableEvents(value: unknown) {
  return !!value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)
    && (value as { results: Array<{ available?: boolean; total?: number; slot?: string }> }).results
      .some((offer) => offer?.available === true && Number(offer.total) > 0 && Boolean(offer.slot));
}

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
        key: ["events-discovery", date, date, guests, "both"],
        db,
        policy: EVENT_DISCOVERY_POLICY,
        load: () => liveSupplierSearch({ world: "events", from: date, till: date, guests, token, publishedIds }),
        validate: hasAvailableEvents,
      });
      warmed.push({ date, status: cached.cache.status, count: cached.value.results.filter((offer) => offer.available === true).length });
    } catch {
      warmed.push({ date, status: "unavailable", count: 0 });
    }
  }
  if (!warmed.some((item) => item.count > 0)) throw new Error("event_discovery_refresh_unavailable");
  return warmed;
}
