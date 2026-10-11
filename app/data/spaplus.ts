import catalog from "./spaplus-catalog.json";

export type SpaPlusSite = (typeof catalog.sites)[number];
export type SpaPlusPackage = SpaPlusSite["packages"][number];

export const spaPlusSites: SpaPlusSite[] = catalog.sites;
export const spaPlusCatalogGeneratedAt = catalog.generatedAt;

const regionCities: Record<string, string[]> = {
  "צפון": ["נהריה", "רגבה", "שבי ציון", "עכו", "ירכא", "מעלות תרשיחא", "צפת", "ראש פינה", "כמון", "גלבוע", "נצרת", "זכרון יעקב"],
  "חיפה": ["חיפה"],
  "כנרת": ["טבריה", "חוף צאלון"],
  "מרכז": ["תל אביב", "יפו", "רמת גן", "בת ים", "הרצליה", "כפר שמריהו", "רעננה", "נתניה", "עמק חפר", "קיסריה", "חדרה", "ראשון לציון", "רחובות", "נס ציונה", "מודיעין", "מודיעין מכבים רעות", "אשדוד", "ביצרון"],
  "ירושלים והסביבה": ["ירושלים", "מעלה אדומים", "נווה אילן", "מעלה החמישה"],
  "דרום ונגב": ["באר שבע", "אשקלון", "ים המלח", "עין גדי"],
  "אילת והסביבה": ["אילת"],
};

export function spaPlusArea(city: string) {
  return Object.entries(regionCities).find(([, cities]) => cities.includes(city))?.[0] || city || "מיקום לא נמסר";
}

export function spaPlusAudience(pack: SpaPlusPackage): "יחיד" | "זוג" | "קבוצה" | "יום כיף" | "לא צוין" {
  if (pack.group || (pack.people !== null && pack.people >= 3)) return "קבוצה";
  if (pack.people === 1) return "יחיד";
  if (pack.people === 2) return "זוג";
  if (/קבוצ|קבוצה/.test(pack.title)) return "קבוצה";
  if (/זוגי|זוגית/.test(pack.title)) return "זוג";
  if (/ליחיד|ליחידה/.test(pack.title)) return "יחיד";
  if (/יום כיף/.test(pack.title)) return "יום כיף";
  return "לא צוין";
}

export function spaPlusSiteById(id: string) {
  if (!/^spa-\d+$/.test(id)) return undefined;
  return spaPlusSites.find((site) => `spa-${site.id}` === id);
}
