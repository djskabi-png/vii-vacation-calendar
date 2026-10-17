import vacationCatalog from "../data/sergey-public-catalog.json" with { type: "json" };
import hourlyCatalog from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spaCatalog from "../data/spaplus-catalog.json" with { type: "json" };
import { providerProfiles, paidAttractions } from "../data/world-data.ts";
import { trails } from "../data/trail-data.ts";
import { magazineArticles } from "../data/magazine-data.ts";
import { magazineBodySource } from "./magazine-body";
import { publicWorldNavigation } from "../data/world-navigation.ts";
import { worldFooterContexts } from "../data/footer-context.ts";
import { readSupplierCatalogSummaries } from "./supplier-catalog-store.ts";
import type { D1Database } from "../../types/cloudflare-runtime";
import type { ContentLocale, ContentSource, ContentType, ManagedLink } from "./content-studio.ts";
import { defaultEventLandingPresentation, eventLandingSourceAttributes } from "./event-landing-presentation.ts";
import { defaultWorldLandingPresentations, managedWorldLandingTypes, worldLandingSourceAttributes } from "./world-landing-presentation.ts";
import { holidayContentSource } from "./holiday-world.ts";
import { getHomeHolidays } from "./vii-home-holidays.ts";
import { supplierToken } from "./vii-supplier-token.ts";

type UnknownRow = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : "";
const numeric = (value: unknown) => Number.isSafeInteger(Number(value)) ? Number(value) : 0;
const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "";
const highlightList = (value: unknown) => Array.isArray(value) ? value.map((item) => typeof item === "string" ? item : text((item as UnknownRow)?.label)).filter(Boolean).slice(0, 5).join(", ") : "";

function sourceAttributes(type: ContentType, row: UnknownRow): Record<string, string> {
  if (type === "vacation") return { accommodationType: text(row.type), highlights: highlightList(row.highlights) || (Array.isArray(row.features) ? row.features.filter((item): item is string => typeof item === "string").slice(0, 5).join(", ") : ""), cardNote: text(row.cardNote) };
  if (type === "trails") return { mainArea: text(row.mainArea), region: text(row.region), nature: list(row.nature), distance: text(row.distance),
    duration: text(row.duration), difficulty: text(row.difficulty), routeType: text(row.routeType), bestSeason: text(row.bestSeason),
    familyFit: text(row.familyFit), accessibility: text(row.accessibility), officialSource: text(row.officialSource), sourceName: text(row.sourceName), mapQuery: text(row.mapQuery) };
  if (type === "providers" || type === "attractions") return { location: text(row.location), area: text(row.area), features: list(row.features),
    image: text(row.image), priceLabel: text(row.priceLabel), phone: text(row.phone), sourceUrl: text(row.sourceUrl), sourceName: text(row.sourceName) };
  if (type === "magazine") return { category: text(row.category), image: text(row.image), dateLabel: text(row.dateLabel), readTime: String(numeric(row.readTime) || ""),
    takeaway: text(row.takeaway), tags: list(row.tags), imageTitle: text(row.imageTitle) || text(row.imageAlt), imageCredit: text(row.imageCredit), world: text(row.world) };
  return {};
}

function source(type: ContentType, world: string, row: UnknownRow, key: string, sourceLabel: string, locale: ContentLocale): ContentSource {
  const about = Array.isArray(row.about) ? row.about.filter((item): item is string => typeof item === "string") : [];
  return { type, world, key, sourceLabel, locale, title: text(row.title || row.name) || key,
    summary: text(row.shortDescription || row.description || row.summary || row.excerpt),
    body: type === "magazine" ? magazineBodySource(row as unknown as Parameters<typeof magazineBodySource>[0]) : about.join("\n\n") || text(row.intro || row.body), slug: text(row.slug) || key,
    imageAlt: text(row.imageAlt) || text(row.title || row.name), indexable: row.indexable !== false, attributes: sourceAttributes(type, row) };
}

async function catalogRows(db: D1Database, world: "vacations" | "events" | "rooms" | "spa") {
  try {
    const active = await readSupplierCatalogSummaries(db, world);
    if (active?.entries.length) return active.entries.map((entry) => entry.summary as UnknownRow);
  } catch { /* Fall back to the bundled, reviewed generation. */ }
  if (world === "spa") return spaCatalog.sites as UnknownRow[];
  if (world === "rooms") return hourlyCatalog.places as UnknownRow[];
  return (vacationCatalog.places as UnknownRow[]).filter((row) => row.world === world);
}

const managedLink = (id: string, label: string, href: string, group: string, order: number): ManagedLink =>
  ({ id, label, href, group, order, visible: true, newWindow: false });

