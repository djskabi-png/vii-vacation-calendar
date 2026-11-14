import type { D1Database } from "../../types/cloudflare-runtime";
import { cachedDiscovery } from "./discovery-offer-cache.ts";
import { firstDealDate } from "./deal-clock.ts";
import { readSpaAvailability } from "./spa-availability.ts";

/** Keep the shared spa availability snapshot hot before a visitor opens a
 * homepage tab. The public route still validates and filters every offer. */
export async function warmSpaDiscoveryCache(db: D1Database, now = new Date(), availabilityToken?: string) {
  return cachedDiscovery({
    key: ["spa-discovery-availability", firstDealDate(now)],
    db,
    load: () => readSpaAvailability(availabilityToken),
    validate: Array.isArray,
  });
}
