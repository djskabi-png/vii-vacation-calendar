import { eventDealDate, currentDealDate } from "./event-deal-dates.ts";

// Discovery rails only. Final booking and explicitly dated searches retain
// their own authoritative availability rules.
export function todayDealsVisible(now = new Date()) {
  // Today is the last-minute arrival throughout the morning. At the exact
  // 14:00 Israel-time boundary the rail advances to tomorrow.
  return currentDealDate(now) === eventDealDate(0, now);
}

export function firstDealDate(now = new Date()) {
  return currentDealDate(now);
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
