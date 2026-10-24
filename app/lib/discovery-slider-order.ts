import { prioritizeOnlineFirst } from "./vacation-online-first.ts";

/** Orders a discovery rail before its visible cap. The caller owns the document
 * seed, so SSR can serialize it and hydration/interactions can reuse it. */
type DiscoveryOrder<T> = {
  id: (item: T) => string | number;
  online?: (item: T) => boolean;
  priority?: (item: T) => number | undefined;
  compare?: (left: T, right: T) => number;
  seed: string | number;
};

export function discoverySeedRank(id: string | number, seed: string | number): number {
  const value = `${seed}:${id}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function discoverySeedCompare(firstId: string | number, secondId: string | number, seed: string | number): number {
  return discoverySeedRank(firstId, seed) - discoverySeedRank(secondId, seed)
    || String(firstId).localeCompare(String(secondId));
}

/** Shared ordering also serves full result grids, without a rail's visible cap. */
export function orderDiscoveryItems<T>(items: readonly T[], options: DiscoveryOrder<T>): T[] {
  const compare = (left: T, right: T) => (options.compare?.(left, right) ??
    (options.priority?.(left) ?? 1000) - (options.priority?.(right) ?? 1000))
    || discoverySeedCompare(options.id(left), options.id(right), options.seed)
    || String(options.id(left)).localeCompare(String(options.id(right)));
  return options.online ? prioritizeOnlineFirst(items, options.online, compare) : [...items].sort(compare);
}

export function orderDiscoveryRail<T>(items: readonly T[], options: DiscoveryOrder<T> & { limit?: number }): T[] {
  const ordered = orderDiscoveryItems(items, options);
  const requestedLimit = options.limit ?? 20;
  const limit = Number.isFinite(requestedLimit) ? Math.max(0, Math.min(20, Math.floor(requestedLimit))) : 20;
  return ordered.slice(0, limit);
}
