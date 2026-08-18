/**
 * Selects the smallest sellable combination that can host the whole party.
 * Ordering is deliberately product-led: fewer units, then a verified lower
 * full-stay price, then the least unused capacity. Missing prices are never
 * treated as zero.
 *
 * @param {Array<{index:number, availableCount:number, maxGuests:number, totalPrice?:number, nightlyPrice?:number}>} units
 * @param {number} requestedGuests
 * @returns {{guests:number, unitCount:number, totalCapacity:number, totalPrice?:number, nightlyPrice?:number, items:Array<{index:number, quantity:number, maxGuests:number, totalPrice?:number, nightlyPrice?:number}>}|null}
 */
export function recommendVacationUnits(units, requestedGuests) {
  const guests = Math.max(1, Math.floor(Number(requestedGuests) || 1));
  const inventory = units.flatMap((unit) => {
    const availableCount = Math.max(0, Math.floor(Number(unit.availableCount) || 0));
    const maxGuests = Math.max(0, Math.floor(Number(unit.maxGuests) || 0));
    if (!availableCount || !maxGuests) return [];
    return Array.from({ length: availableCount }, () => ({
      index: Number(unit.index),
      maxGuests,
      totalPrice: Number(unit.totalPrice) > 0 ? Number(unit.totalPrice) : undefined,
      nightlyPrice: Number(unit.nightlyPrice) > 0 ? Number(unit.nightlyPrice) : undefined,
    }));
  });
  if (!inventory.length) return null;

  /** @type {Map<number, {capacity:number, units:Array<{index:number,maxGuests:number,totalPrice?:number,nightlyPrice?:number}>}>} */
  let bestByCapacity = new Map([[0, { capacity: 0, units: [] }]]);
  for (const unit of inventory) {
    const next = new Map(bestByCapacity);
    for (const candidate of bestByCapacity.values()) {
      const combined = {
        capacity: candidate.capacity + unit.maxGuests,
        units: [...candidate.units, unit],
      };
      const current = next.get(combined.capacity);
      if (!current || compareSameCapacity(combined, current) < 0) {
        next.set(combined.capacity, combined);
      }
    }
    bestByCapacity = next;
  }

  const candidates = [...bestByCapacity.values()].filter((candidate) => candidate.capacity >= guests && candidate.units.length > 0);
  if (!candidates.length) return null;
  candidates.sort((left, right) => compareComplete(left, right, guests));
  const selected = candidates[0];
  const grouped = new Map();
  for (const unit of selected.units) {
    const current = grouped.get(unit.index) || {
      index: unit.index,
      quantity: 0,
      maxGuests: unit.maxGuests,
      totalPrice: 0,
      nightlyPrice: 0,
      totalPriceKnown: true,
      nightlyPriceKnown: true,
    };
    current.quantity += 1;
    current.maxGuests = unit.maxGuests;
    if (unit.totalPrice) current.totalPrice += unit.totalPrice;
    else current.totalPriceKnown = false;
    if (unit.nightlyPrice) current.nightlyPrice += unit.nightlyPrice;
    else current.nightlyPriceKnown = false;
    grouped.set(unit.index, current);
  }
  const items = [...grouped.values()].sort((left, right) => left.index - right.index).map((item) => ({
    index: item.index,
    quantity: item.quantity,
    maxGuests: item.maxGuests,
    ...(item.totalPriceKnown ? { totalPrice: item.totalPrice } : {}),
    ...(item.nightlyPriceKnown ? { nightlyPrice: item.nightlyPrice } : {}),
  }));
  const totalPriceKnown = selected.units.every((unit) => unit.totalPrice);
  const nightlyPriceKnown = selected.units.every((unit) => unit.nightlyPrice);
  return {
    guests,
    unitCount: selected.units.length,
    totalCapacity: selected.capacity,
    ...(totalPriceKnown ? { totalPrice: selected.units.reduce((sum, unit) => sum + unit.totalPrice, 0) } : {}),
    ...(nightlyPriceKnown ? { nightlyPrice: selected.units.reduce((sum, unit) => sum + unit.nightlyPrice, 0) } : {}),
    items,
  };
}

function candidatePrice(candidate) {
  if (!candidate.units.every((unit) => unit.totalPrice)) return null;
  return candidate.units.reduce((sum, unit) => sum + unit.totalPrice, 0);
}

function candidateSignature(candidate) {
  return candidate.units.map((unit) => unit.index).sort((a, b) => a - b).join(",");
}

function compareSameCapacity(left, right) {
  if (left.units.length !== right.units.length) return left.units.length - right.units.length;
  const leftPrice = candidatePrice(left);
  const rightPrice = candidatePrice(right);
  if (leftPrice !== null && rightPrice === null) return -1;
  if (leftPrice === null && rightPrice !== null) return 1;
  if (leftPrice !== null && rightPrice !== null && leftPrice !== rightPrice) return leftPrice - rightPrice;
  return candidateSignature(left).localeCompare(candidateSignature(right));
}

function compareComplete(left, right, guests) {
  if (left.units.length !== right.units.length) return left.units.length - right.units.length;
  const leftPrice = candidatePrice(left);
  const rightPrice = candidatePrice(right);
  if (leftPrice !== null && rightPrice === null) return -1;
  if (leftPrice === null && rightPrice !== null) return 1;
  if (leftPrice !== null && rightPrice !== null && leftPrice !== rightPrice) return leftPrice - rightPrice;
  const leftUnused = left.capacity - guests;
  const rightUnused = right.capacity - guests;
  if (leftUnused !== rightUnused) return leftUnused - rightUnused;
  return candidateSignature(left).localeCompare(candidateSignature(right));
}
