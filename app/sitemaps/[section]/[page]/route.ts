import { sitemapSection, sitemapSectionOrder, type SitemapSection } from "../../../lib/sitemap-inventory.ts";
import { renderUrlSet, sitemapPage, sitemapPageCount } from "../../../lib/sitemap-xml.ts";

export const dynamic = "force-dynamic";
const headers = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" };
type Props = { params: Promise<{ section: string; page: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { section, page: rawPage } = await params;
  if (!sitemapSectionOrder.includes(section as SitemapSection) || !/^\d+\.xml$/.test(rawPage)) return new Response("Not found", { status: 404 });
  const page = Number(rawPage.replace(/\.xml$/, ""));
  const entries = await sitemapSection(section as SitemapSection);
  if (!Number.isSafeInteger(page) || page < 1 || page > sitemapPageCount(entries.length) || !entries.length) return new Response("Not found", { status: 404 });
  return new Response(renderUrlSet(sitemapPage(entries, page)), { headers });
}

