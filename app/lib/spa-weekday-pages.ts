import { eventDealDate } from "./event-deal-dates.ts";
import { firstDealDate } from "./deal-clock.ts";

export const spaWeekdaySlugs = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type SpaWeekdaySlug = typeof spaWeekdaySlugs[number];
const weekdayNumbers: Record<SpaWeekdaySlug, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
export function spaWeekdayDate(slug: SpaWeekdaySlug, now = new Date()) {
  const start = firstDealDate(now);
  const startOffset = start === eventDealDate(0, now) ? 0 : 1;
  const startDay = new Date(`${start}T12:00:00Z`).getUTCDay();
  const offset = (weekdayNumbers[slug] - startDay + 7) % 7;
  return eventDealDate(startOffset + offset, now);
}
export function spaWeekdayPath(slug: SpaWeekdaySlug) { return `/spas/day/${slug}`; }
export const spaWeekdayLabels = {
  he: { sunday: "יום ראשון", monday: "יום שני", tuesday: "יום שלישי", wednesday: "יום רביעי", thursday: "יום חמישי", friday: "יום שישי", saturday: "שבת" },
  en: { sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday" },
  ru: { sunday: "Воскресенье", monday: "Понедельник", tuesday: "Вторник", wednesday: "Среда", thursday: "Четверг", friday: "Пятница", saturday: "Суббота" },
  fr: { sunday: "Dimanche", monday: "Lundi", tuesday: "Mardi", wednesday: "Mercredi", thursday: "Jeudi", friday: "Vendredi", saturday: "Samedi" },
} as const;
