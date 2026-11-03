import type { HomeDealPeriod } from "./vii-home-deals.ts";

export const permanentHomePeriodLandings = {
  tomorrow: "/last-minute",
  weekend: "/weekend/thursday-to-saturday",
  "friday-weekend": "/weekend/friday-to-sunday",
  thursday: "/weekend/thursday-night",
  friday: "/weekend/friday-night",
} as const satisfies Record<HomeDealPeriod, string>;

export type WeekendLandingSlug = "thursday-to-saturday" | "friday-to-sunday" | "thursday-night" | "friday-night";

export const weekendLandingPeriods = {
  "thursday-to-saturday": "weekend",
  "friday-to-sunday": "friday-weekend",
  "thursday-night": "thursday",
  "friday-night": "friday",
} as const satisfies Record<WeekendLandingSlug, HomeDealPeriod>;

export function isWeekendLandingSlug(value: string): value is WeekendLandingSlug {
  return Object.hasOwn(weekendLandingPeriods, value);
}
