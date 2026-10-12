import { parseFragment } from "parse5";
import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { SupplierCatalogRedirectError } from "./supplier-catalog-diagnostics.ts";

const root = "https://bizonline.co.il/api/ai/vii";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positive(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function plainText(value: unknown) {
  if (typeof value !== "string") return "";
  const walk = (node: { nodeName: string; value?: string; childNodes?: unknown[] }): string =>
    node.nodeName === "#text" ? node.value || "" : (node.childNodes || []).map((child) => walk(child as typeof node)).join(" ");
  return walk(parseFragment(value) as unknown as Parameters<typeof walk>[0]).replace(/\s+/g, " ").trim();
}

function pictures(galleries: unknown) {
  const values = Array.isArray(galleries) ? galleries : Object.values(record(galleries));
  return [...new Set(values.flatMap((gallery) => {
    const items = record(gallery).pictures;
    return Array.isArray(items) ? items : [];
  }))].filter((path): path is string => typeof path === "string" && /^\/gallery\/[\w.-]+$/.test(path))
    .map((path) => new URL(path, "https://www.vii.co.il").href);
}

function rates(value: unknown) {
  const base = record(value);
  return [
    { duration: "שעה", weekday: positive(base.hourPriceWeekday), weekend: positive(base.hourPriceWeekend) },
    { duration: "שעתיים", weekday: positive(base.twoHourPriceWeekday), weekend: positive(base.twoHourPriceWeekend) },
    { duration: "3 שעות", weekday: positive(base.threeHourPriceWeekday), weekend: positive(base.threeHourPriceWeekend) },
  ].filter((rate) => rate.weekday || rate.weekend);
}

export function createSergeyRoomsCatalogClient(options: { apiKey: string; fetchImpl?: typeof fetch }) {
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
    if (response.status >= 300 && response.status < 400) throw new SupplierCatalogRedirectError("sergey_redirect_not_allowed", response.status, response.headers.get("Location"), `${root}${path}`);
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "sergey_not_authorized" : "sergey_provider_error");
    try { return record(await response.json()); } catch { throw new Error("invalid_sergey_response"); }
  }

  return {
    async fetchCandidate() {
      const [listing, locations] = await Promise.all([get("/rooms"), get("/rooms/locations")]);
      if (!Array.isArray(listing.places) || !Array.isArray(locations.cities) || !Array.isArray(locations.areas)) {
        throw new Error("invalid_rooms_catalog");
      }
      const active = listing.places.map(record).filter((place) => place.active === true);
      const ids = active.map((place) => positive(place.siteID));
      if (!active.length || ids.some((id) => id === null) || new Set(ids).size !== ids.length) {
        throw new Error("invalid_rooms_catalog");
      }
      const cities = new Map(locations.cities.map((city) => [record(city).id, record(city)]));
      const areas = new Map(locations.areas.map((area) => [record(area).id, String(record(area).title || "")]));
      const entries = new Array<SupplierCatalogEntry>(active.length);
      let cursor = 0;
      async function worker() {
        while (cursor < active.length) {
          const index = cursor++;
          const supplierId = ids[index]!;
          const detail = await get(`/rooms/${supplierId}`);
          const name = typeof detail.name === "string" ? detail.name.trim() : "";
          if (detail.id !== supplierId || detail.active !== true || !name) throw new Error("invalid_room_identity");
          const city = cities.get(record(detail.location).city);
          const rooms = Array.isArray(detail.rooms) ? detail.rooms.map((value) => {
            const room = record(value);
            const id = positive(room.roomID);
            const roomName = String(room.roomName || "").trim();
            if (!id || !roomName) throw new Error("invalid_room_inventory");
            const spaces = Array.isArray(room.spaces) ? room.spaces : [];
            return {
              id,
              name: roomName,
              count: positive(room.roomCount),
              maxGuests: positive(room.maxGuests),
              features: [...new Set(spaces.flatMap((space) => {
                const features = record(space).features;
                return Array.isArray(features) ? features.map((feature) => plainText(record(feature).description)) : [];
              }).filter(Boolean))],
              rates: rates(room.basePrices),
            };
          }) : [];
          entries[index] = { supplierId, summary: {
            id: `hourly-${supplierId}`,
            supplierId,
            name,
            sourceUrl: detail.page_url,
            location: String(city?.title || ""),
            area: areas.get(city?.area) || "",
            description: plainText(record(detail.meta).description) || plainText(detail.summary),
            images: pictures(detail.galleries),
            phone: typeof record(detail.contact).phone === "string" ? record(detail.contact).phone : "",
            whatsapp: typeof record(detail.contact).whatsapp === "string" ? record(detail.contact).whatsapp : "",
            lat: record(detail.gps).lat,
            lng: record(detail.gps).long,
            score: typeof record(detail.reviews).score === "number" && (record(detail.reviews).score as number) > 0 ? record(detail.reviews).score : null,
            reviewCount: positive(record(detail.reviews).count) || 0,
            rooms,
          } };
        }
      }
      await Promise.all(Array.from({ length: Math.min(6, active.length) }, worker));
      if (entries.some((entry) => !entry)) throw new Error("invalid_rooms_catalog");
      return { fetchedAt: new Date().toISOString(), entries };
    },
  };
}
