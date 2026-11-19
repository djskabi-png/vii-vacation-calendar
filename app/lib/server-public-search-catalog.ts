import { bundledPublicSearchCatalogSummaries } from "./public-catalog-read.ts";
import { readPublicSearchCatalogSnapshot, type PublicSearchCatalogWorld } from "./public-search-catalog-snapshot.ts";
import { publicCatalogDatabase } from "./runtime-database.ts";
import { readOnceInServerRequest } from "./server-request-reads.ts";

/**
 * Canonical server-side search seed. A complete accepted runtime generation
 * wins; otherwise the immutable accepted search projection is used. The
 * fallback is intentionally a search projection, not a display-card catalog,
 * so hydration cannot add semantic facets that were absent from initial HTML.
 */
export async function serverPublicSearchCatalog<T>(world: PublicSearchCatalogWorld): Promise<T[]> {
  return readOnceInServerRequest(`server-public-search-catalog:${world}`, async () => {
    try {
      const { database } = await publicCatalogDatabase();
      const snapshot = await readPublicSearchCatalogSnapshot(database, world);
      if (snapshot) return snapshot.entries.map((entry) => entry.summary) as T[];
    } catch {
      console.warn(`public_search_catalog_fallback:${world}`);
    }
    return bundledPublicSearchCatalogSummaries<T>(world);
  });
}
