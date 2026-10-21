import type { ReactNode } from "react";
import { publicCatalogSummaries } from "../../lib/public-catalog-read.ts";
import { PublishedCatalogSeed } from "../../lib/published-catalog-seed";
import type { EventPlace } from "../../data/site-data";
import { SearchDepthSeed } from "../../components/search-depth-seed";
import { trails } from "../../data/trail-data";
import { providerProfiles } from "../../data/world-data";
import { publicEventSearchPlaces } from "../../lib/public-event-search";

const searchDepthSeed = {
  trails: trails.map((trail) => ({ slug: trail.slug, name: trail.name, mainArea: trail.mainArea, region: trail.region, areaTags: trail.areaTags, image: `/images/trails/${trail.slug}.jpg`, meta: `${trail.duration} · ${trail.difficulty}` })),
  providers: providerProfiles.filter((item) => item.indexable !== false && item.image).map((item) => ({ id: item.id, name: item.name, location: item.location, area: item.area, serviceAreas: item.serviceAreas || [], image: item.image!, meta: item.features.slice(0, 2).join(" · ") })),
};

export default async function EventSearchLayout({ children }: { children: ReactNode }) {
  const entries = publicEventSearchPlaces(await publicCatalogSummaries<EventPlace>("events"), 1);
  return <SearchDepthSeed value={searchDepthSeed}><PublishedCatalogSeed world="events" entries={entries}>{children}</PublishedCatalogSeed></SearchDepthSeed>;
}
