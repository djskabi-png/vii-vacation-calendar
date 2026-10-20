import { eventPlaces, properties } from "../data/site-data";
import { discoveryItems } from "../data/world-data";

export type MapSnapshotWorld = "vacation" | "events" | "spa" | "hourly" | "activities";

export type MapSnapshotCandidate = {
  world: MapSnapshotWorld;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  precision: "exact" | "area";
  zoom: number;
};

function validCoordinate(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
export function bundledMapSnapshotCandidates(): MapSnapshotCandidate[] {
  const vacation = properties.flatMap((place) => validCoordinate(place.lat, place.lng) ? [{
    world: "vacation" as const,
    placeId: place.slug,
    name: place.name,
    lat: place.lat,
    lng: place.lng as number,
    precision: "exact" as const,
    zoom: 14,
  }] : []);
  const events = eventPlaces.flatMap((place) => validCoordinate(place.lat, place.lng) ? [{
    world: "events" as const,
    placeId: place.slug,
    name: place.name,
    lat: place.lat,
    lng: place.lng as number,
    precision: "exact" as const,
    zoom: 14,
  }] : []);
  const discovery = discoveryItems.flatMap((place) => validCoordinate(place.lat, place.lng) && ["spa", "hourly", "activities"].includes(place.world) ? [{
    world: place.world as "spa" | "hourly" | "activities",
    placeId: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng as number,
    precision: place.mapPrecision === "area" ? "area" as const : "exact" as const,
    zoom: place.mapPrecision === "area" ? 12 : 14,
  }] : []);

  return [...new Map([...vacation, ...events, ...discovery]
    .map((candidate) => [`${candidate.world}:${candidate.placeId}`, candidate])).values()];
}
