import type { EventPlace } from "../data/site-data.ts";
import { eventSearchTaxonomy } from "./event-search-taxonomy.ts";

// Event discovery needs filter, contact, map and card data, not the complete
// detail-page editorial model for every venue in the initial document.
export function publicEventSearchPlaces(places: readonly EventPlace[], imageLimit = 5): EventPlace[] {
  return places.map((place) => {
    const taxonomy = eventSearchTaxonomy(place);
    return ({
    slug: place.slug,
    name: place.name,
    location: place.location,
    area: place.area,
    type: taxonomy.type,
    units: place.units,
    guests: place.guests,
    capacityScope: place.capacityScope,
    image: place.image,
    images: (place.images?.length ? place.images : [place.image]).slice(0, Math.max(1, imageLimit)),
    description: "",
    features: taxonomy.features,
    audiences: [],
    badges: [],
    lat: place.lat,
    lng: place.lng,
    scenario: place.scenario,
    score: place.score,
    reviews: place.reviews,
    price: place.price,
    startPriceWinter: place.startPriceWinter,
    startPriceSummer: place.startPriceSummer,
    contact: place.contact ? { phone: place.contact.phone, whatsapp: place.contact.whatsapp } : undefined,
    eventTypes: taxonomy.eventTypes,
    sourcePropertySlug: place.sourcePropertySlug,
    });
  });
}
