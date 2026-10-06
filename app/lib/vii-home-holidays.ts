import { getHomeDealsForDates } from "./vii-home-deals.ts";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";

export type HomeHoliday = { id: number; name: string; from: string; till: string; nights: number; windowSearch: boolean };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function israelToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

export async function getHomeHolidays(options: { token: string; now?: Date; fetchImpl?: typeof fetch }) {
  if (!options.token) throw new Error("missing_token");
  const response = await (options.fetchImpl ?? fetch)(`${API_ROOT}/holidays`, {
    headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("supplier_unavailable");
  const source = record(await response.json());
  if (!Array.isArray(source.holidays)) throw new Error("invalid_supplier_response");
  const today = israelToday(options.now ?? new Date());
  const holidays: HomeHoliday[] = [];
  for (const value of source.holidays) {
    const item = record(value);
    const start = date(item.dateStart);
    const end = date(item.dateEnd);
    const id = item.holidayID;
    const name = typeof item.holidayName === "string" ? item.holidayName.trim() : "";
    if (!Number.isSafeInteger(id) || (id as number) <= 0 || !name || item.shown !== 1 || !start || !end || end < today) continue;
    const nights = Math.max(1, Math.round((end.valueOf() - start.valueOf()) / 86_400_000));
    if (nights > 30 || start < today) continue;
    const windowSearch = item.windowSearch === 1 || item.isWindowSearch === 1;
    const till = new Date(start);
    till.setUTCDate(till.getUTCDate() + nights);
    holidays.push({ id: id as number, name, from: item.dateStart as string, till: till.toISOString().slice(0, 10), nights, windowSearch });
  }
  return holidays.sort((a, b) => a.from.localeCompare(b.from) || a.id - b.id);
}

export async function getHomeHolidayDeals(options: {
  id: number; token: string; publicSiteIds: ReadonlySet<number>; now?: Date; fetchImpl?: typeof fetch;
}) {
  const holidays = await getHomeHolidays(options);
  const holiday = holidays.find((item) => item.id === options.id);
  if (!holiday) throw new Error("invalid_holiday");
  if (holiday.windowSearch) throw new Error("unsupported_holiday_window");
  return { holiday, ...await getHomeDealsForDates({ ...options, dates: { from: holiday.from, till: holiday.till, nights: holiday.nights } }) };
}
