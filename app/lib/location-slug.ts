import { accommodationCitySlug } from "../data/accommodation-landings.ts";
import { canonicalSearchLocation } from "./geographic-names.ts";

const approvedLocationSlugs: Record<string, string> = {
  "צפון": "north",
  "חיפה": "haifa",
  "חיפה והכרמל": "haifa-carmel",
  "כנרת": "kinneret",
  "גליל מערבי": "western-galilee",
  "השרון": "sharon",
  "שרון": "sharon",
  "מישור החוף והשפלה": "coastal-plain",
  "מרכז": "center",
  "תל אביב": "tel-aviv",
  "תל אביב וגוש דן": "tel-aviv-area",
  "ראשון לציון": "rishon-lezion",
  "פתח תקווה": "petah-tikva",
  "רמת גן": "ramat-gan",
  "בת ים": "bat-yam",
  "הרצליה": "herzliya",
  "נתניה": "netanya",
  "רחובות": "rehovot",
  "אשדוד": "ashdod",
  "באר שבע": "beer-sheva",
  "ירושלים והסביבה": "jerusalem",
  "ים המלח": "dead-sea",
  "דרום ונגב": "south",
  "אילת והערבה": "eilat",
  "אילת והסביבה": "eilat",
};

export function worldLocationSlug(label: string) {
  const canonical = canonicalSearchLocation(label);
  return approvedLocationSlugs[canonical] || accommodationCitySlug(canonical);
}

