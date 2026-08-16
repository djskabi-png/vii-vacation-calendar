import type { ResolvedAvailability } from "../components/property-card";

export const lastMinutePeriods = [
  { id: "last-minute", label: "ברגע האחרון", cta: "לכל הדילים ברגע האחרון", group: "immediate", dateSummary: "9 עד 10 באוגוסט", from: "2026-08-09", till: "2026-08-10", slugs: ["aqua-resort", "ar-suites", "kesem-harimon", "ahuzat-or", "rose-estate"] },
  { id: "thursday-saturday", label: "2 לילות חמישי עד שבת", cta: "לכל הפנויים חמישי עד שבת", group: "immediate", dateSummary: "13 עד 15 באוגוסט", from: "2026-08-13", till: "2026-08-15", slugs: ["perfumes-villa", "aqua-resort", "anael-estate", "magic-garden-gefen", "kesem-harimon"] },
  { id: "friday-sunday", label: "2 לילות שישי עד ראשון", cta: "לכל הפנויים שישי עד ראשון", group: "immediate", dateSummary: "14 עד 16 באוגוסט", from: "2026-08-14", till: "2026-08-16", slugs: ["rose-estate", "ahuzat-or", "sol-gilgal", "perfumes-villa", "aqua-resort"] },
  { id: "thursday", label: "פנוי לחמישי", cta: "לכל הפנויים ליום אחד בחמישי", group: "immediate", dateSummary: "13 עד 14 באוגוסט", from: "2026-08-13", till: "2026-08-14", slugs: ["aqua-resort", "kesem-harimon", "ahuzat-or", "anael-estate", "rose-estate"] },
  { id: "friday", label: "פנוי לשישי", cta: "לכל הפנויים ליום אחד בשישי", group: "immediate", dateSummary: "14 עד 15 באוגוסט", from: "2026-08-14", till: "2026-08-15", slugs: ["ar-suites", "perfumes-villa", "magic-garden-gefen", "sol-gilgal", "aqua-resort"] },
  { id: "august", label: "אוגוסט", cta: "לכל הדילים באוגוסט", group: "upcoming", dateSummary: "20 עד 22 באוגוסט", from: "2026-08-20", till: "2026-08-22", slugs: ["aqua-resort", "perfumes-villa", "ar-suites", "kesem-harimon", "ahuzat-or"] },
  { id: "rosh-hashana", label: "ראש השנה", cta: "לכל הדילים בראש השנה", group: "upcoming", dateSummary: "11 עד 13 בספטמבר", from: "2026-09-11", till: "2026-09-13", slugs: ["anael-estate", "magic-garden-gefen", "rose-estate", "sol-gilgal", "ahuzat-or"] },
  { id: "sukkot", label: "סוכות", cta: "לכל הדילים בסוכות", group: "upcoming", dateSummary: "25 עד 27 בספטמבר", from: "2026-09-25", till: "2026-09-27", slugs: ["kesem-harimon", "aqua-resort", "anael-estate", "perfumes-villa", "rose-estate"] },
  { id: "simchat-torah", label: "שמחת תורה", cta: "לכל הדילים שמחת תורה", group: "upcoming", dateSummary: "2 עד 4 באוקטובר", from: "2026-10-02", till: "2026-10-04", slugs: ["rose-estate", "aqua-resort", "magic-garden-gefen", "ahuzat-or", "anael-estate"] },
  { id: "sigd", label: "חג הסיגד", cta: "לכל הדילים בחג הסיגד", group: "upcoming", dateSummary: "8 עד 10 בנובמבר", from: "2026-11-08", till: "2026-11-10", slugs: ["perfumes-villa", "kesem-harimon", "sol-gilgal", "ar-suites", "aqua-resort"] },
] as const;

export const lastMinuteStartingPrices: Record<string, number> = { "aqua-resort": 3500, "ar-suites": 950, "kesem-harimon": 1200, "ahuzat-or": 1200, "rose-estate": 6000, "perfumes-villa": 3500, "anael-estate": 4800, "magic-garden-gefen": 2400, "sol-gilgal": 2200 };

export function publishedLastMinuteDeal({ slug, period, from, till, guests, nightlyPrice }: { slug: string; period?: string; from: string; till: string; guests: number; nightlyPrice: number }): ResolvedAvailability | null {
  const deal = lastMinutePeriods.find((candidate) => candidate.id === period);
  if (!deal || !deal.slugs.includes(slug as never) || deal.from !== from || deal.till !== till || nightlyPrice <= 0) return null;
  return { from: deal.from, till: deal.till, availability: "available", nightlyPrice, includedGuests: Math.max(1, guests), showSelectedDates: true };
}
