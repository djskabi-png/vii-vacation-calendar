import { sitemapInventory, sitemapSectionOrder, type SitemapSection } from "./sitemap-inventory.ts";
import { renderUrlSet, SITEMAP_PAGE_SIZE, sitemapPage, sitemapPageCount, type SitemapUrlEntry } from "./sitemap-xml.ts";

export const GOOGLE_SITEMAP_MAX_URLS = 50_000;
export const GOOGLE_SITEMAP_MAX_BYTES = 50 * 1024 * 1024;

function localeOf(url: string) {
  const path = new URL(url).pathname;
  if (path === "/en" || path.startsWith("/en/")) return "en";
  if (path === "/ru" || path.startsWith("/ru/")) return "ru";
  if (path === "/fr" || path.startsWith("/fr/")) return "fr";
  return "he-IL";
}

function unlocalizedPath(url: string) {
  return new URL(url).pathname.replace(/^\/(?:en|ru|fr)(?=\/|$)/, "") || "/";
}

export function sitemapEntryKind(section: SitemapSection, entry: SitemapUrlEntry) {
  const path = unlocalizedPath(entry.url);
  if (section === "core") {
    if (path === "/") return "home";
    if (path.startsWith("/join")) return "join";
    if (path.startsWith("/legal/") || path === "/accessibility") return "legal-accessibility";
    return "information-services";
  }
  if (section === "vacations") {
    if (path === "/search") return "vacation-search";
    if (path === "/business") return "place-pages";
    return "region-type-landings";
  }
  if (section === "holidays") return "holiday-worlds";
  if (section === "events") {
    if (path.startsWith("/events/place/")) return "place-pages";
    if (path.startsWith("/events/search")) return "search-region-pages";
    return "events-world";
  }
  if (section === "spas") {
    if (path.startsWith("/discover/place/")) return "spa-place-pages";
    if (path === "/spas") return "spa-world";
    return "landing-search-pages";
  }
  if (section === "hourly") {
    if (path.startsWith("/discover/place/")) return "place-pages";
    if (path === "/hourly") return "hourly-world";
    return "regional-search-pages";
  }
  if (section === "discovery") {
    if (path.startsWith("/guides/")) return "guides-articles";
    if (path.startsWith("/trails/")) return "trails";
    if (path.startsWith("/discover/place/")) return "attractions-providers";
    return "world-content-pages";
  }
  return "published-demand-pages";
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "he"));
}

export function buildSitemapAdminReport(inventory: Partial<Record<SitemapSection, SitemapUrlEntry[]>>) {
  const sections = sitemapSectionOrder.map((section) => {
    const entries = inventory[section] || [];
    const fileDetails = Array.from({ length: entries.length ? sitemapPageCount(entries.length) : 0 }, (_, index) => {
      const page = index + 1;
      const pageEntries = sitemapPage(entries, page);
      const bytes = new TextEncoder().encode(renderUrlSet(pageEntries)).byteLength;
      return {
        page,
        url: `/sitemaps/${section}/${page}.xml`,
        urls: pageEntries.length,
        bytes,
        imageReferences: pageEntries.reduce((sum, entry) => sum + new Set(entry.images || []).size, 0),
        alternateLinks: pageEntries.reduce((sum, entry) => sum + Object.keys(entry.languages || {}).length, 0),
        languages: countBy(pageEntries.map((entry) => localeOf(entry.url))),
        contents: countBy(pageEntries.map((entry) => sitemapEntryKind(section, entry))),
        samples: pageEntries.slice(0, 4).map((entry) => entry.url),
        limits: {
          viiUrlPercent: Number(((pageEntries.length / SITEMAP_PAGE_SIZE) * 100).toFixed(1)),
          googleUrlPercent: Number(((pageEntries.length / GOOGLE_SITEMAP_MAX_URLS) * 100).toFixed(1)),
          googleBytePercent: Number(((bytes / GOOGLE_SITEMAP_MAX_BYTES) * 100).toFixed(1)),
        },
        status: pageEntries.length <= GOOGLE_SITEMAP_MAX_URLS && bytes <= GOOGLE_SITEMAP_MAX_BYTES ? "healthy" as const : "error" as const,
      };
    });
    return {
      section,
      urls: entries.length,
      files: fileDetails.length,
      images: entries.reduce((sum, entry) => sum + new Set(entry.images || []).size, 0),
      fileDetails,
    };
  });
  return {
    healthy: sections.every((section) => section.fileDetails.every((file) => file.status === "healthy")),
    totalUrls: sections.reduce((sum, section) => sum + section.urls, 0),
    totalFiles: sections.reduce((sum, section) => sum + section.files, 0),
    languages: ["he-IL", "en", "ru", "fr"],
    limits: { viiUrlsPerFile: SITEMAP_PAGE_SIZE, googleUrlsPerFile: GOOGLE_SITEMAP_MAX_URLS, googleBytesPerFile: GOOGLE_SITEMAP_MAX_BYTES },
    sections,
    generatedAt: new Date().toISOString(),
  };
}

export async function sitemapAdminReport() {
  return buildSitemapAdminReport(await sitemapInventory());
}
