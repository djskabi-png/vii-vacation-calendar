export function mapSnapshotPublicUrl(world: string, placeId: string) {
  return `/api/map-snapshot?world=${encodeURIComponent(world)}&id=${encodeURIComponent(placeId)}`;
}

export function mapSnapshotProbeUrl(world: string, placeId: string) {
  return `${mapSnapshotPublicUrl(world, placeId)}&probe=1`;
}