export async function contentStudioSources(db: D1Database, locale: ContentLocale = "he", requestedType?: ContentType) {
  if (requestedType === "holiday") {
    const holidays = await getHomeHolidays({ token: await supplierToken() }).catch(() => []);
    return holidays.map((holiday) => holidayContentSource(holiday, locale));
  }
  const [vacations, events, rooms, spas] = await Promise.all([
    catalogRows(db, "vacations"), catalogRows(db, "events"), catalogRows(db, "rooms"), catalogRows(db, "spa"),
  ]);
  const sources: ContentSource[] = [
    { type: "homepage", key: "vacation-sliders", world: "global", locale, sourceLabel: "VII homepage controls", title: "סליידרים של נופש בעמוד הבית",
      summary: "שליטה בלשוניות התאריכים, ברירת המחדל, מספר החגים והתאריכים שיוצגו בעמוד הבית.", indexable: false,
      attributes: { homePeriodOrder: "tomorrow,weekend,friday-weekend,thursday,friday", homePeriodDefault: "tomorrow", homePeriodHidden: "", homePeriodLabels: "{}", homeHolidayLimit: "6", homeHolidayHidden: "", homeHolidayDates: "{}" } },
    { type: "events", key: "landing", world: "events", locale, sourceLabel: "VII events landing controls", title: defaultEventLandingPresentation.title,
      summary: defaultEventLandingPresentation.description, body: "", slug: "events", imageAlt: defaultEventLandingPresentation.heroImages[0].alt,
      indexable: true, attributes: eventLandingSourceAttributes() },
    ...managedWorldLandingTypes.map((type) => {
      const presentation = defaultWorldLandingPresentations[type];
      return { type, key: "landing", world: type === "attractions" || type === "trails" ? "activities" : type, locale, sourceLabel: "VII world landing controls",
        title: presentation.title, summary: presentation.description, body: "", slug: type, imageAlt: presentation.heroImages[0].alt,
        indexable: true, attributes: worldLandingSourceAttributes(type) } satisfies ContentSource;
    }),
    ...vacations.map((row) => source("vacation", "vacation", row, String(numeric(row.supplierId) || text(row.slug).replace(/^vacation-/, "")), "Sergey API", locale)),
    ...events.map((row) => source("events", "events", row, String(numeric(row.supplierId) || text(row.slug).replace(/^event-/, "")), "Sergey API", locale)),
    ...rooms.map((row) => source("hourly", "hourly", row, text(row.id) || String(numeric(row.supplierId)), "Sergey Rooms API", locale)),
    ...spas.map((row) => source("spa", "spa", row, String(numeric(row.id)), "Gal / Spa Plus API", locale)),
    ...providerProfiles.map((row) => source("providers", "providers", row as unknown as UnknownRow, row.id, row.sourceName || "VII verified catalog", locale)),
    ...paidAttractions.map((row) => source("attractions", "activities", row as unknown as UnknownRow, row.id, row.sourceName || "VII verified catalog", locale)),
    ...trails.map((row) => source("trails", "activities", row as unknown as UnknownRow, row.slug, row.sourceName, locale)),
    ...magazineArticles.map((row) => source("magazine", "magazine", row as unknown as UnknownRow, row.slug, "VII editorial", locale)),
  ];
  const primaryLinks = publicWorldNavigation.map((row, index) => managedLink(String(row.id), row.shortLabel, row.href, "עולמות", index + 1));
  const secondaryLinks = [
    managedLink("gift-card", "גיפט קארד", "/gift-card", "עוד באתר", 1), managedLink("destinations", "יעדים", "/destinations", "עוד באתר", 2),
    managedLink("guides", "מגזין ומדריכים", "/guides", "עוד באתר", 3), managedLink("questions", "שאלות ותשובות", "/questions", "עוד באתר", 4),
    managedLink("accessibility", "הצהרת נגישות", "/accessibility", "עוד באתר", 5),
  ];
  const worldLinks = Object.entries(worldFooterContexts).flatMap(([world, context], worldIndex) => context.links.map((row, index) =>
    managedLink(`${world}-${index + 1}`, row.label, row.href, context.label, worldIndex * 100 + index + 1)));
  const footerWorldLinks = publicWorldNavigation.map((row, index) => managedLink(String(row.id), row.shortLabel, row.href, "העולמות שלנו", index + 1));
  const serviceLinks = [
    managedLink("account", "החשבון האישי שלי", "/account", "מידע ושירות", 1), managedLink("favorites", "המקומות שאהבתי", "/favorites", "מידע ושירות", 2),
    managedLink("booking", "ניהול הזמנה", "/booking?action=manage", "מידע ושירות", 3), managedLink("guides", "מגזין ומדריכים", "/guides", "מידע ושירות", 4),
    managedLink("terms", "תקנון האתר", "/legal/terms", "מידע ושירות", 5), managedLink("privacy", "מדיניות פרטיות", "/legal/privacy", "מידע ושירות", 6),
  ];
  sources.push(
    { type: "navigation", key: "primary", world: "global", locale, sourceLabel: "VII canonical navigation", title: "תפריט עולמות", links: primaryLinks },
    { type: "navigation", key: "secondary", world: "global", locale, sourceLabel: "VII canonical navigation", title: "תפריט משני והמבורגר", links: secondaryLinks },
    { type: "footer", key: "contextual", world: "global", locale, sourceLabel: "VII contextual footer", title: "קישורים הקשריים בפוטר", links: worldLinks },
    { type: "footer", key: "worlds", world: "global", locale, sourceLabel: "VII canonical navigation", title: "העולמות שלנו בפוטר", links: footerWorldLinks },
    { type: "footer", key: "service", world: "global", locale, sourceLabel: "VII service footer", title: "מידע ושירות בפוטר", links: serviceLinks },
  );
  return sources.filter((item) => item.key && /^[A-Za-z0-9._-]+$/.test(item.key));
}

export function publicContentPath(type: ContentType, key: string) {
  if (type === "homepage") return "/";
  if (type === "holiday") return `/holidays/${key}`;
  if (type === "vacation") return `/business?id=vacation-${key}`;
  if (type === "events") return key === "landing" ? "/events" : `/events/place?id=event-${key}`;
  if (key === "landing" && type === "spa") return "/spas";
  if (key === "landing" && (type === "hourly" || type === "providers" || type === "attractions" || type === "trails")) return `/${type}`;
  if (type === "hourly" || type === "spa" || type === "providers" || type === "attractions") return `/discover/place/${type === "spa" ? `spa-${key}` : key}`;
  if (type === "trails") return `/trails/${key}`;
  if (type === "magazine") return `/guides/${key}`;
  return "/";
}
