import { daysBetween, validDate } from "./vii-live-search.ts";

export type StayCalendarDay = { date: string; availableUnitCount: number; availableUnits: number[]; minNights: number; closedArrival: boolean };
export type StayCalendarPrice = { date: string; total: number; nights: number };
export type StayCalendar = { siteID: number; from: string; till: string; rooms: { roomID: number; dates: StayCalendarDay[] }[]; prices: StayCalendarPrice[] };
export type StayRuleResult = { allowed: boolean; reason: "min_nights" | "closed_to_arrival" | "not_available" | "calendar_unknown" | null; minimumNights?: number; roomIDs: number[]; availableUnitCounts: Record<number, number> };
export class SupplierCalendarError extends Error {
  readonly diagnostic: string;
  readonly upstreamStatus?: number;
  constructor(diagnostic: string, upstreamStatus?: number) {
    super(`invalid_supplier_calendar:${diagnostic}`);
    this.name = "SupplierCalendarError";
    this.diagnostic = diagnostic;
    this.upstreamStatus = upstreamStatus;
  }
}
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const supplierInteger = (value: unknown, min = 0) => {
  if (integer(value, min)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (integer(parsed, min)) return parsed;
  }
  return undefined;
};
const supplierBoolean = (value: unknown) => value === true || value === 1 || value === "1"
  ? true
  : value === false || value === 0 || value === "0"
    ? false
    : undefined;
const contractVariantSymbol = Symbol("supplier-calendar-contract-variants");
type CalendarWithVariants = StayCalendar & { [contractVariantSymbol]?: string[] };
export function stayCalendarContractVariants(calendar: StayCalendar) {
  return [...((calendar as CalendarWithVariants)[contractVariantSymbol] ?? [])];
}
const dayIndexes = new WeakMap<StayCalendar["rooms"][number], Map<string, StayCalendarDay>>();
const priceIndexes = new WeakMap<StayCalendar, Map<string, StayCalendarPrice>>();
function dayIndex(room: StayCalendar["rooms"][number]) {
  let index = dayIndexes.get(room);
  if (!index) { index = new Map(room.dates.map((day) => [day.date, day])); dayIndexes.set(room, index); }
  return index;
}

// Calendar rules are arrival-date rules. A departure does not occupy its night.
// Do not apply another date's arrival closure/minimum to an in-progress stay.
export function parseStayCalendar(value: unknown, siteID: number, from: string, till: string): StayCalendar {
  const data = record(value);
  const variants = new Set<string>();
  const responseSiteID = supplierInteger(data.siteID, 1);
  if (typeof data.siteID === "string" && responseSiteID !== undefined) variants.add("numeric_strings");
  if (responseSiteID !== siteID) throw new SupplierCalendarError("schema_site_id");
  if (data.from !== from || data.till !== till) throw new SupplierCalendarError("schema_date_context");
  if (!Array.isArray(data.rooms) || data.rooms.length > 500) throw new SupplierCalendarError("schema_rooms");
  const ids = new Set<number>();
  const rooms = data.rooms.map((value) => {
    const room = record(value);
    const roomID = supplierInteger(room.roomID, 1);
    if (typeof room.roomID === "string" && roomID !== undefined) variants.add("numeric_strings");
    if (roomID === undefined || ids.has(roomID) || !Array.isArray(room.dates) || room.dates.length > 366) throw new SupplierCalendarError("schema_room");
    ids.add(roomID);
    const dates = new Set<string>();
    return { roomID, dates: room.dates.map((value): StayCalendarDay => {
      const day = record(value);
      if (typeof day.date !== "string" || !validDate(day.date) || day.date < from || day.date > till || dates.has(day.date)) throw new SupplierCalendarError("schema_day_date");
      const availableUnitCount = supplierInteger(day.availableUnitCount);
      const rawMinimum = day.minNights ?? day.minimumNights;
      const minNights = supplierInteger(rawMinimum);
      const rawClosedArrival = day.closedArrival ?? day.closedToArrival;
      const closedArrival = supplierBoolean(rawClosedArrival);
      if (day.minNights === undefined && day.minimumNights !== undefined) variants.add("minimum_nights_alias");
      if (day.closedArrival === undefined && day.closedToArrival !== undefined) variants.add("closed_arrival_alias");
      if (typeof rawMinimum === "string" || typeof day.availableUnitCount === "string") variants.add("numeric_strings");
      if (typeof rawClosedArrival !== "boolean" && closedArrival !== undefined) variants.add("boolean_flags");
      const rawAvailableUnits = day.availableUnits ?? (availableUnitCount === 0 ? [] : undefined);
      if (day.availableUnits === undefined && availableUnitCount === 0) variants.add("empty_units_omitted");
      if (availableUnitCount === undefined || minNights === undefined || closedArrival === undefined || !Array.isArray(rawAvailableUnits)) throw new SupplierCalendarError("schema_day_rules");
      const availableUnits = rawAvailableUnits.map((id) => supplierInteger(id, 1));
      if (rawAvailableUnits.some((id) => typeof id === "string")) variants.add("numeric_strings");
      if (availableUnits.some((id) => id === undefined)) throw new SupplierCalendarError("schema_available_units");
      const normalizedAvailableUnits = availableUnits as number[];
      if (new Set(normalizedAvailableUnits).size !== normalizedAvailableUnits.length || normalizedAvailableUnits.length !== availableUnitCount) throw new SupplierCalendarError("schema_available_units");
      dates.add(day.date);
      return { date: day.date, availableUnitCount, availableUnits: normalizedAvailableUnits, minNights, closedArrival };
    }) };
  });
  const priceDates = new Set<string>();
  const prices = (Array.isArray(data.prices) ? data.prices : []).map((value): StayCalendarPrice => {
    const price = record(value);
    if (typeof price.date !== "string" || !validDate(price.date) || price.date < from || price.date > till || priceDates.has(price.date)
      || typeof price.total !== "number" || !Number.isFinite(price.total) || price.total <= 0
      || !integer(price.nights, 1) || price.nights > 30) throw new SupplierCalendarError("schema_prices");
    priceDates.add(price.date);
    return { date: price.date, total: price.total, nights: price.nights };
  });
  const calendar: CalendarWithVariants = { siteID, from, till, rooms, prices };
  Object.defineProperty(calendar, contractVariantSymbol, { value: [...variants].sort(), enumerable: false });
  return calendar;
}

