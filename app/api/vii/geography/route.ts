import { geographyDatabase, readGeography } from "../../../lib/geography-admin.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";

export async function GET() {
  try {
    const runtime = await import("cloudflare:workers");
    const database = (runtime.env as unknown as { DB?: D1Database }).DB;
    if (!database) throw new Error("geography_database_unavailable");
    const nodes = await readGeography(await geographyDatabase(database), true);
    return Response.json({
      generatedAt: new Date().toISOString(),
      nodes: nodes.map((node) => ({ key: node.key, level: node.level, parentKey: node.parentKey,
        title: node.effectiveTitle, titleEn: node.effectiveTitleEn, slug: node.slug, featured: node.featured,
        gpsLat: node.gpsLat, gpsLong: node.gpsLong, unassigned: node.unassigned })),
    }, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ nodes: [] }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  }
}
