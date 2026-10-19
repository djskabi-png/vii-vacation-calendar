import { daysBetween, validDate } from "./vii-live-search.ts";
import { validVacationRooms, supplierPartyRooms, type VacationSearchRoom } from "./vacation-party.ts";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export class BookingError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, httpStatus: number) {
    super(code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export async function createSupplierBooking(options: {
  siteID: number; roomID: number; from: string; till: string; guests: number;
  party?: VacationSearchRoom;
  expectedTotal: number; partnerRef: string; guest: { firstName: string; lastName: string; phone: string; email: string; remarks?: string };
  token: string; publishedIds: ReadonlySet<number>; fetchImpl?: typeof fetch;
}) {
  const { siteID, roomID, from, till, guests, expectedTotal, partnerRef, guest, token, publishedIds } = options;
  const nights = validDate(from) && validDate(till) ? daysBetween(from, till) : 0;
  const requestedParty = options.party === undefined ? { adults: guests } : options.party;
  if (!Number.isSafeInteger(siteID) || !publishedIds.has(siteID) || !Number.isSafeInteger(roomID) || roomID < 1
    || !validDate(from) || !validDate(till) || nights < 1 || nights > 30
    || !Number.isSafeInteger(guests) || guests < 1 || guests > 1000 || !validVacationRooms([requestedParty], guests)
    || !Number.isFinite(expectedTotal) || expectedTotal <= 0
    || !/^VII-[A-Za-z0-9-]{8,59}$/.test(partnerRef)
    || !guest.firstName.trim() || !guest.lastName.trim() || !/^[+\d\s().-]{7,30}$/.test(guest.phone)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) {
    throw new BookingError("invalid_booking", 400);
  }
  if (!token) throw new BookingError("supplier_unavailable", 503);
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${API_ROOT}/vacations/${siteID}/booking`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };

  // A read by the stable partner reference precedes every write, including a user retry.
  const existing = await fetchImpl(`${url}?ref=${encodeURIComponent(partnerRef)}`, {
    method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (existing.ok) return receipt(await existing.json(), options, true);
  if (existing.status !== 404) throw new BookingError("supplier_unavailable", 503);

  const party = supplierPartyRooms([requestedParty])[0];
  const stay = { siteID, from, nights, rooms: [{ roomID, ...party }] };
  const search = await fetchImpl(`${API_ROOT}/vacations/search`, {
    method: "POST", headers, body: JSON.stringify({ siteID, from, nights, rooms: [party] }),
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!search.ok) throw new BookingError("supplier_unavailable", 503);
  const sites = object(await search.json()).sites;
  const match = Array.isArray(sites) ? sites.map(object).find((site) => site.siteID === siteID) : null;
  const cheapest = object(match?.cheapest);
  if (!match || match.available !== true || cheapest.from !== from || cheapest.till !== till
    || !Array.isArray(cheapest.rooms) || !cheapest.rooms.some((room) => object(room).roomID === roomID)) {
    throw new BookingError("not_available", 409);
  }
  const vacancy = await fetchImpl(`${API_ROOT}/vacations/${siteID}/vacancy`, {
    method: "POST", headers, body: JSON.stringify(stay), cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!vacancy.ok) throw new BookingError("supplier_unavailable", 503);
  const checked = object(await vacancy.json());
  const summary = object(checked.summary);
  const total = object(summary.totals).total;
  const summaryRooms = summary.rooms;
  const quotedPax = object(object(Array.isArray(summaryRooms) ? summaryRooms[0] : undefined).pax);
  if (checked.available !== true || checked.onlineBooking !== true) throw new BookingError("not_available", 409);
  if (summary.siteID !== siteID || summary.from !== from || summary.till !== till || summary.nights !== nights || summary.currency !== "ILS"
    || !Array.isArray(summaryRooms) || summaryRooms.length !== 1 || object(summaryRooms[0]).roomID !== roomID
    || quotedPax.adults !== party.adults || (quotedPax.kids ?? 0) !== (party.kids ?? 0) || (quotedPax.infants ?? 0) !== (party.infants ?? 0)
    || typeof total !== "number" || !Number.isFinite(total) || total <= 0) {
    throw new BookingError("invalid_supplier_response", 503);
  }
  if (Math.abs(total - expectedTotal) > 0.01) throw new BookingError("price_changed", 409);

  let created: Response;
  try {
    created = await fetchImpl(url, {
      method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ ...stay, partnerRef, guest }),
    });
  } catch {
    // The write may have succeeded. Never issue another write in this request.
    throw new BookingError("booking_status_unknown", 503);
  }
  if (!created.ok) {
    if (created.status === 409) throw new BookingError("not_available", 409);
    if (created.status === 422) throw new BookingError("invalid_booking", 400);
    throw new BookingError("supplier_unavailable", 503);
  }
  return receipt(await created.json(), options, false);
}

function receipt(raw: unknown, expected: Parameters<typeof createSupplierBooking>[0], replay: boolean) {
  const value = object(raw);
  const summary = object(value.summary);
  const rooms = summary.rooms;
  const remoteGuest = object(value.guest);
  const party = supplierPartyRooms([expected.party ?? { adults: expected.guests }])[0];
  const pax = object(object(Array.isArray(rooms) ? rooms[0] : undefined).pax);
  if (value.partnerRef !== expected.partnerRef || (value.status !== "confirmed" && value.status !== "pending_approval")
    || summary.siteID !== expected.siteID || summary.from !== expected.from || summary.till !== expected.till
    || summary.nights !== daysBetween(expected.from, expected.till) || summary.currency !== "ILS"
    || !Array.isArray(rooms) || rooms.length !== 1 || object(rooms[0]).roomID !== expected.roomID
    || pax.adults !== party.adults || (pax.kids ?? 0) !== (party.kids ?? 0) || (pax.infants ?? 0) !== (party.infants ?? 0)
    || typeof object(summary.totals).total !== "number"
    || Math.abs(Number(object(summary.totals).total) - expected.expectedTotal) > 0.01
    || remoteGuest.email !== expected.guest.email
    || (!Number.isSafeInteger(value.bookingID) && !Number.isSafeInteger(value.systemOrderID))) {
    throw new BookingError("invalid_supplier_response", 503);
  }
  return {
    success: true as const,
    reference: expected.partnerRef,
    status: value.status as "confirmed" | "pending_approval",
    bookingID: Number.isSafeInteger(value.bookingID) ? value.bookingID as number : null,
    systemOrderID: Number.isSafeInteger(value.systemOrderID) ? value.systemOrderID as number : null,
    replay,
  };
}
