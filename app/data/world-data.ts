import verifiedCatalog from "./verified-catalog.json";

export type WorldId = "vacation" | "events" | "corporate" | "spa" | "hourly" | "providers" | "activities";

export type WorldDefinition = {
  id: WorldId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
};

export type DiscoveryItem = {
  id: string;
  world: Exclude<WorldId, "vacation" | "events">;
  name: string;
  location: string;
  area: string;
  description: string;
  features: string[];
  image?: string;
  images?: string[];
  imageFit?: "cover" | "contain";
  imagePosition?: string;
  imageLabel?: string;
  searchTerms?: string[];
  priceLabel?: string;
  phone?: string;
  contactName?: string;
  rating?: number;
  duration?: string;
  sourceUrl?: string;
  sourceName?: string;
  demo?: boolean;
  indexable?: boolean;
  lat?: number;
  lng?: number;
  mapPrecision?: "exact" | "area";
  serviceAreas?: string[];
};

export const worlds: WorldDefinition[] = [
  { id: "vacation", label: "עולם הנופש", shortLabel: "נופש", description: "וילות, סוויטות ומקומות אירוח", href: "/" },
  { id: "events", label: "עולם האירועים", shortLabel: "אירועים", description: "לופטים ומתחמים לכל חגיגה", href: "/events" },
  { id: "corporate", label: "אירועי חברה ורווחה", shortLabel: "חברות", description: "ימי גיבוש, רווחה וחבילות מלאות לארגונים", href: "/corporate" },
  { id: "spa", label: "עולם הספא", shortLabel: "ספא", description: "טיפולים, חבילות וימי פינוק", href: "/spas" },
  { id: "hourly", label: "חדרים לכמה שעות", shortLabel: "לפי שעה", description: "שהייה קצרה, פרטית וגמישה", href: "/hourly" },
  { id: "providers", label: "עולם הספקים", shortLabel: "ספקים", description: "שפים, תקליטנים ותוכן לאירוח", href: "/providers" },
  { id: "activities", label: "אטרקציות", shortLabel: "אטרקציות", description: "אטרקציות וחוויות פעילות עם מידע מאומת", href: "/attractions" },
];

export const publicWorldNavigation = [
  ...worlds.filter((world) => world.id !== "activities"),
  { id: "trails", label: "מסלולי טיול", shortLabel: "מסלולים", description: "מסלולים עצמאיים לפי אזור, טבע ורמת קושי", href: "/trails" },
  { id: "attractions", label: "אטרקציות", shortLabel: "אטרקציות", description: "אטרקציות פעילות עם מידע מאומת ואפשרויות הזמנה", href: "/attractions" },
] as const;

