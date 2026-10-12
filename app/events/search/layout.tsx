import type { ReactNode } from "react";
import { publicCatalogSummaries } from "../../lib/public-catalog-read.ts";
import { PublishedCatalogSeed } from "../../lib/published-catalog-seed";
import type { EventPlace } from "../../data/site-data";

export default async function EventSearchLayout({ children }: { children: ReactNode }) {
  const entries = await publicCatalogSummaries<EventPlace>("events");
  return <PublishedCatalogSeed world="events" entries={entries}>{children}</PublishedCatalogSeed>;
}
