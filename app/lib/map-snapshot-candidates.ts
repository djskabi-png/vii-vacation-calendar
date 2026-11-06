import { validMapCoordinate } from "./map-marker-layout.ts";
import { discoveryMapPrecision, listingMapPrecision } from "./map/coordinate-precision.ts";

export type SnapshotSourcePlace = { slug?: string; id?: string; name: string; lat?: number; lng?: number; mapPrecision?: "exact" | "area"; world?: string };
export type SnapshotCandidate = { world: "vacation" | "events" | "spa" | "hourly" | "activities"; placeId: string; name: string; lat: number; lng: number; precision: "exact" | "area"; zoom: number };
export const validSnapshotCoordinate = validMapCoordinate;

function point(world: SnapshotCandidate["world"], id: string | undefined, place: SnapshotSourcePlace): SnapshotCandidate[] {
  const { lat, lng } = place;
  if (typeof id !== "string" || !id || typeof lat !== "number" || typeof lng !== "number" || !validSnapshotCoordinate(lat, lng)) return [];
  const precision = world === "vacation" || world === "events" ? listingMapPrecision(place.mapPrecision) : discoveryMapPrecision(place.mapPrecision);
  return [{ world, placeId: id, name: place.name, lat, lng, precision, zoom: precision === "area" ? 12 : 14 }];
}

export function buildMapSnapshotCandidates(input: { properties: readonly SnapshotSourcePlace[]; eventPlaces: readonly SnapshotSourcePlace[]; discoveryItems: readonly SnapshotSourcePlace[] }): SnapshotCandidate[] {
  const vacation = input.properties.flatMap(place => point("vacation", place.slug, place));
  const events = input.eventPlaces.flatMap(place => point("events", place.slug, place));
  const discovery = input.discoveryItems.flatMap(place => place.world === "spa" || place.world === "hourly" || place.world === "activities" ? point(place.world, place.id, place) : []);
  return [...new Map([...vacation, ...events, ...discovery].map((candidate) => [`${candidate.world}:${candidate.placeId}`, candidate])).values()];
}
