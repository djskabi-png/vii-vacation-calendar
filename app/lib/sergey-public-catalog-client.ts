import { parseFragment } from "parse5";
import { supplierContactNumber } from "./supplier-contact.ts";
import { supplierDisplayDescription } from "../data/supplier-display-text.ts";
import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";

type World = "vacations" | "events";
const root = "https://bizonline.co.il/api/ai/vii";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function plainText(value: unknown) {
  if (typeof value !== "string") return "";
  const walk = (node: { nodeName: string; value?: string; childNodes?: unknown[] }): string =>
    node.nodeName === "#text" ? node.value || "" : (node.childNodes || []).map((child) => walk(child as typeof node))
      .join(["p", "br", "li"].includes(node.nodeName) ? "\n" : " ");
  return walk(parseFragment(value) as unknown as Parameters<typeof walk>[0])
    .replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

function unique(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))];
}

function imageUrl(path: unknown) {
  return typeof path === "string" && /^\/gallery\/[\w.-]+$/.test(path)
    ? new URL(path, "https://www.vii.co.il").href : null;
}

function galleryImages(value: unknown) {
  const galleries = Array.isArray(value) ? value : Object.values(record(value));
  return unique(galleries.flatMap((gallery) => {
    const pictures = record(gallery).pictures;
    return Array.isArray(pictures) ? pictures.map(imageUrl) : [];
  }));
}

function positive(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : 0;
}

function coordinates(gps: unknown) {
  const source = record(gps);
  const lat = source.lat;
  const lng = source.long;
  const valid = (a: unknown, b: unknown) => typeof a === "number" && typeof b === "number"
    && a >= 29 && a <= 34 && b >= 34 && b <= 36;
  if (valid(lat, lng)) return { lat, lng };
  if (valid(lng, lat)) return { lat: lng, lng: lat };
  return {};
}

