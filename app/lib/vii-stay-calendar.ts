import { daysBetween, validDate } from "./vii-live-search.ts";

export type StayCalendarDay = { date: string; availableUnitCount: number; availableUnits: number[]; minNights: number; closedArrival: boolean };
export type StayCalendar = { siteID: number; from: string; till: string; rooms: { roomID: number; dates: StayCalendarDay[] }[] };
export type StayRuleResult = { allowed: boolean; reason: "min_nights" | "closed_to_arrival" | "not_available" | "calendar_unknown" | null; minimumNights?: number; roomIDs: number[] };
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const dayIndexes = new WeakMap<StayCalendar["rooms"][number], Map<string, StayCalendarDay>>();
function dayIndex(room: StayCalendar["rooms"][number]) {
  let index = dayIndexes.get(room);
  if (!index) { index = new Map(room.dates.map((day) => [day.date, day])); dayIndexes.set(room, index); }
  return index;
}

// Calendar rules are arrival-date rules. A departure does not occupy its night.
// Do not apply another date's arrival closure/minimum to an in-progress stay.
export function parseStayCalendar(value: unknown, siteID: number, from: string, till: string): StayCalendar {
  const data = record(value);
  if (data.siteID !== siteID || data.from !== from || data.till !== till || !Array.isArray(data.rooms) || data.rooms.length > 500) throw Error("invalid_supplier_calendar");
  const ids = new Set<number>();
  const rooms = data.rooms.map((value) => {
    const room = record(value);
    if (!integer(room.roomID, 1) || ids.has(room.roomID) || !Array.isArray(room.dates) || room.dates.length > 366) throw Error("invalid_supplier_calendar");
    ids.add(room.roomID);
    const dates = new Set<string>();
    return { roomID: room.roomID, dates: room.dates.map((value): StayCalendarDay => {
      const day = record(value);
      if (typeof day.date !== "string" || !validDate(day.date) || day.date < from || day.date > till || dates.has(day.date)
        || !integer(day.minNights) || typeof day.closedArrival !== "boolean" || !integer(day.availableUnitCount)
        || !Array.isArray(day.availableUnits) || day.availableUnits.some((id) => !integer(id, 1))
        || new Set(day.availableUnits).size !== day.availableUnits.length || day.availableUnits.length !== day.availableUnitCount) throw Error("invalid_supplier_calendar");
      dates.add(day.date);
      return { date: day.date, availableUnitCount: day.availableUnitCount, availableUnits: day.availableUnits, minNights: day.minNights, closedArrival: day.closedArrival };
    }) };
  });
  return { siteID, from, till, rooms };
}

export function stayCalendarDay(calendar: StayCalendar, date: string) {
  const days = calendar.rooms.map((room) => dayIndex(room).get(date));
  const known = days.filter((day): day is StayCalendarDay => Boolean(day));
  const arrivals = known.filter((day) => day.availableUnitCount > 0 && !day.closedArrival && day.minNights > 0);
  const complete = known.length > 0 && known.length === calendar.rooms.length;
  return {
    known: complete,
    units: known.reduce((sum, day) => sum + day.availableUnitCount, 0),
    arrivalAllowed: complete && arrivals.length > 0,
    minimumNights: complete && arrivals.length ? Math.min(...arrivals.map((day) => day.minNights)) : undefined,
  };
}

export function assessCalendarStay(calendar: StayCalendar, from: string, till: string, roomID?: number): StayRuleResult {
  const nights = validDate(from) && validDate(till) ? daysBetween(from, till) : 0;
  if (nights < 1 || nights > 30) return { allowed: false, reason: "calendar_unknown", roomIDs: [] };
  const rooms = calendar.rooms.filter((room) => roomID === undefined || room.roomID === roomID);
  const results = rooms.map((room) => {
    const arrival = dayIndex(room).get(from);
    if (!arrival) return { roomID: room.roomID, reason: "calendar_unknown" as const };
    if (arrival.closedArrival || arrival.minNights === 0) return { roomID: room.roomID, reason: "closed_to_arrival" as const };
    if (arrival.availableUnitCount === 0) return { roomID: room.roomID, reason: "not_available" as const };
    if (nights < arrival.minNights) return { roomID: room.roomID, reason: "min_nights" as const, minimumNights: arrival.minNights };
    let availableUnits = new Set(arrival.availableUnits);
    for (let n = 1; n < nights; n++) {
      const date = new Date(`${from}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + n);
      const day = dayIndex(room).get(date.toISOString().slice(0, 10));
      if (!day) return { roomID: room.roomID, reason: "calendar_unknown" as const };
      availableUnits = new Set(day.availableUnits.filter((id) => availableUnits.has(id)));
    }
    return { roomID: room.roomID, reason: availableUnits.size ? null : "not_available" as const };
  });
  if (results.some((result) => result.reason === "calendar_unknown")) return { allowed: false, reason: "calendar_unknown", roomIDs: [] };
  const roomIDs = results.filter((result) => result.reason === null).map((result) => result.roomID);
  if (roomIDs.length) return { allowed: true, reason: null, roomIDs };
  if (!results.length || results.some((result) => result.reason === "calendar_unknown")) return { allowed: false, reason: "calendar_unknown", roomIDs: [] };
  const minimums = results.filter((result) => result.reason === "min_nights").map((result) => result.minimumNights!);
  if (minimums.length) return { allowed: false, reason: "min_nights", minimumNights: Math.min(...minimums), roomIDs: [] };
  return { allowed: false, reason: results.every((result) => result.reason === "closed_to_arrival") ? "closed_to_arrival" : "not_available", roomIDs: [] };
}

export async function supplierStayCalendar(options: { siteID: number; from: string; till: string; token: string; publishedIds: ReadonlySet<number>; fetchImpl?: typeof fetch }) {
  const { siteID, from, till, token, publishedIds } = options;
  if (!integer(siteID, 1) || !publishedIds.has(siteID) || !validDate(from) || !validDate(till) || daysBetween(from, till) < 0 || daysBetween(from, till) > 365) throw Error("invalid_calendar");
  if (!token) throw Error("supplier_unavailable");
  const response = await (options.fetchImpl ?? fetch)(`https://bizonline.co.il/api/ai/vii/vacations/${siteID}/calendar?${new URLSearchParams({ from, till })}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw Error("supplier_unavailable");
  const body = await response.text();
  if (body.length > 5_000_000) throw Error("invalid_supplier_calendar");
  return parseStayCalendar(JSON.parse(body), siteID, from, till);
}
