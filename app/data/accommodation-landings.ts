import type { Property } from "./site-data";

export type AccommodationCategoryId = "villas" | "zimmers" | "wood-cabins" | "caves" | "stone-zimmers" | "indian-tents" | "hospitality-complexes" | "suite-complexes" | "luxury-suites" | "vacation-apartments";

export type AccommodationCategory = {
  id: AccommodationCategoryId;
  path: string;
  propertyTypes: string[];
  title: string;
  singular: string;
  countOne: string;
  description: string;
  footerTopic: "vacation-villas" | "suite-complexes" | "luxury-suites" | "vacation-apartments";
};

export type AccommodationRegion = {
  slug: string;
  label: string;
  kind: "region" | "city";
  matches: (property: Property) => boolean;
};

export const accommodationCategories: AccommodationCategory[] = [
  {
    id: "zimmers",
    path: "/zimmers",
    propertyTypes: ["צימר", "צימרים"],
    title: "צימרים לנופש",
    singular: "צימר",
    countOne: "צימר אחד",
    description: "צימרים לנופש ברחבי הארץ עם תמונות, פירוט יחידות, מתקנים ואפשרויות הזמנה במקום אחד.",
    footerTopic: "suite-complexes",
  },
  {
    id: "wood-cabins",
    path: "/wood-cabins",
    propertyTypes: ["בקתת עץ", "בקתות עץ"],
    title: "בקתות עץ לנופש",
    singular: "בקתת עץ",
    countOne: "בקתת עץ אחת",
    description: "בקתות עץ לנופש עם תמונות, פרטי יחידות, מתקנים ואפשרויות הזמנה.",
    footerTopic: "suite-complexes",
  },
  {
    id: "caves",
    path: "/vacation-caves",
    propertyTypes: ["מערה", "מערות"],
    title: "מערות אירוח",
    singular: "מערת אירוח",
    countOne: "מערת אירוח אחת",
    description: "מערות אירוח פעילות עם תמונות, מתקנים, פרטי יחידות ואפשרויות הזמנה.",
    footerTopic: "suite-complexes",
  },
  {
    id: "stone-zimmers",
    path: "/stone-zimmers",
    propertyTypes: ["צימר מאבן", "צימרים מאבן"],
    title: "צימרים מאבן",
    singular: "צימר מאבן",
    countOne: "צימר מאבן אחד",
    description: "צימרים מאבן לנופש עם מידע מלא על היחידות, המתקנים ואפשרויות ההזמנה.",
    footerTopic: "suite-complexes",
  },
  {
    id: "indian-tents",
    path: "/indian-tents",
    propertyTypes: ["אוהל אינדיאני", "אוהלים אינדיאנים"],
    title: "אוהלים אינדיאנים לנופש",
    singular: "אוהל אינדיאני",
    countOne: "אוהל אינדיאני אחד",
    description: "אוהלים אינדיאנים לנופש עם תמונות, מידע על המתחם ואפשרויות הזמנה.",
    footerTopic: "suite-complexes",
  },
  {
    id: "hospitality-complexes",
    path: "/hospitality-complexes",
    propertyTypes: ["מתחם אירוח", "מתחמי אירוח", "מתחם נופש"],
    title: "מתחמי אירוח לנופש",
    singular: "מתחם אירוח",
    countOne: "מתחם אירוח אחד",
    description: "מתחמי אירוח לנופש עם פירוט יחידות, תמונות, מתקנים ואפשרויות הזמנה.",
    footerTopic: "suite-complexes",
  },
  {
    id: "villas",
    path: "/villas",
    propertyTypes: ["וילה", "וילות"],
    title: "וילות נופש",
    singular: "וילה",
    countOne: "וילת נופש אחת",
    description: "וילות נופש פעילות עם תמונות מלאות, פרטי חדרים, מתקנים ואפשרויות הזמנה במקום אחד.",
    footerTopic: "vacation-villas",
  },
  {
    id: "suite-complexes",
    path: "/suite-complexes",
    propertyTypes: ["סוויטה", "מתחם סוויטות", "סוויטות", "מתחם נופש"],
    title: "מתחמי סוויטות",
    singular: "מתחם סוויטות",
    countOne: "מתחם סוויטות אחד",
    description: "מתחמי סוויטות פעילים למשפחות, זוגות וקבוצות, עם מידע מלא על היחידות והמתקנים.",
    footerTopic: "suite-complexes",
  },
  {
    id: "luxury-suites",
    path: "/luxury-suites",
    propertyTypes: ["סוויטות יוקרה"],
    title: "סוויטות יוקרה",
    singular: "סוויטת יוקרה",
    countOne: "סוויטת יוקרה אחת",
    description: "סוויטות יוקרה פעילות עם פרטיות, מתקנים איכותיים ומידע מלא לבחירה בטוחה.",
    footerTopic: "luxury-suites",
  },
  {
    id: "vacation-apartments",
    path: "/vacation-apartments",
    propertyTypes: ["דירת נופש", "דירות נופש"],
    title: "דירות נופש",
    singular: "דירת נופש",
    countOne: "דירת נופש אחת",
    description: "דירות נופש פעילות עם פירוט חדרים, מתקנים, תמונות ואפשרויות הזמנה.",
    footerTopic: "vacation-apartments",
  },
];

