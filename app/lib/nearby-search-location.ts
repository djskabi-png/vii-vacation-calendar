export const nearbySearchCenters = [
  { label: "צפון", lat: 32.96, lng: 35.5 },
  { label: "מרכז", lat: 32.08, lng: 34.8 },
  { label: "ירושלים והרי יהודה", lat: 31.78, lng: 35.21 },
  { label: "דרום", lat: 31.25, lng: 34.79 },
  { label: "אילת והערבה", lat: 29.56, lng: 34.95 },
] as const;

export type NearbySearchLocation = (typeof nearbySearchCenters)[number]["label"];

function radians(value: number) {
  return value * Math.PI / 180;
}

export function nearestSearchLocation(latitude: number, longitude: number): NearbySearchLocation | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const origin = radians(latitude);
  return nearbySearchCenters.reduce<{ label: NearbySearchLocation; distance: number }>((best, item) => {
    const lat = radians(item.lat);
    const latDelta = lat - origin;
    const lngDelta = radians(item.lng - longitude);
    const haversine = Math.sin(latDelta / 2) ** 2 + Math.cos(origin) * Math.cos(lat) * Math.sin(lngDelta / 2) ** 2;
    return haversine < best.distance ? { label: item.label, distance: haversine } : best;
  }, { label: "מרכז", distance: Number.POSITIVE_INFINITY }).label;
}

export function cloudflareRequestCoordinates(request: Request) {
  const cf = (request as Request & { cf?: { latitude?: unknown; longitude?: unknown } }).cf;
  const latitude = Number(cf?.latitude);
  const longitude = Number(cf?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}
