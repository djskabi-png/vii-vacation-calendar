import { parseFragment } from "parse5";
import { supplierContactNumber } from "./supplier-contact.ts";
import { supplierDisplayDescription } from "../data/supplier-display-text.ts";
import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { SupplierCatalogRedirectError } from "./supplier-catalog-diagnostics.ts";
import { sergeyPlaceGalleryGroups, sergeyPlaceImages, sergeyRoomImages, sergeyRoomFeatureGroups } from "./sergey-gallery.ts";
import { startingPriceFields } from "./supplier-starting-price.ts";
import { publicCatalogEntryAllowed } from "./public-catalog-policy.ts";
import { buildSergeyAmenityIndex, sergeyAmenityGroups, sergeyAmenityLabels, sergeyAmenitySearchLabels, sergeyRoomType, type SergeyAmenityIndex } from "./sergey-amenities.ts";
import { vacationSearchFilterIdsFromText } from "./vacation-search-filter-index.ts";

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

function positive(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : 0;
}

function accommodationType(name: string, rooms: Record<string, unknown>[], highlights: string[], features: string[], amenityIndex: SergeyAmenityIndex) {
  const explicit = rooms.map((room) => sergeyRoomType(room.roomType, amenityIndex)).find(Boolean);
  if (explicit) return explicit;
  const searchable = `${name} ${rooms.map((room) => text(room.roomName)).join(" ")} ${highlights.join(" ")} ${features.slice(0, 8).join(" ")}`;
  if (/וילה/.test(searchable)) return "וילה";
  if (/בקת/.test(searchable)) return "בקתות עץ";
  if (/סוויט/.test(searchable)) return "סוויטות";
  if (/דיר/.test(searchable)) return "דירות נופש";
  if (/צימר/.test(searchable)) return "צימרים";
  return "מתחם אירוח";
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
  cityById: Map<number, Record<string, unknown>>, areaById: Map<number, string>, amenityIndex: SergeyAmenityIndex): SupplierCatalogEntry {
  const raw = record(rawValue);
  const name = text(raw.name);
  const images = sergeyPlaceImages(raw.galleries);
  const city = cityById.get(Number(record(raw.location).city));
  if (raw.active !== true || raw.id !== supplierId || !name || !text(city?.title)) {
    throw new Error("invalid_sergey_place");
  }
  if (!images.length) throw new Error("sergey_place_missing_media");
  const area = areaById.get(Number(city?.area)) || "";
  const rooms = Array.isArray(raw.rooms) ? raw.rooms.map(record) : [];
  const sharedAmenities = sergeyAmenitySearchLabels(raw.shared_amenities, amenityIndex);
  const roomAmenityFilters = rooms.flatMap((room) => sergeyAmenitySearchLabels(room.amenities, amenityIndex));
  const roomFeatures = unique(rooms.flatMap((room) => {
    const spaces = Array.isArray(room.spaces) ? room.spaces : [];
    return spaces.flatMap((space) => {
      const items = record(space).features;
      return Array.isArray(items) ? items.map((feature) => text(record(feature).description)) : [];
    });
  }));
  const searchableFeatures = unique([...sharedAmenities, ...roomAmenityFilters, ...roomFeatures]);
  const visibleFeatures = unique([
    ...sergeyAmenityLabels(raw.shared_amenities, amenityIndex),
    ...rooms.flatMap((room) => sergeyAmenityLabels(room.amenities, amenityIndex)),
    ...roomFeatures,
  ]);
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
    galleryGroups: sergeyPlaceGalleryGroups(raw.galleries),
    features: sergeyAmenityLabels(raw.shared_amenities, amenityIndex),
    featureGroups: sergeyAmenityGroups(raw.shared_amenities, amenityIndex),
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
        maxAdults: positive(room.maxAdults),
        maxKids: positive(room.maxKids),
        showKidsAndAdults: room.showKidsAndAdults === 1 || room.showKidsAndAdults === true,
        basisGuests: positive(room.basisGuests),
        roomType: sergeyRoomType(room.roomType, amenityIndex),
        bedrooms: positive(room.bedrooms),
        area: positive(room.totalSize) || positive(room.roomSize) || undefined,
        features: unique([...sergeyAmenityLabels(room.amenities, amenityIndex), ...spaces.flatMap((space) => {
          const values = record(space).features;
          return Array.isArray(values) ? values.map((value) => text(record(value).description)) : [];
        })]),
        featureGroups: [...sergeyAmenityGroups(room.amenities, amenityIndex), ...sergeyRoomFeatureGroups(room)],
        images: positive(room.roomID) ? sergeyRoomImages(room, raw.galleries) : [],
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
    ...startingPriceFields(raw),
    sourceUrl: raw.page_url,
    slug,
    name,
    location: text(city?.title),
    area,
    type: world === "vacations"
      ? accommodationType(name, rooms, highlights, searchableFeatures, amenityIndex)
      : rooms.map((room) => sergeyRoomType(room.roomType, amenityIndex)).find(Boolean) || "מקום לאירועים",
    units,
    guests,
    capacityScope: "unit",
    image: images[0],
    images,
    description: text(record(raw.meta).description),
    features: unique([...highlights, ...visibleFeatures]).slice(0, 24),
    searchFilterIds: vacationSearchFilterIdsFromText([name, text(city?.title), area, text(record(raw.meta).description), ...searchableFeatures]),
    ...(world === "vacations" && highlights.length ? { highlights: highlights.slice(0, 5).map((label) => ({ label, icon: "default" })) } : {}),
    audiences: [],
    badges: [],
    ...coordinates(raw.gps),
    scenario: units > 1 ? "multi" : "single",
    ...(score ? { score } : {}),
    ...(reviewCount ? { reviews: reviewCount } : {}),
    ...(phone || whatsapp ? { contact: { ...(phone ? { phone } : {}), ...(whatsapp ? { whatsapp } : {}) } } : {}),
    ...(world === "events" ? { eventTypes: [] } : {}),
  };
  if (!publicCatalogEntryAllowed(summary)) throw new Error("supplier_fixture_not_public");
  return { supplierId, summary, detail };
}

