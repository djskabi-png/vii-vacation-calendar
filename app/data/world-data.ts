export type WorldId = "vacation" | "events" | "spa" | "hourly" | "providers" | "activities";

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
  imageLabel?: string;
  searchTerms?: string[];
  priceLabel?: string;
  rating?: number;
  duration?: string;
  sourceUrl?: string;
  sourceName?: string;
  demo?: boolean;
  indexable?: boolean;
};

export const worlds: WorldDefinition[] = [
  { id: "vacation", label: "עולם הנופש", shortLabel: "נופש", description: "וילות, סוויטות ומקומות אירוח", href: "/" },
  { id: "events", label: "עולם האירועים", shortLabel: "אירועים", description: "לופטים ומתחמים לכל חגיגה", href: "/events" },
  { id: "spa", label: "עולם הספא", shortLabel: "ספא", description: "טיפולים, חבילות וימי פינוק", href: "/spas" },
  { id: "hourly", label: "חדרים לכמה שעות", shortLabel: "לפי שעה", description: "שהייה קצרה, פרטית וגמישה", href: "/hourly" },
  { id: "providers", label: "עולם הספקים", shortLabel: "ספקים", description: "שפים, תקליטנים ותוכן לאירוח", href: "/providers" },
  { id: "activities", label: "מה עושים בסביבה", shortLabel: "מה עושים", description: "מסלולים, אוכל וחוויות לידכם", href: "/activities" },
];

export const spaPlaces: DiscoveryItem[] = [
  { id: "spa-butik-tlv", world: "spa", name: "ספא בוטיק תל אביב", location: "תל אביב", area: "מרכז", description: "מתחם ספא זוגי עם סוויטות פרטיות, ג׳קוזי ומבחר חבילות טיפול.", features: ["עיסוי זוגי", "סוויטה פרטית", "ג׳קוזי"], image: "/media/discovery/spa-butik-tlv.jpg", priceLabel: "החל מ־399 ₪", rating: 8.9, sourceUrl: "https://www.spaplus.co.il/spa_butik_tlv", sourceName: "ספא פלוס" },
  { id: "cassia-jerusalem", world: "spa", name: "קסיה וולנס וספא", location: "ירושלים", area: "ירושלים והסביבה", description: "מרכז וולנס במלון קסיה, סמוך לממילא, עם בריכה על הגג ומתקני ספא.", features: ["וולנס", "בריכה", "ג׳קוזי"], image: "/media/discovery/cassia-jerusalem.jpg", rating: 9.8, sourceUrl: "https://www.spaplus.co.il/spa_Cassia_Jerusalem", sourceName: "ספא פלוס" },
  { id: "assemblage-spa", world: "spa", name: "אסמבלאז׳ ספא", location: "תל אביב", area: "מרכז", description: "ספא במלון הבוטיק אסמבלאז׳ עם חדרי טיפולים וחבילות יחיד וזוג.", features: ["מלון בוטיק", "עיסוי", "חבילות זוגיות"], image: "/media/discovery/assemblage-spa.jpg", priceLabel: "החל מ־680 ₪ לזוג", sourceUrl: "https://www.spaplus.co.il/assemblage_spa", sourceName: "ספא פלוס" },
  { id: "urban-spa-tlv", world: "spa", name: "אורבן ספא תל אביב", location: "תל אביב", area: "מרכז", description: "מתחם ספא אורבני בצפון תל אביב עם טיפולי גוף, סאונות וחדר מנוחה.", features: ["סאונה יבשה", "סאונה רטובה", "חדר מנוחה"], image: "/media/discovery/urban-spa-tlv.jpg", priceLabel: "החל מ־355 ₪", rating: 9.0, sourceUrl: "https://www.spaplus.co.il/urban_spa_tlv", sourceName: "ספא פלוס" },
  { id: "david-intercontinental", world: "spa", name: "הספא במלון דיוויד אינטרקונטיננטל", location: "תל אביב", area: "מרכז", description: "מתחם ספא במלון עם חבילות טיפול, ארוחת בוקר ושימוש במתקנים.", features: ["מלון", "בריכה", "חבילות עם ארוחה"], image: "/media/discovery/david-intercontinental.jpg", priceLabel: "החל מ־555 ₪", rating: 9.0, sourceUrl: "https://www.spaplus.co.il/the_spa", sourceName: "ספא פלוס" },
  { id: "horizon-spa", world: "spa", name: "הוריזון ספא במלון שרתון", location: "תל אביב", area: "מרכז", description: "ספא מול הים עם 13 חדרי טיפולים, סאונת מלח, סאונה יבשה ורטובה.", features: ["מול הים", "סאונת מלח", "13 חדרי טיפול"], image: "/media/discovery/horizon-spa.jpg", priceLabel: "החל מ־420 ₪", rating: 8.9, sourceUrl: "https://www.spaplus.co.il/horizon_spa", sourceName: "ספא פלוס" },
  { id: "debrah-spa", world: "spa", name: "ספא דברה מרשת אדמה", location: "תל אביב", area: "מרכז", description: "ספא במלון דברה עם חדרי טיפול וחבילות יחיד וזוג בהזמנה מקוונת.", features: ["מלון בוטיק", "טיפול זוגי", "גג המלון"], image: "/media/discovery/debrah-spa.jpg", rating: 9.9, sourceUrl: "https://www.spaplus.co.il/Debrah_hotel_spa", sourceName: "ספא פלוס" },
  { id: "bobo-spa", world: "spa", name: "ספא בובו מרשת אדמה", location: "תל אביב", area: "מרכז", description: "חדרי טיפולים מרווחים ופינות מנוחה במלון בובו ברחוב יבנה.", features: ["חדרי טיפול", "פינות מנוחה", "חבילות זוגיות"], image: "/media/discovery/bobo-spa.jpg", priceLabel: "החל מ־300 ₪", rating: 9.9, sourceUrl: "https://www.spaplus.co.il/bobo_tlv_spa", sourceName: "ספא פלוס" },
  { id: "leonardo-plaza-jerusalem", world: "spa", name: "ספא לאונרדו פלאזה ירושלים", location: "ירושלים", area: "ירושלים והסביבה", description: "ספא במלון לאונרדו פלאזה עם טיפולים ואפשרות לשלב ארוחת בוקר או יום כיף.", features: ["מלון", "בריכה", "יום כיף"], image: "/media/discovery/leonardo-plaza-jerusalem.jpg", sourceUrl: "https://www.spaplus.co.il/leonardo_plaza_jerusalem_spa", sourceName: "ספא פלוס" },
  { id: "playa-spa", world: "spa", name: "פלאיה ספא במלון פליי ווסט", location: "תל אביב", area: "מרכז", description: "ספא בצפון תל אביב ליד חוף הצוק עם סאונות, חדר כושר ומלתחות.", features: ["ליד הים", "סאונות", "חדר כושר"], image: "/media/discovery/playa-spa.jpg", priceLabel: "החל מ־415 ₪", rating: 9.6, sourceUrl: "https://www.spaplus.co.il/spa_OpolSky", sourceName: "ספא פלוס" },
];

