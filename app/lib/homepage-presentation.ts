import type { D1Database } from "../../types/cloudflare-runtime";
import { readPublishedContent, type ContentLocale } from "./content-studio";

export type HomeDiscoveryItem = {
  id: string;
  label: string;
  note: string;
  href: string;
  image: string;
  imageAlt?: string;
  visible: boolean;
};

const defaults = {
  popular: [
    { id: "vacations", label: "מקומות נופש", note: "כל המקומות והאזורים", href: "/search", image: "/media/f18d7c0469633ca0.jpeg", visible: true },
    { id: "pool", label: "נופש עם בריכה", note: "בריכות פרטיות ומתחמים", href: "/search?feature=בריכה", image: "/media/9a403cb4d9d1cbde.jpg", visible: true },
    { id: "events", label: "מקומות לאירועים", note: "לפי כמות וסוג האירוע", href: "/events/search", image: "/media/bc85b10f1d64d6db.jpeg", visible: true },
    { id: "north", label: "נופש בצפון", note: "גליל, גולן וכנרת", href: "/vacations/north", image: "/media/978e5fd5134b0831.jpeg", visible: true }
  ],
  cities: [
    { id: "eilat", label: "אילת", note: "שמש, ים ומקומות שלמים", href: "/search?location=אילת", image: "/media/322de460abbda5c6.jpg", visible: true },
    { id: "tiberias", label: "טבריה והכנרת", note: "חופשה קרובה למים", href: "/search?location=כנרת", image: "/media/9a403cb4d9d1cbde.jpg", visible: true },
    { id: "jerusalem", label: "ירושלים", note: "אוויר הרים וחופשה עירונית", href: "/search?location=ירושלים והסביבה", image: "/media/231b0e706cc61cc1.jpg", visible: true },
    { id: "netanya", label: "נתניה והשרון", note: "ים, מרכז ונגישות קלה", href: "/search?location=נתניה", image: "/media/c3a6274bfd08091a.jpeg", visible: true },
    { id: "galilee", label: "הגליל", note: "נוף ירוק ומתחמים למשפחות", href: "/search?location=גליל עליון", image: "/media/f18d7c0469633ca0.jpeg", visible: true }
  ],
  types: [
    { id: "villas", label: "וילות", note: "מקום שלם למשפחה או לקבוצה", href: "/villas", image: "/media/322de460abbda5c6.jpg", visible: true },
    { id: "suites", label: "סוויטות", note: "אירוח זוגי ומשפחתי", href: "/suite-complexes", image: "/media/e65d757e686fda64.jpg", visible: true },
    { id: "cabins", label: "צימרים ובקתות", note: "אירוח אינטימי מול הנוף", href: "/search?types=צימרים", image: "/media/f18d7c0469633ca0.jpeg", visible: true },
    { id: "apartments", label: "דירות נופש", note: "עצמאות ונוחות בעיר", href: "/vacation-apartments", image: "/media/c3a6274bfd08091a.jpeg", visible: true },
    { id: "complexes", label: "מתחמי אירוח", note: "כמה יחידות במקום אחד", href: "/search?types=מתחמי אירוח", image: "/media/978e5fd5134b0831.jpeg", visible: true }
  ]
} satisfies Record<string, HomeDiscoveryItem[]>;

function parseItems(value: string | undefined, fallback: HomeDiscoveryItem[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const items = parsed.flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim().slice(0, 70) : "";
      const href = typeof row.href === "string" ? row.href.trim().slice(0, 240) : "";
      const image = typeof row.image === "string" ? row.image.trim().slice(0, 300) : "";
      if (!label || !href.startsWith("/") || !image.startsWith("/")) return [];
      return [{
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 60) : `item-${index + 1}`,
        label,
        note: typeof row.note === "string" ? row.note.trim().slice(0, 120) : "",
        href,
        image,
        visible: row.visible !== false,
      }];
    });
    return items.length ? items : fallback;
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

export function parseHomepagePresentation(attributes?: Record<string, string>) {
  return {
    popular: parseItems(attributes?.homePopularSearches, defaults.popular).filter((item) => item.visible),
    cities: parseItems(attributes?.homeCitySearches, defaults.cities).filter((item) => item.visible),
    types: parseItems(attributes?.homeTypeSearches, defaults.types).filter((item) => item.visible),
    editorialTitle: attributes?.homeEditorialTitle?.trim().slice(0, 120) || defaultHomepagePresentation.editorialTitle,
    editorialBody: attributes?.homeEditorialBody?.trim().slice(0, 700) || defaultHomepagePresentation.editorialBody,
  };
}

export async function readHomepagePresentation(db: D1Database | undefined, locale: ContentLocale = "he") {
  if (!db) return defaultHomepagePresentation;
  const published = await readPublishedContent(db, "homepage", "vacation-sliders", locale).catch(() => null);
  if (published) return parseHomepagePresentation(published.content.attributes);
  if (locale !== "he") {
    const hebrew = await readPublishedContent(db, "homepage", "vacation-sliders", "he").catch(() => null);
    if (hebrew) return parseHomepagePresentation(hebrew.content.attributes);
  }
  return defaultHomepagePresentation;
}

export function serializeHomepageItems(items: HomeDiscoveryItem[]) {
  return JSON.stringify(items);
}
