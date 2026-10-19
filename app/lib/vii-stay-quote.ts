import { daysBetween, validDate } from "./vii-live-search.ts";
import { assessCalendarStay, supplierStayCalendar, stayCalendarDay } from "./vii-stay-calendar.ts";
import { validVacationRooms, supplierPartyRooms, type VacationSearchRoom } from "./vacation-party.ts";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rejection(value: Record<string, unknown>) {
  const allowed = new Set(["min_nights", "closed_to_arrival", "no_prices", "occupancy", "not_available", "not_sellable"]);
  const details = object(value.details);
  const reasons = Array.isArray(details.reasons) ? details.reasons.filter((reason): reason is string => typeof reason === "string" && allowed.has(reason)) : [];
  return { reason: reasons[0] ?? (typeof value.reason === "string" && allowed.has(value.reason) ? value.reason : null) };
}

export async function supplierStayQuote(options: {
  siteID: number;
  from: string;
  till: string;
  guests: number;
  rooms?: VacationSearchRoom[];
  token: string;
  publishedIds: ReadonlySet<number>;
  fetchImpl?: typeof fetch;
}) {
  const { siteID, from, till, guests, token, publishedIds } = options;
  const nights = validDate(from) && validDate(till) ? daysBetween(from, till) : 0;
  const requestedRooms = options.rooms ?? [{ adults: guests }];
  if (!Number.isSafeInteger(siteID) || !publishedIds.has(siteID) || !validDate(from) || !validDate(till)
    || nights < 1 || nights > 30 || !Number.isSafeInteger(guests) || guests < 1 || guests > 1000 || !validVacationRooms(requestedRooms, guests)) {
    throw new Error("invalid_stay");
  }
  if (!token) throw new Error("supplier_unavailable");
  const fetchImpl = options.fetchImpl ?? fetch;
  const calendar = await supplierStayCalendar({ siteID, from, till, token, publishedIds, fetchImpl });
  const rules = assessCalendarStay(calendar, from, till);
  if (!rules.allowed) return { status: rules.reason === "calendar_unknown" ? "unverified" as const : "unavailable" as const, reason: rules.reason, ...(rules.minimumNights ? { minimumNights: rules.minimumNights } : {}) };
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  const search = await fetchImpl(`${API_ROOT}/vacations/search`, {
    method: "POST", headers, body: JSON.stringify({ from, nights, rooms: supplierPartyRooms(requestedRooms), siteID }),
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!search.ok) throw new Error("supplier_unavailable");
  const searchSites = object(await search.json()).sites;
  if (!Array.isArray(searchSites)) throw new Error("invalid_supplier_response");
  const match = searchSites.map(object).find((site) => site.siteID === siteID);
  if (!match) return { status: "unverified" as const, reason: "missing_site" };
  if (match.available === false) return { status: "unavailable" as const, ...rejection(match) };
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
  if (roomIDs.length !== 1 || requestedRooms.length !== 1) return { status: "unverified" as const, reason: "multiple_rooms" };
  const party = supplierPartyRooms(requestedRooms)[0];
  const selectedRules = assessCalendarStay(calendar, from, till, roomIDs[0] as number);
  if (!selectedRules.allowed) return { status: selectedRules.reason === "calendar_unknown" ? "unverified" as const : "unavailable" as const, reason: selectedRules.reason, ...(selectedRules.minimumNights ? { minimumNights: selectedRules.minimumNights } : {}) };
  const vacancy = await fetchImpl(`${API_ROOT}/vacations/${siteID}/vacancy`, {
    method: "POST", headers,
    body: JSON.stringify({ siteID, from, nights, rooms: [{ roomID: roomIDs[0], ...party }] }),
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!vacancy.ok) throw new Error("supplier_unavailable");
  const result = object(await vacancy.json());
  if (result.available === false) return { status: "unavailable" as const, ...rejection(result) };
  const summary = object(result.summary);
  const total = object(summary.totals).total;
  const summaryRooms = summary.rooms;
  const quotedRoom = Array.isArray(summaryRooms) && summaryRooms.length === 1 ? object(summaryRooms[0]) : {};
  const pax = object(quotedRoom.pax);
  if (result.available !== true || summary.siteID !== siteID || summary.from !== from || summary.till !== till
    || summary.nights !== nights || summary.currency !== "ILS" || quotedRoom.roomID !== roomIDs[0] || pax.adults !== party.adults
    || (pax.kids ?? 0) !== (party.kids ?? 0) || (pax.infants ?? 0) !== (party.infants ?? 0)
    || typeof total !== "number" || !Number.isFinite(total) || total <= 0) {
    return { status: "unverified" as const, reason: "invalid_supplier_response" };
  }
  // The authoritative total must survive intact. total/nights is a display
  // average, never a new amount to multiply back into a booking total.
  return { status: "available" as const, total, nights, roomIDs, onlineBooking: result.onlineBooking === true,
    minimumNights: stayCalendarDay({ ...calendar, rooms: calendar.rooms.filter((room) => room.roomID === roomIDs[0]) }, from).minimumNights };
}