export const hourlyPlaces: DiscoveryItem[] = [
  { id: "gentleman-haifa", world: "hourly", name: "ג׳נטלמן חיפה", location: "חיפה", area: "צפון", description: "שני חדרי סטודיו לשהייה קצרה עם כניסה עצמאית, מטבחון וחניה פרטית.", features: ["2 חדרים", "כניסה עצמאית", "מטבחון"], image: "/media/discovery/gentleman-haifa.jpg", priceLabel: "שעה החל מ־200 ₪", sourceUrl: "https://roomsvip.com/Gentleman_Haifa", sourceName: "חדרים וי־איי־פי" },
  { id: "lago-suite", world: "hourly", name: "לאגו סוויט", location: "ירושלים", area: "ירושלים והסביבה", description: "מתחם סוויטות ויחידות אירוח עם אפשרויות לפי שעה או ללילה.", features: ["סוויטות", "ג׳קוזי", "אפשרות לבריכה"], image: "/media/discovery/lago-suite.jpg", priceLabel: "שעה החל מ־150 ₪", sourceUrl: "https://roomsvip.com/Lago_Suite", sourceName: "חדרים וי־איי־פי" },
  { id: "kinki-rooms", world: "hourly", name: "קינקי רומס", location: "ראשון לציון", area: "מרכז", description: "שלוש סוויטות מעוצבות לשהייה של כמה שעות או ללילה.", features: ["3 סוויטות", "חניה פרטית", "פינות ישיבה"], image: "/media/discovery/kinki-rooms.jpg", priceLabel: "שעה החל מ־330 ₪", sourceUrl: "https://roomsvip.com/Kinki_rooms", sourceName: "חדרים וי־איי־פי" },
  { id: "escape-love", world: "hourly", name: "אסקייפ לאב", location: "הרצליה", area: "מרכז", description: "ארבע סוויטות עם ג׳קוזי, חדר רחצה פרטי, חניה וכניסה עצמאית.", features: ["4 סוויטות", "ג׳קוזי", "כניסה עצמאית"], image: "/media/discovery/escape-love.jpg", priceLabel: "שעה החל מ־200 ₪", sourceUrl: "https://roomsvip.com/ascape_room", sourceName: "חדרים וי־איי־פי" },
  { id: "pninat-miel", world: "hourly", name: "פנינת מיאל", location: "אבן יהודה", area: "השרון", description: "שני צימרים עם ג׳קוזי, חצר, מטבח וחניה פרטית.", features: ["2 צימרים", "ג׳קוזי", "חצר פרטית"], image: "/media/discovery/pninat-miel.jpg", priceLabel: "שעה החל מ־300 ₪", sourceUrl: "https://roomsvip.com/Pninat_Miel_Rooms", sourceName: "חדרים וי־איי־פי" },
  { id: "shanti-suites", world: "hourly", name: "שאנטי סוויט", location: "תל אביב", area: "מרכז", description: "מתחם של שמונה חדרים וסוויטות לשהייה לפי שעה או ללינה.", features: ["8 חדרים", "חניה", "לפי שעה או לילה"], image: "/media/discovery/shanti-suites.jpg", priceLabel: "שעה החל מ־200 ₪", sourceUrl: "https://roomsvip.com/shanti_suites", sourceName: "חדרים וי־איי־פי" },
  { id: "ahava-beshnaim", world: "hourly", name: "אהבה בשניים", location: "ראשון לציון", area: "מרכז", description: "חדר בוטיק לשהייה קצרה עם שירות עצמאי וללא מפגש.", features: ["חדר בוטיק", "ללא מפגש", "לפי שעה או לילה"], image: "/media/discovery/ahava-beshnaim.jpg", priceLabel: "שעה החל מ־300 ₪", sourceUrl: "https://roomsvip.com/ahava_beshanim", sourceName: "חדרים וי־איי־פי" },
  { id: "herzliya-suite", world: "hourly", name: "הרצליה סוויט", location: "הרצליה", area: "השרון", description: "סוויטה בגודל 40 מ״ר לשהייה של שעה, מספר שעות או לילה.", features: ["40 מ״ר", "פינת ישיבה", "לפי שעה או לילה"], image: "/media/discovery/herzliya-suite.jpg", priceLabel: "שעה החל מ־400 ₪", sourceUrl: "https://roomsvip.com/Herzliya_Suite", sourceName: "חדרים וי־איי־פי" },
  { id: "graf-suites", world: "hourly", name: "סוויטות גראף", location: "ראשון לציון", area: "מרכז", description: "מלון סוויטות עם 13 חדרים בעיצובים שונים ואפשרות לשהייה קצרה או לילה.", features: ["13 סוויטות", "חניה", "חדרים בעיצובים שונים"], image: "/media/discovery/graf-suites.jpg", priceLabel: "שעה החל מ־180 ₪", sourceUrl: "https://roomsvip.com/Graf_suite", sourceName: "חדרים וי־איי־פי" },
  { id: "titanic-spa", world: "hourly", name: "סוויטות טיטאניק", location: "ראשון לציון", area: "מרכז", description: "מתחם של 17 סוויטות עם אפשרויות אירוח קצרות לפי שעה.", features: ["17 סוויטות", "שהייה קצרה", "ראשון לציון"], image: "/media/discovery/titanic-spa.jpg", priceLabel: "שעה החל מ־120 ₪", sourceUrl: "https://roomsvip.com/Titanic_Spa", sourceName: "חדרים וי־איי־פי" },
];