function contains(property: Property, terms: string[]) {
  const haystack = `${property.area} ${property.location}`;
  return terms.some((term) => haystack.includes(term));
}

export const accommodationRegions: AccommodationRegion[] = [
  { slug: "north", label: "צפון", kind: "region", matches: (property) => contains(property, ["צפון", "גליל", "גולן"]) },
  { slug: "kinneret", label: "כנרת", kind: "region", matches: (property) => contains(property, ["כנרת"]) },
  { slug: "western-galilee", label: "גליל מערבי", kind: "region", matches: (property) => contains(property, ["גליל מערבי"]) },
  { slug: "center", label: "מרכז", kind: "region", matches: (property) => contains(property, ["מרכז", "השרון", "מישור החוף והשפלה"]) },
  { slug: "jerusalem", label: "ירושלים", kind: "region", matches: (property) => contains(property, ["ירושלים"]) },
  { slug: "dead-sea", label: "ים המלח", kind: "region", matches: (property) => contains(property, ["ים המלח"]) },
  { slug: "eilat", label: "אילת", kind: "region", matches: (property) => contains(property, ["אילת", "הערבה"]) },
];

const accommodationCitySlugOverrides: Record<string, string> = {
  "אבן מנחם": "even-menachem",
  "אבן ספיר": "even-sapir",
  "אדרת": "aderet",
  "אור עקיבא": "or-akiva",
  "אילת": "eilat-city",
  "אכזיב": "achziv",
  "אלקוש": "elkosh",
  "אמירים": "amirim",
  "אמנון": "amnon",
  "אשדוד": "ashdod",
  "אשקלון": "ashkelon",
  "אשתאול": "eshtaol",
  "באר שבע": "beer-sheva",
  "בוסתן הגליל": "bustan-hagalil",
  "ביריה": "biriya",
  "בית זית": "beit-zayit",
  "בית שאן": "beit-shean",
  "בית שמש": "beit-shemesh",
  "בנימינה": "binyamina",
  "ברכיה": "berekhya",
  "ברק": "barak",
  "בת ים": "bat-yam",
  "גבעת זאב": "givat-zeev",
  "גורן": "goren",
  "גיתה": "gita",
  "גלגל": "gilgal",
  "גפן": "gefen",
  "דישון": "dishon",
  "דלתון": "dalton",
  "הוד השרון": "hod-hasharon",
  "הודיה": "hodaya",
  "הרצליה": "herzliya",
  "זכרון יעקב": "zichron-yaakov",
  "זכריה": "zecharia",
  "זנוח": "zanoah",
  "זרעית": "zarit",
  "חד נס": "had-nes",
  "חדרה": "hadera",
  "חוסן": "hosen",
  "חזון": "hazon",
  "חיפה": "haifa-city",
  "חצור הגלילית": "hatzor-haglilit",
  "טבריה": "tiberias",
  "טפחות": "tefahot",
  "יבנאל": "yavneel",
  "ים המלח": "dead-sea-city",
  "יערה": "yaara",
  "ירושלים": "jerusalem-city",
  "ירכא": "yarka",
  "כליל": "klil",
  "כלנית": "kalanit",
  "כפר ורדים": "kfar-vradim",
  "כפר חנניה": "kfar-hananya",
  "כפר סבא": "kfar-saba",
  "כרם בן זמרה": "kerem-ben-zimra",
  "כרמיאל": "karmiel",
  "לימן": "liman",
  "לפידות": "lapidot",
  "מבועים": "mabuim",
  "מגדל": "migdal",
  "מגן שאול": "magen-shaul",
  "מושבה כנרת": "moshavat-kinneret",
  "מטולה": "metula",
  "מנות": "manot",
  "מנחמיה": "menahemia",
  "מעונה": "meona",
  "מעלה לבונה": "maale-levona",
  "משמר הירדן": "mishmar-hayarden",
  "נהריה": "nahariya",
  "נווה זיו": "neve-ziv",
  "נווה מבטח": "neve-mivtah",
  "נווה מיכאל": "neve-michael",
  "נוף כנרת": "nof-kinneret",
  "נטועה": "netua",
  "ניר בנים": "nir-banim",
  "נתניה": "netanya",
  "ספסופה": "safsufa",
  "עבדון": "avdon",
  "עוצם": "otzem",
  "עזריקם": "azrikam",
  "עין אל-אסד": "ein-al-asad",
  "עין יעקב": "ein-yaakov",
  "עלמה": "alma",
  "עמק חפר": "emek-hefer",
  "עספיא": "isfiya",
  "עפולה": "afula",
  "פוריה": "poriya",
  "פוריה עילית": "poriya-illit",
  "פוריה-כפר עבודה": "poriya-kfar-avoda",
  "פקיעין החדשה": "pekiin-hahadasha",
  "פרדס חנה כרכור": "pardes-hanna-karkur",
  "פרזון": "perazon",
  "פתח תקווה": "petah-tikva",
  "פתחיה": "petahya",
  "צוריאל": "tzuriel",
  "צפריה": "tzafria",
  "צפת": "safed",
  "קידר": "kedar",
  "קיסריה": "caesarea",
  "קצרין": "katzrin",
  "קריית שמונה": "kiryat-shmona",
  "קרית אתא": "kiryat-ata",
  "ראש פינה": "rosh-pina",
  "ראשון לציון": "rishon-lezion",
  "רחובות": "rehovot",
  "שדה אליעזר": "sde-eliezer",
  "שדה דוד": "sde-david",
  "שדה יצחק": "sde-yitzhak",
  "שדה נחמיה": "sde-nehemia",
  "שדה צבי": "sde-tzvi",
  "שדות מיכה": "sdot-micha",
  "שדרות": "sderot",
  "שומרה": "shomera",
  "שזור": "shezor",
  "שלומי": "shlomi",
  "שפר": "shefer",
  "שתולה": "shtula",
  "תירוש": "tirosh",
  "תל אביב": "tel-aviv-city",
  "תלמים": "tlamim",
  "תפרח": "tefah",
};

