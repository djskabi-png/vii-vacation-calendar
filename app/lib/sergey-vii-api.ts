const API_ROOT = "https://bizonline.co.il/api/ai/vii";
const MEDIA_ROOT = "https://www.vii.co.il";
const TIMEOUT_MS = 15_000;

export type ViiSupplierWorld = "vacations" | "events";

type SupplierGallery = { pictures?: unknown };
type SupplierRoom = { roomID?: unknown; roomName?: unknown; roomCount?: unknown; maxGuests?: unknown; bedrooms?: unknown };
type SupplierPlace = {
  siteID?: unknown;
  siteName?: unknown;
  active?: unknown;
  location?: { cityID?: unknown };
  galleries?: unknown;
  rooms?: unknown;
  reviews?: { score?: unknown; count?: unknown };
};

export type ViiLivePlace = {
  id: number;
  name: string;
  city: string;
  area: string;
  image: string;
  score: number | null;
  reviewCount: number;
};

export type ViiLiveDetail = ViiLivePlace & {
  images: string[];
  highlights: string[];
  phone: string | null;
  rooms: Array<{ id: number; name: string; units: number; maxGuests: number | null; bedrooms: number | null }>;
};

export class ViiSupplierError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`VII supplier API: ${code}`);
    this.name = "ViiSupplierError";
    this.code = code;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mediaUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, MEDIA_ROOT);
    return url.protocol === "https:" && ["www.vii.co.il", "vii.co.il"].includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function images(galleries: unknown): string[] {
  const collection = Array.isArray(galleries) ? galleries : Object.values(record(galleries));
  return [...new Set(collection.flatMap((gallery) => {
    const pictures = (gallery as SupplierGallery)?.pictures;
    return Array.isArray(pictures) ? pictures.map(mediaUrl).filter((url): url is string => Boolean(url)) : [];
  }))];
}

async function getSupplier(path: string, fetchImpl: typeof fetch, apiKey: string): Promise<unknown> {
  if (!apiKey) throw new ViiSupplierError("missing_api_key");
  let response: Response;
  try {
    response = await fetchImpl(`${API_ROOT}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ViiSupplierError("transport_error");
  }
  if (!response.ok) throw new ViiSupplierError(response.status === 401 || response.status === 403 ? "not_authorized" : "provider_error");
  try {
    return await response.json();
  } catch {
    throw new ViiSupplierError("invalid_response");
  }
}

export function createSergeyViiClient(options: { apiKey: string; fetchImpl?: typeof fetch }) {
  const apiKey = options.apiKey.trim();
  const fetchImpl = options.fetchImpl ?? fetch;

  async function locations() {
    const data = record(await getSupplier("/locations", fetchImpl, apiKey));
    if (!Array.isArray(data.cities) || !Array.isArray(data.areas)) throw new ViiSupplierError("invalid_locations");
    const areas = new Map(data.areas.map((area) => [number(record(area).id), String(record(area).title || "")]));
    return new Map(data.cities.map((city) => {
      const value = record(city);
      return [number(value.id), { city: String(value.title || ""), area: areas.get(number(value.area)) || "" }] as const;
    }));
  }

  function summary(place: SupplierPlace, placeLocations: Awaited<ReturnType<typeof locations>>): ViiLivePlace | null {
    const id = number(place.siteID);
    const name = typeof place.siteName === "string" ? place.siteName.trim() : "";
    const cover = images(place.galleries)[0];
    if (place.active !== true || id === null || !Number.isSafeInteger(id) || !name || !cover) return null;
    const location = placeLocations.get(number(place.location?.cityID));
    return {
      id,
      name,
      city: location?.city || "",
      area: location?.area || "",
      image: cover,
      score: number(place.reviews?.score),
      reviewCount: number(place.reviews?.count) ?? 0,
    };
  }

  return {
    async list(world: ViiSupplierWorld): Promise<ViiLivePlace[]> {
      const [payload, placeLocations] = await Promise.all([getSupplier(`/${world}`, fetchImpl, apiKey), locations()]);
      const places = record(payload).places;
      if (!Array.isArray(places)) throw new ViiSupplierError("invalid_list");
      return places.map((place) => summary(place, placeLocations)).filter((place): place is ViiLivePlace => Boolean(place));
    },
    async detail(world: ViiSupplierWorld, id: number): Promise<ViiLiveDetail | null> {
      if (!Number.isSafeInteger(id) || id < 1) throw new ViiSupplierError("invalid_id");
      const [payload, placeLocations] = await Promise.all([getSupplier(`/${world}/${id}`, fetchImpl, apiKey), locations()]);
      const data = record(payload);
      const place = summary({
        siteID: data.id,
        siteName: data.name,
        active: data.active,
        location: { cityID: record(data.location).city },
        galleries: data.galleries,
        rooms: data.rooms,
        reviews: record(data.reviews) as SupplierPlace["reviews"],
      }, placeLocations);
      if (!place || place.id !== id) return null;
      const contactPhone = record(data.contact).phone;
      const rooms = Array.isArray(data.rooms) ? data.rooms as SupplierRoom[] : [];
      return {
        ...place,
        images: images(data.galleries),
        highlights: Array.isArray(data.highlights) ? data.highlights.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 12) : [],
        phone: typeof contactPhone === "string" && /^[+\d()\s-]{7,24}$/.test(contactPhone) ? contactPhone : null,
        rooms: rooms.flatMap((room) => {
          const roomId = number(room.roomID);
          if (roomId === null || !Number.isSafeInteger(roomId)) return [];
          return [{ id: roomId, name: typeof room.roomName === "string" ? room.roomName : "יחידת אירוח", units: number(room.roomCount) ?? 0, maxGuests: number(room.maxGuests), bedrooms: number(room.bedrooms) }];
        }),
      };
    },
  };
}

export function sergeyViiClientFromEnv() {
  return createSergeyViiClient({ apiKey: process.env.SERGEY_VII_API_TOKEN ?? "" });
}