export const providerProfiles: DiscoveryItem[] = [
  { id: "maor-natan", world: "providers", name: "מאור נתן", location: "לפי מיקום האירוע", area: "שף פרטי וקייטרינג", description: "ארוחות שף פרטיות, אירוח מלא וקייטרינג בוטיק שמגיעים לבית או למקום הנופש.", features: ["שף פרטי", "אירוח מלא", "תפריט מותאם"], image: "/media/providers/maor-natan.jpg", imageLabel: "תמונת אווירה", priceLabel: "הצעה מותאמת" },
  { id: "nissan-mukhtar", world: "providers", name: "ניסן מוכתר", location: "כל הארץ", area: "שף פרטי", description: "ארוחות שף בבית או בווילה, עם תפריטים בשריים וחלביים לאירועים פרטיים ועסקיים.", features: ["בשרי או חלבי", "אירועים קטנים", "הגשה במקום"], image: "/media/providers/nissan-mukhtar.jpg", imageLabel: "תמונת אווירה", priceLabel: "הצעה מותאמת" },
  { id: "dj-kfir-w", world: "providers", name: "DJ Kfir W", searchTerms: ["כפיר", "כפיר וי", "דיג׳יי כפיר"], location: "קריית עקרון", area: "תקליטן ויוצר מוזיקלי", description: "תקליטנות לחתונות, מסיבות ואירועי חברה עם קו מוזיקלי שנבנה לפי הקהל.", features: ["חתונות", "מסיבות פרטיות", "אירועי חברה"], image: "/media/providers/dj-kfir-w.jpg", imageLabel: "תמונת אווירה", priceLabel: "בדיקת זמינות" },
  { id: "liran-elias-dj", world: "providers", name: "Liran Elias", searchTerms: ["לירן אליאס", "דיג׳יי לירן"], location: "לפי מיקום האירוע", area: "תקליטן ועורך מוזיקלי", description: "מוזיקה לחתונות ואירועי חברה, לצד סדנת תקליטנות אישית או זוגית.", features: ["חתונות", "אירועי חברה", "סדנת DJ"], image: "/media/providers/liran-elias-dj.jpg", imageLabel: "תמונת אווירה", priceLabel: "בדיקת זמינות" },
  { id: "photoshot", world: "providers", name: "פוטושוט", location: "לפי מיקום האירוע", area: "צילום אירועים", description: "צילום סטילס, וידאו, עריכה ואלבומים לחתונות ולאירועים משפחתיים.", features: ["סטילס", "וידאו", "אלבומים"], image: "/media/providers/photoshot.jpg", imageLabel: "תמונת אווירה", priceLabel: "בחירת חבילה" },
  { id: "baboom", world: "providers", name: "באבום בלונים", location: "מחיפה ועד אשדוד", area: "עיצוב בלונים", description: "קירות צילום, קשתות, עמודים וחבילות עיצוב בלונים בהתאמה לצבעים ולקונספט.", features: ["קירות צילום", "קשתות", "עיצוב מלא"], image: "/media/providers/baboom.jpg", imageLabel: "תמונת אווירה", priceLabel: "הצעה לפי עיצוב" },
  { id: "balloona", world: "providers", name: "Balloona", searchTerms: ["בלונה"], location: "לפי מיקום האירוע", area: "אירועי קונספט", description: "עיצוב בלונים אמנותי לאירועי חברה, השקות, חגיגות ועיצוב חדרים.", features: ["קונספט", "מיתוג", "עיצוב חלל"], image: "/media/providers/balloona.jpg", imageLabel: "תמונת אווירה", priceLabel: "הצעה לפי קונספט" },
  { id: "bp-cocktails", world: "providers", name: "B&P Cocktails", searchTerms: ["בי אנד פי", "בי אנד פי קוקטיילס"], location: "ישראל", area: "בר קוקטיילים", description: "קוקטיילים ממותגים, בר לחתונות ואירועי חברה ותפריט שנבנה לפי הקהל.", features: ["קוקטיילים", "מיתוג", "צוות בר"], image: "/media/providers/bp-cocktails.jpg", imageLabel: "תמונת אווירה", priceLabel: "בניית תפריט" },
  { id: "onyx-bar", world: "providers", name: "ONYX Bar", searchTerms: ["אוניקס", "אוניקס בר"], location: "לפי מיקום האירוע", area: "בר ומיקסולוגיה", description: "בר קוקטיילים לאירועים פרטיים, מסיבות ועמדות Happy Hour לחברות.", features: ["ברמנים", "מיקסולוגיה", "Happy Hour"], image: "/media/providers/onyx-bar.jpg", imageLabel: "תמונת אווירה", priceLabel: "בקשת הצעה" },
  { id: "zen-events", world: "providers", name: "Zen Events", searchTerms: ["זן", "זן אירועים"], location: "כל הארץ", area: "יוגה ורווחה", description: "יוגה, אקרו יוגה, נשימה, חשיפה לקור ועמדות עיסוי לאירועים ולימי גיבוש.", features: ["יוגה", "נשימה", "עמדות עיסוי"], image: "/media/providers/zen-events.jpg", imageLabel: "תמונת אווירה", priceLabel: "התאמת פעילות" },
];

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

export const discoveryItems = [...spaPlaces, ...hourlyPlaces, ...providerProfiles, ...activityIdeas];
