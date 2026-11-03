export type VacationPriceSortDirection = "asc" | "desc";

function knownPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
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
