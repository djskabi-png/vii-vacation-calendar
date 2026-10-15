const API_ROOT = "https://bizonline.co.il/api/ai/vii";

export type LiveSearchWorld = "vacations" | "events";
export type LiveSearchRoom = { adults: number; children?: number };
export type LiveSearchResult = {
  siteID: number;
  available: boolean | null;
  onlineBooking: boolean;
  total: number | null;
  from: string | null;
  till: string | null;
  start: string | null;
  reason: string | null;
  roomCount: number;
  priceGuests: number | null;
  priceMode: "stay_total" | "nightly_average" | "event_total";
};

type RoomBasis = Map<number, Map<number, number>>;
let vacationRoomBasisCache: { expires: number; promise: Promise<RoomBasis> } | null = null;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function daysBetween(from: string, till: string) {
  return Math.round((Date.parse(`${till}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function validRooms(value: unknown): value is LiveSearchRoom[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 12 && value.every((room) => {
    const item = object(room);
    return Number.isSafeInteger(item.adults) && Number(item.adults) >= 1 && Number(item.adults) <= 30
      && (item.children === undefined || Number.isSafeInteger(item.children) && Number(item.children) >= 0 && Number(item.children) <= 20);
  });
}

async function fetchVacationRoomBasis(token: string, fetchImpl: typeof fetch): Promise<RoomBasis> {
  const response = await fetchImpl(`${API_ROOT}/vacations`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return new Map();
  const payload = object(await response.json());
  const result: RoomBasis = new Map();
  for (const value of Array.isArray(payload.places) ? payload.places : []) {
    const place = object(value);
    const siteID = place.siteID;
    if (!Number.isSafeInteger(siteID)) continue;
    const rooms = new Map<number, number>();
    for (const roomValue of Array.isArray(place.rooms) ? place.rooms : []) {
      const room = object(roomValue);
      if (Number.isSafeInteger(room.roomID) && Number.isSafeInteger(room.basisGuests) && Number(room.basisGuests) > 0) {
        rooms.set(Number(room.roomID), Number(room.basisGuests));
      }
    }
    result.set(Number(siteID), rooms);
  }
  return result;
}

function vacationRoomBasis(token: string, fetchImpl: typeof fetch, cacheAllowed: boolean) {
  if (!cacheAllowed) return fetchVacationRoomBasis(token, fetchImpl).catch(() => new Map());
  const now = Date.now();
  if (!vacationRoomBasisCache || vacationRoomBasisCache.expires <= now) {
    vacationRoomBasisCache = { expires: now + 10 * 60_000, promise: fetchVacationRoomBasis(token, fetchImpl).catch(() => new Map()) };
  }
  return vacationRoomBasisCache.promise;
}

export async function liveSupplierSearch(options: {
  world: LiveSearchWorld;
  from: string;
  till: string;
  guests: number;
  rooms?: LiveSearchRoom[];
  hours?: number;
  token: string;
  publishedIds: ReadonlySet<number>;
  fetchImpl?: typeof fetch;
}) {
  const { world, from, till, guests, publishedIds } = options;
  const days = daysBetween(from, till);
  const requestedRooms: LiveSearchRoom[] = options.rooms || [{ adults: guests }];
  if (!validDate(from) || !validDate(till) || !Number.isSafeInteger(guests) || guests < 1 || guests > 1000
    || !validRooms(requestedRooms)
    || (world === "vacations" ? days < 1 || days > 30 : days < 0 || days > 62)
    || (world === "events" && (!Number.isSafeInteger(options.hours) || options.hours! < 1 || options.hours! > 24))) {
    throw new Error("invalid_search");
  }
  if (!options.token) throw new Error("supplier_unavailable");
  const bodies: Record<string, unknown>[] = [];
  if (world === "vacations") bodies.push({ from, nights: days, rooms: requestedRooms });
  else if (days === 0) bodies.push({ date: from, hours: options.hours, rooms: [{ adults: guests }] });
  else {
    let cursor = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${till}T00:00:00Z`);
    while (cursor <= end) {
      const chunkEnd = Math.min(end, cursor + 30 * 86_400_000);
      bodies.push({ window: { from: new Date(cursor).toISOString().slice(0, 10), till: new Date(chunkEnd).toISOString().slice(0, 10) }, hours: options.hours, rooms: [{ adults: guests }] });
      cursor = chunkEnd + 86_400_000;
    }
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const basisPromise = world === "vacations" ? vacationRoomBasis(options.token, fetchImpl, !options.fetchImpl) : Promise.resolve(new Map() as RoomBasis);
  const payloads = await Promise.all(bodies.map(async (body) => {
    const response = await fetchImpl(`${API_ROOT}/${world}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("supplier_unavailable");
    const payload = object(await response.json());
    if (!Array.isArray(payload.sites)) throw new Error("invalid_supplier_response");
    return payload;
  }));
  const roomBasis = await basisPromise;
  const parsed = payloads.map((payload) => (payload.sites as unknown[]).flatMap((value) => {
    const site = object(value);
    const siteID = site.siteID;
    if (!Number.isSafeInteger(siteID) || !publishedIds.has(siteID as number)) return [];
    const cheapest = object(site.cheapest);
    const reportedAvailable = site.available === true ? true : site.available === false ? false : null;
    const total = reportedAvailable && typeof site.minTotal === "number" && Number.isFinite(site.minTotal) && site.minTotal > 0 ? site.minTotal : null;
    const resultFrom = world === "vacations" ? cheapest.from : cheapest.date;
    const resultTill = world === "vacations" ? cheapest.till : cheapest.endDate;
    const validStay = world === "vacations"
      ? resultFrom === from && resultTill === till
      : validDate(resultFrom) && resultFrom >= from && resultFrom <= till && validDate(resultTill)
        && typeof cheapest.start === "string" && /^\d{2}:\d{2}$/.test(cheapest.start);
    const available = reportedAvailable && (!validStay || total === null) ? null : reportedAvailable;
    const selectedRooms = Array.isArray(cheapest.rooms) ? cheapest.rooms.map(object) : [];
    const priceGuests = world === "vacations" && selectedRooms.length ? selectedRooms.reduce((sum, room) => {
      const roomID = Number(room.roomID);
      return sum + (roomBasis.get(Number(siteID))?.get(roomID) || 0);
    }, 0) || null : null;
    return [{
      siteID: siteID as number,
      available,
      onlineBooking: site.onlineBooking === true,
      total: available ? total : null,
      from: validDate(resultFrom) ? resultFrom : null,
      till: validDate(resultTill) ? resultTill : null,
      start: typeof cheapest.start === "string" && /^\d{2}:\d{2}$/.test(cheapest.start) ? cheapest.start : null,
      reason: typeof site.reason === "string" ? site.reason : reportedAvailable && !available ? "invalid_supplier_response" : null,
      roomCount: selectedRooms.length || requestedRooms.length,
      priceGuests,
      priceMode: world === "events" ? "event_total" : requestedRooms.length > 1 ? "nightly_average" : "stay_total",
    }];
  }));
  const ids = new Set(parsed.flatMap((items) => items.map((item) => item.siteID)));
  const results: LiveSearchResult[] = [...ids].map((siteID) => {
    const answers = parsed.map((items) => items.find((item) => item.siteID === siteID));
    const available = answers.filter((item): item is LiveSearchResult => item?.available === true);
    if (available.length) return [...available].sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))[0];
    if (answers.every((item) => item?.available === false)) return answers[0]!;
    const reason = answers.find((item) => item?.reason)?.reason || "unknown";
    return { siteID, available: null, onlineBooking: false, total: null, from: null, till: null, start: null, reason,
      roomCount: requestedRooms.length, priceGuests: null,
      priceMode: world === "events" ? "event_total" as const : requestedRooms.length > 1 ? "nightly_average" as const : "stay_total" as const };
  });
  return { checkedAt: typeof payloads[0].created === "string" ? payloads[0].created : null, world, results };
}
