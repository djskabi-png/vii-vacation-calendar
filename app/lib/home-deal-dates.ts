import { eligibleDealDate, firstDealDate } from "./deal-clock.ts";

export const homeDealPeriods = [
  { id: "tomorrow", label: "ברגע האחרון", weekday: null, nights: 1 },
  { id: "weekend", label: "חמישי עד שבת", weekday: 4, nights: 2 },
  { id: "friday-weekend", label: "שישי עד ראשון", weekday: 5, nights: 2 },
  { id: "thursday", label: "לילה בחמישי", weekday: 4, nights: 1 },
  { id: "friday", label: "לילה בשישי", weekday: 5, nights: 1 },
] as const;

export type HomeDealPeriod = (typeof homeDealPeriods)[number]["id"];
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
  if (period.weekday === null) {
    const arrival = new Date(`${firstDealDate(now)}T00:00:00Z`);
    return { from: dateString(arrival), till: dateString(addDays(arrival, period.nights)), nights: period.nights };
  }
  const today = israelToday(now);
  let offset = (period.weekday - today.getUTCDay() + 7) % 7;
  if (offset === 0 && !eligibleDealDate(dateString(today), now)) offset = 7;
  const arrival = addDays(today, offset);
  return { from: dateString(arrival), till: dateString(addDays(arrival, period.nights)), nights: period.nights };
}

