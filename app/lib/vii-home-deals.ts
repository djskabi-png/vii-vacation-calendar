const API_ROOT = "https://bizonline.co.il/api/ai/vii";
const MEDIA_ROOT = "https://www.vii.co.il";
import siteDetails from "../data/sergey-place-details.json" with { type: "json" };

export const homeDealPeriods = [
  { id: "tomorrow", label: "ברגע האחרון", weekday: null, nights: 1 },
  { id: "weekend", label: "חמישי עד שבת", weekday: 4, nights: 2 },
  { id: "friday-weekend", label: "שישי עד ראשון", weekday: 5, nights: 2 },
  { id: "thursday", label: "לילה בחמישי", weekday: 4, nights: 1 },
  { id: "friday", label: "לילה בשישי", weekday: 5, nights: 1 },
] as const;

export type HomeDealPeriod = (typeof homeDealPeriods)[number]["id"];
export type HomeDeal = { siteID: number; name: string; image: string; city: string; area: string; score: number | null; reviewCount: number; from: string; till: string; total: number; nights: number; roomID?: number };

function israelToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

function addDays(date: Date, count: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

function dateString(date: Date) { return date.toISOString().slice(0, 10); }

function checkoutDate(from: unknown, nights: number) {
  if (typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  const arrival = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(arrival.valueOf()) || dateString(arrival) !== from) return null;
  return dateString(addDays(arrival, nights));
}

export function homeDealDates(periodId: HomeDealPeriod, now = new Date()) {
  const period = homeDealPeriods.find((item) => item.id === periodId);
  if (!period) throw new Error("invalid_period");
  const today = israelToday(now);
  const offset = period.weekday === null ? 1 : (period.weekday - today.getUTCDay() + 7) % 7;
  const arrival = addDays(today, offset);
  return { from: dateString(arrival), till: dateString(addDays(arrival, period.nights)), nights: period.nights };
}

function mediaUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, MEDIA_ROOT);
    return url.protocol === "https:" && ["www.vii.co.il", "vii.co.il"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function getHomeDeals(options: {
  period: HomeDealPeriod;
  token: string;
  publicSiteIds: ReadonlySet<number>;
  now?: Date;
  fetchImpl?: typeof fetch;
}) {
  const dates = homeDealDates(options.period, options.now);
  return { period: options.period, ...await getHomeDealsForDates({ ...options, dates }) };
}

export async function getHomeDealsForDates(options: {
  dates: { from: string; till: string; nights: number };
  window?: { from: string; till: string };
  token: string;
  publicSiteIds: ReadonlySet<number>;
  fetchImpl?: typeof fetch;
}) {
  if (!options.token) throw new Error("missing_token");
  const dates = options.dates;
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${options.token}`, Accept: "application/json" };
  const [catalogResponse, searchResponse, locationsResponse] = await Promise.all([
    fetchImpl(`${API_ROOT}/vacations`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) }),
    fetchImpl(`${API_ROOT}/vacations/search`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...(options.window ? { window: options.window } : { from: dates.from }), nights: dates.nights, rooms: [{ adults: 2 }] }),
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    }),
    fetchImpl(`${API_ROOT}/locations`, { headers, cache: "no-store", signal: AbortSignal.timeout(5_000) }).catch(() => null),
  ]);
  if (!catalogResponse.ok || !searchResponse.ok) throw new Error("supplier_unavailable");
  const catalog = record(await catalogResponse.json());
  const search = record(await searchResponse.json());
  const locations = locationsResponse?.ok ? record(await locationsResponse.json().catch(() => ({}))) : {};
  if (!Array.isArray(catalog.places) || !Array.isArray(search.sites)) throw new Error("invalid_supplier_response");

  const areas = new Map<number, string>();
  for (const value of Array.isArray(locations.areas) ? locations.areas : []) {
    const area = record(value);
    if (Number.isSafeInteger(area.id) && typeof area.title === "string") areas.set(area.id as number, area.title);
  }
  const cities = new Map<number, { city: string; area: string }>();
  for (const value of Array.isArray(locations.cities) ? locations.cities : []) {
    const city = record(value);
    if (Number.isSafeInteger(city.id) && typeof city.title === "string") cities.set(city.id as number, { city: city.title, area: areas.get(city.area as number) || "" });
  }

  const places = new Map<number, Record<string, unknown>>();
  for (const value of catalog.places) {
    const place = record(value);
    if (Number.isSafeInteger(place.siteID) && place.active === true) places.set(place.siteID as number, place);
  }

  const deals: HomeDeal[] = [];
  for (const value of search.sites) {
    const result = record(value);
    const siteID = result.siteID;
    const total = result.minTotal;
    if (result.available !== true || !Number.isSafeInteger(siteID) || !options.publicSiteIds.has(siteID as number) || typeof total !== "number" || !Number.isFinite(total) || total <= 0) continue;
    const cheapest = record(result.cheapest);
    const place = places.get(siteID as number);
    const gallery = Array.isArray(place?.galleries) ? record(place.galleries[0]) : {};
    const image = mediaUrl(Array.isArray(gallery.pictures) ? gallery.pictures[0] : null);
    const name = typeof place?.siteName === "string" ? place.siteName.trim() : "";
    const validStay = options.window
      ? typeof cheapest.from === "string" && typeof cheapest.till === "string"
        && cheapest.from >= options.window.from && cheapest.till <= options.window.till
        && checkoutDate(cheapest.from, dates.nights) === cheapest.till
      : cheapest.from === dates.from && cheapest.till === dates.till;
    if (!image || !name || !validStay || (typeof cheapest.total === "number" && cheapest.total !== total)) continue;
    const location = cities.get(record(place?.location).cityID as number);
    const reviews = (siteDetails.details as Record<string, { reviews?: Array<{ score?: number }> }>)[`vacation-${siteID}`]?.reviews || [];
    const scores = reviews.map((review) => review.score).filter((score): score is number => typeof score === "number" && Number.isFinite(score) && score > 0 && score <= 10);
    const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10 : null;
    const reviewCount = reviews.length;
    const rooms = Array.isArray(cheapest.rooms) ? cheapest.rooms : [];
    const room = rooms.length === 1 ? record(rooms[0]) : {};
    const roomID = Number.isSafeInteger(room.roomID) && (room.roomID as number) > 0 ? room.roomID as number : undefined;
    deals.push({ siteID: siteID as number, name, image, city: location?.city || "", area: location?.area || "", score, reviewCount, from: cheapest.from as string, till: cheapest.till as string, total, nights: dates.nights, ...(roomID ? { roomID } : {}) });
  }
  return { dates, checkedAt: typeof search.created === "string" ? search.created : null, deals };
}
