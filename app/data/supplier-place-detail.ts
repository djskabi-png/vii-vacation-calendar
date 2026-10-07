import source from "./sergey-place-details.json" with { type: "json" };
import { supplierToken } from "../lib/vii-supplier-token.ts";
import { supplierDisplayDescription } from "./supplier-display-text.ts";
import catalog from "./sergey-public-catalog.json" with { type: "json" };
import { unknownReviewer } from "../i18n/vii-live-search-copy.ts";

export type SupplierPlaceDetail = {
  name?: string;
  location?: string;
  area?: string;
  lat?: number;
  lng?: number;
  guests?: number;
  units?: number;
  phone?: string;
  whatsapp?: string;
  highlights?: string[];
  images: string[];
  summary: string;
  policy: { checkIn: string; checkOut: string; checkOutSat: string; remarks: string };
  rooms: Array<{ name: string; quantity: number; guests: number; bedrooms: number; features: string[] }>;
  reviews: Array<{ id: number; author: string; title: string; text: string; date: string; score?: number; response: string; pictureFiles: string[] }>;
  sourceUrl: string;
  reviewCount?: number;
  reviewScore?: number;
};

export function supplierPlaceDetail(slug: string): SupplierPlaceDetail | undefined {
  return (source.details as Record<string, SupplierPlaceDetail>)[slug];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function plain(value: unknown) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function supplierMedia(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, "https://www.vii.co.il");
    return url.protocol === "https:" && ["www.vii.co.il", "vii.co.il"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export async function liveSupplierPlaceDetail(slug: string, options: { token?: string; fetchImpl?: typeof fetch } = {}): Promise<SupplierPlaceDetail | undefined> {
  const match = /^(vacation|event)-(\d+)$/.exec(slug);
  const fallback = supplierPlaceDetail(slug);
  if (!match || !fallback) return fallback;
  const listing = catalog.places.find((item) => item.slug === slug);
  if (!listing) return fallback;
  try {
    const token = options.token ?? await supplierToken();
    if (!token) return fallback;
    const fetchImpl = options.fetchImpl ?? fetch;
    const world = match[1] === "vacation" ? "vacations" : "events";
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const [response, locationResponse] = await Promise.all([
      fetchImpl(`https://bizonline.co.il/api/ai/vii/${world}/${match[2]}`, { headers, cache: "no-store", signal: AbortSignal.timeout(12_000) }),
      fetchImpl("https://bizonline.co.il/api/ai/vii/locations", { headers, cache: "no-store", signal: AbortSignal.timeout(6_000) }).catch(() => null),
    ]);
    if (!response.ok) return fallback;
    const detail = record(await response.json());
    if (detail.active !== true || detail.id !== Number(match[2])) return fallback;
    const galleries = record(detail.galleries);
    const groups = Array.isArray(detail.galleries) ? detail.galleries : Object.values(galleries);
    const images = [...new Set(groups.flatMap((group) => {
      const pictures = record(group).pictures;
      return Array.isArray(pictures) ? pictures.map(supplierMedia).filter((value): value is string => Boolean(value)) : [];
    }))];
    if (!images.length) return fallback;
    const policy = record(detail.policy);
    const reviews = record(detail.reviews);
    const rooms = Array.isArray(detail.rooms) ? detail.rooms : [];
    const reviewList = Array.isArray(reviews.list) ? reviews.list : [];
    const locations = locationResponse?.ok ? record(await locationResponse.json().catch(() => ({}))) : {};
    const cities = Array.isArray(locations.cities) ? locations.cities : [];
    const areas = Array.isArray(locations.areas) ? locations.areas : [];
    const city = record(cities.find((value) => record(value).id === record(detail.location).city));
    const area = record(areas.find((value) => record(value).id === city.area));
    const gps = record(detail.gps);
    const contact = record(detail.contact);
    const validPhone = typeof contact.phone === "string" && /^[+\d()\s-]{7,24}$/.test(contact.phone);
    const validWhatsApp = typeof contact.whatsapp === "string" && /^[+\d()\s-]{7,24}$/.test(contact.whatsapp);
    const counts = rooms.map((value) => record(value));
    return {
      name: typeof detail.name === "string" && detail.name.trim() ? detail.name.trim() : listing.name,
      location: typeof city.title === "string" ? city.title : listing.location,
      area: typeof area.title === "string" ? area.title : listing.area,
      ...(typeof gps.lat === "number" && gps.lat >= 29 && gps.lat <= 34 ? { lat: gps.lat } : {}),
      ...(typeof gps.long === "number" && gps.long >= 34 && gps.long <= 36 ? { lng: gps.long } : {}),
      guests: Math.max(0, ...counts.map((room) => typeof room.maxGuests === "number" ? room.maxGuests : 0)),
      units: counts.reduce((sum, room) => sum + (typeof room.roomCount === "number" && room.roomCount > 0 ? room.roomCount : 1), 0),
      ...(validPhone ? { phone: contact.phone as string } : {}),
      ...(validWhatsApp ? { whatsapp: contact.whatsapp as string } : {}),
      highlights: Array.isArray(detail.highlights) ? detail.highlights.map(plain).filter(Boolean) : [],
      images,
      summary: supplierDisplayDescription({ description: plain(detail.summary), name: typeof detail.name === "string" ? detail.name : listing.name, location: typeof city.title === "string" ? city.title : listing.location, area: typeof area.title === "string" ? area.title : listing.area }),
      policy: {
        checkIn: typeof policy.checkIn === "string" ? policy.checkIn : "",
        checkOut: typeof policy.checkOut === "string" ? policy.checkOut : "",
        checkOutSat: typeof policy.checkOutSat === "string" ? policy.checkOutSat : "",
        remarks: plain(policy.remarks),
      },
      rooms: rooms.map((value) => {
        const room = record(value);
        const spaces = Array.isArray(room.spaces) ? room.spaces : [];
        return {
          name: typeof room.roomName === "string" ? room.roomName : "יחידת אירוח",
          quantity: typeof room.roomCount === "number" && room.roomCount > 0 ? room.roomCount : 1,
          guests: typeof room.maxGuests === "number" && room.maxGuests > 0 ? room.maxGuests : 0,
          bedrooms: typeof room.bedrooms === "number" && room.bedrooms > 0 ? room.bedrooms : 0,
          features: [...new Set(spaces.flatMap((value) => {
            const features = record(value).features;
            return Array.isArray(features) ? features.map((feature) => plain(record(feature).description)).filter(Boolean) : [];
          }))],
        };
      }),
      reviews: reviewList.flatMap((value) => {
        const review = record(value);
        if (!Number.isSafeInteger(review.id)) return [];
        const pictures = Array.isArray(review.pictures) ? review.pictures : [];
        return [{
          id: review.id as number,
          author: plain(review.author) || unknownReviewer,
          title: plain(review.title),
          text: plain(review.text),
          date: typeof review.added === "string" ? review.added : "",
          ...(typeof review.score === "number" ? { score: review.score } : {}),
          response: plain(review.response),
          pictureFiles: pictures.filter((picture): picture is string => typeof picture === "string" && /^[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(picture)),
        }];
      }),
      sourceUrl: typeof detail.page_url === "string" ? detail.page_url : fallback.sourceUrl,
      reviewCount: typeof reviews.count === "number" ? reviews.count : reviewList.length,
      reviewScore: typeof reviews.score === "number" ? reviews.score : undefined,
    };
  } catch {
    return fallback;
  }
}
