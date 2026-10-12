import type { ReactNode } from "react";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import { PublishedCatalogSeed } from "../lib/published-catalog-seed";
import type { Property } from "../data/site-data";

export default async function SearchLayout({ children }: { children: ReactNode }) {
  const entries = await publicCatalogSummaries<Property>("vacations");
  return <PublishedCatalogSeed world="vacations" entries={entries}>{children}</PublishedCatalogSeed>;
}
