import { geographyDatabase, readGeography } from "../../../lib/geography-admin.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "../../../lib/runtime-database.ts";

export async function GET() {
  try {
    const database = await requiredRuntimeDatabase("geography_database_unavailable");
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