export function stayCalendarDay(calendar: StayCalendar, date: string) {
  const days = calendar.rooms.map((room) => dayIndex(room).get(date));
  const known = days.filter((day): day is StayCalendarDay => Boolean(day));
  const arrivals = known.filter((day) => day.availableUnitCount > 0 && !day.closedArrival && day.minNights > 0);
  const complete = known.length > 0 && known.length === calendar.rooms.length;
  let priceIndex = priceIndexes.get(calendar);
  if (!priceIndex) { priceIndex = new Map(calendar.prices.map((price) => [price.date, price])); priceIndexes.set(calendar, priceIndex); }
  const price = priceIndex.get(date);
  return {
    known: complete,
    units: known.reduce((sum, day) => sum + day.availableUnitCount, 0),
    arrivalAllowed: complete && arrivals.length > 0,
    minimumNights: complete && arrivals.length ? Math.min(...arrivals.map((day) => day.minNights)) : undefined,
    minimumStayTotal: price?.total,
    priceNights: price?.nights,
  };
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function enrichStayCalendarPrices(options: {
  calendar: StayCalendar;
  guests: number;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  const { calendar, guests, token } = options;
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 50 || !token) return calendar;
  const fetchImpl = options.fetchImpl ?? fetch;
  const windowTill = addUtcDays(calendar.from, Math.min(62, daysBetween(calendar.from, calendar.till)));
  const minimumByDate = new Map<string, number>();
  for (let date = calendar.from; date <= windowTill; date = addUtcDays(date, 1)) {
    const day = stayCalendarDay(calendar, date);
    if (day.arrivalAllowed && day.minimumNights && day.minimumNights <= 30) minimumByDate.set(date, day.minimumNights);
  }
  const nightGroups = [...new Set(minimumByDate.values())].sort((a, b) => a - b).slice(0, 10);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  const results = await Promise.all(nightGroups.map(async (nights) => {
    try {
      const response = await fetchImpl("https://bizonline.co.il/api/ai/vii/vacations/search", {
        method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ window: { from: calendar.from, till: windowTill }, nights, rooms: [{ adults: guests }], siteID: calendar.siteID }),
      });
      if (!response.ok) return [] as StayCalendarPrice[];
      const body = record(await response.json());
      const site = Array.isArray(body.sites) ? body.sites.map(record).find((value) => value.siteID === calendar.siteID) : undefined;
      if (!site || site.available !== true || !Array.isArray(site.dates)) return [] as StayCalendarPrice[];
      return site.dates.flatMap((value): StayCalendarPrice[] => {
        const row = record(value);
        return typeof row.from === "string" && minimumByDate.get(row.from) === nights && typeof row.total === "number"
          && Number.isFinite(row.total) && row.total > 0 ? [{ date: row.from, total: row.total, nights }] : [];
      });
    } catch { return [] as StayCalendarPrice[]; }
  }));
  return { ...calendar, prices: results.flat().sort((a, b) => a.date.localeCompare(b.date)) };
}

