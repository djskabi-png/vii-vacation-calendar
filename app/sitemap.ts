import type { MetadataRoute } from "next";
import { eventPlaces, properties } from "./data/site-data";
import { discoveryItems } from "./data/world-data";
import { magazineArticles } from "./data/magazine-data";
import { trails } from "./data/trail-data";
import { absoluteUrl } from "./lib/seo";
import { indexableAccommodationLandings } from "./data/accommodation-landings";

const updated = new Date("2026-08-06T00:00:00+03:00");

function item(path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly", images?: string[]): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    lastModified: updated,
    changeFrequency,
    priority,
    ...(images?.length ? { images: Array.from(new Set(images)).map(absoluteUrl) } : {}),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    item("/", 1, "daily"),
    item("/search/", 0.9, "daily"),
    item("/events/", 0.9, "weekly"),
    item("/events/search/", 0.8, "daily"),
    item("/spas/", 0.8),
    item("/hourly/", 0.8),
    item("/activities/", 0.8),
    item("/trails/", 0.8),
    item("/attractions/", 0.8),
    item("/gift-card/", 0.85, "weekly"),
    item("/corporate/", 0.85, "weekly"),
    item("/guides/", 0.8),
    item("/destinations/", 0.8),
    item("/questions/", 0.8),
    item("/join/", 0.4, "monthly"),
    item("/accessibility/", 0.3, "yearly"),
    item("/legal/terms/", 0.2, "yearly"),
    item("/legal/privacy/", 0.2, "yearly"),
    item("/legal/cancellation/", 0.2, "yearly"),
  ];

  return [
    ...staticPages,
    ...indexableAccommodationLandings().map(({ path }) => item(path, 0.88, "weekly")),
    ...properties.map((place) => item(`/business?id=${place.slug}`, 0.9, "weekly", [place.image, ...place.images])),
    ...eventPlaces.filter((place) => !place.sourcePropertySlug).map((place) => item(`/events/place?id=${place.slug}`, 0.85, "weekly", [place.image, ...place.images])),
    ...discoveryItems.filter((place) => place.indexable === true || (place.indexable !== false && (place.world === "spa" || place.world === "hourly" || place.world === "activities"))).map((place) => item(`/discover/place?id=${place.id}`, 0.7, "weekly", place.image ? [place.image] : undefined)),
    ...magazineArticles.map((article) => item(`/guides/${article.slug}/`, 0.75, "monthly", [article.image])),
    ...trails.map((trail) => item(`/trails/${trail.slug}/`, 0.75, "monthly")),
  ];
}