export const SERGEY_DETAIL_REFRESH_LIMIT = 24;

export function createSergeyPublicCatalogClient(options: { apiKey: string; fetchImpl?: typeof fetch; now?: () => Date;
  detailRefreshLimit?: number }) {
  const apiKey = options.apiKey.trim();
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || (() => new Date());
  const detailRefreshLimit = Number.isSafeInteger(options.detailRefreshLimit)
    ? Math.max(0, Math.min(48, options.detailRefreshLimit as number)) : SERGEY_DETAIL_REFRESH_LIMIT;
  async function get(path: string): Promise<Record<string, unknown>> {
    if (!apiKey) throw new Error("missing_sergey_key");
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000), redirect: "manual", cache: "no-store",
      });
    } catch { throw new Error("sergey_transport_error"); }
    if (response.status >= 300 && response.status < 400) throw new SupplierCatalogRedirectError("sergey_redirect_not_allowed", response.status, response.headers.get("Location"), `${root}${path}`);
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "sergey_not_authorized" : "sergey_provider_error");
    try { return record(await response.json()); } catch { throw new Error("invalid_sergey_response"); }
  }

  return {
    async fetchCandidate(world: World, previousEntries: SupplierCatalogEntry[] = []) {
      const [locations, list, types] = await Promise.all([get("/locations"), get(`/${world}`), get(`/${world}/types`)]);
      if (!Array.isArray(locations.cities) || !Array.isArray(locations.areas) || !Array.isArray(list.places)) {
        throw new Error("invalid_sergey_catalog");
      }
      const cities = new Map(locations.cities.map((value) => [Number(record(value).id), record(value)]));
      const areas = new Map(locations.areas.map((value) => [Number(record(value).id), text(record(value).title)]));
      const amenityIndex = buildSergeyAmenityIndex(types);
      const active = list.places.map(record).filter((place) => place.active === true);
      const ids = active.map((place) => positive(place.siteID));
      if (!active.length || ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        throw new Error("invalid_sergey_catalog");
      }
      const entries = new Array<SupplierCatalogEntry | null>(active.length);
      const excludedMediaIds: number[] = [];
      const previous = new Map(previousEntries.map((entry) => [entry.supplierId, entry]));
      const existingIndexes = ids.map((id, index) => previous.has(id) ? index : -1).filter((index) => index >= 0);
      const refreshIndexes = new Set<number>();
      if (existingIndexes.length && detailRefreshLimit) {
        const window = Math.floor(now().getTime() / 600_000);
        const start = (window * detailRefreshLimit) % existingIndexes.length;
        for (let offset = 0; offset < Math.min(detailRefreshLimit, existingIndexes.length); offset += 1) {
          refreshIndexes.add(existingIndexes[(start + offset) % existingIndexes.length]);
        }
      }
      const detailIndexes = active.map((_place, index) => index)
        .filter((index) => !previous.has(ids[index]) || !previous.get(ids[index])?.detail || refreshIndexes.has(index));
      for (let index = 0; index < active.length; index += 1) {
        const old = previous.get(ids[index]);
        if (!old || detailIndexes.includes(index)) continue;
        try {
          const listPlace = active[index];
          const location = record(listPlace.location);
          const normalized = normalizePlace(world, ids[index], {
            ...listPlace,
            id: ids[index], name: listPlace.siteName, location: { city: location.cityID },
            summary: record(old.detail).summary || "", meta: { description: record(old.summary).description || "" },
          }, cities, areas, amenityIndex);
          entries[index] = { supplierId: ids[index], summary: {
            ...record(old.summary),
            ...record(normalized.summary),
            description: record(old.summary).description || record(normalized.summary).description,
            ...("highlights" in record(old.summary) ? { highlights: record(old.summary).highlights } : {}),
          }, detail: old.detail };
        } catch {
          // A list-card omission must not erase a previously accepted detail page.
          entries[index] = old;
        }
      }
      let cursor = 0;
      async function worker() {
        while (cursor < detailIndexes.length) {
          const index = detailIndexes[cursor++];
          const id = ids[index];
          try {
            const detail = await get(`/${world}/${id}`);
            // Seasonal starting prices belong to the list contract. Preserve
            // them in the accepted summary even when the detail response does
            // not repeat them, so future catalog syncs cannot erase the
            // undated browse price.
            entries[index] = normalizePlace(world, id, {
              ...detail,
              ...startingPriceFields(active[index]),
            }, cities, areas, amenityIndex);
          } catch (error) {
            if (error instanceof Error && ["sergey_place_missing_media", "supplier_fixture_not_public"].includes(error.message)) {
              entries[index] = previous.get(id) || null;
              excludedMediaIds.push(id);
            } else if (previous.has(id)) {
              entries[index] = previous.get(id)!;
              console.warn("VII supplier detail refresh retained previous entry", { world, siteID: id,
                code: error instanceof Error && /^[a-z_]{3,100}$/.test(error.message) ? error.message : "supplier_detail_refresh_failed" });
            } else if (error instanceof Error && ["sergey_transport_error", "sergey_provider_error"].includes(error.message)) {
              // A single new place must not make hundreds of already accepted
              // places disappear. It remains unpublished until a later bounded
              // detail refresh succeeds.
              entries[index] = null;
              console.warn("VII new supplier place deferred after detail failure", { world, siteID: id,
                code: error instanceof Error && /^[a-z_]{3,100}$/.test(error.message) ? error.message : "supplier_detail_refresh_failed" });
            } else throw error;
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, detailIndexes.length) }, worker));
      if (entries.some((entry) => entry === undefined)) throw new Error("invalid_sergey_catalog");
      if (excludedMediaIds.length) console.warn("VII supplier places withheld without media", { world, siteIDs: excludedMediaIds.sort((a, b) => a - b) });
      return { fetchedAt: new Date().toISOString(), entries: entries.filter((entry): entry is SupplierCatalogEntry => entry !== null) };
    },
  };
}