export function assessCalendarStay(calendar: StayCalendar, from: string, till: string, roomID?: number): StayRuleResult {
  const nights = validDate(from) && validDate(till) ? daysBetween(from, till) : 0;
  if (nights < 1 || nights > 30) return { allowed: false, reason: "calendar_unknown", roomIDs: [], availableUnitCounts: {} };
  const rooms = calendar.rooms.filter((room) => roomID === undefined || room.roomID === roomID);
  const results = rooms.map((room) => {
    const arrival = dayIndex(room).get(from);
    if (!arrival) return { roomID: room.roomID, reason: "calendar_unknown" as const, availableUnitCount: 0 };
    if (arrival.closedArrival || arrival.minNights === 0) return { roomID: room.roomID, reason: "closed_to_arrival" as const, availableUnitCount: 0 };
    if (arrival.availableUnitCount === 0) return { roomID: room.roomID, reason: "not_available" as const, availableUnitCount: 0 };
    if (nights < arrival.minNights) return { roomID: room.roomID, reason: "min_nights" as const, minimumNights: arrival.minNights, availableUnitCount: 0 };
    let availableUnits = new Set(arrival.availableUnits);
    for (let n = 1; n < nights; n++) {
      const date = new Date(`${from}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + n);
      const day = dayIndex(room).get(date.toISOString().slice(0, 10));
      if (!day) return { roomID: room.roomID, reason: "calendar_unknown" as const, availableUnitCount: 0 };
      availableUnits = new Set(day.availableUnits.filter((id) => availableUnits.has(id)));
    }
    return { roomID: room.roomID, reason: availableUnits.size ? null : "not_available" as const, availableUnitCount: availableUnits.size };
  });
  if (results.some((result) => result.reason === "calendar_unknown")) return { allowed: false, reason: "calendar_unknown", roomIDs: [], availableUnitCounts: {} };
  const roomIDs = results.filter((result) => result.reason === null).map((result) => result.roomID);
  const availableUnitCounts = Object.fromEntries(results.filter((result) => result.reason === null).map((result) => [result.roomID, result.availableUnitCount]));
  if (roomIDs.length) return { allowed: true, reason: null, roomIDs, availableUnitCounts };
  if (!results.length || results.some((result) => result.reason === "calendar_unknown")) return { allowed: false, reason: "calendar_unknown", roomIDs: [], availableUnitCounts: {} };
  const minimums = results.filter((result) => result.reason === "min_nights").map((result) => result.minimumNights!);
  if (minimums.length) return { allowed: false, reason: "min_nights", minimumNights: Math.min(...minimums), roomIDs: [], availableUnitCounts: {} };
  return { allowed: false, reason: results.every((result) => result.reason === "closed_to_arrival") ? "closed_to_arrival" : "not_available", roomIDs: [], availableUnitCounts: {} };
}

export async function supplierStayCalendar(options: { siteID: number; from: string; till: string; token: string; publishedIds: ReadonlySet<number>; fetchImpl?: typeof fetch }) {
  const { siteID, from, till, token, publishedIds } = options;
  if (!integer(siteID, 1) || !publishedIds.has(siteID) || !validDate(from) || !validDate(till) || daysBetween(from, till) < 0 || daysBetween(from, till) > 365) throw Error("invalid_calendar");
  if (!token) throw new SupplierCalendarError("missing_supplier_token");
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(`https://bizonline.co.il/api/ai/vii/vacations/${siteID}/calendar?${new URLSearchParams({ from, till })}`, {
      // The supplier's GET endpoints may issue an infrastructure redirect before
      // returning JSON. Fetch strips Authorization on cross-origin redirects, while
      // a same-origin redirect must be followed like the other working VII calls.
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new SupplierCalendarError(error instanceof DOMException && error.name === "TimeoutError" ? "supplier_timeout" : "supplier_transport");
  }
  if (!response.ok) {
    let providerCode = "";
    try {
      const body = record(await response.clone().json());
      if (typeof body.error_code === "string" && /^[a-z0-9_]{1,64}$/.test(body.error_code)) providerCode = `_${body.error_code}`;
    } catch { /* Upstream errors are allowed to have an empty or non-JSON body. */ }
    throw new SupplierCalendarError(`supplier_http_${response.status}${providerCode}`, response.status);
  }
  const body = await response.text();
  if (body.length > 5_000_000) throw new SupplierCalendarError("supplier_payload_too_large");
  let value: unknown;
  try { value = JSON.parse(body); }
  catch { throw new SupplierCalendarError("supplier_invalid_json"); }
  return parseStayCalendar(value, siteID, from, till);
}
