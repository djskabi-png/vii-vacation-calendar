import type { HomeHoliday } from "./vii-home-holidays.ts";

export const holidayAudiences = [
  { id: "family", guests: 6 },
  { id: "couple", guests: 2 },
  { id: "group", guests: 20 },
] as const;
export const holidayParts = ["all", "opening", "middle", "ending"] as const;
export type HolidayAudience = typeof holidayAudiences[number]["id"];
export type HolidayPart = typeof holidayParts[number];
export type HolidaySelection = { audience: HolidayAudience; part: HolidayPart };
export const HOLIDAY_FLEXIBLE_MAX_NIGHTS = 4;
export type HolidayStayQuery = {
  dates: { from: string; till: string; nights: number };
  window?: { from: string; till: string };
};

export function availableHolidayParts(holiday: Pick<HomeHoliday, "from" | "till" | "nights">): HolidayPart[] {
  const parts: HolidayPart[] = ["all"];
  const seen = new Set([JSON.stringify(holidayDealWindow(holiday, "all"))]);
  for (const part of holidayParts.slice(1)) {
    const window = holidayDealWindow(holiday, part);
    const key = JSON.stringify(window);
    if (!seen.has(key)) { parts.push(part); seen.add(key); }
  }
  return parts;
}

export function holidaySelection(params: { get(name: string): string | null }, holiday?: Pick<HomeHoliday, "from" | "till" | "nights">): HolidaySelection {
  const audience = params.get("audience");
  const part = params.get("part");
  return {
    audience: holidayAudiences.some((item) => item.id === audience) ? audience as HolidayAudience : "couple",
    part: holidayParts.includes(part as HolidayPart) && (!holiday || availableHolidayParts(holiday).includes(part as HolidayPart)) ? part as HolidayPart : "all",
  };
}

export function holidayDealWindow(holiday: Pick<HomeHoliday, "from" | "till" | "nights">, part: HolidayPart) {
  const start = Date.parse(`${holiday.from}T00:00:00Z`);
  const end = Date.parse(`${holiday.till}T00:00:00Z`);
  const day = 86_400_000;
  const duration = Math.round((end - start) / day);
  if (!Number.isFinite(duration) || duration < 1 || duration > 30) throw new Error("invalid_stay");
  const nights = Math.min(holiday.nights, duration);
  const offset = part === "middle" ? Math.floor((duration - nights) / 2) : part === "ending" ? duration - nights : 0;
  const from = new Date(start + offset * day).toISOString().slice(0, 10);
  const till = part === "all" ? holiday.till : new Date(start + (offset + nights) * day).toISOString().slice(0, 10);
  return { from, till, nights };
}

function addDays(value: string, days: number) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A holiday is an anchor period, not a promise that every supplier sells the
 * shortest calendar stay. Ask the supplier for every commercially common
 * duration up to four nights and keep the actual stay it confirms. Short
 * holidays stay anchored to their first night so a cheaper date after the
 * holiday can never masquerade as a holiday offer.
 */
export function holidayStayPlan(holiday: Pick<HomeHoliday, "from" | "till" | "nights">, part: HolidayPart): HolidayStayQuery[] {
  const base = holidayDealWindow(holiday, part);
  const duration = Math.round((Date.parse(`${base.till}T00:00:00Z`) - Date.parse(`${base.from}T00:00:00Z`)) / 86_400_000);
  const holidayDuration = Math.round((Date.parse(`${holiday.till}T00:00:00Z`) - Date.parse(`${holiday.from}T00:00:00Z`)) / 86_400_000);
  const maximum = Math.max(base.nights, HOLIDAY_FLEXIBLE_MAX_NIGHTS);
  const queries: HolidayStayQuery[] = [];
  for (let nights = base.nights; nights <= maximum; nights++) {
    if (part === "all" && duration >= maximum) {
      queries.push({ dates: { from: base.from, till: addDays(base.from, nights), nights }, window: { from: base.from, till: base.till } });
      continue;
    }
    if (part === "ending" && holidayDuration >= nights) {
      const from = addDays(holiday.till, -nights);
      queries.push({ dates: { from, till: holiday.till, nights } });
      continue;
    }
    const from = base.from;
    queries.push({ dates: { from, till: addDays(from, nights), nights } });
  }
  return queries;
}

export function holidayStayMatchesPlan(plan: readonly HolidayStayQuery[], from: string, till: string) {
  const nights = Math.round((Date.parse(`${till}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  return plan.some((query) => query.dates.nights === nights && (query.window
    ? from >= query.window.from && till <= query.window.till
    : from === query.dates.from && till === query.dates.till));
}

export function holidayForRequestedStay<T extends Pick<HomeHoliday, "id" | "name" | "from" | "till">>(
  holidays: readonly T[],
  candidate: { from: string; till: string },
) {
  const nights = Math.round((Date.parse(`${candidate.till}T00:00:00Z`) - Date.parse(`${candidate.from}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(nights) || nights < 1 || nights > HOLIDAY_FLEXIBLE_MAX_NIGHTS) return null;
  return holidays.find((holiday) => holiday.from === candidate.from && candidate.till <= holiday.till) ?? null;
}

export function holidayDealSearchHref(holiday: Pick<HomeHoliday, "id" | "from" | "till" | "nights">, selection: HolidaySelection) {
  const window = holidayDealWindow(holiday, selection.part);
  const guests = holidayAudiences.find((item) => item.id === selection.audience)!.guests;
  const till = new Date(Date.parse(`${window.from}T00:00:00Z`) + window.nights * 86_400_000).toISOString().slice(0, 10);
  return `/search?${new URLSearchParams({ from: window.from, till, guests: String(guests), holiday: String(holiday.id), holidayPart: selection.part, editSearch: "dates" })}`;
}
