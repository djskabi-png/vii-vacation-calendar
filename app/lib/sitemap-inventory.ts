import type { EventPlace, Property } from "../data/site-data.ts";
import type { SpaPlusSite } from "../data/spaplus.ts";
import type { SitemapUrlEntry } from "./sitemap-xml.ts";
import { activityDepthTopics, trailDepthTopics } from "./world-depth-topics.ts";
import { activityMatchesTopic } from "./activity-discovery-taxonomy.ts";
import { runtimeDatabase } from "./runtime-database.ts";
import { readWorldAvailability, worldForPath } from "./world-availability.ts";

export const sitemapSectionOrder = ["core", "holidays", "vacations", "events", "spas", "hourly", "discovery", "search-pages"] as const;
export type SitemapSection = (typeof sitemapSectionOrder)[number];
const locales = ["he", "en", "ru", "fr"] as const;
const SITE_URL = "https://vii.spaplus.co";

function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`; const [pathname, query] = normalized.split("?", 2);
  const canonicalPath = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  return `${SITE_URL}${canonicalPath}${query ? `?${query}` : ""}`;
}

function localizedPath(path: string, locale: typeof locales[number]) {
  const normalized = path === "/" ? "" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return locale === "he" ? normalized || "/" : `/${locale}${normalized}`;
}

export function localizedEntries(path: string, images?: string[]): SitemapUrlEntry[] {
  const languages = { "he-IL": absoluteUrl(localizedPath(path, "he")), en: absoluteUrl(localizedPath(path, "en")), ru: absoluteUrl(localizedPath(path, "ru")), fr: absoluteUrl(localizedPath(path, "fr")), "x-default": absoluteUrl(localizedPath(path, "he")) };
  const sitemapImages = [...new Set(images || [])].slice(0, 10).map(absoluteUrl);
  return locales.map((locale) => ({ url: absoluteUrl(localizedPath(path, locale)), languages, ...(sitemapImages.length ? { images: sitemapImages } : {}) }));
}

function unique(entries: SitemapUrlEntry[]) {
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()].sort((left, right) => left.url.localeCompare(right.url));
}

export async function sitemapSection(section: SitemapSection): Promise<SitemapUrlEntry[]> {
  const availability = await readWorldAvailability();
  const expand = (rows: Array<{ path: string; images?: string[] }>) => rows.flatMap((row) => localizedEntries(row.path, row.images));
  if (section === "core") { const { joinWorlds } = await import("../join/worlds.ts"); return unique(expand([
      { path: "/" }, { path: "/gift-card" }, { path: "/corporate" }, { path: "/destinations" }, { path: "/questions" }, { path: "/join" },
      ...joinWorlds.map((world) => ({ path: `/join/${world}` })), { path: "/accessibility" }, { path: "/legal/terms" }, { path: "/legal/privacy" }, { path: "/legal/cancellation" },
  ].filter(({ path }) => path !== "/corporate" || availability.corporate))); }
  if (section === "holidays") {
    if (!availability.vacation) return [];
    const [{ getHomeHolidays }, { supplierToken }, { holidayWorldPath, readHolidayWorld }] = await Promise.all([
      import("./vii-home-holidays.ts"), import("./vii-supplier-token.ts"), import("./holiday-world.ts")]);
    const holidays = await getHomeHolidays({ token: await supplierToken() }).catch(() => []);
    let db;
    try { db = await runtimeDatabase(); }
    catch { db = undefined; }
    const worlds = await Promise.all(holidays.map((holiday) => readHolidayWorld(holiday, db)));
    return unique(worlds
      .filter((world) => world.indexable)
      .flatMap((world) => localizedEntries(holidayWorldPath(world.name, world.id))));
  }
  if (section === "vacations") {
    if (!availability.vacation) return [];
    const [{ publicCatalogSummaries }, { indexableAccommodationLandings }, { indexableVacationLandings }] = await Promise.all([
      import("./public-catalog-read.ts"), import("../data/accommodation-landings.ts"), import("../data/vacation-landings.ts")]);
    const properties = await publicCatalogSummaries<Property>("vacations");
    return unique(expand([
      { path: "/search" }, ...indexableAccommodationLandings(properties).map(({ path }) => ({ path })), ...indexableVacationLandings(properties).map(({ path }) => ({ path })),
      ...properties.filter((place) => place.indexable !== false).map((place) => ({ path: `/business?id=${place.slug}`, images: [place.image, ...place.images] })),
    ]));
  }
  if (section === "events") {
    if (!availability.events) return [];
    const [{ publicCatalogSummaries }, { matchesSearchLocation, searchLocationOptions }, { eventSearchHref }] = await Promise.all([
      import("./public-catalog-read.ts"), import("../data/search-taxonomy.ts"), import("../data/world-search-landings.ts")]);
    const eventPlaces = await publicCatalogSummaries<EventPlace>("events");
    return unique(expand([
      { path: "/events" }, { path: "/events/search" },
      ...searchLocationOptions("events").filter((location) => location !== "כל הארץ" && eventPlaces.some((place) => matchesSearchLocation(place, location))).map((location) => ({ path: eventSearchHref(location) })),
      ...eventPlaces.filter((place) => !place.sourcePropertySlug).map((place) => ({ path: `/events/place/${place.slug}`, images: [place.image, ...place.images] })),
    ]));
  }
  if (section === "spas") {
    if (!availability.spa) return [];
    const [{ publicCatalogSummaries }, { spaPlacesFromSites }, { spaLandings, spaLandingHref }, { indexableSpaSearchStates, spaSearchHref }] = await Promise.all([
      import("./public-catalog-read.ts"), import("../data/world-data.ts"), import("../data/spa-landings.ts"), import("../data/spa-search-landings.ts")]);
    const spaSites = await publicCatalogSummaries<SpaPlusSite>("spa");
    const spaPlaces = spaPlacesFromSites(spaSites);
    return unique(expand([
      { path: "/spas" }, ...spaLandings.map((landing) => ({ path: spaLandingHref(landing) })),
      ...Array.from(new Set(indexableSpaSearchStates(spaPlaces).map(spaSearchHref))).map((path) => ({ path })),
      ...spaPlaces.filter((place) => place.indexable !== false).map((place) => ({ path: `/discover/place/${place.id}`, images: place.image ? [place.image] : [] })),
    ]));
  }
  if (section === "hourly") {
    if (!availability.hourly) return [];
    const [{ publicCatalogSummaries }, { hourlyPlacesFromCatalog }, { matchesSearchLocation, searchLocationOptions }, { hourlySearchHref }] = await Promise.all([
      import("./public-catalog-read.ts"), import("../data/world-data.ts"), import("../data/search-taxonomy.ts"), import("../data/world-search-landings.ts")]);
    type HourlyCatalogPlace = Parameters<typeof hourlyPlacesFromCatalog>[0][number];
    const hourlyCatalogPlaces = await publicCatalogSummaries<HourlyCatalogPlace>("rooms");
    const hourlyPlaces = hourlyPlacesFromCatalog(hourlyCatalogPlaces);
    return unique(expand([
      { path: "/hourly" }, ...searchLocationOptions("hourly").filter((location) => location !== "כל הארץ" && hourlyPlaces.some((place) => matchesSearchLocation(place, location))).map((location) => ({ path: hourlySearchHref(location) })),
      ...hourlyPlaces.filter((place) => place.indexable !== false).map((place) => ({ path: `/discover/place/${place.id}`, images: place.image ? [place.image] : [] })),
    ]));
  }
  if (section === "discovery") { const [{ discoveryItems }, { magazineArticles }, { trails }, { managedMagazineArticles }] = await Promise.all([
    import("../data/world-data.ts"), import("../data/magazine-data.ts"), import("../data/trail-data.ts"), import("./managed-public-content.ts")]);
    const articles = await managedMagazineArticles(magazineArticles);
    const articleEntries = articles.filter(article => article.indexable !== false).flatMap(article => article.publishedLocales
      ? [{ url: absoluteUrl(`/guides/${article.slug}`), images: [absoluteUrl(article.image)], lastModified: article.modifiedAt }]
      : localizedEntries(`/guides/${article.slug}`, [article.image]));
    return unique([...expand([
      ...(availability.trails ? [{ path: "/trails" }] : []), ...(availability.attractions ? [{ path: "/attractions" }] : []), { path: "/guides" },
      ...(availability.attractions ? activityDepthTopics.filter(topic => discoveryItems.some(item => item.world === "activities" && item.indexable !== false && activityMatchesTopic(item, topic.params))).map(topic => ({ path: `/attractions/explore/${topic.slug}` })) : []),
      ...(availability.trails ? trailDepthTopics.map(topic => ({ path: `/trails/explore/${topic.slug}` })) : []),
      ...discoveryItems.filter((place) => place.world !== "spa" && place.world !== "hourly" && (place.indexable === true || (place.indexable !== false && place.world === "activities")) && availability[(place.world === "activities" ? "attractions" : place.world) as keyof typeof availability] !== false).map((place) => ({ path: `/discover/place/${place.id}`, images: place.image ? [place.image] : [] })),
      ...(availability.trails ? trails.map((trail) => ({ path: `/trails/${trail.slug}` })) : []),
  ]), ...articleEntries]); }
  const { publishedOpportunityPaths } = await import("./search-opportunities.ts");
  const opportunityPaths = (await publishedOpportunityPaths()).filter(({ path }) => {
    const world = worldForPath(path);
    return !world || availability[world] !== false;
  });
  return unique(opportunityPaths.map(({ path, updatedAt }) => ({ url: absoluteUrl(path), lastModified: updatedAt || undefined })));
}

export async function sitemapManifest() {
  const manifest: Array<{ section: SitemapSection; total: number }> = [];
  for (const section of sitemapSectionOrder) manifest.push({ section, total: (await sitemapSection(section)).length });
  return manifest;
}

export async function sitemapInventory(): Promise<Record<SitemapSection, SitemapUrlEntry[]>> {
  const inventory = {} as Record<SitemapSection, SitemapUrlEntry[]>;
  for (const section of sitemapSectionOrder) inventory[section] = await sitemapSection(section);
  return inventory;
}

