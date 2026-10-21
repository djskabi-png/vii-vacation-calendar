import type { EventPlace } from "../data/site-data.ts";

type EventSearchSource = Pick<EventPlace, "name" | "description" | "features" | "audiences" | "type" | "eventTypes">;
type FacetDefinition = { label: string; pattern: RegExp };

const venueTypes: FacetDefinition[] = [
  { label: "וילות", pattern: /וילה|villa/i },
  { label: "לופטים", pattern: /לופט|loft/i },
  { label: "חדרי קריוקי", pattern: /חדר(?:י)? קריוקי/ },
  { label: "מתחמי קיץ", pattern: /מתח(?:ם|מי) קיץ/ },
  { label: "מתחמי אירוח", pattern: /מתח(?:ם|מי) אירוח|ריזורט|resort|מתחם נופש/i },
];

export const eventVenueTypeOrder = ["לופטים", "מתחמי אירועים", "מתחמי אירוח", "וילות", "מתחמי קיץ", "חדרי קריוקי"] as const;

export const legacyEventOccasions: FacetDefinition[] = [
  { label: "מסיבות", pattern: /מסיב|חגיג/ },
  { label: "ימי הולדת", pattern: /י(?:ום|מי) הולדת/ },
  { label: "מסיבת רווקות", pattern: /רווקות/ },
  { label: "מסיבת רווקים", pattern: /רווקים/ },
  { label: "בר או בת מצווה", pattern: /בר\s*(?:או|\/)?\s*בת מצווה|בת מצווה|בר מצווה/ },
  { label: "חתונות", pattern: /חתונ|חופה/ },
  { label: "אירועים משפחתיים", pattern: /משפח/ },
  { label: "אירועים פרטיים", pattern: /אירוע(?:ים)?\s+פרט/ },
  { label: "אירועי חברה", pattern: /אירועי? חברה|אירועי? עסק|כנס|ועדי עובדים/ },
  { label: "ערבי גיבוש", pattern: /גיבוש/ },
  { label: "ימי כיף", pattern: /י(?:ום|מי) כיף/ },
  { label: "הצעות נישואין", pattern: /הצע(?:ת|ות) נישואין/ },
  { label: "קבוצות", pattern: /קבוצ/ },
  { label: "ברית או בריתה", pattern: /\bברית(?:ה|ות)?\b/ },
  { label: "שבתות חתן", pattern: /שבת(?:ות)? חתן/ },
  { label: "התארגנות כלה", pattern: /התארגנות כלה/ },
];

export const legacyEventFacilities: FacetDefinition[] = [
  { label: "בריכת שחייה", pattern: /בריכ/ },
  { label: "בריכה מחוממת ומקורה", pattern: /בריכ[^.]{0,45}(?:מחוממ|מקור)|(?:מחוממ|מקור)[^.]{0,45}בריכ/ },
  { label: "ג׳קוזי ספא", pattern: /ג[׳'’]?קוזי|גקוזי/ },
  { label: "סאונה", pattern: /סאונה/ },
  { label: "פינת מנגל", pattern: /מנגל|ברביקיו|\bbbq\b/i },
  { label: "חצר או גינה", pattern: /חצר|גינה|מדשא/ },
  { label: "מערכת הגברה", pattern: /הגבר|מערכת שמע|סאונד/ },
  { label: "ערכת קריוקי", pattern: /קריוקי/ },
  { label: "מקרן", pattern: /מקרן/ },
  { label: "מערכות תאורה", pattern: /תאור/ },
  { label: "עמדת דיג׳יי", pattern: /דיג.?יי|\bdj\b/i },
  { label: "מטבח מאובזר", pattern: /מטבח/ },
  { label: "בר אלכוהול", pattern: /בר אלכוהול|בר (?:עם|חיצוני|מאובזר)|כסאות בר/ },
  { label: "חדר קולנוע", pattern: /חדר קולנוע/ },
  { label: "חניה פרטית", pattern: /חניה/ },
  { label: "שולחן סנוקר", pattern: /סנוקר/ },
  { label: "שולחן פינג פונג", pattern: /פינג פונג/ },
  { label: "שולחן פוקר", pattern: /פוקר/ },
  { label: "שולחן כדורגל", pattern: /שולחן כדורגל/ },
  { label: "הוקי אוויר", pattern: /הוקי אוויר/ },
  { label: "ללא הגבלת רעש", pattern: /ללא הגבל(?:ת|ות) רעש|אין הגבלת רעש/ },
];

export const eventOccasionOrder = legacyEventOccasions.map((definition) => definition.label);
export const eventFacilityOrder = legacyEventFacilities.map((definition) => definition.label);

export function orderedEventFacetValues(values: Iterable<string>, preferredOrder: readonly string[]) {
  const remaining = new Set(Array.from(values).filter(Boolean));
  const ordered = preferredOrder.filter((value) => remaining.delete(value));
  return [...ordered, ...Array.from(remaining).sort((left, right) => left.localeCompare(right, "he"))];
}

function searchableText(place: EventSearchSource) {
  return [place.name, place.description, ...place.features, ...place.audiences, ...place.eventTypes].join(" ");
}

function matchingLabels(definitions: readonly FacetDefinition[], text: string) {
  return definitions.filter((definition) => definition.pattern.test(text)).map((definition) => definition.label);
}

export function eventSearchVenueType(place: EventSearchSource) {
  if (place.type && place.type !== "מקום לאירועים") return place.type;
  return venueTypes.find((definition) => definition.pattern.test(place.name))?.label || "מתחמי אירועים";
}

export function eventSearchOccasions(place: EventSearchSource) {
  return [...new Set([...place.eventTypes, ...matchingLabels(legacyEventOccasions, searchableText(place))])];
}

export function eventSearchFacilities(place: EventSearchSource) {
  return matchingLabels(legacyEventFacilities, searchableText(place));
}

export function eventSearchTaxonomy(place: EventSearchSource) {
  return { type: eventSearchVenueType(place), eventTypes: eventSearchOccasions(place), features: eventSearchFacilities(place) };
}
