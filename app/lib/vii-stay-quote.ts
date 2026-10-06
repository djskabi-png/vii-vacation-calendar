import { daysBetween, validDate } from "./vii-live-search.ts";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function supplierStayQuote(options: {
  siteID: number;
  from: string;
  till: string;
  guests: number;
  token: string;
  publishedIds: ReadonlySet<number>;
  fetchImpl?: typeof fetch;
}) {
  const { siteID, from, till, guests, token, publishedIds } = options;
  const nights = validDate(from) && validDate(till) ? daysBetween(from, till) : 0;
  if (!Number.isSafeInteger(siteID) || !publishedIds.has(siteID) || !validDate(from) || !validDate(till)
    || nights < 1 || nights > 30 || !Number.isSafeInteger(guests) || guests < 1 || guests > 1000) {
    throw new Error("invalid_stay");
  }
  if (!token) throw new Error("supplier_unavailable");
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  const search = await fetchImpl(`${API_ROOT}/vacations/search`, {
    method: "POST", headers, body: JSON.stringify({ from, nights, rooms: [{ adults: guests }], siteID }),
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!search.ok) throw new Error("supplier_unavailable");
  const searchSites = object(await search.json()).sites;
  if (!Array.isArray(searchSites)) throw new Error("invalid_supplier_response");
  const match = searchSites.map(object).find((site) => site.siteID === siteID);
  if (!match) return { status: "unverified" as const, reason: "missing_site" };
  if (match.available === false) return { status: "unavailable" as const, reason: typeof match.reason === "string" ? match.reason : null };
  if (match.available !== true) return { status: "unverified" as const, reason: typeof match.reason === "string" ? match.reason : null };
  const cheapest = object(match.cheapest);
  const selectedRooms = cheapest.rooms;
  if (cheapest.from !== from || cheapest.till !== till || !Array.isArray(selectedRooms) || !selectedRooms.length) {
    return { status: "unverified" as const, reason: "missing_room" };
  }
  const roomIDs = selectedRooms.map((value) => object(value).roomID);
  if (roomIDs.some((id) => !Number.isSafeInteger(id) || (id as number) < 1)) {
    return { status: "unverified" as const, reason: "missing_room" };
  }
  // The search result does not promise a guest allocation for multiple rooms.
  if (roomIDs.length !== 1) return { status: "unverified" as const, reason: "multiple_rooms" };
  const vacancy = await fetchImpl(`${API_ROOT}/vacations/${siteID}/vacancy`, {
    method: "POST", headers,
    body: JSON.stringify({ siteID, from, nights, rooms: [{ roomID: roomIDs[0], adults: guests }] }),
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!vacancy.ok) throw new Error("supplier_unavailable");
  const result = object(await vacancy.json());
  if (result.available === false) return { status: "unavailable" as const, reason: typeof result.reason === "string" ? result.reason : null };
  const summary = object(result.summary);
  const total = object(summary.totals).total;
  if (result.available !== true || summary.siteID !== siteID || summary.from !== from || summary.till !== till
    || summary.nights !== nights || typeof total !== "number" || !Number.isFinite(total) || total <= 0) {
    return { status: "unverified" as const, reason: "invalid_supplier_response" };
  }
  return { status: "available" as const, total, nights, roomIDs, onlineBooking: result.onlineBooking === true };
}
