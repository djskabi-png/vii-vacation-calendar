import type { Property } from "../data/site-data.ts";

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

function searchablePropertyText(property: Property) {
  return [property.description, property.type, property.location, property.area, ...property.features]
    .join(" ")
    .toLocaleLowerCase("he");
}

export function vacationSearchFilterIds(property: Property) {
  const searchable = searchablePropertyText(property);
  return Object.entries(vacationSearchFilterTerms)
    .filter(([, terms]) => terms.some((term) => searchable.includes(term.toLocaleLowerCase("he"))))
    .map(([id]) => id);
}

export function matchesVacationSearchFilter(property: Property, id: string) {
  if (property.searchFilterIds) return property.searchFilterIds.includes(id);
  const terms = vacationSearchFilterTerms[id];
  if (!terms) return false;
  const searchable = searchablePropertyText(property);
  return terms.some((term) => searchable.includes(term.toLocaleLowerCase("he")));
}
