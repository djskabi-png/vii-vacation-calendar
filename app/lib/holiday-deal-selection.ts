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

export function holidaySelection(params: { get(name: string): string | null }): HolidaySelection {
  const audience = params.get("audience");
  const part = params.get("part");
  return {
    audience: holidayAudiences.some((item) => item.id === audience) ? audience as HolidayAudience : "couple",
    part: holidayParts.includes(part as HolidayPart) ? part as HolidayPart : "all",
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

export function holidayDealSearchHref(holiday: Pick<HomeHoliday, "from" | "till" | "nights">, selection: HolidaySelection) {
  const window = holidayDealWindow(holiday, selection.part);
  const guests = holidayAudiences.find((item) => item.id === selection.audience)!.guests;
  const till = new Date(Date.parse(`${window.from}T00:00:00Z`) + window.nights * 86_400_000).toISOString().slice(0, 10);
  return `/search?${new URLSearchParams({ from: window.from, till, guests: String(guests) })}`;
}
