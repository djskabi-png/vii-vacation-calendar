import { eventDealDate } from "./event-deal-dates.ts";

// Discovery rails only. Final booking and explicitly dated searches retain
// their own authoritative availability rules.
export function todayDealsVisible(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
  const part = (type: string) => Number(parts.find(value => value.type === type)?.value);
  const minute = part("hour") * 60 + part("minute");
  return minute >= 1 && minute < 14 * 60 + 1;
}

export function firstDealDate(now = new Date()) {
  return eventDealDate(todayDealsVisible(now) ? 0 : 1, now);
}

export function eligibleDealDate(date: string, now = new Date()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= firstDealDate(now);
}

export function dealRailDays(count: number, now = new Date()) {
  return Array.from({ length: count }, (_, index) => eventDealDate(index, now)).filter(day => eligibleDealDate(day, now));
}

export function dealClockKey(now = new Date()) {
  return `${eventDealDate(0, now)}:${todayDealsVisible(now) ? "today" : "future"}`;
}

export function normalizeDealDate(date: string, now = new Date()) {
  return eligibleDealDate(date, now) ? date : firstDealDate(now);
}
