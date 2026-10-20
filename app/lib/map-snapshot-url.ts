export function mapSnapshotPublicUrl(world: string, placeId: string) {
  return `/api/map-snapshot?world=${encodeURIComponent(world)}&id=${encodeURIComponent(placeId)}`;
}
