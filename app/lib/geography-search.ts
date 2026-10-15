export type PublicGeographyNode = {
  key: string;
  level: "district" | "area" | "city";
  parentKey: string | null;
  title: string;
  titleEn: string;
  slug: string;
  featured: boolean;
  gpsLat: number | null;
  gpsLong: number | null;
  unassigned: boolean;
};

export type CoordinatePlace = {
  location?: string;
  area?: string;
  lat?: number;
  lng?: number;
};

export type NearbyPlace<T> = { place: T; distanceKm: number };

function normalized(value?: string | null) {
  return (value || "").trim().toLocaleLowerCase("he");
}

export function geographyNodeForSelection(nodes: readonly PublicGeographyNode[], selection?: string | null) {
  const target = normalized(selection);
  if (!target) return null;
  return nodes.find((node) => normalized(node.title) === target || normalized(node.titleEn) === target || normalized(node.slug) === target) || null;
}

export function distanceKm(first: { lat: number; lng: number }, second: { lat: number; lng: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(second.lat - first.lat);
  const longitudeDelta = radians(second.lng - first.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearbyPlacesForSelection<T extends CoordinatePlace>(
  places: readonly T[],
  nodes: readonly PublicGeographyNode[],
  selection: string,
  options: { limit?: number; maximumDistanceKm?: number } = {},
): NearbyPlace<T>[] {
  const target = geographyNodeForSelection(nodes, selection);
  if (!target || target.gpsLat === null || target.gpsLong === null) return [];
  const maximumDistanceKm = options.maximumDistanceKm ?? 100;
  const limit = options.limit ?? 12;
  const coordinatesByLocation = new Map(nodes
    .filter((node) => node.level === "city" && node.gpsLat !== null && node.gpsLong !== null)
    .flatMap((node) => [node.title, node.titleEn, node.slug]
      .map(normalized)
      .filter(Boolean)
      .map((name) => [name, { lat: node.gpsLat as number, lng: node.gpsLong as number }] as const)));
  return places
    .map((place) => {
      const coordinates = Number.isFinite(place.lat) && Number.isFinite(place.lng)
        ? { lat: place.lat as number, lng: place.lng as number }
        : coordinatesByLocation.get(normalized(place.location));
      return coordinates ? { place, distanceKm: distanceKm(
        { lat: target.gpsLat as number, lng: target.gpsLong as number },
        coordinates,
      ) } : null;
    })
    .filter((candidate): candidate is NearbyPlace<T> => candidate !== null)
    .filter((candidate) => candidate.distanceKm <= maximumDistanceKm)
    .sort((left, right) => left.distanceKm - right.distanceKm
      || normalized(left.place.location).localeCompare(normalized(right.place.location), "he"))
    .slice(0, limit);
}
