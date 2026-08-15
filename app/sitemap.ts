import type { MetadataRoute } from "next";
import { eventPlaces, properties } from "./data/site-data";
import { discoveryItems, spaPlaces } from "./data/world-data";
import { magazineArticles } from "./data/magazine-data";
import { trails } from "./data/trail-data";
import { absoluteUrl } from "./lib/seo";
import { indexableAccommodationLandings } from "./data/accommodation-landings";
import { indexableVacationLandings } from "./data/vacation-landings";
import { joinWorlds } from "./join/worlds";
import { spaLandings, spaLandingHref } from "./data/spa-landings";
import { indexableSpaSearchStates, spaSearchHref } from "./data/spa-search-landings";
import { matchesSearchLocation, searchLocationOptions } from "./data/search-taxonomy";
import { eventSearchHref, hourlySearchHref } from "./data/world-search-landings";

/**
 * Every indexable page has one canonical Hebrew URL and reciprocal language
 * alternatives. Keeping the alternate cluster in the sitemap makes the
 * language relationship discoverable without adding duplicate canonical URLs.
 *
 * We intentionally omit `lastModified` here. The catalog does not yet expose
 * a verified per-record edit timestamp, and an invented shared timestamp is a
 * less reliable crawl signal than no timestamp at all.
 */
function languageAlternates(path: string) {
  const canonical = absoluteUrl(path);
  const normalizedPath = path === "/" ? "" : path.replace(/\/$/, "");
  return {
    languages: {
      "he-IL": canonical,
      en: absoluteUrl(`/en${normalizedPath}` || "/en"),
      ru: absoluteUrl(`/ru${normalizedPath}` || "/ru"),
      fr: absoluteUrl(`/fr${normalizedPath}` || "/fr"),
      "x-default": canonical,
    },
  };
}

function item(path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly", images?: string[]): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    changeFrequency,
    priority,
    alternates: languageAlternates(path),
    ...(images?.length ? { images: Array.from(new Set(images)).map(absoluteUrl) } : {}),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    item("/", 1, "daily"),
    item("/search/", 0.9, "daily"),
    item("/events/", 0.9, "weekly"),
    item("/events/search/", 0.8, "daily"),
    ...searchLocationOptions("events").filter((location) => location !== "כל הארץ" && eventPlaces.some((place) => matchesSearchLocation(place, location))).map((location) => item(eventSearchHref(location), 0.82, "weekly")),
    item("/spas/", 0.8),
    ...spaLandings.map((landing) => item(spaLandingHref(landing), 0.82, "weekly")),
    ...Array.from(new Set(indexableSpaSearchStates(spaPlaces).map(spaSearchHref))).map((path) => item(path, 0.84, "weekly")),
    item("/hourly/", 0.8),
    ...searchLocationOptions("hourly").filter((location) => location !== "כל הארץ" && discoveryItems.filter((place) => place.world === "hourly").some((place) => matchesSearchLocation(place, location))).map((location) => item(hourlySearchHref(location), 0.82, "weekly")),
    item("/trails/", 0.8),
    item("/attractions/", 0.8),
    item("/gift-card/", 0.85, "weekly"),
    item("/corporate/", 0.85, "weekly"),
    item("/guides/", 0.8),
    item("/destinations/", 0.8),
    item("/questions/", 0.8),
    item("/join/", 0.4, "monthly"),
    ...joinWorlds.map((world) => item(`/join/${world}/`, 0.35, "monthly")),
    item("/accessibility/", 0.3, "yearly"),
    item("/legal/terms/", 0.2, "yearly"),
    item("/legal/privacy/", 0.2, "yearly"),
    item("/legal/cancellation/", 0.2, "yearly"),
  ];

  return [
    ...staticPages,
    ...indexableAccommodationLandings().map(({ path }) => item(path, 0.88, "weekly")),
    ...indexableVacationLandings().map(({ path }) => item(path, 0.9, "daily")),
    ...properties.filter((place) => place.indexable !== false).map((place) => item(`/business?id=${place.slug}`, 0.9, "weekly", [place.image, ...place.images])),
    ...eventPlaces.filter((place) => !place.sourcePropertySlug).map((place) => item(`/events/place/${place.slug}`, 0.85, "weekly", [place.image, ...place.images])),
    ...discoveryItems.filter((place) => place.indexable === true || (place.indexable !== false && (place.world === "spa" || place.world === "hourly" || place.world === "activities"))).map((place) => item(`/discover/place/${place.id}`, 0.7, "weekly", place.image ? [place.image] : undefined)),
    ...magazineArticles.map((article) => item(`/guides/${article.slug}/`, 0.75, "monthly", [article.image])),
    ...trails.map((trail) => item(`/trails/${trail.slug}/`, 0.75, "monthly")),
  ];
}
