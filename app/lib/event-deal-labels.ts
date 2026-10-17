import type { SiteLanguage } from "../i18n/locale-routing";
import { latinBusinessAlias, localizedBusinessText } from "../i18n/localized-business-content.ts";
import type { PublicGeographyNode } from "./geography-search";

export type EventDealPlace = { slug: string; name: string; location: string; type: string; guests: number; image: string; images: string[]; sourceUrl?: string; sourcePropertySlug?: string };

function sourceBusinessName(sourceUrl?: string) {
  try {
    const url = new URL(sourceUrl || "");
    if (!["vii.co.il", "www.vii.co.il"].includes(url.hostname)) return "";
    const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
    return /^[a-z0-9_'&. -]+$/i.test(slug) && /[a-z]{2}/i.test(slug) ? slug.replace(/[_-]+/g, " ").trim() : "";
  } catch { return ""; }
}

export function eventDealPlaceLabels(place: { name: string; location: string; type: string; sourceUrl?: string }, language: SiteLanguage, translate: (value: string) => string, geography: readonly PublicGeographyNode[] = []) {
  if (language === "he") return { name: place.name, location: place.location, type: place.type };
  const copy = {
    en: { venue: "Event venue", country: "Israel" },
    ru: { venue: "Площадка для мероприятий", country: "Израиль" },
    fr: { venue: "Lieu événementiel", country: "Israël" },
  }[language];
  // Brand and city names are proper names, not dictionary nouns (Nesher is not
  // "an eagle"). Prefer the supplier's published Latin identity and geography.
  const name = latinBusinessAlias(place.name) || sourceBusinessName(place.sourceUrl)
    || localizedBusinessText(place.name, language, translate, copy.venue);
  const city = geography.find((node) => node.level === "city" && node.title === place.location)?.titleEn;
  return { name, location: city || copy.country,
    type: localizedBusinessText(place.type, language, translate, copy.venue) };
}
