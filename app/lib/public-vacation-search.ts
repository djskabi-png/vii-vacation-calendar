import type { Property } from "../data/site-data.ts";
import { vacationSearchFilterIds } from "./vacation-search-filter-index.ts";

// Search needs the complete filter and map inventory, but not depth-page
// galleries, editorial sections or other heavy fields for every listing.
export function publicVacationSearchProperties(properties: readonly Property[], imageLimit = 5): Property[] {
  return properties.map((property) => ({
    slug: property.slug,
    name: property.name,
    location: property.location,
    area: property.area,
    type: property.type,
    types: property.types,
    units: property.units,
    bedrooms: property.bedrooms,
    previewText: property.previewText,
    onlineAvailability: property.onlineAvailability,
    onlinePrices: property.onlinePrices,
    guests: property.guests,
    capacityScope: property.capacityScope,
    image: property.image,
    images: (property.images?.length ? property.images : [property.image]).slice(0, Math.max(1, imageLimit)),
    description: "",
    features: property.features.slice(0, 3),
    searchFilterIds: vacationSearchFilterIds(property),
    audiences: [],
    badges: property.badges,
    lat: property.lat,
    lng: property.lng,
    mapPrecision: property.mapPrecision,
    scenario: property.scenario,
    score: property.score,
    reviews: property.reviews,
    price: property.price,
    startPriceWinter: property.startPriceWinter,
    startPriceSummer: property.startPriceSummer,
    dateQuotes: property.dateQuotes,
    dailyAvailability: property.dailyAvailability,
    roomOptions: property.roomOptions,
    contact: property.contact ? { phone: property.contact.phone, whatsapp: property.contact.whatsapp } : undefined,
    demoOperations: property.demoOperations,
    curatedRank: property.curatedRank,
  }));
}

// Country-level category pages can contain hundreds of places. Shipping the
// live availability arrays and complete card galleries for every place in the
// first HTML document can exceed the edge response budget before React gets a
// chance to hydrate. Keep every searchable identity and filter field in the
// seed, but let the existing public catalog refresh supply the heavy booking
// data and remaining card images after the first useful paint.
export function publicVacationLandingSeedProperties(properties: readonly Property[]): Property[] {
  return publicVacationSearchProperties(properties, 1).map((property) => ({
    ...property,
    dateQuotes: undefined,
    dailyAvailability: undefined,
    roomOptions: undefined,
    contact: undefined,
    demoOperations: undefined,
  }));
}
