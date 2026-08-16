import type { ResolvedAvailability } from "../components/property-card";

export type LegacyPeriodOffer = { slug: string; from: string; till: string; dateSummary: string; nightlyPrice: number };
export type LastMinutePeriod = {
  id: string; legacyTab: string; label: string; cta: string; group: "immediate" | "upcoming";
  dateSummary: string; from: string; till: string; offers: readonly LegacyPeriodOffer[];
};

// Snapshot verified against vii.co.il on 2026-08-16. Only businesses that already
// have a complete, public profile on the new site are shown here.
export const legacyPeriodSnapshot = { sourceUrl: "https://www.vii.co.il/", verifiedAt: "2026-08-16T12:26:00+03:00" } as const;

export const lastMinutePeriods = [
  {
    id: "last-minute", legacyTab: "lastminute", label: "ברגע האחרון", cta: "לכל הדילים ברגע האחרון", group: "immediate",
    dateSummary: "16 עד 17 באוגוסט", from: "2026-08-16", till: "2026-08-17",
    offers: [
      { slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-08-16", till: "2026-08-17", dateSummary: "16 עד 17 באוגוסט", nightlyPrice: 3500 },
      { slug: "aqua-resort", from: "2026-08-16", till: "2026-08-17", dateSummary: "16 עד 17 באוגוסט", nightlyPrice: 6000 },
      { slug: "hilat-hanof", from: "2026-08-16", till: "2026-08-17", dateSummary: "16 עד 17 באוגוסט", nightlyPrice: 1200 },
      { slug: "kesem-harimon", from: "2026-08-16", till: "2026-08-17", dateSummary: "16 עד 17 באוגוסט", nightlyPrice: 800 },
    ],
  },
  {
    id: "thursday-saturday", legacyTab: "weekend", label: "2 לילות חמישי עד שבת", cta: "לכל הפנויים חמישי עד שבת", group: "immediate",
    dateSummary: "20 עד 22 באוגוסט", from: "2026-08-20", till: "2026-08-22",
    offers: [
      { slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-08-20", till: "2026-08-22", dateSummary: "20 עד 22 באוגוסט", nightlyPrice: 3250 },
      { slug: "hilat-hanof", from: "2026-08-20", till: "2026-08-22", dateSummary: "20 עד 22 באוגוסט", nightlyPrice: 1200 },
      { slug: "kesem-harimon", from: "2026-08-20", till: "2026-08-22", dateSummary: "20 עד 22 באוגוסט", nightlyPrice: 900 },
    ],
  },
  {
    id: "friday-sunday", legacyTab: "weekend2", label: "2 לילות שישי עד ראשון", cta: "לכל הפנויים שישי עד ראשון", group: "immediate",
    dateSummary: "21 עד 23 באוגוסט", from: "2026-08-21", till: "2026-08-23",
    offers: [
      { slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-08-21", till: "2026-08-23", dateSummary: "21 עד 23 באוגוסט", nightlyPrice: 3250 },
      { slug: "hilat-hanof", from: "2026-08-21", till: "2026-08-23", dateSummary: "21 עד 23 באוגוסט", nightlyPrice: 1200 },
      { slug: "kesem-harimon", from: "2026-08-21", till: "2026-08-23", dateSummary: "21 עד 23 באוגוסט", nightlyPrice: 850 },
    ],
  },
  {
    id: "thursday", legacyTab: "thursday", label: "פנוי לחמישי", cta: "לכל הפנויים ליום אחד בחמישי", group: "immediate",
    dateSummary: "20 עד 21 באוגוסט", from: "2026-08-20", till: "2026-08-21",
    offers: [{ slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-08-20", till: "2026-08-21", dateSummary: "20 עד 21 באוגוסט", nightlyPrice: 4000 }],
  },
  {
    id: "friday", legacyTab: "friday", label: "פנוי לשישי", cta: "לכל הפנויים ליום אחד בשישי", group: "immediate",
    dateSummary: "21 עד 22 באוגוסט", from: "2026-08-21", till: "2026-08-22",
    offers: [{ slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-08-21", till: "2026-08-22", dateSummary: "21 עד 22 באוגוסט", nightlyPrice: 4000 }],
  },
  {
    id: "august", legacyTab: "holiday119", label: "אוגוסט", cta: "לכל הדילים באוגוסט", group: "upcoming",
    dateSummary: "16 עד 31 באוגוסט", from: "2026-08-16", till: "2026-08-31",
    offers: [
      { slug: "aqua-resort", from: "2026-08-16", till: "2026-08-17", dateSummary: "16 עד 17 באוגוסט", nightlyPrice: 6000 },
      { slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-08-16", till: "2026-08-17", dateSummary: "16 עד 17 באוגוסט", nightlyPrice: 3500 },
      { slug: "hilat-hanof", from: "2026-08-19", till: "2026-08-20", dateSummary: "19 עד 20 באוגוסט", nightlyPrice: 1200 },
      { slug: "kesem-harimon", from: "2026-08-16", till: "2026-08-17", dateSummary: "16 עד 17 באוגוסט", nightlyPrice: 800 },
    ],
  },
  {
    id: "rosh-hashana", legacyTab: "holiday111", label: "ראש השנה", cta: "לכל הדילים בראש השנה", group: "upcoming",
    dateSummary: "11 עד 13 בספטמבר", from: "2026-09-11", till: "2026-09-13",
    offers: [
      { slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-09-11", till: "2026-09-12", dateSummary: "11 עד 12 בספטמבר", nightlyPrice: 4000 },
      { slug: "vacation-gesthouse-royal", from: "2026-09-11", till: "2026-09-12", dateSummary: "11 עד 12 בספטמבר", nightlyPrice: 5000 },
    ],
  },
  {
    id: "sukkot", legacyTab: "holiday112", label: "סוכות", cta: "לכל הדילים בסוכות", group: "upcoming",
    dateSummary: "25 בספטמבר עד 2 באוקטובר", from: "2026-09-25", till: "2026-10-02",
    offers: [{ slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-09-25", till: "2026-09-26", dateSummary: "25 עד 26 בספטמבר", nightlyPrice: 4000 }],
  },
  {
    id: "simchat-torah", legacyTab: "holiday113", label: "שמחת תורה", cta: "לכל הדילים בשמחת תורה", group: "upcoming",
    dateSummary: "3 עד 4 באוקטובר", from: "2026-10-03", till: "2026-10-04",
    offers: [
      { slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-10-03", till: "2026-10-04", dateSummary: "3 עד 4 באוקטובר", nightlyPrice: 3500 },
      { slug: "hilat-hanof", from: "2026-10-03", till: "2026-10-04", dateSummary: "3 עד 4 באוקטובר", nightlyPrice: 1200 },
      { slug: "kesem-harimon", from: "2026-10-03", till: "2026-10-04", dateSummary: "3 עד 4 באוקטובר", nightlyPrice: 800 },
    ],
  },
  {
    id: "sigd", legacyTab: "holiday114", label: "חג הסיגד", cta: "לכל הדילים בחג הסיגד", group: "upcoming",
    dateSummary: "8 עד 9 בנובמבר", from: "2026-11-08", till: "2026-11-09",
    offers: [
      { slug: "aqua-resort", from: "2026-11-08", till: "2026-11-09", dateSummary: "8 עד 9 בנובמבר", nightlyPrice: 6000 },
      { slug: "vacation-sea-view-penthouse-26-spa-netanya", from: "2026-11-08", till: "2026-11-09", dateSummary: "8 עד 9 בנובמבר", nightlyPrice: 3500 },
    ],
  },
] as const satisfies readonly LastMinutePeriod[];

export const lastMinuteStartingPrices: Record<string, number> = Object.fromEntries(
  lastMinutePeriods.flatMap((period) => period.offers.map((offer) => [offer.slug, offer.nightlyPrice])),
);

export function publishedLastMinuteDeal({ slug, period, from, till, guests, nightlyPrice }: { slug: string; period?: string; from: string; till: string; guests: number; nightlyPrice: number }): ResolvedAvailability | null {
  const deal = lastMinutePeriods.find((candidate) => candidate.id === period);
  const offer = deal?.offers.find((candidate) => candidate.slug === slug && candidate.from === from && candidate.till === till && candidate.nightlyPrice === nightlyPrice);
  if (!offer || nightlyPrice <= 0) return null;
  return { from: offer.from, till: offer.till, availability: "available", nightlyPrice: offer.nightlyPrice, includedGuests: Math.max(1, guests), showSelectedDates: true };
}
