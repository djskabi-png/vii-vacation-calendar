import { readSession } from "../../../lib/google-auth.ts";
import { isAdminEmail } from "../../../lib/admin-access.ts";
import { sitemapAdminReport } from "../../../lib/sitemap-report.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const session = await readSession(request).catch(() => null);
  if (!session || !isAdminEmail(session.email)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    return Response.json(await sitemapAdminReport(), { headers });
  } catch (error) {
    console.error("VII sitemap status unavailable", error);
    return Response.json({ error: "sitemap_status_unavailable" }, { status: 503, headers });
  }
}
