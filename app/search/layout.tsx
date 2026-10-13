import type { ReactNode } from "react";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import { PublishedCatalogSeed } from "../lib/published-catalog-seed";
import type { Property } from "../data/site-data";
import { publicVacationSearchProperties } from "../lib/public-vacation-search";

export default async function SearchLayout({ children }: { children: ReactNode }) {
  const entries = publicVacationSearchProperties(await publicCatalogSummaries<Property>("vacations"));
  return <PublishedCatalogSeed world="vacations" entries={entries}>{children}</PublishedCatalogSeed>;
}
