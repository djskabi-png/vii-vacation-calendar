export const SITEMAP_PAGE_SIZE = 10_000;

export type SitemapUrlEntry = {
  url: string;
  images?: string[];
  languages?: Record<string, string>;
  lastModified?: string | null;
};

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function sitemapPageCount(total: number) {
  return Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
}

export function sitemapPage(entries: SitemapUrlEntry[], page: number) {
  const start = (page - 1) * SITEMAP_PAGE_SIZE;
  return entries.slice(start, start + SITEMAP_PAGE_SIZE);
}

export function renderSitemapIndex(urls: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <sitemap><loc>${xml(url)}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
}

export function renderUrlSet(entries: SitemapUrlEntry[]) {
  const hasImages = entries.some((entry) => entry.images?.length);
  const hasLanguages = entries.some((entry) => entry.languages && Object.keys(entry.languages).length);
  const namespaces = [`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`, hasImages ? `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` : "", hasLanguages ? `xmlns:xhtml="http://www.w3.org/1999/xhtml"` : ""].filter(Boolean).join(" ");
  const rows = entries.map((entry) => {
    const languages = Object.entries(entry.languages || {}).map(([language, href]) => `    <xhtml:link rel="alternate" hreflang="${xml(language)}" href="${xml(href)}" />`).join("\n");
    const images = [...new Set(entry.images || [])].map((image) => `    <image:image><image:loc>${xml(image)}</image:loc></image:image>`).join("\n");
    const modified = entry.lastModified ? `\n    <lastmod>${xml(entry.lastModified)}</lastmod>` : "";
    return `  <url>\n    <loc>${xml(entry.url)}</loc>${languages ? `\n${languages}` : ""}${images ? `\n${images}` : ""}${modified}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${namespaces}>\n${rows.join("\n")}\n</urlset>\n`;
}