const curatedSpaPlaces: DiscoveryItem[] = [
  { id: "spa-butik-tlv", world: "spa", name: "ספא בוטיק תל אביב", location: "תל אביב", area: "מרכז", description: "מתחם ספא זוגי עם סוויטות פרטיות, ג׳קוזי ומבחר חבילות טיפול.", features: ["עיסוי זוגי", "סוויטה פרטית", "ג׳קוזי"], image: "/media/discovery/spa-butik-tlv.jpg", images: ["/media/discovery/spa-butik-tlv.jpg", "/media/discovery/spa-butik-tlv-1.jpg", "/media/discovery/spa-butik-tlv-2.jpg", "/media/discovery/spa-butik-tlv-3.jpg"], priceLabel: "החל מ־399 ₪", rating: 8.9, lat: 32.0805, lng: 34.7692, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/spa_butik_tlv", sourceName: "ספא פלוס" },
  { id: "cassia-jerusalem", world: "spa", name: "קסיה וולנס וספא", location: "ירושלים", area: "ירושלים והסביבה", description: "מרכז וולנס במלון קסיה, סמוך לממילא, עם בריכה על הגג ומתקני ספא.", features: ["וולנס", "בריכה", "ג׳קוזי"], image: "/media/discovery/cassia-jerusalem.jpg", images: ["/media/discovery/cassia-jerusalem.jpg", "/media/discovery/cassia-jerusalem-1.jpg", "/media/discovery/cassia-jerusalem-2.jpg", "/media/discovery/cassia-jerusalem-3.jpg"], rating: 9.8, lat: 31.7703, lng: 35.2226, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/spa_Cassia_Jerusalem", sourceName: "ספא פלוס" },
  { id: "assemblage-spa", world: "spa", name: "אסמבלאז׳ ספא", location: "תל אביב", area: "מרכז", description: "ספא במלון הבוטיק אסמבלאז׳ עם חדרי טיפולים וחבילות יחיד וזוג.", features: ["מלון בוטיק", "עיסוי", "חבילות זוגיות"], image: "/media/discovery/assemblage-spa.jpg", images: ["/media/discovery/assemblage-spa.jpg", "/media/discovery/assemblage-spa-1.jpg", "/media/discovery/assemblage-spa-2.jpg", "/media/discovery/assemblage-spa-3.jpg"], priceLabel: "החל מ־680 ₪ לזוג", lat: 32.0635, lng: 34.7694, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/assemblage_spa", sourceName: "ספא פלוס" },
  { id: "urban-spa-tlv", world: "spa", name: "אורבן ספא תל אביב", location: "תל אביב", area: "מרכז", description: "מתחם ספא אורבני בצפון תל אביב עם טיפולי גוף, סאונות וחדר מנוחה.", features: ["סאונה יבשה", "סאונה רטובה", "חדר מנוחה"], image: "/media/discovery/urban-spa-tlv.jpg", images: ["/media/discovery/urban-spa-tlv.jpg", "/media/discovery/urban-spa-tlv-1.jpg", "/media/discovery/urban-spa-tlv-2.jpg", "/media/discovery/urban-spa-tlv-3.jpg"], priceLabel: "החל מ־355 ₪", rating: 9.0, lat: 32.1018, lng: 34.7881, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/urban_spa_tlv", sourceName: "ספא פלוס" },
  { id: "david-intercontinental", world: "spa", name: "הספא במלון דיוויד אינטרקונטיננטל", location: "תל אביב", area: "מרכז", description: "מתחם ספא במלון עם חבילות טיפול, ארוחת בוקר ושימוש במתקנים.", features: ["מלון", "בריכה", "חבילות עם ארוחה"], image: "/media/discovery/david-intercontinental.jpg", images: ["/media/discovery/david-intercontinental.jpg", "/media/discovery/david-intercontinental-1.jpg", "/media/discovery/david-intercontinental-2.jpg", "/media/discovery/david-intercontinental-3.jpg"], priceLabel: "החל מ־555 ₪", rating: 9.0, lat: 32.0620, lng: 34.7619, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/the_spa", sourceName: "ספא פלוס" },
  { id: "horizon-spa", world: "spa", name: "הוריזון ספא במלון שרתון", location: "תל אביב", area: "מרכז", description: "ספא מול הים עם 13 חדרי טיפולים, סאונת מלח, סאונה יבשה ורטובה.", features: ["מול הים", "סאונת מלח", "13 חדרי טיפול"], image: "/media/discovery/horizon-spa.jpg", images: ["/media/discovery/horizon-spa.jpg", "/media/discovery/horizon-spa-1.jpg", "/media/discovery/horizon-spa-2.jpg", "/media/discovery/horizon-spa-3.jpg"], priceLabel: "החל מ־420 ₪", rating: 8.9, lat: 32.0797, lng: 34.7672, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/horizon_spa", sourceName: "ספא פלוס" },
  { id: "debrah-spa", world: "spa", name: "ספא דברה מרשת אדמה", location: "תל אביב", area: "מרכז", description: "ספא במלון דברה עם חדרי טיפול וחבילות יחיד וזוג בהזמנה מקוונת.", features: ["מלון בוטיק", "טיפול זוגי", "גג המלון"], image: "/media/discovery/debrah-spa.jpg", images: ["/media/discovery/debrah-spa.jpg", "/media/discovery/debrah-spa-1.jpg", "/media/discovery/debrah-spa-2.jpg", "/media/discovery/debrah-spa-3.jpg"], rating: 9.9, lat: 32.0876, lng: 34.7731, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/Debrah_hotel_spa", sourceName: "ספא פלוס" },
  { id: "bobo-spa", world: "spa", name: "ספא בובו מרשת אדמה", location: "תל אביב", area: "מרכז", description: "חדרי טיפולים מרווחים ופינות מנוחה במלון בובו ברחוב יבנה.", features: ["חדרי טיפול", "פינות מנוחה", "חבילות זוגיות"], image: "/media/discovery/bobo-spa.jpg", images: ["/media/discovery/bobo-spa.jpg", "/media/discovery/bobo-spa-1.jpg", "/media/discovery/bobo-spa-2.jpg", "/media/discovery/bobo-spa-3.jpg"], priceLabel: "החל מ־300 ₪", rating: 9.9, lat: 32.0638, lng: 34.7748, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/bobo_tlv_spa", sourceName: "ספא פלוס" },
  { id: "leonardo-plaza-jerusalem", world: "spa", name: "ספא לאונרדו פלאזה ירושלים", location: "ירושלים", area: "ירושלים והסביבה", description: "ספא במלון לאונרדו פלאזה עם טיפולים ואפשרות לשלב ארוחת בוקר או יום כיף.", features: ["מלון", "בריכה", "יום כיף"], image: "/media/discovery/leonardo-plaza-jerusalem.jpg", images: ["/media/discovery/leonardo-plaza-jerusalem.jpg", "/media/discovery/leonardo-plaza-jerusalem-1.jpg", "/media/discovery/leonardo-plaza-jerusalem-2.jpg", "/media/discovery/leonardo-plaza-jerusalem-3.jpg"], lat: 31.7787, lng: 35.2152, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/leonardo_plaza_jerusalem_spa", sourceName: "ספא פלוס" },
  { id: "playa-spa", world: "spa", name: "פלאיה ספא במלון פליי ווסט", location: "תל אביב", area: "מרכז", description: "ספא בצפון תל אביב ליד חוף הצוק עם סאונות, חדר כושר ומלתחות.", features: ["ליד הים", "סאונות", "חדר כושר"], image: "/media/discovery/playa-spa.jpg", images: ["/media/discovery/playa-spa.jpg", "/media/discovery/playa-spa-1.jpg", "/media/discovery/playa-spa-2.png", "/media/discovery/playa-spa-3.png"], priceLabel: "החל מ־415 ₪", rating: 9.6, lat: 32.1388, lng: 34.7919, mapPrecision: "area", sourceUrl: "https://www.spaplus.co.il/spa_OpolSky", sourceName: "ספא פלוס" },
];

const curatedHourlyPlaces: DiscoveryItem[] = [
  { id: "gentleman-haifa", world: "hourly", name: "ג׳נטלמן חיפה", location: "חיפה", area: "צפון", description: "שני חדרי סטודיו לשהייה קצרה עם כניסה עצמאית, מטבחון וחניה פרטית.", features: ["2 חדרים", "כניסה עצמאית", "מטבחון"], image: "/media/discovery/gentleman-haifa.jpg", images: ["/media/discovery/gentleman-haifa.jpg", "/media/discovery/gentleman-haifa-1.jpg", "/media/discovery/gentleman-haifa-2.jpg", "/media/discovery/gentleman-haifa-3.jpg"], priceLabel: "שעה החל מ־200 ₪", phone: "055-4576591", contactName: "מרכז הזמנות", lat: 32.7940, lng: 34.9896, mapPrecision: "area", sourceUrl: "https://roomsvip.com/Gentleman_Haifa", sourceName: "חדרים וי־איי־פי" },
  { id: "lago-suite", world: "hourly", name: "לאגו סוויט", location: "ירושלים", area: "ירושלים והסביבה", description: "מתחם סוויטות ויחידות אירוח עם אפשרויות לפי שעה או ללילה.", features: ["סוויטות", "ג׳קוזי", "אפשרות לבריכה"], image: "/media/discovery/lago-suite.jpg", images: ["/media/discovery/lago-suite.jpg", "/media/discovery/lago-suite-1.jpg", "/media/discovery/lago-suite-2.jpg", "/media/discovery/lago-suite-3.jpeg"], priceLabel: "שעה החל מ־250 ₪", phone: "055-4339686", contactName: "אלי", lat: 31.7683, lng: 35.2137, mapPrecision: "area", sourceUrl: "https://roomsvip.com/Lago_Suite", sourceName: "חדרים וי־איי־פי" },
  { id: "kinki-rooms", world: "hourly", name: "קינקי רומס", location: "ראשון לציון", area: "מרכז", description: "שלוש סוויטות מעוצבות לשהייה של כמה שעות או ללילה.", features: ["3 סוויטות", "חניה פרטית", "פינות ישיבה"], image: "/media/discovery/kinki-rooms.jpg", images: ["/media/discovery/kinki-rooms.jpg", "/media/discovery/kinki-rooms-1.jpg", "/media/discovery/kinki-rooms-2.jpg", "/media/discovery/kinki-rooms-3.jpg"], priceLabel: "שעה החל מ־330 ₪", phone: "055-4353721", contactName: "ברוך", lat: 31.9730, lng: 34.7925, mapPrecision: "area", sourceUrl: "https://roomsvip.com/Kinki_rooms", sourceName: "חדרים וי־איי־פי" },
  { id: "escape-love", world: "hourly", name: "אסקייפ לאב", location: "הרצליה", area: "מרכז", description: "ארבע סוויטות עם ג׳קוזי, חדר רחצה פרטי, חניה וכניסה עצמאית.", features: ["4 סוויטות", "ג׳קוזי", "כניסה עצמאית"], image: "/media/discovery/escape-love.jpg", images: ["/media/discovery/escape-love.jpg", "/media/discovery/escape-love-1.jpg", "/media/discovery/escape-love-2.jpg", "/media/discovery/escape-love-3.jpg"], priceLabel: "שעה החל מ־200 ₪", phone: "055-4336823", contactName: "רוני", lat: 32.1663, lng: 34.8433, mapPrecision: "area", sourceUrl: "https://roomsvip.com/ascape_room", sourceName: "חדרים וי־איי־פי" },
  { id: "pninat-miel", world: "hourly", name: "פנינת מיאל", location: "אבן יהודה", area: "השרון", description: "שני צימרים עם ג׳קוזי, חצר, מטבח וחניה פרטית.", features: ["2 צימרים", "ג׳קוזי", "חצר פרטית"], image: "/media/discovery/pninat-miel.jpg", images: ["/media/discovery/pninat-miel.jpg", "/media/discovery/pninat-miel-1.jpg", "/media/discovery/pninat-miel-2.jpeg", "/media/discovery/pninat-miel-3.jpg"], priceLabel: "שעה החל מ־300 ₪", phone: "055-4549885", lat: 32.2695, lng: 34.8870, mapPrecision: "area", sourceUrl: "https://roomsvip.com/Pninat_Miel_Rooms", sourceName: "חדרים וי־איי־פי" },
  { id: "shanti-suites", world: "hourly", name: "שאנטי סוויט", location: "תל אביב", area: "מרכז", description: "מתחם של שמונה חדרים וסוויטות לשהייה לפי שעה או ללינה.", features: ["8 חדרים", "חניה", "לפי שעה או לילה"], image: "/media/discovery/shanti-suites.jpg", images: ["/media/discovery/shanti-suites.jpg", "/media/discovery/shanti-suites-1.jpg", "/media/discovery/shanti-suites-2.jpeg", "/media/discovery/shanti-suites-3.jpeg"], priceLabel: "שעה החל מ־200 ₪", phone: "055-4520575", contactName: "אלירן", lat: 32.0853, lng: 34.7818, mapPrecision: "area", sourceUrl: "https://roomsvip.com/shanti_suites", sourceName: "חדרים וי־איי־פי" },
  { id: "ahava-beshnaim", world: "hourly", name: "אהבה בשניים", location: "ראשון לציון", area: "מרכז", description: "חדר בוטיק לשהייה קצרה עם שירות עצמאי וללא מפגש.", features: ["חדר בוטיק", "ללא מפגש", "לפי שעה או לילה"], image: "/media/discovery/ahava-beshnaim.jpg", images: ["/media/discovery/ahava-beshnaim.jpg", "/media/discovery/ahava-beshnaim-1.jpg", "/media/discovery/ahava-beshnaim-2.jpeg", "/media/discovery/ahava-beshnaim-3.jpg"], priceLabel: "שעה החל מ־300 ₪", phone: "055-4360860", contactName: "יהודה", lat: 31.9790, lng: 34.7890, mapPrecision: "area", sourceUrl: "https://roomsvip.com/ahava_beshanim", sourceName: "חדרים וי־איי־פי" },
  { id: "herzliya-suite", world: "hourly", name: "הרצליה סוויט", location: "הרצליה", area: "השרון", description: "סוויטה בגודל 40 מ״ר לשהייה של שעה, מספר שעות או לילה.", features: ["40 מ״ר", "פינת ישיבה", "לפי שעה או לילה"], image: "/media/discovery/herzliya-suite.jpg", images: ["/media/discovery/herzliya-suite.jpg", "/media/discovery/herzliya-suite-1.jpg", "/media/discovery/herzliya-suite-2.jpg", "/media/discovery/herzliya-suite-3.jpg"], priceLabel: "שעה החל מ־400 ₪", phone: "055-4310744", contactName: "שרלי", lat: 32.1692, lng: 34.8517, mapPrecision: "area", sourceUrl: "https://roomsvip.com/Herzliya_Suite", sourceName: "חדרים וי־איי־פי" },
  { id: "graf-suites", world: "hourly", name: "סוויטות גראף", location: "ראשון לציון", area: "מרכז", description: "מלון סוויטות עם 13 חדרים בעיצובים שונים ואפשרות לשהייה קצרה או לילה.", features: ["13 סוויטות", "חניה", "חדרים בעיצובים שונים"], image: "/media/discovery/graf-suites.jpg", images: ["/media/discovery/graf-suites.jpg", "/media/discovery/graf-suites-1.jpg", "/media/discovery/graf-suites-2.jpg", "/media/discovery/graf-suites-3.jpg"], priceLabel: "שעה החל מ־180 ₪", phone: "055-4357174", contactName: "ברוך", lat: 31.9675, lng: 34.7830, mapPrecision: "area", sourceUrl: "https://roomsvip.com/Graf_suite", sourceName: "חדרים וי־איי־פי" },
  { id: "titanic-spa", world: "hourly", name: "סוויטות טיטאניק", location: "ראשון לציון", area: "מרכז", description: "מתחם של 17 סוויטות עם אפשרויות אירוח קצרות לפי שעה.", features: ["17 סוויטות", "שהייה קצרה", "ראשון לציון"], image: "/media/discovery/titanic-spa.jpg", images: ["/media/discovery/titanic-spa.jpg", "/media/discovery/titanic-spa-1.jpeg", "/media/discovery/titanic-spa-2.jpg", "/media/discovery/titanic-spa-3.jpg"], priceLabel: "שעה החל מ־120 ₪", phone: "055-4549882", lat: 31.9860, lng: 34.7955, mapPrecision: "area", sourceUrl: "https://roomsvip.com/Titanic_Spa", sourceName: "חדרים וי־איי־פי" },
];

const spaAreaCoordinates: Record<string, { lat: number; lng: number }> = {
  "נהריה": { lat: 33.006, lng: 35.095 },
  "חיפה": { lat: 32.794, lng: 34.989 },
  "רגבה": { lat: 32.977, lng: 35.099 },
  "כמון": { lat: 32.913, lng: 35.36 },
  "תל אביב": { lat: 32.085, lng: 34.781 },
  "הרצליה": { lat: 32.166, lng: 34.843 },
  "ירושלים": { lat: 31.778, lng: 35.223 },
  "רמת גן": { lat: 32.082, lng: 34.814 },
  "אילת": { lat: 29.558, lng: 34.948 },
  "אשדוד": { lat: 31.8, lng: 34.65 },
  "נווה אילן": { lat: 31.808, lng: 35.081 },
  "מעלה החמישה": { lat: 31.817, lng: 35.11 },
  "טבריה": { lat: 32.794, lng: 35.532 },
};

function areaMapCoordinates(item: { location: string; lat: number; lng: number }, world: "spa" | "hourly") {
  if (world === "spa") return spaAreaCoordinates[item.location] ?? { lat: item.lat, lng: item.lng };
  return { lat: item.lat, lng: item.lng };
}

const verifiedDiscoveryItems = (world: "spa" | "hourly"): DiscoveryItem[] => verifiedCatalog[world].map((item) => {
  const coordinates = areaMapCoordinates(item, world);
  return {
  id: item.id,
  world,
  name: item.name,
  location: item.location,
  area: item.area,
  description: item.description,
  features: item.features,
  image: item.image,
  images: item.images,
  priceLabel: item.price ? `החל מ-${item.price} ₪` : undefined,
  rating: "rating" in item ? item.rating : undefined,
  sourceUrl: item.sourceUrl,
  sourceName: item.sourceName,
  lat: coordinates.lat,
  lng: coordinates.lng,
  mapPrecision: "area",
  indexable: true,
  };
});

export const spaPlaces: DiscoveryItem[] = [...curatedSpaPlaces, ...verifiedDiscoveryItems("spa").filter((item) => !curatedSpaPlaces.some((existing) => existing.sourceUrl === item.sourceUrl))];
export const hourlyPlaces: DiscoveryItem[] = [...curatedHourlyPlaces, ...verifiedDiscoveryItems("hourly").filter((item) => !curatedHourlyPlaces.some((existing) => existing.sourceUrl === item.sourceUrl))];

const curatedProviderProfiles: DiscoveryItem[] = [
  { id: "masu-home-wellness", world: "providers", name: "מאסו", searchTerms: ["מאסו", "Masu", "עיסוי עד הבית", "טיפול פנים עד הבית", "עיסוי במשרד"], location: "בכל הארץ", area: "עיסויים וטיפולי פנים עד הבית", description: "מטפלים מוסמכים שמגיעים לבית, למלון, לווילה, למשרד או לאירוע עם ציוד מתאים. ניתן להזמין עיסוי אישי, טיפול פנים, עמדות עיסוי ופעילות רווחה לצוותים.", features: ["עיסוי עד הבית", "טיפולי פנים", "אירועי חברה"], image: "/media/providers/masu/masu-home.jpg", images: ["/media/providers/masu/masu-home.jpg", "/media/providers/masu/masu-office.png", "/media/providers/masu/masu-logo.png"], priceLabel: "החל מ-340 ₪", sourceUrl: "https://masu.co.il/", sourceName: "מאסו", indexable: true },
  { id: "maor-natan", world: "providers", name: "מאור נתן", location: "לפי מיקום האירוע", area: "שף פרטי וקייטרינג", description: "ארוחות שף פרטיות, אירוח מלא וקייטרינג בוטיק שמגיעים לבית או למקום הנופש.", features: ["שף פרטי", "אירוח מלא", "תפריט מותאם"], image: "/media/providers/maor-natan-1.jpg", images: ["/media/providers/maor-natan-1.jpg", "/media/providers/maor-natan-2.jpg", "/media/providers/maor-natan-3.jpg"], priceLabel: "מחיר לפי תפריט והרכב", sourceUrl: "https://www.maornatan.co.il/", sourceName: "האתר הרשמי של מאור נתן", indexable: true },
  { id: "nissan-mukhtar", world: "providers", name: "ניסן מוכתר", location: "כל הארץ", area: "שף פרטי", description: "ארוחות שף בבית או בווילה, עם תפריטים בשריים וחלביים לאירועים פרטיים ועסקיים.", features: ["בשרי או חלבי", "אירועים קטנים", "הגשה במקום"], image: "/media/providers/nissan-mukhtar-1.jpg", images: ["/media/providers/nissan-mukhtar-1.jpg", "/media/providers/nissan-mukhtar-2.jpg", "/media/providers/nissan-mukhtar-3.jpg"], priceLabel: "מחיר לפי תפריט והרכב", sourceUrl: "https://www.chef-b.co.il/", sourceName: "האתר הרשמי של ניסן מוכתר", indexable: true },
  { id: "amit-mitrani-magic-man", world: "providers", name: "עמית מיטרני, Magic Man", searchTerms: ["עמית מיטרני", "מג׳יק מן", "Magic Man", "קוסם", "אמן חושים"], location: "כל הארץ", area: "אמן חושים וקוסם", description: "מופעי קסמים ואמנות חושים לילדים, למשפחות, לאירועים עסקיים ולקבלות פנים, בהתאמה לקהל ולאופי האירוע.", features: ["אמן חושים", "מופע לכל המשפחה", "אירועים עסקיים"], image: "/media/providers/amit-mitrani/amit-mitrani-1.webp", images: ["/media/providers/amit-mitrani/amit-mitrani-1.webp", "/media/providers/amit-mitrani/amit-mitrani-2.webp", "/media/providers/amit-mitrani/amit-mitrani-3.webp"], priceLabel: "מחיר לפי סוג המופע והאירוע", sourceUrl: "https://amitgic.co.il/", sourceName: "האתר הרשמי של עמית מיטרני", indexable: true },
  { id: "dj-kfir-w", world: "providers", name: "DJ Kfir W", searchTerms: ["כפיר", "כפיר וי", "דיג׳יי כפיר"], location: "קריית עקרון", area: "תקליטן ויוצר מוזיקלי", description: "תקליטנות לחתונות, מסיבות ואירועי חברה עם קו מוזיקלי שנבנה לפי הקהל.", features: ["חתונות", "מסיבות פרטיות", "אירועי חברה"], image: "/media/providers/dj-kfir-w-1.jpg", images: ["/media/providers/dj-kfir-w-1.jpg", "/media/providers/dj-kfir-w-2.jpg", "/media/providers/dj-kfir-w-3.jpg"], priceLabel: "מחיר לפי אירוע וציוד", sourceUrl: "https://www.kfirw.co.il/", sourceName: "האתר הרשמי של כפיר וישניה", indexable: true },
  { id: "liran-elias-dj", world: "providers", name: "Liran Elias", searchTerms: ["לירן אליאס", "דיג׳יי לירן"], location: "לפי מיקום האירוע", area: "תקליטן ועורך מוזיקלי", description: "מוזיקה לחתונות ואירועי חברה, לצד סדנת תקליטנות אישית או זוגית.", features: ["חתונות", "אירועי חברה", "סדנת DJ"], image: "/media/providers/liran-elias-dj-1.jpg", images: ["/media/providers/liran-elias-dj-1.jpg", "/media/providers/liran-elias-dj-2.jpg", "/media/providers/liran-elias-dj-3.jpg"], priceLabel: "מחיר לפי אירוע ושירות", sourceUrl: "https://www.liranelias.com/", sourceName: "האתר הרשמי של לירן אליאס", indexable: true },
  { id: "photoshot", world: "providers", name: "פוטושוט", location: "לפי מיקום האירוע", area: "צילום אירועים", description: "צילום סטילס, וידאו, עריכה ואלבומים לחתונות ולאירועים משפחתיים.", features: ["סטילס", "וידאו", "אלבומים"], image: "/media/providers/photoshot-1.webp", images: ["/media/providers/photoshot-1.webp", "/media/providers/photoshot-2.jpg", "/media/providers/photoshot-3.webp"], priceLabel: "מחיר לפי צוות ותוצרים", sourceUrl: "https://photoshot.co.il/", sourceName: "האתר הרשמי של פוטושוט", indexable: true },
  { id: "baboom", world: "providers", name: "באבום בלונים", location: "מחיפה ועד אשדוד", area: "עיצוב בלונים", description: "קירות צילום, קשתות, עמודים וחבילות עיצוב בלונים בהתאמה לצבעים ולקונספט.", features: ["קירות צילום", "קשתות", "עיצוב מלא"], image: "/media/providers/baboom-1.webp", images: ["/media/providers/baboom-1.webp", "/media/providers/baboom-2.webp", "/media/providers/baboom-3.webp"], priceLabel: "מחיר לפי גודל ועיצוב", sourceUrl: "https://baboom.co.il/", sourceName: "האתר הרשמי של באבום", indexable: true },
  { id: "balloona", world: "providers", name: "Balloona", searchTerms: ["בלונה"], location: "לפי מיקום האירוע", area: "אירועי קונספט", description: "עיצוב בלונים אמנותי לאירועי חברה, השקות, חגיגות ועיצוב חדרים.", features: ["קונספט", "מיתוג", "עיצוב חלל"], image: "/media/providers/balloona-1.jpg", images: ["/media/providers/balloona-1.jpg", "/media/providers/balloona-2.jpg", "/media/providers/balloona-3.jpg"], priceLabel: "הצעה לפי קונספט", sourceUrl: "https://balloona.co.il/", sourceName: "האתר הרשמי של Balloona", indexable: true },
  { id: "bp-cocktails", world: "providers", name: "B&P Cocktails", searchTerms: ["בי אנד פי", "בי אנד פי קוקטיילס"], location: "ישראל", area: "בר קוקטיילים", description: "קוקטיילים ממותגים, בר לחתונות ואירועי חברה ותפריט שנבנה לפי הקהל.", features: ["קוקטיילים", "מיתוג", "צוות בר"], image: "/media/providers/bp-cocktails-1.jpg", images: ["/media/providers/bp-cocktails-1.jpg", "/media/providers/bp-cocktails-2.jpg", "/media/providers/bp-cocktails-3.jpg"], priceLabel: "מחיר לפי תפריט וכמות", sourceUrl: "https://www.bandpcocktail.com/", sourceName: "האתר הרשמי של B&P Cocktails", indexable: true },
  { id: "onyx-bar", world: "providers", name: "ONYX Bar", searchTerms: ["אוניקס", "אוניקס בר"], location: "לפי מיקום האירוע", area: "בר ומיקסולוגיה", description: "בר קוקטיילים לאירועים פרטיים, מסיבות ועמדות Happy Hour לחברות.", features: ["ברמנים", "מיקסולוגיה", "Happy Hour"], image: "/media/providers/onyx-bar.jpg", imageLabel: "תמונת אווירה", priceLabel: "מחיר לפי אירוע, כמות ומשך", sourceUrl: "https://onyxbar.co.il/", sourceName: "האתר הרשמי של ONYX Bar", indexable: true },
  { id: "zen-events", world: "providers", name: "Zen Events", searchTerms: ["זן", "זן אירועים"], location: "כל הארץ", area: "יוגה ורווחה", description: "יוגה, אקרו יוגה, נשימה, חשיפה לקור ועמדות עיסוי לאירועים ולימי גיבוש.", features: ["יוגה", "נשימה", "עמדות עיסוי"], image: "/media/providers/zen-events-1.jpg", images: ["/media/providers/zen-events-1.jpg", "/media/providers/zen-events-2.jpg", "/media/providers/zen-events-3.jpg"], priceLabel: "התאמת פעילות", sourceUrl: "https://www.zen-events.co.il/", sourceName: "האתר הרשמי של Zen Events", indexable: true },
];

const nationwideServiceAreas = ["צפון", "כנרת", "חיפה", "מרכז", "תל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה"];

export const providerProfiles: DiscoveryItem[] = curatedProviderProfiles
  .map((item) => ({
    ...item,
    serviceAreas: item.location.includes("כל הארץ") || item.location.includes("לפי מיקום") || item.location.includes("בכל הארץ")
      ? nationwideServiceAreas
      : [item.area, item.location],
  }))
  .filter((item) => (item.images?.length || 0) >= 3);

export const activityIdeas: DiscoveryItem[] = [
  { id: "eilat-sunset", world: "activities", name: "שקיעה לאורך מפרץ אילת", location: "אילת", area: "אילת והערבה", description: "תוכנית לערב רגוע: הליכה בטיילת, עצירה מול הים וארוחה באזור המרינה.", features: ["מסלול קל", "מתאים לזוגות", "כשעתיים"], duration: "כשעתיים", image: "/media/activities/eilat-sunset.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://www.gov.il/he/pages/sea-rules", sourceName: "כללי בטיחות בים, ממשלת ישראל" },
  { id: "mount-zefahot", world: "activities", name: "בוקר בהר צפחות", location: "אילת", area: "אילת והערבה", description: "תוכנית למסלול בוקר עם תצפיות אל מפרץ אילת. יש לבדוק תנאי מזג אוויר ומידע עדכני לפני היציאה.", features: ["תצפית", "מסלול הליכה", "יציאה מוקדמת"], duration: "3 עד 4 שעות", image: "/media/activities/mount-zefahot.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://www.parks.org.il/trip/tzfachot/", sourceName: "רשות הטבע והגנים" },
  { id: "kinneret-day", world: "activities", name: "יום סביב הכנרת", location: "סובב כנרת", area: "צפון", description: "תוכנית ליום המשלב תצפית, עצירת מים וארוחה באחד מיישובי הסביבה.", features: ["נוף", "מים", "יום מלא"], duration: "יום מלא", image: "/media/activities/kinneret-day.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://www.parks.org.il/area-north/an-golan-heights/", sourceName: "רשות הטבע והגנים" },
  { id: "achziv-coast", world: "activities", name: "קו החוף של אכזיב", location: "גליל מערבי", area: "צפון", description: "תוכנית לטיול חוף קצר עם נקודות תצפית ועצירה לפיקניק.", features: ["חוף", "פיקניק", "משפחות"], duration: "חצי יום", image: "/media/activities/achziv-coast.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://www.parks.org.il/reserve-park/%D7%92%D7%9F-%D7%9C%D7%90%D7%95%D7%9E%D7%99-%D7%90%D7%9B%D7%96%D7%99%D7%91-%D7%95%D7%97%D7%95%D7%A3-%D7%90%D7%9B%D7%96%D7%99%D7%91/", sourceName: "רשות הטבע והגנים" },
  { id: "jerusalem-market", world: "activities", name: "טעמים ומחנה יהודה", location: "ירושלים", area: "ירושלים והסביבה", description: "תוכנית לסיור אוכל עצמאי בשוק ובשכונות הסמוכות, עם בחירה חופשית של עצירות.", features: ["אוכל", "הליכה עירונית", "ערב"], duration: "2 עד 3 שעות", image: "/media/activities/jerusalem-market.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://unsplash.com/photos/oeSWMzk5MxI", sourceName: "Unsplash" },
  { id: "desert-morning", world: "activities", name: "בוקר מדברי רגוע", location: "נגב", area: "דרום", description: "תוכנית ליציאה מוקדמת לתצפית מדברית, ארוחת בוקר בשטח וחזרה למקום לפני החום.", features: ["מדבר", "תצפית", "יציאה מוקדמת"], duration: "חצי יום", image: "/media/activities/desert-morning.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://www.parks.org.il/", sourceName: "רשות הטבע והגנים" },
  { id: "horseback-idea", world: "activities", name: "טיול סוסים באזור", location: "לפי מקום האירוח", area: "חוויה בהזמנה", description: "תוכנית לחיפוש חווה פעילה בקרבת מקום האירוח. הספק והזמינות ייבדקו לפני הצגה באתר החי.", features: ["סוסים", "זוגות", "משפחות"], duration: "כשעה וחצי", image: "/media/activities/horseback-idea.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://www.gov.il/he/departments/guides/horse-riding-safety", sourceName: "מידע בטיחות ממשלתי", indexable: false },
  { id: "atv-idea", world: "activities", name: "מסלול שטח וטרקטורונים", location: "לפי מקום האירוח", area: "חוויה בהזמנה", description: "תוכנית לחוויית שטח שתוצמד למקום לפי מרחק, גיל משתתפים ותנאי המסלול.", features: ["שטח", "קבוצות", "בהזמנה מראש"], duration: "כשעתיים", image: "/media/activities/atv-idea.jpg", imageLabel: "תמונת אווירה", sourceUrl: "https://www.gov.il/he/pages/21-9025", sourceName: "משרד התחבורה והבטיחות בדרכים", indexable: false },
];

export const attractionOnboardingCategories: DiscoveryItem[] = [
  { id: "bookable-atv", world: "activities", name: "טרקטורונים וטיולי שטח", location: "צפון, מרכז ודרום", area: "שטח ואדרנלין", description: "מתאימים מסלול שטח לפי אזור הלינה, גיל המשתתפים, סוג הכלי ורמת האתגר. פרטי הספק, הביטוח, המחיר והזמינות מוצגים לפני אישור ההזמנה.", features: ["טרקטורונים", "זוגות וקבוצות", "התאמת ספק"], duration: "כשעתיים", image: "/media/activities/atv-idea.jpg", imageLabel: "תמונת אווירה", indexable: false },
  { id: "bookable-horseback", world: "activities", name: "רכיבה על סוסים", location: "בכל הארץ", area: "טבע ורכיבה", description: "מחפשים חווה פעילה ומסלול שמתאים לניסיון, לגיל ולהרכב. מקבלים מראש את תנאי הרכיבה, הציוד, המגבלות ופרטי ההזמנה.", features: ["רכיבה מודרכת", "זוגות ומשפחות", "התאמת ספק"], duration: "שעה עד שעתיים", image: "/media/activities/horseback-idea.jpg", imageLabel: "תמונת אווירה", indexable: false },
  { id: "bookable-eilat-sea", world: "activities", name: "שיט וחוויות ים באילת", location: "אילת והסביבה", area: "ים ושיט", description: "שיט, פעילות ימית או חוויה זוגית במפרץ לפי העונה, תנאי הים והרכב המשתתפים. ההזמנה מתבצעת רק מול ספק פעיל שנבדק.", features: ["שיט", "זוגות ומשפחות", "הזמנה באתר"], duration: "שעה עד חצי יום", image: "/media/activities/eilat-sunset.jpg", imageLabel: "תמונת אווירה", indexable: false },
  { id: "bookable-kinneret-water", world: "activities", name: "ספורט ימי בכנרת", location: "כנרת", area: "מים ומשפחה", description: "מתאימים פעילות מים לפי גיל, ניסיון ומצב החופים. לפני ההזמנה מוצגים נקודת המפגש, ציוד הבטיחות, משך הפעילות והמחיר.", features: ["ספורט ימי", "משפחות וקבוצות", "לפי תנאי מזג האוויר"], duration: "שעה עד שלוש שעות", image: "/media/activities/kinneret-day.jpg", imageLabel: "תמונת אווירה", indexable: false },
  { id: "bookable-western-galilee-kayak", world: "activities", name: "קיאקים וחוויות מים בצפון", location: "צפון", area: "נחלים ומים", description: "חוויה רטובה שמותאמת לעונה, לזרימה, לגיל המשתתפים ולמקום האירוח. ספק ויציאה מוצגים רק לאחר בדיקת פעילות וזמינות.", features: ["קיאקים", "משפחות", "התאמה עונתית"], duration: "שעתיים עד חצי יום", image: "/media/activities/achziv-coast.jpg", imageLabel: "תמונת אווירה", indexable: false },
  { id: "bookable-jerusalem-tastes", world: "activities", name: "סיור קולינרי בירושלים", location: "ירושלים", area: "אוכל ותרבות", description: "סיור טעימות מודרך או עצמאי עם כרטיס טעימות, לפי שעה, שפה והעדפות תזונה. כל תחנה ותנאי הביטול מוצגים לפני התשלום.", features: ["טעימות", "זוגות וקבוצות", "הזמנה מראש"], duration: "שעתיים עד שלוש שעות", image: "/media/activities/jerusalem-market.jpg", imageLabel: "תמונת אווירה", indexable: false },
  { id: "bookable-negev-jeep", world: "activities", name: "טיול ג׳יפים בנגב", location: "דרום ונגב", area: "מדבר ושטח", description: "בוחרים מסלול מדברי לפי אזור הלינה, משך, רמת קושי וגיל המשתתפים. נהג, רכב, ביטוח ומדיניות מזג אוויר מאושרים לפני ההזמנה.", features: ["ג׳יפים", "מדבר", "זוגות וקבוצות"], duration: "שעתיים עד יום מלא", image: "/media/activities/desert-morning.jpg", imageLabel: "תמונת אווירה", indexable: false },
  { id: "bookable-central-workshop", world: "activities", name: "סדנאות וחוויות משפחתיות", location: "מרכז ותל אביב", area: "יצירה וקבוצות", description: "סדנת בישול, יצירה או פעילות קבוצתית שמתאימה לגיל, למספר המשתתפים ולמיקום. בוחרים אפשרות ורואים מה כלול לפני ההזמנה.", features: ["סדנאות", "משפחות וקבוצות", "הזמנה באתר"], duration: "שעה וחצי עד שלוש שעות", image: "/media/activities/mount-zefahot.jpg", imageLabel: "תמונת אווירה", indexable: false },
];

const lowQualityAttractionMedia = new Set([
  "/media/verified/attractions/kfar-blum-kayaks-1.png",
  "/media/verified/attractions/aqua-kef-1.png",
  "/media/verified/attractions/aqua-kef-2.png",
  "/media/verified/attractions/aqua-kef-4.webp",
  "/media/verified/attractions/haifa-museums-1.png",
  "/media/verified/attractions/safari-ramat-gan-1.png",
  "/media/verified/attractions/safari-ramat-gan-2.png",
  "/media/verified/attractions/safari-ramat-gan-3.png",
  "/media/verified/attractions/safari-ramat-gan-4.png",
  "/media/verified/attractions/underwater-observatory-2.png",
  "/media/verified/attractions/underwater-observatory-3.png",
  "/media/verified/attractions/underwater-observatory-4.png",
  "/media/verified/attractions/dolphin-reef-3.jpg",
  "/media/verified/attractions/camel-ranch-eilat-1.png",
  "/media/verified/attractions/camel-ranch-eilat-2.png",
  "/media/verified/attractions/camel-ranch-eilat-3.png",
]);

const approvedAttractionCardMedia: Record<string, { image: string; fit: "cover" | "contain"; position?: string }> = {
  "kfar-blum-kayaks": { image: "/media/verified/attractions/kfar-blum-kayaks-3.jpg", fit: "cover", position: "center" },
  "hamat-gader": { image: "/media/verified/attractions/hamat-gader-3.jpg", fit: "cover", position: "center" },
  "luna-park-tel-aviv": { image: "/media/verified/attractions/luna-park-tel-aviv-3.jpg", fit: "cover", position: "center" },
  "superland": { image: "/media/verified/attractions/superland-3.webp", fit: "cover", position: "center" },
  "tel-aviv-museum": { image: "/media/verified/attractions/tel-aviv-museum-4.jpg", fit: "cover", position: "center" },
  "timna-park": { image: "/media/verified/attractions/timna-park-2.jpg", fit: "cover", position: "center" },
};

const verifiedAttractions: DiscoveryItem[] = verifiedCatalog.attractions.flatMap((item) => {
  const images = item.images.filter((image) => !lowQualityAttractionMedia.has(image));
  if (images.length < 3) return [];
  const media = approvedAttractionCardMedia[item.id];
  if (!media || !images.includes(media.image)) return [];
  return [{
    id: item.id,
    world: "activities" as const,
    name: item.name,
    location: item.location,
    area: item.area,
    description: item.description,
    features: item.features,
    image: media.image,
    images,
    imageFit: media.fit,
    imagePosition: media.position,
    priceLabel: "price" in item && item.price ? `החל מ-${item.price} ₪` : "מחיר מוצג בבחירת מועד",
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
    lat: item.lat,
    lng: item.lng,
    mapPrecision: "exact" as const,
    indexable: true,
  }];
});

// Only verified attractions with a complete gallery are public. The curated
// category records remain available for future onboarding, but are never
// presented as bookable suppliers before their identity and media are verified.
export const paidAttractions: DiscoveryItem[] = verifiedAttractions;

export const discoveryItems = [...spaPlaces, ...hourlyPlaces, ...providerProfiles, ...activityIdeas, ...paidAttractions]
  .filter((item) => item.indexable !== false && (item.images?.length || 0) >= 3);
