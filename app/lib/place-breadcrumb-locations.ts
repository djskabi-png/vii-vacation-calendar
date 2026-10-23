import { canonicalSearchLocation } from "./geographic-names.ts";

const NON_GEOGRAPHIC_VALUES = new Set([
  "",
  "הכל",
  "כל הארץ",
  "בכל הארץ",
  "ישראל",
  "לא צוין",
]);

/**
 * Keep the supplier hierarchy intact: area is the verified region and
 * location is the verified city/locality.  We suppress only missing,
 * whole-country and canonically identical values; we never infer geography.
 */
export function orderedPlaceLocations(area?: string | null, location?: string | null) {
  const ordered = [area, location]
    .map((value) => canonicalSearchLocation(value?.trim()))
    .filter((value) => !NON_GEOGRAPHIC_VALUES.has(value));

  return ordered.filter((value, index) => ordered.indexOf(value) === index);
}
