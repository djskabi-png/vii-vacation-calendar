import { readSession } from "../../../lib/google-auth.ts";
import { opportunityDatabase, readOpportunityDashboard } from "../../../lib/search-opportunities.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const session = await readSession(request).catch(() => null);
  const allowed = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase());
  if (!session || !allowed.includes(session.email.toLowerCase())) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const report = await readOpportunityDashboard(await opportunityDatabase(), 30);
    const queue = report.opportunities.filter((item) => ["pending", "draft", "review", "scheduled"].includes(item.status)).map((item) => ({
      id: item.id, path: item.canonicalPath || item.proposedPath, title: item.title || item.suggestedTitle,
      world: item.world, location: item.location, searches: item.searches, uniqueSessions: item.uniqueSessions,
      results: item.latestResultCount, readiness: item.readiness, priority: item.priority, status: item.status,
    }));
    return Response.json({ periodDays: 30, queue, generatedAt: report.generatedAt }, { headers });
  } catch (error) {
    console.error("VII content queue unavailable", error);
    return Response.json({ error: "content_queue_unavailable" }, { status: 503, headers });
  }
}