const hebrewTransliteration: Record<string, string> = {
  "א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "h", "ט": "t", "י": "y",
  "כ": "k", "ך": "k", "ל": "l", "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "a", "פ": "p",
  "ף": "f", "צ": "z", "ץ": "z", "ק": "k", "ר": "r", "ש": "sh", "ת": "t",
};

function stableLocationSuffix(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36).slice(0, 5);
}

export function accommodationCitySlug(label: string) {
  const normalized = label.trim().replace(/\s+/g, " ");
  const override = accommodationCitySlugOverrides[normalized];
  if (override) return override;
  const transliterated = [...normalized]
    .map((character) => hebrewTransliteration[character] ?? (/^[a-z0-9]$/i.test(character) ? character.toLowerCase() : "-"))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return `city-${transliterated || "place"}-${stableLocationSuffix(normalized)}`;
}

export function accommodationCities(inventory: Property[]): AccommodationRegion[] {
  return [...new Set(inventory.map((property) => property.location.trim()).filter(Boolean))]
    .map((label) => ({
      slug: accommodationCitySlug(label),
      label,
      kind: "city" as const,
      matches: (property: Property) => property.location.trim() === label,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "he"));
}

export function getAccommodationCategory(id: AccommodationCategoryId) {
  return accommodationCategories.find((category) => category.id === id);
}

export function getAccommodationRegion(slug?: string | null) {
  return slug ? accommodationRegions.find((region) => region.slug === slug) : undefined;
}

export function getAccommodationDestination(slug: string | null | undefined, inventory: Property[]) {
  if (!slug) return undefined;
  return getAccommodationRegion(slug) || accommodationCities(inventory).find((city) => city.slug === slug);
}

export function accommodationListings(category: AccommodationCategory, region: AccommodationRegion | undefined, inventory: Property[]) {
  return inventory.filter((property) => (property.types?.length ? property.types : [property.type]).some((type) => category.propertyTypes.includes(type)) && (!region || region.matches(property)));
}

export function accommodationLandingPath(category: AccommodationCategory, region?: AccommodationRegion) {
  return `${category.path}${region ? `/${region.slug}` : ""}`;
}

const minimumDestinationListings = 1;

function accommodationRegionForArea(area: string) {
  const normalized = area.trim();
  return accommodationRegions.find((region) => {
    if (region.label === normalized) return true;
    if (region.slug === "north") return normalized.includes("צפון");
    if (region.slug === "kinneret") return normalized.includes("כנרת");
    if (region.slug === "western-galilee") return normalized.includes("גליל מערבי");
    if (region.slug === "center") return normalized.includes("מרכז") || normalized.includes("השרון");
    if (region.slug === "jerusalem") return normalized.includes("ירושלים");
    if (region.slug === "dead-sea") return normalized.includes("ים המלח");
    if (region.slug === "eilat") return normalized.includes("אילת") || normalized.includes("ערבה");
    return false;
  });
}

export function cleanAccommodationPath(type: string, area: string) {
  const legacyCategoryAliases: Partial<Record<string, AccommodationCategoryId>> = {
    "וילות": "villas",
    "צימרים": "zimmers",
    "בקתות עץ": "wood-cabins",
    "מערות": "caves",
    "צימרים מאבן": "stone-zimmers",
    "אוהלים אינדיאנים": "indian-tents",
    "מתחמי אירוח": "hospitality-complexes",
    "דירות נופש": "vacation-apartments",
    "סוויטות": "suite-complexes",
  };
  const aliasedCategory = legacyCategoryAliases[type];
  const category = accommodationCategories.find((item) => item.id === aliasedCategory || item.propertyTypes.includes(type) || item.title === type || item.singular === type);
  if (!category) return null;
  if (area === "הכל" || area === "כל הארץ") return category.path;
  const region = accommodationRegionForArea(area);
  if (region) return accommodationLandingPath(category, region);
  return `${category.path}/${accommodationCitySlug(area)}`;
}

export function indexableAccommodationLandings(inventory: Property[]) {
  return accommodationCategories.flatMap((category) => {
    if (!accommodationListings(category, undefined, inventory).length) return [];
    const destinations = [...accommodationRegions, ...accommodationCities(inventory)]
      .filter((destination) => accommodationListings(category, destination, inventory).length >= minimumDestinationListings)
      .map((destination) => ({ category, region: destination, path: accommodationLandingPath(category, destination) }));
    return [...new Map([{ category, region: undefined, path: category.path }, ...destinations].map((landing) => [landing.path, landing])).values()];
  });
}

export function accommodationLandingForPath(categoryId: AccommodationCategoryId, regionSlug: string | null | undefined, inventory: Property[]) {
  const category = getAccommodationCategory(categoryId);
  if (!category) return null;
  const region = getAccommodationDestination(regionSlug, inventory);
  if (regionSlug && !region) return null;
  const listings = accommodationListings(category, region, inventory);
  const path = accommodationLandingPath(category, region);
  const title = region ? `${category.title} ב${region.label}` : `${category.title} בישראל`;
  const placeCount = listings.length === 1 ? category.countOne : `${listings.length} מקומות`;
  const description = region
    ? `${title}: ${placeCount} פעילים עם תמונות, פרטי יחידות, מתקנים ודרכי הזמנה. המידע בעמוד מבוסס על המלאי הפעיל באתר.`
    : `${category.description} בעמוד מוצגים ${placeCount} פעילים מהמלאי הנוכחי.`;
  return { category, region, listings, path, title, description };
}
