import type { D1Database } from "../../types/cloudflare-runtime";
import type { ContentLocale } from "./content-studio.ts";
import { readPublishedContent } from "./content-studio.ts";
import { homeDealPeriods, type HomeDealPeriod } from "./vii-home-deals.ts";
import type { HomeHoliday } from "./vii-home-holidays.ts";

export type HomePeriodTab = { id: HomeDealPeriod; label: string };
export type HomeDisplaySettings = {
  periods: HomePeriodTab[];
  defaultPeriod: HomeDealPeriod;
  holidayLimit: number;
  hiddenHolidayIds: Set<number>;
  holidayDates: Map<number, { from: string; till: string }>;
};

const defaultLabels: Record<ContentLocale, Record<HomeDealPeriod, string>> = {
  he: { tomorrow: "ברגע האחרון", weekend: "חמישי עד שבת", "friday-weekend": "שישי עד ראשון", thursday: "לילה בחמישי", friday: "לילה בשישי" },
  en: { tomorrow: "Last minute", weekend: "Thursday to Saturday", "friday-weekend": "Friday to Sunday", thursday: "Thursday night", friday: "Friday night" },
  ru: { tomorrow: "В последний момент", weekend: "Чт–Сб", "friday-weekend": "Пт–Вс", thursday: "Ночь в четверг", friday: "Ночь в пятницу" },
  fr: { tomorrow: "Dernière minute", weekend: "Jeudi à samedi", "friday-weekend": "Vendredi à dimanche", thursday: "Nuit de jeudi", friday: "Nuit de vendredi" },
};

const ids = new Set<HomeDealPeriod>(homeDealPeriods.map((item) => item.id));
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function jsonRecord(value: string | undefined) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

export function defaultHomeDisplaySettings(locale: ContentLocale = "he"): HomeDisplaySettings {
  return {
    periods: homeDealPeriods.map((item) => ({ id: item.id, label: defaultLabels[locale][item.id] })),
    defaultPeriod: "tomorrow",
    holidayLimit: 6,
    hiddenHolidayIds: new Set(),
    holidayDates: new Map(),
  };
}

export function parseHomeDisplaySettings(attributes: Record<string, string> | undefined, locale: ContentLocale = "he") {
  const defaults = defaultHomeDisplaySettings(locale);
  if (!attributes) return defaults;
  const labels = jsonRecord(attributes.homePeriodLabels);
  const ordered = (attributes.homePeriodOrder || "").split(",").filter((id): id is HomeDealPeriod => ids.has(id as HomeDealPeriod));
  const completeOrder = [...new Set([...ordered, ...homeDealPeriods.map((item) => item.id)])];
  // All five nearby-date tabs are a required part of the public homepage.
  // Legacy CMS records may still contain homePeriodHidden values from an
  // earlier editor, but they must never be allowed to collapse this search
  // surface to a single tab again.
  const periods = completeOrder.map((id) => ({ id, label: typeof labels[id] === "string" && labels[id]!.trim() ? String(labels[id]).trim().slice(0, 40) : defaultLabels[locale][id] }));
  const requestedDefault = attributes.homePeriodDefault as HomeDealPeriod;
  const defaultPeriod = periods.some((item) => item.id === requestedDefault) ? requestedDefault : periods[0].id;
  const holidayLimit = Math.min(12, Math.max(1, Number.parseInt(attributes.homeHolidayLimit || "6", 10) || 6));
  const hiddenHolidayIds = new Set((attributes.homeHolidayHidden || "").split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0));
  const rawDates = jsonRecord(attributes.homeHolidayDates);
  const holidayDates = new Map<number, { from: string; till: string }>();
  for (const [rawId, raw] of Object.entries(rawDates)) {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0 || !raw || typeof raw !== "object") continue;
    const from = (raw as Record<string, unknown>).from;
    const till = (raw as Record<string, unknown>).till;
    if (typeof from === "string" && typeof till === "string" && isoDate.test(from) && isoDate.test(till) && from < till) holidayDates.set(id, { from, till });
  }
  return { periods, defaultPeriod, holidayLimit, hiddenHolidayIds, holidayDates };
}

export async function readHomeDisplaySettings(db: D1Database | undefined, locale: ContentLocale = "he") {
  if (!db) return defaultHomeDisplaySettings(locale);
  const published = await readPublishedContent(db, "homepage", "vacation-sliders", locale).catch(() => null);
  if (published) return parseHomeDisplaySettings(published.content.attributes, locale);
  if (locale !== "he") {
    const hebrew = await readPublishedContent(db, "homepage", "vacation-sliders", "he").catch(() => null);
    if (hebrew) {
      const structural = { ...hebrew.content.attributes };
      delete structural.homePeriodLabels;
      return parseHomeDisplaySettings(structural, locale);
    }
  }
  return defaultHomeDisplaySettings(locale);
}

export function applyHolidayDisplaySettings(holidays: HomeHoliday[], settings: HomeDisplaySettings) {
  return holidays
    .filter((holiday) => !settings.hiddenHolidayIds.has(holiday.id))
    .map((holiday) => {
      const dates = settings.holidayDates.get(holiday.id);
      if (!dates || dates.from < holiday.from || dates.till > holiday.till) return holiday;
      const nights = Math.round((new Date(`${dates.till}T00:00:00Z`).valueOf() - new Date(`${dates.from}T00:00:00Z`).valueOf()) / 86_400_000);
      return nights >= 1 && nights <= 2 ? { ...holiday, ...dates, nights, exactStay: true } : holiday;
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.id - b.id);
}
