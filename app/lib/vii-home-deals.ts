const API_ROOT = "https://bizonline.co.il/api/ai/vii";
const MEDIA_ROOT = "https://www.vii.co.il";

export const homeDealPeriods = [
  { id: "tomorrow", label: "ברגע האחרון", weekday: null, nights: 1 },
  { id: "weekend", label: "חמישי עד שבת", weekday: 4, nights: 2 },
  { id: "friday-weekend", label: "שישי עד ראשון", weekday: 5, nights: 2 },
  { id: "thursday", label: "לילה בחמישי", weekday: 4, nights: 1 },
  { id: "friday", label: "לילה בשישי", weekday: 5, nights: 1 },
] as const;

export type HomeDealPeriod = (typeof homeDealPeriods)[number]["id"];
export type HomeDeal = { siteID: number; name: string; image: string; from: string; till: string; total: number; nights: number };

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
  if (!options.token) throw new Error("missing_token");
  const dates = homeDealDates(options.period, options.now);
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${options.token}`, Accept: "application/json" };
  const [catalogResponse, searchResponse] = await Promise.all([
    fetchImpl(`${API_ROOT}/vacations`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) }),
    fetchImpl(`${API_ROOT}/vacations/search`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ from: dates.from, nights: dates.nights, rooms: [{ adults: 2 }] }),
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    }),
  ]);
  if (!catalogResponse.ok || !searchResponse.ok) throw new Error("supplier_unavailable");
  const catalog = record(await catalogResponse.json());
  const search = record(await searchResponse.json());
  if (!Array.isArray(catalog.places) || !Array.isArray(search.sites)) throw new Error("invalid_supplier_response");

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
    if (!image || !name || typeof cheapest.from !== "string" || typeof cheapest.till !== "string") continue;
    deals.push({ siteID: siteID as number, name, image, from: cheapest.from, till: cheapest.till, total, nights: dates.nights });
  }
  return { period: options.period, dates, checkedAt: typeof search.created === "string" ? search.created : null, deals };
}
