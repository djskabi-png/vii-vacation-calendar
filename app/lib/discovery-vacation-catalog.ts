import { publicCatalogDetails } from "./public-catalog-read.ts";
import type { HomeDealCatalogPlace } from "./vii-home-deals.ts";

export type DiscoveryVacationPlace = { supplierId: number; name: string; image?: string; images?: string[]; location?: string; area?: string; lat?: number; lng?: number; contact?: { phone?: string; whatsapp?: string } };
type PublicDetail = { rooms?: { id: number; name?: string; bedrooms?: number; guests?: number }[] };

export function discoveryVacationCatalog(places: DiscoveryVacationPlace[]) {
  const byId = new Map(places.map(place => [place.supplierId, place]));
  return async (requestedIds: number[]): Promise<ReadonlyMap<number, HomeDealCatalogPlace>> => {
    const ids = [...new Set(requestedIds)].filter(id => byId.has(id));
    const details = await publicCatalogDetails<PublicDetail>("vacations", ids);
    return new Map(ids.map(id => {
      const place = byId.get(id)!;
      return [id, { name: place.name, images: [...new Set([place.image, ...(place.images || [])].filter((image): image is string => Boolean(image)))].slice(0, 10),
        city: place.location || "", area: place.area || "", phone: place.contact?.phone, whatsapp: place.contact?.whatsapp,
        rooms: (details.get(id)?.rooms || []).map(room => ({ roomID: room.id, roomName: room.name, bedrooms: room.bedrooms, maxGuests: room.guests })),
      }];
    }));
  };
}
