import type { EventDealPlace } from "./event-deal-labels";
import type { SeasonalStartingPrices } from "./supplier-starting-price";

export type EventLastMinutePlace = EventDealPlace & SeasonalStartingPrices;

/** Explicit server-to-client rail contract. Keep every venue and every image
 * supplied by the caller. Full catalog/detail records stay on the server and
 * at their existing endpoints; this projection changes only hydrated props. */
export function eventLastMinuteProps(places: readonly EventLastMinutePlace[]): EventLastMinutePlace[] {
  return places.map(place => ({
    slug: place.slug, name: place.name, location: place.location, area: place.area,
    type: place.type, guests: place.guests, image: place.image, images: place.images,
    sourceUrl: place.sourceUrl, sourcePropertySlug: place.sourcePropertySlug,
    ...(place.contact ? { contact: { phone: place.contact.phone, whatsapp: place.contact.whatsapp } } : {}),
    startPriceWinter: place.startPriceWinter, startPriceSummer: place.startPriceSummer,
  }));
}
