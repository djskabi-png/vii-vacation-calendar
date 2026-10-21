import type { DiscoveryVacationPlace } from "./discovery-vacation-catalog.ts";

export type VacationCatalogFallback = {
  siteID: number;
  name: string;
  image: string;
  images: string[];
  city: string;
  area: string;
  phone?: string;
  whatsapp?: string;
};

export function vacationCatalogFallbacks(
  places: DiscoveryVacationPlace[],
  publishedIds: ReadonlySet<number>,
  limit = 20,
): VacationCatalogFallback[] {
  return places
    .filter((place) => publishedIds.has(place.supplierId) && Boolean(place.name?.trim()) && Boolean(place.image?.trim()))
    .sort((a, b) => a.supplierId - b.supplierId)
    .slice(0, limit)
    .map((place) => ({
      siteID: place.supplierId,
      name: place.name.trim(),
      image: place.image!,
      images: [...new Set([place.image, ...(place.images || [])].filter((image): image is string => Boolean(image)))].slice(0, 10),
      city: place.location || place.area || "ישראל",
      area: place.area || place.location || "ישראל",
      phone: place.contact?.phone,
      whatsapp: place.contact?.whatsapp,
    }));
}
