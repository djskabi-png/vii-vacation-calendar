import { cloudflareRequestCoordinates, nearestSearchLocation } from "../../../lib/nearby-search-location.ts";

const noStore = { "Cache-Control": "private, no-store" };

export async function nearbyLocationResponse(request: Request) {
  const coordinates = cloudflareRequestCoordinates(request);
  const location = coordinates ? nearestSearchLocation(coordinates.latitude, coordinates.longitude) : null;
  return location
    ? Response.json({ location, precision: "region" }, { headers: noStore })
    : Response.json({ error: "location_unavailable" }, { status: 503, headers: noStore });
}

export async function GET(request: Request) {
  return nearbyLocationResponse(request);
}
