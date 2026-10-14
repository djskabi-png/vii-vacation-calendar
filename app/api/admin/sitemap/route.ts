import { readSession } from "../../../lib/google-auth.ts";
import { sitemapManifest } from "../../../lib/sitemap-inventory.ts";
import { sitemapPageCount } from "../../../lib/sitemap-xml.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const allowlist = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const session = await readSession(request).catch(() => null);
  if (!session || !allowlist.includes(session.email.toLowerCase())) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const manifest = await sitemapManifest();
    const sections = manifest.map(({ section, total }) => ({ section, urls: total, files: total ? sitemapPageCount(total) : 0 }));
    return Response.json({ healthy: true, totalUrls: sections.reduce((sum, item) => sum + item.urls, 0), totalFiles: sections.reduce((sum, item) => sum + item.files, 0), languages: ["he-IL", "en", "ru", "fr"], sections, generatedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    console.error("VII sitemap status unavailable", error);
    return Response.json({ error: "sitemap_status_unavailable" }, { status: 503, headers });
  }
}
