import { canonicalSearchLocation, metropolitanLocationMatches, normalizeGeographicName } from "../lib/geographic-names.ts";
export type SearchMode = "vacation" | "events" | "spa" | "hourly";

type SearchablePlace = {
  area?: string;
  location?: string;
};

const OPTIONS: Record<SearchMode, string[]> = {
  vacation: [
    "כל הארץ", "צפון", "מרכז", "דרום",
    "גליל מערבי", "גליל עליון", "אילת והערבה", "כנרת", "מישור החוף והשפלה", "ירושלים והרי יהודה", "שרון", "רמת הגולן",
    "אילת", "ירכא", "נוף כנרת", "מגדל", "דלתון", "נתניה", "יערה", "טבריה", "חדרה", "יבנאל", "חוסן", "פקיעין החדשה", "קיסריה", "אבן מנחם", "כלנית",
    "חיפה והכרמל", "תל אביב", "תל אביב וגוש דן", "ירושלים והסביבה", "ים המלח", "דרום ונגב",
  ],
  events: ["כל הארץ", "צפון", "חיפה והכרמל", "מרכז", "תל אביב", "תל אביב וגוש דן", "ירושלים והסביבה", "דרום ונגב", "אילת והערבה"],
  spa: ["כל הארץ", "צפון", "חיפה", "חיפה והכרמל", "כנרת", "מרכז", "תל אביב", "תל אביב וגוש דן", "ירושלים והסביבה", "דרום ונגב", "אילת והסביבה"],
  hourly: ["כל הארץ", "גליל מערבי", "חיפה והכרמל", "מישור החוף והשפלה", "השרון", "מרכז", "תל אביב וגוש דן"],
};

export const vacationLocationGroups = [
  { id: "primary", title: "אזורים ראשיים מומלצים", options: ["כל הארץ", "צפון", "מרכז", "דרום"] },
  { id: "regions", title: "אזורים מומלצים", options: ["גליל מערבי", "גליל עליון", "אילת והערבה", "כנרת", "מישור החוף והשפלה", "ירושלים והרי יהודה", "שרון", "רמת הגולן"] },
  { id: "settlements", title: "יישובים מומלצים", options: ["אילת", "ירכא", "נוף כנרת", "מגדל", "דלתון", "נתניה", "יערה", "טבריה", "חדרה", "יבנאל", "חוסן", "פקיעין החדשה", "קיסריה", "אבן מנחם", "כלנית"] },
] as const;
const LOCATION_TERMS: Record<string, string[]> = {
  צפון: ["צפון", "גליל", "גולן", "כרמל", "חיפה", "קריות", "כנרת", "טבריה", "נהריה", "ראש פינה", "חצור", "שזור", "כמון"],
  דרום: ["דרום", "נגב", "אשקלון", "אשדוד", "באר שבע", "אילת", "ערבה"],
  "גליל עליון": ["גליל עליון", "דלתון", "צפת", "מירון", "ספסופה"],
  "מישור החוף והשפלה": ["מישור החוף", "שפלה", "אשדוד", "רחובות", "גדרה"],
  "ירושלים והרי יהודה": ["ירושלים", "הרי יהודה", "נווה אילן", "מעלה החמישה"],
  "רמת הגולן": ["רמת הגולן", "גולן"],
  כנרת: ["כנרת", "טבריה", "כלנית"],
  "גליל מערבי": ["גליל מערבי", "שלומי", "ירכא", "נהריה", "עבדון", "שומרה"],
  "חיפה והכרמל": ["חיפה", "כרמל", "קריות", "נשר", "קיסריה"],
  חיפה: ["חיפה", "כרמל", "נשר"],
  השרון: ["השרון", "שרון", "נתניה", "הרצליה", "רעננה", "אבן יהודה", "עמק חפר"],
  מרכז: ["מרכז", "מישור החוף והשפלה", "מישור החוף הצפוני", "שרון", "תל אביב", "פתח תקווה", "ראשון לציון", "רחובות", "בת ים", "הרצליה", "רמת גן", "נתניה", "משמר השבעה", "עמק חפר"],
  "תל אביב": ["תל אביב"],
  "ירושלים והסביבה": ["ירושלים", "הרי יהודה", "נווה אילן", "מעלה החמישה", "שדות מיכה", "זכריה", "גפן"],
  "ים המלח": ["ים המלח", "בקעת הירדן", "גלגל"],
  "דרום ונגב": ["דרום", "נגב", "אשקלון", "אשדוד", "באר שבע", "שדה צבי", "שדה דוד", "ניר בנים", "הודיה"],
  "אילת והערבה": ["אילת", "ערבה"],
  "אילת והסביבה": ["אילת", "ערבה"],
};

export function searchLocationOptions(mode: SearchMode) {
  return OPTIONS[mode];
}

const WHOLE_COUNTRY_SELECTIONS = new Set([
  "הכל",
  "כל הארץ",
  "all-country",
  "all",
  "all israel",
  "whole country",
  "the whole country",
  "all haaretz",
  "вся страна",
  "вся израиль",
  "по всей стране",
  "tout le pays",
  "tous",
  "tout israël",
]);

export function isWholeCountrySelection(selection?: string | null) {
  if (!selection) return true;
  return WHOLE_COUNTRY_SELECTIONS.has(selection.trim().toLocaleLowerCase());
}

export function matchesSearchLocation(place: SearchablePlace, selection: string) {
  if (isWholeCountrySelection(selection)) return true;
  const canonical = canonicalSearchLocation(selection);
  const metro = metropolitanLocationMatches(place, canonical);
  if (metro !== null) return metro;
  if (canonical === "חיפה" || canonical === "תל אביב") {
    return normalizeGeographicName(canonicalSearchLocation(place.location || place.area)) === normalizeGeographicName(canonical);
  }
  const haystack = normalizeGeographicName(`${place.area ?? ""} ${place.location ?? ""}`);
  const terms = LOCATION_TERMS[canonical] ?? [canonical];
  return terms.some((term) => haystack.includes(normalizeGeographicName(term)));
}
