import type { D1Database } from "../../types/cloudflare-runtime";
import { readPublishedContent, type ContentLocale } from "./content-studio.ts";
import { resolvePublicSliderMedia } from "./public-media-policy.ts";
import { normalizeHomepageSearchHref } from "./homepage-search-href.ts";
import { popularSearchesForWorld, popularSearchWorlds, type PopularSearchWorld } from "./world-popular-search-defaults.ts";

export type HomeDiscoveryItem = {
  id: string;
  label: string;
  note: string;
  href: string;
  image: string;
  imageAlt?: string;
  visible: boolean;
  action?: "nearby";
};

const vacationSearchHref = (params: Record<string, string>) => `/search?${new URLSearchParams(params).toString()}`;

const defaults = {
  popular: [
    { id: "vacation-villas", label: "וילות נופש", note: "וילות למשפחות ולקבוצות", href: "/villas", image: "/media/322de460abbda5c6.jpg", visible: true },
    { id: "zimmers", label: "צימרים", note: "צימרים ובקתות ברחבי הארץ", href: "/zimmers", image: "/media/hilat-hanof/535f7c268ed1dc4.jpeg", visible: true },
    { id: "vacation-apartments", label: "דירות נופש", note: "דירות מאובזרות לחופשה עצמאית", href: "/vacation-apartments", image: "/media/88fcef4341b24a45.jpeg", visible: true },
    { id: "luxury-suites", label: "סוויטות יוקרתיות", note: "סוויטות לחופשה מפנקת", href: "/luxury-suites", image: "/media/051ff4fbc8d7d2ac.jpeg", visible: true },
    { id: "last-minute", label: "נופש ברגע האחרון", note: "מקומות פנויים לתאריך הקרוב", href: "/last-minute", image: "/media/f18d7c0469633ca0.jpeg", visible: true },
    { id: "heated-pool-family", label: "נופש למשפחה עם בריכה מחוממת", note: "מקומות למשפחות עם בריכה מחוממת", href: vacationSearchHref({ features: "heated-pool,families" }), image: "/media/9a403cb4d9d1cbde.jpg", visible: true },
    { id: "event-places", label: "מקומות לאירועים", note: "לופטים ומתחמים לכל חגיגה", href: "/events", image: "/media/bc85b10f1d64d6db.jpeg", visible: true },
    { id: "spa-packages", label: "חבילות ספא", note: "טיפולים וחבילות לפי תאריך", href: "/spas#spa-world-package-deals", image: "/media/editorial/spa-couple-experience.webp", visible: true },
    { id: "hourly-rooms", label: "חדרים לפי שעה", note: "שהייה קצרה, פרטית וגמישה", href: "/hourly", image: "/media/editorial/hourly-stay-what-to-check.webp", visible: true },
    { id: "lofts", label: "לופטים", note: "לופטים למסיבות ולאירועים", href: "/events/search?type=%D7%9C%D7%95%D7%A4%D7%98", image: "/media/978e5fd5134b0831.jpeg", visible: true }
  ],
  cities: [
    { id: "eilat", label: "אילת", note: "שמש, ים ומקומות שלמים", href: "/vacations/eilat", image: "/media/322de460abbda5c6.jpg", visible: true },
    { id: "tiberias", label: "טבריה והכנרת", note: "חופשה קרובה למים", href: "/vacations/kinneret", image: "/media/9a403cb4d9d1cbde.jpg", visible: true },
    { id: "jerusalem", label: "ירושלים", note: "אוויר הרים וחופשה עירונית", href: "/vacations/jerusalem", image: "/media/231b0e706cc61cc1.jpg", visible: true },
    { id: "netanya", label: "נתניה והשרון", note: "ים, מרכז ונגישות קלה", href: vacationSearchHref({ location: "נתניה" }), image: "/media/verified/vacation/vacation-vila-tzukey-yam-1.jpg", imageAlt: "מתחם נופש באזור החוף, תמונת אווירה", visible: true },
    { id: "galilee", label: "הגליל", note: "נוף ירוק ומתחמים למשפחות", href: "/vacations/north", image: "/media/f18d7c0469633ca0.jpeg", visible: true }
  ],
  types: [
    { id: "villas", label: "וילות", note: "מקום שלם למשפחה או לקבוצה", href: "/villas", image: "/media/322de460abbda5c6.jpg", visible: true },
    { id: "suites", label: "סוויטות", note: "אירוח זוגי ומשפחתי", href: "/suite-complexes", image: "/media/051ff4fbc8d7d2ac.jpeg", visible: true },
    { id: "cabins", label: "צימרים ובקתות", note: "אירוח אינטימי מול הנוף", href: "/zimmers", image: "/media/hilat-hanof/535f7c268ed1dc4.jpeg", visible: true },
    { id: "apartments", label: "דירות נופש", note: "עצמאות ונוחות בעיר", href: "/vacation-apartments", image: "/media/88fcef4341b24a45.jpeg", visible: true },
    { id: "complexes", label: "מתחמי אירוח", note: "כמה יחידות במקום אחד", href: "/hospitality-complexes", image: "/media/978e5fd5134b0831.jpeg", visible: true }
  ]
} satisfies Record<string, HomeDiscoveryItem[]>;

