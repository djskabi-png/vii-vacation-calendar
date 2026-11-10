/** Pure booking-selection rules shared by dated search and the booking handoff. */
export type AvailableUnit = { roomID: number; capacity: number; total?: number };

/**
 * Select the smallest deterministic set of real units that can host the party.
 * A result is never inferred from the property's headline capacity: every
 * selected unit must be present in the supplier's exact-date response.
 */
export function selectUnitCombination(units: AvailableUnit[], guests: number, rooms = 1) {
  if (!Number.isSafeInteger(guests) || guests < 1 || !Number.isSafeInteger(rooms) || rooms < 1) return null;
  const candidates = units
    .filter((unit) => Number.isSafeInteger(unit.roomID) && unit.roomID > 0 && Number.isSafeInteger(unit.capacity) && unit.capacity > 0)
    .slice()
    .sort((a, b) => b.capacity - a.capacity || a.roomID - b.roomID);
  if (candidates.length < rooms) return null;
  let best: AvailableUnit[] | null = null;
  const visit = (start: number, picked: AvailableUnit[]) => {
    if (picked.length === rooms) {
      if (picked.reduce((sum, unit) => sum + unit.capacity, 0) < guests) return;
      const capacity = picked.reduce((sum, unit) => sum + unit.capacity, 0);
      const bestCapacity = best?.reduce((sum, unit) => sum + unit.capacity, 0) ?? Infinity;
      if (!best || capacity < bestCapacity || (capacity === bestCapacity && picked.map((u) => u.roomID).join(",") < best.map((u) => u.roomID).join(","))) best = [...picked];
      return;
    }
    for (let index = start; index <= candidates.length - (rooms - picked.length); index++) visit(index + 1, [...picked, candidates[index]]);
  };
  visit(0, []);
  const selected = best as AvailableUnit[] | null;
  if (!selected) return null;
  return {
    units: selected,
    capacity: selected.reduce((sum, unit) => sum + unit.capacity, 0),
    total: selected.every((unit) => typeof unit.total === "number")
      ? selected.reduce((sum, unit) => sum + (unit.total || 0), 0)
      : undefined,
  };
}

export function stayPriceLabel(total: number | null | undefined, nights: number, currency = "₪") {
  if (!Number.isFinite(total) || !Number.isSafeInteger(nights) || nights < 1) return null;
  const value = Math.round((total as number) * 100) / 100;
  return nights > 1 ? { total: value, averagePerNight: Math.round((value / nights) * 100) / 100, currency } : { total: value, currency };
}
