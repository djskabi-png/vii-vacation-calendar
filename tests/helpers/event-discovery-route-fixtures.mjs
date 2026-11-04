import { eventDiscoveryKey, eventDiscoveryValidator, eventOffersForSlot } from "../../app/lib/event-discovery-offers.ts";
import { EVENT_DISCOVERY_VERSION } from "../../app/lib/event-discovery-contract.ts";

// Preserve route tests' injected provider/cache boundaries while upgrading
// their fixtures to the versioned, both-slot snapshot envelope. Raw supplier
// normalization has separate behavior tests with actual days/freeUnits data.
export function eventRouteDependencies(dependencies) {
  function envelope(value, date, guests) {
    const results = (value.results || []).map(offer => ({ ...offer, priceGuests: offer.priceGuests ?? guests }));
    return { ...value, world: "events", results,
      eventSlots: value.eventSlots ?? results.filter(offer => offer.available === true),
      discoveryVersion: EVENT_DISCOVERY_VERSION, scope: { date, guests } };
  }
  const read = dependencies.readCachedDiscovery;
  return {
    eventDiscoveryKey, eventDiscoveryValidator, eventOffersForSlot, EVENT_DISCOVERY_VERSION,
    loadEventDiscovery: async ({ date, guests, token, publishedIds }) => {
      const value = await dependencies.liveSupplierSearch({ world: "events", from: date, till: date, guests, token, publishedIds, includeEventSlots: true });
      return envelope(value, date, guests);
    },
    ...dependencies,
    ...(read ? { readCachedDiscovery: async options => {
      const result = await read(options);
      return options.key[0] === "events-discovery" ? { ...result, value: envelope(result.value, options.key[2], options.key[3]) } : result;
    } } : {}),
  };
}