function normalizePlace(world: World, supplierId: number, rawValue: unknown,
  cityById: Map<number, Record<string, unknown>>, areaById: Map<number, string>): SupplierCatalogEntry {
  const raw = record(rawValue);
  const name = text(raw.name);
  const images = galleryImages(raw.galleries);
  const city = cityById.get(Number(record(raw.location).city));
  if (raw.active !== true || raw.id !== supplierId || !name || !text(city?.title) || !images.length) {
    throw new Error("invalid_sergey_place");
  }
  const area = areaById.get(Number(city?.area)) || "";
  const rooms = Array.isArray(raw.rooms) ? raw.rooms.map(record) : [];
  const galleries = Object.values(record(raw.galleries));
  const features = unique(rooms.flatMap((room) => {
    const spaces = Array.isArray(room.spaces) ? room.spaces : [];
    return spaces.flatMap((space) => {
      const items = record(space).features;
      return Array.isArray(items) ? items.map((feature) => text(record(feature).description)) : [];
    });
  }));
  const highlights = Array.isArray(raw.highlights) ? raw.highlights.filter((item): item is string => typeof item === "string") : [];
  const units = rooms.reduce((total, room) => total + (positive(room.roomCount) || 1), 0);
  const guests = rooms.length ? Math.max(...rooms.map((room) => positive(room.maxGuests))) : 0;
  const reviews = record(raw.reviews);
  const score = typeof reviews.score === "number" && reviews.score > 0 ? reviews.score : undefined;
  const reviewCount = positive(reviews.count) || undefined;
  const contact = record(raw.contact);
  const phone = supplierContactNumber(contact.phone);
  const whatsapp = supplierContactNumber(contact.whatsapp);
  const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
  const policy = record(raw.policy);
  const detail = {
    images,
    summary: supplierDisplayDescription({ description: plainText(raw.summary), name, location: text(city?.title), area }),
    policy: { checkIn: text(policy.checkIn), checkOut: text(policy.checkOut),
      checkOutSat: text(policy.checkOutSat), remarks: plainText(policy.remarks) },
    rooms: rooms.map((room) => {
      const roomName = text(room.roomName);
      const spaces = Array.isArray(room.spaces) ? room.spaces : [];
      return {
        id: positive(room.roomID),
        name: roomName || "יחידת אירוח",
        quantity: positive(room.roomCount) || 1,
        guests: positive(room.maxGuests),
        bedrooms: positive(room.bedrooms),
        features: unique(spaces.flatMap((space) => {
          const values = record(space).features;
          return Array.isArray(values) ? values.map((value) => text(record(value).description)) : [];
        })),
        images: unique(galleries.filter((gallery) => text(record(gallery).title) === roomName).flatMap((gallery) => {
          const values = record(gallery).pictures;
          return Array.isArray(values) ? values.map(imageUrl) : [];
        })),
      };
    }),
    reviews: (Array.isArray(reviews.list) ? reviews.list : []).map(record)
      .filter((review) => positive(review.id) && (typeof review.text === "string" || typeof review.score === "number"))
      .map((review) => ({
        id: positive(review.id), author: text(review.author) || "אורח", title: text(review.title),
        text: text(review.text), date: review.added || "", score: typeof review.score === "number" ? review.score : undefined,
        response: text(review.response),
        pictureFiles: Array.isArray(review.pictures) ? review.pictures.filter((value): value is string =>
          typeof value === "string" && /^[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(value)) : [],
      })),
    sourceUrl: raw.page_url,
  };
  const summary = {
    supplierId,
    world,
    sourceUrl: raw.page_url,
    slug,
    name,
    location: text(city?.title),
    area,
    type: world === "vacations" ? "מקום אירוח" : "מקום לאירועים",
    units,
    guests,
    capacityScope: "unit",
    image: images[0],
    images,
    description: text(record(raw.meta).description),
    features: unique([...highlights, ...features]).slice(0, 24),
    audiences: [],
    badges: [],
    ...coordinates(raw.gps),
    scenario: units > 1 ? "multi" : "single",
    ...(score ? { score } : {}),
    ...(reviewCount ? { reviews: reviewCount } : {}),
    ...(phone || whatsapp ? { contact: { ...(phone ? { phone } : {}), ...(whatsapp ? { whatsapp } : {}) } } : {}),
    ...(world === "events" ? { eventTypes: [] } : {}),
  };
  return { supplierId, summary, detail };
}

export function createSergeyPublicCatalogClient(options: { apiKey: string; fetchImpl?: typeof fetch }) {
  const apiKey = options.apiKey.trim();
  const fetchImpl = options.fetchImpl || fetch;
  async function get(path: string): Promise<Record<string, unknown>> {
    if (!apiKey) throw new Error("missing_sergey_key");
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000), redirect: "manual", cache: "no-store",
      });
    } catch { throw new Error("sergey_transport_error"); }
    if (response.status >= 300 && response.status < 400) throw new Error("sergey_redirect_not_allowed");
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "sergey_not_authorized" : "sergey_provider_error");
    try { return record(await response.json()); } catch { throw new Error("invalid_sergey_response"); }
  }

  return {
    async fetchCandidate(world: World) {
      const [locations, list] = await Promise.all([get("/locations"), get(`/${world}`)]);
      if (!Array.isArray(locations.cities) || !Array.isArray(locations.areas) || !Array.isArray(list.places)) {
        throw new Error("invalid_sergey_catalog");
      }
      const cities = new Map(locations.cities.map((value) => [Number(record(value).id), record(value)]));
      const areas = new Map(locations.areas.map((value) => [Number(record(value).id), text(record(value).title)]));
      const active = list.places.map(record).filter((place) => place.active === true);
      const ids = active.map((place) => positive(place.siteID));
      if (!active.length || ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        throw new Error("invalid_sergey_catalog");
      }
      const entries = new Array<SupplierCatalogEntry>(active.length);
      let cursor = 0;
      async function worker() {
        while (cursor < active.length) {
          const index = cursor++;
          const id = ids[index];
          entries[index] = normalizePlace(world, id, await get(`/${world}/${id}`), cities, areas);
        }
      }
      await Promise.all(Array.from({ length: Math.min(6, active.length) }, worker));
      if (entries.some((entry) => !entry)) throw new Error("invalid_sergey_catalog");
      return { fetchedAt: new Date().toISOString(), entries };
    },
  };
}
