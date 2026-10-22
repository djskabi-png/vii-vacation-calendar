import { daysBetween, validDate } from "./vii-live-search.ts";
import { validVacationRooms, supplierPartyRooms, type VacationSearchRoom } from "./vacation-party.ts";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rejection(value: Record<string, unknown>) {
  const allowed = new Set(["min_nights", "closed_to_arrival", "no_prices", "occupancy", "not_available", "not_sellable"]);
  const details = object(value.details);
  const reasons = Array.isArray(details.reasons) ? details.reasons.filter((reason): reason is string => typeof reason === "string" && allowed.has(reason)) : [];
  const minimum = Number(details.minimumNights ?? details.minNights);
  return {
    reason: reasons[0] ?? (typeof value.reason === "string" && allowed.has(value.reason) ? value.reason : null),
    ...(Number.isSafeInteger(minimum) && minimum > 0 && minimum <= 30 ? { minimumNights: minimum } : {}),
  };
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function calendarMinimumNights(options: {
  fetchImpl: typeof fetch;
  headers: Record<string, string>;
  siteID: number;
  roomID: number;
  from: string;
  requestedNights: number;
}) {
  const params = new URLSearchParams({ from: options.from, till: addUtcDays(options.from, 30), roomID: String(options.roomID) });
  try {
    const response = await options.fetchImpl(`${API_ROOT}/vacations/${options.siteID}/calendar?${params}`, {
      headers: options.headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return undefined;
    const value = object(await response.json());
    const rooms = Array.isArray(value.rooms) ? value.rooms.map(object) : [];
    const room = rooms.find((entry) => entry.roomID === options.roomID);
    const dates = Array.isArray(room?.dates) ? room.dates.map(object) : [];
    const arrival = dates.find((entry) => entry.date === options.from);
    const minimum = Number(arrival?.minNights);
    return Number.isSafeInteger(minimum) && minimum > options.requestedNights && minimum <= 30 ? minimum : undefined;
  } catch {
    return undefined;
  }
}

export async function supplierStayQuote(options: {
  siteID: number;
  from: string;
  till: string;
  guests: number;
  rooms?: VacationSearchRoom[];
  roomID?: number;
  token: string;
  publishedIds: ReadonlySet<number>;
  fetchImpl?: typeof fetch;
}) {
  const { siteID, from, till, guests, token, publishedIds } = options;
  const nights = validDate(from) && validDate(till) ? daysBetween(from, till) : 0;
  const requestedRooms = options.rooms ?? [{ adults: guests }];
  if (!Number.isSafeInteger(siteID) || !publishedIds.has(siteID) || !validDate(from) || !validDate(till)
    || nights < 1 || nights > 30 || !Number.isSafeInteger(guests) || guests < 1 || guests > 1000 || !validVacationRooms(requestedRooms, guests)
    || (options.roomID !== undefined && (!Number.isSafeInteger(options.roomID) || options.roomID < 1))) {
    throw new Error("invalid_stay");
  }
  if (!token) throw new Error("supplier_unavailable");
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  let roomIDs: unknown[];
  if (options.roomID !== undefined) {
    // A last-minute card already carries the exact supplier room. The official
    // vacancy endpoint is the authoritative pre-booking check, so do not make
    // that path depend on the broader calendar or cheapest-room search.
    roomIDs = [options.roomID];
  } else {
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
    roomIDs = selectedRooms.map((value) => object(value).roomID);
  }
  if (roomIDs.some((id) => !Number.isSafeInteger(id) || (id as number) < 1)) return { status: "unverified" as const, reason: "missing_room" };
  // The current checkout intentionally supports one verified supplier unit.
  if (roomIDs.length !== 1 || requestedRooms.length !== 1) return { status: "unverified" as const, reason: "multiple_rooms" };
  const party = supplierPartyRooms(requestedRooms)[0];
  const vacancyUrl = `${API_ROOT}/vacations/${siteID}/vacancy`;
  const vacancyBody = (stayNights: number) => JSON.stringify({ siteID, from, nights: stayNights, rooms: [{ roomID: roomIDs[0], ...party }] });
  const vacancy = await fetchImpl(vacancyUrl, {
    method: "POST", headers,
    body: vacancyBody(nights),
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!vacancy.ok) throw new Error("supplier_unavailable");
  const result = object(await vacancy.json());
  if (result.available === false) {
    const rejected = rejection(result);
    if (rejected.reason === "min_nights" && !rejected.minimumNights) {
      const calendarMinimum = await calendarMinimumNights({
        fetchImpl, headers, siteID, roomID: roomIDs[0] as number, from, requestedNights: nights,
      });
      if (calendarMinimum) {
        return { status: "unavailable" as const, reason: "min_nights" as const, minimumNights: calendarMinimum };
      }
      // The vacancy contract names a minimum-stay failure but older supplier
      // responses do not always include the number. Probe longer, distinct
      // stays for the same room and party, stopping at the first authoritative
      // sellable duration. This is not a retry of one request and it never
      // manufactures availability or a price.
      for (let candidate = nights + 1; candidate <= Math.min(7, 30); candidate += 1) {
        const probe = await fetchImpl(vacancyUrl, {
          method: "POST", headers, body: vacancyBody(candidate), cache: "no-store", signal: AbortSignal.timeout(20_000),
        });
        if (!probe.ok) break;
        const probeValue = object(await probe.json());
        if (probeValue.available === true) {
          const probeSummary = object(probeValue.summary);
          const probeRooms = Array.isArray(probeSummary.rooms) ? probeSummary.rooms.map(object) : [];
          if (probeSummary.siteID === siteID && probeSummary.from === from && probeSummary.nights === candidate
            && probeRooms.length === 1 && probeRooms[0].roomID === roomIDs[0]) {
            return { status: "unavailable" as const, reason: "min_nights" as const, minimumNights: candidate };
          }
          break;
        }
        if (rejection(probeValue).reason !== "min_nights") break;
      }
    }
    return { status: "unavailable" as const, ...rejected };
  }
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
  return { status: "available" as const, total, nights, roomIDs: roomIDs as number[], onlineBooking: result.onlineBooking === true };
}
