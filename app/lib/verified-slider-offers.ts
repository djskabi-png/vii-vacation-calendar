/**
 * Final boundary for supplier-verified discovery rails.
 *
 * The API owns commercial ordering. The browser may remove an invalid or
 * repeated identity, but it must never reshuffle accepted supplier offers.
 */
export function canonicalVerifiedSliderItems<T>(
  items: readonly T[],
  identity: (item: T) => string | number,
  valid: (item: T) => boolean = () => true,
  limit = 20,
): T[] {
  const accepted: T[] = [];
  const seen = new Set<string>();
  const boundedLimit = Number.isFinite(limit) ? Math.max(0, Math.min(20, Math.floor(limit))) : 20;
  if (boundedLimit === 0) return accepted;
  for (const item of items) {
    if (!valid(item)) continue;
    const key = String(identity(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    accepted.push(item);
    if (accepted.length === boundedLimit) break;
  }
  return accepted;
}

/**
 * Final boundary for complete verified result grids.
 *
 * Full result pages share the same validation and identity rules as discovery
 * rails, but they must not inherit the rail's 20-card presentation limit.
 */
export function canonicalVerifiedItems<T>(
  items: readonly T[],
  identity: (item: T) => string | number,
  valid: (item: T) => boolean = () => true,
): T[] {
  const accepted: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!valid(item)) continue;
    const key = String(identity(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    accepted.push(item);
  }
  return accepted;
}
