import { supplierStartingPrice } from "./supplier-starting-price.ts";

export type VacationPriceSortDirection = "asc" | "desc";

function knownPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Keep the undated search ranking on the exact same price ladder rendered by
 * PropertyCard. The asynchronously loaded catalog is authoritative when it
 * contains the listing. If it does not, the listing's approved seasonal
 * fields are checked before the legacy numeric fallback.
 */
export function vacationCatalogDisplayedPrice(
  property: unknown,
  catalogPrices: unknown,
  legacyFallback: number | null | undefined,
) {
  return supplierStartingPrice(catalogPrices ?? property)
    ?? (knownPrice(legacyFallback) ? legacyFallback : null);
}

export function compareVacationDisplayedPrices(
  first: number | null | undefined,
  second: number | null | undefined,
  direction: VacationPriceSortDirection,
) {
  const firstKnown = knownPrice(first);
  const secondKnown = knownPrice(second);
  if (!firstKnown && !secondKnown) return 0;
  if (!firstKnown) return 1;
  if (!secondKnown) return -1;
  return direction === "asc" ? first - second : second - first;
}

export function orderVacationResultsByDisplayedPrice<T>(
  items: readonly T[],
  direction: VacationPriceSortDirection,
  priceFor: (item: T) => number | null | undefined,
  stableIndexFor: (item: T) => number,
) {
  return [...items].sort((first, second) => compareVacationDisplayedPrices(
    priceFor(first),
    priceFor(second),
    direction,
  ) || stableIndexFor(first) - stableIndexFor(second));
}
