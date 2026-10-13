import type { Property } from "../data/site-data.ts";

// Search needs the complete filter and map inventory, but not depth-page
// galleries, editorial sections or other heavy fields for every listing.
export function publicVacationSearchProperties(properties: readonly Property[]): Property[] {
  return properties.map((property) => ({
    slug: property.slug,
    name: property.name,
    location: property.location,
    area: property.area,
    type: property.type,
    units: property.units,
    guests: property.guests,
    capacityScope: property.capacityScope,
    image: property.image,
    images: (property.images?.length ? property.images : [property.image]).slice(0, 5),
    description: property.description.slice(0, 500),
    features: property.features,
    audiences: property.audiences,
    badges: property.badges,
    lat: property.lat,
    lng: property.lng,
    scenario: property.scenario,
    score: property.score,
    reviews: property.reviews,
    price: property.price,
    dateQuotes: property.dateQuotes,
    dailyAvailability: property.dailyAvailability,
    roomOptions: property.roomOptions,
    contact: property.contact,
    demoOperations: property.demoOperations,
  }));
}
