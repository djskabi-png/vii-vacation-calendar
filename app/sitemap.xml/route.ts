import { absoluteUrl } from "../lib/seo";
import { sitemapManifest } from "../lib/sitemap-inventory.ts";
import { renderSitemapIndex, sitemapPageCount } from "../lib/sitemap-xml.ts";

export const dynamic = "force-dynamic";
const headers = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" };

export async function GET() {
  const manifest = await sitemapManifest();
  const urls = manifest.flatMap(({ section, total }) => total ? Array.from({ length: sitemapPageCount(total) }, (_, index) => absoluteUrl(`/sitemaps/${section}/${index + 1}.xml`)) : []);
  return new Response(renderSitemapIndex(urls), { headers });
}

