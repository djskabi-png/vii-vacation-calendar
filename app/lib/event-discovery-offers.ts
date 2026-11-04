import type { LiveSearchResult } from "./vii-live-search.ts";
import { liveSupplierSearch, validDate } from "./vii-live-search.ts";

import { EVENT_DISCOVERY_VERSION, EVENT_DISCOVERY_MAX_AGE_MS } from "./event-discovery-contract.ts";
export { EVENT_DISCOVERY_VERSION } from "./event-discovery-contract.ts";
export const EVENT_DISCOVERY_POLICY = { freshMs: 5 * 60_000, staleMs: EVENT_DISCOVERY_MAX_AGE_MS } as const;
export type EventDiscoverySnapshot = Awaited<ReturnType<typeof loadEventDiscovery>>;

// One bulk supplier request owns both slots and all regions. Slot, geography
// and display layout are local projections, never separate supplier fan-outs.
export function eventDiscoveryKey(date: string, guests: number) {
  return ["events-discovery", EVENT_DISCOVERY_VERSION, date, guests] as const;
}

export async function loadEventDiscovery(options: { date: string; guests: number; token: string; publishedIds: ReadonlySet<number>; fetchImpl?: typeof fetch }) {
  const response = await liveSupplierSearch({ world: "events", from: options.date, till: options.date,
    guests: options.guests, token: options.token, publishedIds: options.publishedIds,
    includeEventSlots: true, providerTimeoutMs: 8_000, fetchImpl: options.fetchImpl });
  return { ...response, discoveryVersion: EVENT_DISCOVERY_VERSION,
    scope: { date: options.date, guests: options.guests }, eventSlots: response.eventSlots ?? [] };
}

export function confirmedEventOffer(offer: LiveSearchResult) {
  return Number.isSafeInteger(offer.siteID) && offer.siteID > 0 && offer.available === true
    && validDate(offer.from) && (offer.slot === "morning" || offer.slot === "evening")
    && (offer.total === null || typeof offer.total === "number" && Number.isFinite(offer.total) && offer.total > 0)
    && (Number.isSafeInteger(offer.roomID) && Number(offer.roomID) > 0
      || offer.total === null && offer.availabilitySource === "supplier_days" && Number.isSafeInteger(offer.freeUnits) && Number(offer.freeUnits) > 0);
}

export function validEventDiscoveryResult(value: unknown): value is EventDiscoverySnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as EventDiscoverySnapshot;
  return row.discoveryVersion === EVENT_DISCOVERY_VERSION && row.world === "events"
    && validDate(row.scope?.date) && Number.isSafeInteger(row.scope?.guests) && row.scope.guests >= 1 && row.scope.guests <= 1000
    && Array.isArray(row.results) && row.results.every(offer => Number.isSafeInteger(offer.siteID)
      && (offer.available === true || offer.available === false || offer.available === null))
    && Array.isArray(row.eventSlots) && row.eventSlots.every(offer => confirmedEventOffer(offer)
      && offer.from === row.scope.date && offer.priceGuests === row.scope.guests);
}

export function eventDiscoveryValidator(date: string, guests: number) {
  return (value: unknown): value is EventDiscoverySnapshot => validEventDiscoveryResult(value)
    && value.scope.date === date && value.scope.guests === guests;
}

export function eventOffersForSlot(offers: readonly LiveSearchResult[], slot?: "morning" | "evening") {
  const ordered = offers.filter(offer => confirmedEventOffer(offer) && (!slot || offer.slot === slot))
    .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || a.siteID - b.siteID || String(a.slot).localeCompare(String(b.slot)));
  const seen = new Set<number>();
  return ordered.filter(offer => {
    if (seen.has(offer.siteID)) return false;
    seen.add(offer.siteID); return true;
  });
}
