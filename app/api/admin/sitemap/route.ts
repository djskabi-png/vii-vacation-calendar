import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { sitemapAdminReport } from "../../../lib/sitemap-report.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    return Response.json(await sitemapAdminReport(), { headers });
  } catch (error) {
    console.error("VII sitemap status unavailable", error);
    return Response.json({ error: "sitemap_status_unavailable" }, { status: 503, headers });
  }
}
