import type { D1Database } from "../../types/cloudflare-runtime";
import { cachedDiscovery, readCachedDiscovery } from "./discovery-offer-cache.ts";
import { CAPABILITY_FRESH_MS, CAPABILITY_MAX_AGE_MS, fetchCapabilityProbe, validOnlineCapabilities, type OnlineCapabilityMap } from "./online-booking-capability.ts";
import { supplierToken } from "./vii-supplier-token.ts";

export function cachedOnlineCapabilities(db: D1Database | null) {
  return cachedDiscovery<OnlineCapabilityMap>({
    key: ["vacation-online-capability", 1], db,
    policy: { freshMs: CAPABILITY_FRESH_MS, staleMs: CAPABILITY_MAX_AGE_MS },
    load: async previous => fetchCapabilityProbe(await supplierToken(), previous),
    validate: validOnlineCapabilities,
  });
}

/** Public discovery reads are deliberately provider-free. */
export function readCachedOnlineCapabilities(db: D1Database | null) {
  return readCachedDiscovery<OnlineCapabilityMap>({
    key: ["vacation-online-capability", 1], db,
    policy: { freshMs: CAPABILITY_FRESH_MS, staleMs: CAPABILITY_MAX_AGE_MS },
    validate: validOnlineCapabilities,
  });
}