const retiredPopularSearchIds = ["vacations", "pool", "events", "north"];

function isRetiredPopularSearchList(items: HomeDiscoveryItem[]) {
  return items.length === retiredPopularSearchIds.length
    && retiredPopularSearchIds.every((id, index) => items[index]?.id === id);
}

export function parseHomepageItems(value: string | undefined, fallback: HomeDiscoveryItem[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const items = parsed.flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim().slice(0, 70) : "";
      const href = typeof row.href === "string" ? row.href.trim().slice(0, 240) : "";
      const requestedImage = typeof row.image === "string" ? row.image.trim().slice(0, 300) : "";
      if (!label || !/^\/(?!\/)/.test(href) || /[\\\u0000-\u001f]/.test(href) || !/^\/(?!\/)/.test(requestedImage)) return [];
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 60) : `item-${index + 1}`;
      const matchedFallback = fallback.find((item) => item.id === id) || fallback[index];
      const media = resolvePublicSliderMedia({ image: requestedImage, topic: `${id} ${label} ${href}`, fallback: matchedFallback?.image });
      if (!media.image.startsWith("/")) return [];
      return [{
        id,
        label,
        note: typeof row.note === "string" ? row.note.trim().slice(0, 120) : "",
        href: normalizeHomepageSearchHref(href),
        image: media.image,
        imageAlt: media.fallbackApplied ? `${label}, תמונת אווירה` : (typeof row.imageAlt === "string" ? row.imageAlt.trim().slice(0, 160) : undefined),
        visible: row.visible !== false,
        ...(row.action === "nearby" ? { action: "nearby" as const } : {}),
      }];
    });
    const ids = new Set<string>();
    return items.filter(item => { if (ids.has(item.id)) return false; ids.add(item.id); return true; });
  } catch {
    return fallback;
  }
}

export const defaultHomepagePresentation = {
  popular: defaults.popular,
  cities: defaults.cities,
  types: defaults.types,
  editorialTitle: "רוצים חופשה שמתאימה בדיוק לכם?",
  editorialBody: "אפשר להתחיל מסוג המקום, מהעיר או מהתאריך. כל בחירה שומרת את הכיוון שלכם ומובילה לתוצאות שאפשר להמשיך לסנן ולהשוות.",
};

export function worldPopularSearchItems(attributes?: Record<string, string>, world: PopularSearchWorld = "vacation") {
  const definition = popularSearchWorlds.find(item => item.id === world)!;
  const fallback = world === "vacation" ? [{ ...popularSearchesForWorld(world)[0] }, ...defaults.popular] : popularSearchesForWorld(world);
  const managedPopular = parseHomepageItems(attributes?.[definition.attribute], fallback);
  if (isRetiredPopularSearchList(managedPopular)) return fallback;
  // Upgrade legacy vacation lists once. The editor writes a schema marker,
  // so later deliberate hiding/removal remains under the publisher's control.
  if (world === "vacation" && attributes?.[definition.attribute] && !attributes[`${definition.attribute}Version`] && managedPopular.length && !managedPopular.some(item => item.action === "nearby")) return [fallback[0], ...managedPopular];
  return managedPopular;
}
export function parseHomepagePresentation(attributes?: Record<string, string>, world: PopularSearchWorld = "vacation") {
  return {
    popular: worldPopularSearchItems(attributes, world).filter((item) => item.visible),
    cities: parseHomepageItems(attributes?.homeCitySearches, defaults.cities).filter((item) => item.visible),
    types: parseHomepageItems(attributes?.homeTypeSearches, defaults.types).filter((item) => item.visible),
    editorialTitle: attributes?.homeEditorialTitle?.trim().slice(0, 120) || defaultHomepagePresentation.editorialTitle,
    editorialBody: attributes?.homeEditorialBody?.trim().slice(0, 700) || defaultHomepagePresentation.editorialBody,
  };
}

export async function readHomepagePresentation(db: D1Database | undefined, locale: ContentLocale = "he", world: PopularSearchWorld = "vacation") {
  if (!db) return parseHomepagePresentation(undefined, world);
  const published = await readPublishedContent(db, "homepage", "vacation-sliders", locale).catch(() => null);
  if (published) return parseHomepagePresentation(published.content.attributes, world);
  if (locale !== "he") {
    const hebrew = await readPublishedContent(db, "homepage", "vacation-sliders", "he").catch(() => null);
    if (hebrew) return parseHomepagePresentation(hebrew.content.attributes, world);
  }
  return parseHomepagePresentation(undefined, world);
}

export function serializeHomepageItems(items: HomeDiscoveryItem[]) {
  return JSON.stringify(items);
}
