import type { Property } from "../data/site-data";
import type { SiteLanguage } from "../i18n/locale-routing";

export function propertyUnitCount(property: Property) {
  // An explicit zero is supplier truth, not a missing value. Counting such a
  // property as one made the public total drift from the accepted API catalog.
  if (typeof property.units === "number" && Number.isFinite(property.units) && property.units >= 0) return property.units;
  const detailedUnits = property.roomOptions?.reduce((total, option) => total + Math.max(1, option.quantity || 1), 0) || 0;
  return detailedUnits || 1;
}

/**
 * Supplier summaries use `guests` for the largest unit when capacity is
 * unit-scoped. Search needs the complex-wide upper bound: one two-guest suite
 * must not match four guests, while several bookable units may host the party
 * across those units.
 */
export function vacationGuestCapacity(property: Pick<Property, "capacityScope" | "guests" | "units" | "roomOptions">) {
  if (property.capacityScope !== "unit") return property.guests;
  const detailedCapacity = property.roomOptions?.reduce((total, option) => {
    const quantity = Number.isFinite(option.quantity) && option.quantity > 0 ? option.quantity : 1;
    const guests = Number.isFinite(option.guests) && option.guests > 0 ? option.guests : 0;
    return total + quantity * guests;
  }, 0) || 0;
  if (detailedCapacity > 0) return detailedCapacity;
  const units = typeof property.units === "number" && Number.isFinite(property.units) && property.units > 0 ? property.units : 1;
  return Math.max(0, property.guests) * units;
}

export function matchesVacationGuestCapacity(
  property: Pick<Property, "capacityScope" | "guests" | "units" | "roomOptions">,
  requestedGuests: number,
) {
  const capacity = vacationGuestCapacity(property);
  // Unknown supplier capacity is not silently converted into a false zero.
  return capacity <= 0 || capacity >= Math.max(1, requestedGuests);
}

export function vacationInventorySummary(listings: Property[], language: SiteLanguage) {
  const complexes = listings.length;
  const units = listings.reduce((total, property) => total + propertyUnitCount(property), 0);

  if (language === "en") {
    return `${complexes} ${complexes === 1 ? "property" : "properties"}, ${units} ${units === 1 ? "accommodation unit" : "accommodation units"}`;
  }
  if (language === "ru") {
    const russianNoun = (count: number, one: string, few: string, many: string) => {
      const remainder100 = count % 100;
      const remainder10 = count % 10;
      if (remainder100 >= 11 && remainder100 <= 14) return many;
      if (remainder10 === 1) return one;
      if (remainder10 >= 2 && remainder10 <= 4) return few;
      return many;
    };
    return `${complexes} ${russianNoun(complexes, "объект", "объекта", "объектов")}, ${units} ${russianNoun(units, "единица размещения", "единицы размещения", "единиц размещения")}`;
  }
  if (language === "fr") {
    return `${complexes} ${complexes === 1 ? "établissement" : "établissements"}, ${units} ${units === 1 ? "unité d’hébergement" : "unités d’hébergement"}`;
  }
  const complexLabel = complexes === 1 ? "מתחם אחד" : `${complexes} מתחמים`;
  const unitLabel = units === 1 ? "יחידת נופש אחת" : `${units} יחידות נופש`;
  return `${complexLabel}, ${unitLabel}`;
}
