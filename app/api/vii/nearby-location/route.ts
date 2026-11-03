import { geographyDatabase, readGeography } from "../../../lib/geography-admin.ts";
import { cloudflareRequestCoordinates, nearestSearchResolution } from "../../../lib/nearby-search-location.ts";
import { requiredRuntimeDatabase } from "../../../lib/runtime-database.ts";
import type { PublicGeographyNode } from "../../../lib/geography-search.ts";

const noStore = { "Cache-Control": "private, no-store" };

export async function nearbyLocationResponse(request: Request) {
  const coordinates = cloudflareRequestCoordinates(request);
  let nodes: PublicGeographyNode[] = [];
  if (coordinates) {
    try {
      const database = await requiredRuntimeDatabase("geography_database_unavailable");
      const geography = await readGeography(await geographyDatabase(database), true);
      nodes = geography.map((node) => ({
        key: node.key,
        level: node.level,
        parentKey: node.parentKey,
        title: node.effectiveTitle,
        titleEn: node.effectiveTitleEn,
        slug: node.slug,
        featured: node.featured,
        gpsLat: node.gpsLat,
        gpsLong: node.gpsLong,
        unassigned: node.unassigned,
      }));
    } catch { /* A bounded regional fallback remains available without the managed database. */ }
  }
  const resolution = coordinates ? nearestSearchResolution(coordinates.latitude, coordinates.longitude, nodes) : null;
  return resolution
    ? Response.json({ location: resolution.location, precision: resolution.precision }, { headers: noStore })
    : Response.json({ error: "location_unavailable" }, { status: 503, headers: noStore });
}

export async function GET(request: Request) {
  return nearbyLocationResponse(request);
}
