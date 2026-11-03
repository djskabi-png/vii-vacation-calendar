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
