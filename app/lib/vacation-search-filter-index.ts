import { hasVerifiedAccessibilityFeature } from "../data/accessibility-data.ts";
import type { Property } from "../data/site-data.ts";
import { validCanonicalAmenityFilter } from "./supplier-amenity-filters.ts";

const vacationAccommodationTypeTerms: Record<string, readonly string[]> = {
  "בקתות עץ": ["בקתת עץ", "בקתות עץ"],
  "וילות": ["וילה", "וילות"],
  "דירות נופש": ["דירת נופש", "דירות נופש"],
  "סוויטות": ["סוויטה", "סוויטות", "סוויטות יוקרה", "מתחם סוויטות"],
  "מערות": ["מערה", "מערות"],
  "צימרים מאבן": ["צימר מאבן", "צימרים מאבן"],
  "צימרים": ["צימר", "צימרים"],
  "מתחמי אירוח": ["מתחם אירוח", "מתחמי אירוח", "מתחם נופש", "מתחם סוויטות"],
  "אוהלים אינדיאנים": ["אוהל אינדיאני", "אוהלים אינדיאנים"],
};

export function matchesVacationAccommodationType(property: Property, selectedType: string) {
  const propertyTypes = property.types?.length ? property.types : [property.type];
  const normalizedPropertyTypes = propertyTypes.map((value) => value.trim().toLocaleLowerCase("he")).filter(Boolean);
  const candidates = vacationAccommodationTypeTerms[selectedType] || [selectedType];
  return candidates.some((candidate) => {
    const normalizedCandidate = candidate.toLocaleLowerCase("he");
    return normalizedPropertyTypes.some((propertyType) => propertyType === normalizedCandidate
      || propertyType.includes(normalizedCandidate)
      || normalizedCandidate.includes(propertyType));
  });
}

const vacationSearchFilterTerms: Record<string, readonly string[]> = {
  accessible: ["נגיש"],
  pets: ["בעלי חיים", "חיות מחמד"],
  "business-license": ["רישיון עסק"],
  "free-parking": ["חניה חינם"],
  "private-units": ["יחידות"],
  isolated: ["מבודד", "מבודדת"],
  "religious-complex": ["שומרי שבת"],
  pool: ["בריכה"],
  "covered-heated-pool": ["בריכה מחוממת ומקורה"],
  "children-pool": ["בריכת ילדים"],
  sauna: ["סאונה"],
  spa: ["ספא"],
  "private-pool": ["בריכה פרטית"],
  "current-pool": ["בריכת זרמים"],
  jacuzzi: ["ג׳קוזי", "ג'קוזי"],
  "outdoor-sound": ["מערכת הגברה"],
  "heated-pool": ["בריכה מחוממת"],
  "fenced-pool": ["בריכה מגודרת"],
  "covered-hot-tub": ["ג׳קוזי ספא מחומם ומקורה", "ג'קוזי ספא מחומם ומקורה"],
  barbecue: ["מנגל", "ברביקיו"],
  "steam-sauna": ["סאונה רטובה"],
  "equipped-kitchen": ["מטבח מאובזר"],
  wifi: ["אינטרנט אלחוטי", "wifi"],
  fireplace: ["קמין עצים", "קמין"],
  projector: ["מקרן"],
  "indoor-jacuzzi": ["ג׳קוזי", "ג'קוזי"],
  karaoke: ["קריוקי"],
  "indoor-sound": ["מערכת הגברה"],
  "indoor-spa": ["ג׳קוזי ספא", "ג'קוזי ספא"],
  "games-room": ["חדר משחקים"],
  events: ["אירועים"],
  "fun-days": ["ימי כיף"],
  parties: ["מסיבות"],
  bachelorette: ["מסיבת רווקות", "מסיבות רווקות"],
  youth: ["בני נוער"],
  "groom-shabbat": ["שבת חתן", "שבתות חתן"],
  families: ["משפחות", "משפחה"],
  "team-building": ["ערבי גיבוש", "יום גיבוש"],
  "couples-only": ["זוגות בלבד"],
  proposals: ["הצעת נישואין", "הצעות נישואין"],
  mitzvah: ["בר מצווה", "בת מצווה"],
  groups: ["קבוצות", "קבוצה"],
  couples: ["זוגות", "זוג"],
  birthdays: ["יום הולדת", "ימי הולדת"],
  bachelor: ["מסיבת רווקים"],
  religious: ["ציבור דתי", "שומרי שבת"],
  weddings: ["חתונה", "חתונות"],
};

export function vacationSearchFilterIdsFromText(values: readonly string[]) {
  const searchable = values.join(" ").toLocaleLowerCase("he");
  return Object.entries(vacationSearchFilterTerms)
    .filter(([id, terms]) => id === "accessible"
      ? hasVerifiedAccessibilityFeature(values)
      : terms.some((term) => searchable.includes(term.toLocaleLowerCase("he"))))
    .map(([id]) => id);
}

export function vacationSearchFilterIds(property: Property) {
  // Supplier filters describe the complete amenity tree. Display features are
  // deliberately truncated, so rebuilding solely from them loses valid facts.
  if (Array.isArray(property.searchFilterIds)) return [...new Set(property.searchFilterIds.filter((id) =>
    Object.hasOwn(vacationSearchFilterTerms, id) || validCanonicalAmenityFilter(id)))];
  const derived = vacationSearchFilterIdsFromText([
    ...property.features, property.description, property.type, property.location, property.area,
  ]);
  return derived;
}

export function matchesVacationSearchFilter(property: Property, id: string) {
  if (Array.isArray(property.searchFilterIds)) return property.searchFilterIds.includes(id);
  if (id === "accessible") return hasVerifiedAccessibilityFeature(property.features);
  const terms = vacationSearchFilterTerms[id];
  if (!terms) return false;
  const searchable = [property.description, property.type, property.location, property.area, ...property.features].join(" ").toLocaleLowerCase("he");
  return terms.some((term) => searchable.includes(term.toLocaleLowerCase("he")));
}
