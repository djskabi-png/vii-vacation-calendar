import { bundledMapSnapshotCandidates } from "../../lib/map-snapshot-catalog.ts";

const allowedWorlds = new Set(["vacation", "events", "spa", "hourly", "activities"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const world = (url.searchParams.get("world") || "").trim().toLowerCase();
  const placeId = (url.searchParams.get("id") || "").trim();
  if (!allowedWorlds.has(world) || !/^[a-z0-9_-]{1,160}$/i.test(placeId)) {
    return Response.json({ error: "map_target_not_found" }, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  }
  const candidate = bundledMapSnapshotCandidates().find((item) => item.world === world && item.placeId === placeId);
  if (!candidate) return Response.json({ error: "map_coordinates_unavailable" }, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  return Response.json({
    world,
    placeId,
    coordinatesReady: Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng),
    interactiveMap: true,
    tileSource: "openstreetmap",
    precision: candidate.precision,
  }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
}
