const regionalVacationSlugs = new Set(["north", "kinneret", "western-galilee", "haifa-carmel", "center", "tel-aviv", "tel-aviv-area", "jerusalem", "dead-sea", "south-negev", "eilat"]);

/** Starts the same request-local vacation catalog read used by regional pages.
 * It is deliberately fire-and-forget: layout availability and disabled-world
 * redirects remain authoritative and are never delayed or bypassed by this hint. */
export function regionalVacationPreloadPath(pathname: string, isAdmin: boolean): string | null {
  if (isAdmin) return null;
  const match = /^\/vacations\/([^/?#]+)$/.exec(pathname);
  return match && regionalVacationSlugs.has(match[1]) ? match[0] : null;
}

export function preloadRegionalVacationCatalog(pathname: string, isAdmin: boolean, freshClientNavigation = false): void {
  // Only a sanitized fresh-client hint skips the read. Ordinary Flight and
  // HTML retain their complete server seed and failure behavior.
  if (freshClientNavigation) return;
  if (!regionalVacationPreloadPath(pathname, isAdmin)) return;
  // Keep the catalog reader out of the root layout's eager dependency graph.
  // It owns the request-local read key, so the child consumes the same promise.
  void import("./public-catalog-read.ts").then(({ publicCatalogSummaries }) => publicCatalogSummaries("vacations")).catch(() => undefined);
}
