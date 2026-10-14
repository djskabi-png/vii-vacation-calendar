import type { EventPlace, Property } from "../data/site-data";
import { discoveryItems, hourlyPlacesFromCatalog, spaPlacesFromSites } from "../data/world-data";
import type { SpaPlusSite } from "../data/spaplus";
import hourlyCatalog from "../data/sergey-hourly-catalog.json";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import { magazineArticles } from "../data/magazine-data";
import { trails } from "../data/trail-data";
import { absoluteUrl } from "./seo";
import { indexableAccommodationLandings } from "../data/accommodation-landings";
import { indexableVacationLandings } from "../data/vacation-landings";
import { joinWorlds } from "../join/worlds";
import { spaLandings, spaLandingHref } from "../data/spa-landings";
import { indexableSpaSearchStates, spaSearchHref } from "../data/spa-search-landings";
import { matchesSearchLocation, searchLocationOptions } from "../data/search-taxonomy";
import { eventSearchHref, hourlySearchHref } from "../data/world-search-landings";
import { publishedOpportunityPaths } from "./search-opportunities.ts";
import type { SitemapUrlEntry } from "./sitemap-xml.ts";

export const sitemapSectionOrder = ["core", "vacations", "events", "spas", "hourly", "discovery", "search-pages"] as const;
export type SitemapSection = (typeof sitemapSectionOrder)[number];
const locales = ["he", "en", "ru", "fr"] as const;

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
  const expand = (rows: Array<{ path: string; images?: string[] }>) => rows.flatMap((row) => localizedEntries(row.path, row.images));
  if (section === "core") return unique(expand([
      { path: "/" }, { path: "/gift-card" }, { path: "/corporate" }, { path: "/destinations" }, { path: "/questions" }, { path: "/join" },
      ...joinWorlds.map((world) => ({ path: `/join/${world}` })), { path: "/accessibility" }, { path: "/legal/terms" }, { path: "/legal/privacy" }, { path: "/legal/cancellation" },
  ]));
  if (section === "vacations") {
    const properties = await publicCatalogSummaries<Property>("vacations");
    return unique(expand([
      { path: "/search" }, ...indexableAccommodationLandings(properties).map(({ path }) => ({ path })), ...indexableVacationLandings(properties).map(({ path }) => ({ path })),
      ...properties.filter((place) => place.indexable !== false).map((place) => ({ path: `/business?id=${place.slug}`, images: [place.image, ...place.images] })),
    ]));
  }
  if (section === "events") {
    const eventPlaces = await publicCatalogSummaries<EventPlace>("events");
    return unique(expand([
      { path: "/events" }, { path: "/events/search" },
      ...searchLocationOptions("events").filter((location) => location !== "כל הארץ" && eventPlaces.some((place) => matchesSearchLocation(place, location))).map((location) => ({ path: eventSearchHref(location) })),
      ...eventPlaces.filter((place) => !place.sourcePropertySlug).map((place) => ({ path: `/events/place/${place.slug}`, images: [place.image, ...place.images] })),
    ]));
  }
  if (section === "spas") {
    const spaSites = await publicCatalogSummaries<SpaPlusSite>("spa");
    const spaPlaces = spaPlacesFromSites(spaSites);
    return unique(expand([
      { path: "/spas" }, ...spaLandings.map((landing) => ({ path: spaLandingHref(landing) })),
      ...Array.from(new Set(indexableSpaSearchStates(spaPlaces).map(spaSearchHref))).map((path) => ({ path })),
      ...spaPlaces.filter((place) => place.indexable !== false).map((place) => ({ path: `/discover/place/${place.id}`, images: place.image ? [place.image] : [] })),
    ]));
  }
  if (section === "hourly") {
    const hourlyCatalogPlaces = await publicCatalogSummaries<(typeof hourlyCatalog.places)[number]>("rooms");
    const hourlyPlaces = hourlyPlacesFromCatalog(hourlyCatalogPlaces);
    return unique(expand([
      { path: "/hourly" }, ...searchLocationOptions("hourly").filter((location) => location !== "כל הארץ" && hourlyPlaces.some((place) => matchesSearchLocation(place, location))).map((location) => ({ path: hourlySearchHref(location) })),
      ...hourlyPlaces.filter((place) => place.indexable !== false).map((place) => ({ path: `/discover/place/${place.id}`, images: place.image ? [place.image] : [] })),
    ]));
  }
  if (section === "discovery") return unique(expand([
      { path: "/trails" }, { path: "/attractions" }, { path: "/guides" },
      ...discoveryItems.filter((place) => place.world !== "spa" && place.world !== "hourly" && (place.indexable === true || (place.indexable !== false && place.world === "activities"))).map((place) => ({ path: `/discover/place/${place.id}`, images: place.image ? [place.image] : [] })),
      ...magazineArticles.map((article) => ({ path: `/guides/${article.slug}`, images: [article.image] })), ...trails.map((trail) => ({ path: `/trails/${trail.slug}` })),
  ]));
  const opportunityPaths = await publishedOpportunityPaths();
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

