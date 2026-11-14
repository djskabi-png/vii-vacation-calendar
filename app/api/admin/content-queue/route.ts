import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { opportunityDatabase, readOpportunityDashboard } from "../../../lib/search-opportunities.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const report = await readOpportunityDashboard(await opportunityDatabase(), 30);
    const queue = report.opportunities.filter((item) => !item.internalOnly && ["pending", "draft", "review", "scheduled"].includes(item.status)).map((item) => {
      const existing = Boolean(item.existingApproved);
      const pageKind = existing ? "existing_enrichment" : item.origin === "managed" ? "legacy_redirect" : "new_proposal";
      const publicPath = existing ? item.existingApprovedPath || item.canonicalPath : null;
      const targetPath = item.canonicalPath || item.proposedPath;
      return {
      id: item.id, path: targetPath, title: item.title || item.suggestedTitle,
      world: item.world, location: item.location, searches: item.searches, uniqueSessions: item.uniqueSessions,
      results: item.latestResultCount, readiness: item.readiness, priority: item.priority, status: item.status,
      firstSeenAt: item.firstSeenAt, lastSeenAt: item.lastSeenAt, pageKind, publicPath,
      sourcePath: item.sourcePath, targetPath, editHref: `/admin/search-pages?id=${encodeURIComponent(item.id)}`,
      nextAction: existing ? "העמקת התוכן בעמוד הפעיל" : pageKind === "legacy_redirect" ? "אימות יעד והפניית 301" : "השלמת תוכן ואישור לפרסום",
      publicationState: existing ? "live" : item.status === "scheduled" ? "scheduled" : "not_live",
      sitemapState: existing ? "listed" : "pending_publication",
      redirectState: pageKind === "legacy_redirect" ? "requires_verification" : "not_applicable",
    }});
    return Response.json({ periodDays: 30, queue, generatedAt: report.generatedAt }, { headers });
  } catch (error) {
    console.error("VII content queue unavailable", error);
    return Response.json({ error: "content_queue_unavailable" }, { status: 503, headers });
  }
}
