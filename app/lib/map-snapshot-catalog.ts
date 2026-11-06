import { eventPlaces, properties } from "../data/site-data";
import { discoveryItems } from "../data/world-data";
import { buildMapSnapshotCandidates } from "./map-snapshot-candidates.ts";
export { validSnapshotCoordinate } from "./map-snapshot-candidates.ts";

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

export function bundledMapSnapshotCandidates(input: { properties?: typeof properties; eventPlaces?: typeof eventPlaces; discoveryItems?: typeof discoveryItems } = {}): MapSnapshotCandidate[] {
  return buildMapSnapshotCandidates({ properties: input.properties || properties, eventPlaces: input.eventPlaces || eventPlaces, discoveryItems: input.discoveryItems || discoveryItems });
}
