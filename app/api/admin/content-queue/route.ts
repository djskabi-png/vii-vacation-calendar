import { readSession } from "../../../lib/google-auth.ts";
import { searchAnalyticsDatabase } from "../../../lib/search-analytics.ts";
import { searchPageDatabase, searchPageDefinitions, searchPageInventory } from "../../../lib/search-page-content.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const session = await readSession(request).catch(() => null);
  const allowed = (process.env.VII_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase());
  if (!session || !allowed.includes(session.email.toLowerCase())) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const analytics = await searchAnalyticsDatabase();
    const content = await searchPageDatabase();
    const [signals, inventory] = await Promise.all([
      analytics.prepare("SELECT world, location, COUNT(*) AS count FROM vii_search_events WHERE created_at >= ? AND internal = 0 AND location NOT IN ('כל הארץ', 'אחר') GROUP BY world, location ORDER BY count DESC LIMIT 50").bind(new Date(Date.now() - 30 * 86400_000).toISOString()).all<{ world: string; location: string; count: number }>(),
      searchPageInventory(content),
    ]);
    const worldMap: Record<string, string> = { events: "events", hourly: "hourly", spa: "spa" };
    const queue = signals.results.flatMap((signal) => {
      const world = worldMap[signal.world];
      const page = inventory.find((entry) => entry.world === world && entry.title.includes(signal.location));
      if (!page || page.override?.status === "published") return [];
      return [{ path: page.path, title: page.override?.title || page.title, world: signal.world, location: signal.location, searches: signal.count, status: page.override?.status || "needs_review" }];
    });
    return Response.json({ periodDays: 30, queue, generatedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    console.error("VII content queue unavailable", error);
    return Response.json({ error: "content_queue_unavailable" }, { status: 503, headers });
  }
}
