import { normalizeApprovedDiscoveryHref } from "./approved-discovery-hrefs.ts";

// Keep old managed homepage links compatible with the current search contract.
// Do not rewrite other worlds, arbitrary features or explicit pool selections.
export function normalizeHomepageSearchHref(href: string): string {
  if (!/^\/(?:(?:en|fr|ru)\/)?search\/?\?/.test(href)) return href;
  const url = new URL(href, "https://vii.invalid");
  const legacy = url.searchParams.getAll("feature");
  if (legacy.length !== 1 || legacy[0] !== "בריכה") return href;
  url.searchParams.delete("feature");
  if (!url.searchParams.has("pool")) url.searchParams.set("pool", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

const nearbyRoutes: Record<string, string> = { "/search": "/vacations/near-me", "/spas": "/spas/near-me", "/events/search": "/events/near-me", "/hourly": "/hourly/near-me", "/trails": "/trails/near-me", "/attractions": "/attractions/near-me", "/providers": "/providers/near-me" };
const canonicalNearbyRoutes = new Set(Object.values(nearbyRoutes));

function nearbyRouteParts(pathname: string) {
  const locale = pathname.match(/^\/(en|ru|fr)(?=\/)/)?.[0] || "";
  const path = pathname.slice(locale.length).replace(/\/$/, "") || "/";
  const destination = nearbyRoutes[path] || (canonicalNearbyRoutes.has(path) ? path : null);
  return { locale, path, destination };
}

/** Canonicalize only the semantic nearest intent. Other sorting parameters
 * remain transactional and must not be rewritten as content pages. */
export function canonicalNearestNearbyUrl(input: URL): URL | null {
  if (input.searchParams.get("sort") !== "nearest") return null;
  const { locale, destination } = nearbyRouteParts(input.pathname);
  if (!destination) return null;
  const canonical = new URL(input);
  canonical.pathname = `${locale}${destination}`;
  canonical.searchParams.delete("sort");
  return canonical;
}

export function semanticNearbyDestination(href: string): string {
  const url = new URL(href, "https://vii.invalid");
  const canonical = canonicalNearestNearbyUrl(url);
  if (canonical) return `${canonical.pathname}${canonical.search}${canonical.hash}`;
  const { locale, path, destination } = nearbyRouteParts(url.pathname);
  return destination && nearbyRoutes[path] ? `${locale}${destination}${url.search}${url.hash}` : href;
}

export function semanticNearbyPath(pathname: string, mode?: "vacation" | "spa" | "events" | "hourly"): string {
  if (mode) return { vacation: "/vacations/near-me", spa: "/spas/near-me", events: "/events/near-me", hourly: "/hourly/near-me" }[mode];
  const url = new URL(pathname, "https://vii.invalid");
  const { locale, path, destination } = nearbyRouteParts(url.pathname);
  return destination && nearbyRoutes[path] ? `${locale}${destination}` : url.pathname;
}

export function normalizeHomepageItems<T extends { href: string }>(items: T[]): T[] {
  const normalized: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let href=normalizeHomepageSearchHref(item.href);
    if ((item as T & {action?:string}).action === "nearby") {
      // A managed nearby tile is a semantic landing-page entry, not a generic
      // search with a nearest-sort query. Preserve the world-specific SEO path
      // even when older CMS data omitted the sort parameter or carried stale
      // query keys.
      href = semanticNearbyDestination(href);
    }
    const approvedHref = normalizeApprovedDiscoveryHref(href);
    if (approvedHref && !seen.has(approvedHref)) {
      seen.add(approvedHref);
      normalized.push({...item,href:approvedHref});
    }
  }
  return normalized;
}

export function isManagedSearchListAttribute(key: string) {
  return /^homePopularSearches(?:Spa|Events|Hourly|Providers|Trails|Attractions|Corporate)?$/.test(key)
    || ["homeCitySearches", "homeTypeSearches"].includes(key);
}
export function validManagedSearchList(value: string) {
  if (value.length > 24_000) return false;
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows) || rows.length > 40) return false;
    const ids = new Set<string>();
    return rows.every(row => {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || ids.has(row.id)) return false;
      ids.add(row.id);
      return typeof row.label === "string" && row.label.trim().length > 0 && row.label.length <= 70
        && typeof row.href === "string" && row.href.length <= 240 && /^\/(?!\/)/.test(row.href) && !/[\\\u0000-\u001f]/.test(row.href)
        && normalizeApprovedDiscoveryHref(normalizeHomepageSearchHref(row.href)) !== null
        && typeof row.image === "string" && row.image.length <= 300 && /^\/(?!\/)/.test(row.image)
        && (row.action === undefined || row.action === "" || row.action === "nearby");
    });
  } catch { return false; }
}
