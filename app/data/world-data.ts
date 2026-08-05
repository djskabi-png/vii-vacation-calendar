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
  { id: "spa-butik-tlv", world: "spa", name: "ספא בוטיק תל אביב", location: "תל אביב", area: "מרכז", description: "מתחם ספא זוגי עם סוויטות פרטיות, ג׳קוזי ומבחר חבילות טיפול.", features: ["עיסוי זוגי", "סוויטה פרטית", "ג׳קוזי"], image: "https://www.spaplus.co.il/gallery/1447756051913687.jpeg", priceLabel: "החל מ־399 ₪", rating: 8.9, sourceUrl: "https://www.spaplus.co.il/spa_butik_tlv", sourceName: "ספא פלוס" },
  { id: "cassia-jerusalem", world: "spa", name: "קסיה וולנס וספא", location: "ירושלים", area: "ירושלים והסביבה", description: "מרכז וולנס במלון קסיה, סמוך לממילא, עם בריכה על הגג ומתקני ספא.", features: ["וולנס", "בריכה", "ג׳קוזי"], image: "https://www.spaplus.co.il/gallery/1785164676703643.jpeg", rating: 9.8, sourceUrl: "https://www.spaplus.co.il/spa_Cassia_Jerusalem", sourceName: "ספא פלוס" },
  { id: "assemblage-spa", world: "spa", name: "אסמבלאז׳ ספא", location: "תל אביב", area: "מרכז", description: "ספא במלון הבוטיק אסמבלאז׳ עם חדרי טיפולים וחבילות יחיד וזוג.", features: ["מלון בוטיק", "עיסוי", "חבילות זוגיות"], image: "https://www.spaplus.co.il/gallery/1685606949192269.jpeg", priceLabel: "החל מ־680 ₪ לזוג", sourceUrl: "https://www.spaplus.co.il/assemblage_spa", sourceName: "ספא פלוס" },
  { id: "urban-spa-tlv", world: "spa", name: "אורבן ספא תל אביב", location: "תל אביב", area: "מרכז", description: "מתחם ספא אורבני בצפון תל אביב עם טיפולי גוף, סאונות וחדר מנוחה.", features: ["סאונה יבשה", "סאונה רטובה", "חדר מנוחה"], image: "https://www.spaplus.co.il/gallery/1779004525957311.jpeg", priceLabel: "החל מ־355 ₪", rating: 9.0, sourceUrl: "https://www.spaplus.co.il/urban_spa_tlv", sourceName: "ספא פלוס" },
  { id: "david-intercontinental", world: "spa", name: "הספא במלון דיוויד אינטרקונטיננטל", location: "תל אביב", area: "מרכז", description: "מתחם ספא במלון עם חבילות טיפול, ארוחת בוקר ושימוש במתקנים.", features: ["מלון", "בריכה", "חבילות עם ארוחה"], image: "https://www.spaplus.co.il/gallery/1683553054234250.jpeg", priceLabel: "החל מ־555 ₪", rating: 9.0, sourceUrl: "https://www.spaplus.co.il/the_spa", sourceName: "ספא פלוס" },
  { id: "horizon-spa", world: "spa", name: "הוריזון ספא במלון שרתון", location: "תל אביב", area: "מרכז", description: "ספא מול הים עם 13 חדרי טיפולים, סאונת מלח, סאונה יבשה ורטובה.", features: ["מול הים", "סאונת מלח", "13 חדרי טיפול"], image: "https://www.spaplus.co.il/gallery/1732608933791410.jpeg", priceLabel: "החל מ־420 ₪", rating: 8.9, sourceUrl: "https://www.spaplus.co.il/horizon_spa", sourceName: "ספא פלוס" },
  { id: "debrah-spa", world: "spa", name: "ספא דברה מרשת אדמה", location: "תל אביב", area: "מרכז", description: "ספא במלון דברה עם חדרי טיפול וחבילות יחיד וזוג בהזמנה מקוונת.", features: ["מלון בוטיק", "טיפול זוגי", "גג המלון"], image: "https://www.spaplus.co.il/gallery/1718796529923161.jpeg", rating: 9.9, sourceUrl: "https://www.spaplus.co.il/Debrah_hotel_spa", sourceName: "ספא פלוס" },
  { id: "bobo-spa", world: "spa", name: "ספא בובו מרשת אדמה", location: "תל אביב", area: "מרכז", description: "חדרי טיפולים מרווחים ופינות מנוחה במלון בובו ברחוב יבנה.", features: ["חדרי טיפול", "פינות מנוחה", "חבילות זוגיות"], image: "https://www.spaplus.co.il/gallery/1719214847448460.jpeg", priceLabel: "החל מ־300 ₪", rating: 9.9, sourceUrl: "https://www.spaplus.co.il/bobo_tlv_spa", sourceName: "ספא פלוס" },
  { id: "leonardo-plaza-jerusalem", world: "spa", name: "ספא לאונרדו פלאזה ירושלים", location: "ירושלים", area: "ירושלים והסביבה", description: "ספא במלון לאונרדו פלאזה עם טיפולים ואפשרות לשלב ארוחת בוקר או יום כיף.", features: ["מלון", "בריכה", "יום כיף"], image: "https://www.spaplus.co.il/gallery/1670927437858820.jpeg", sourceUrl: "https://www.spaplus.co.il/leonardo_plaza_jerusalem_spa", sourceName: "ספא פלוס" },
  { id: "playa-spa", world: "spa", name: "פלאיה ספא במלון פליי ווסט", location: "תל אביב", area: "מרכז", description: "ספא בצפון תל אביב ליד חוף הצוק עם סאונות, חדר כושר ומלתחות.", features: ["ליד הים", "סאונות", "חדר כושר"], image: "https://www.spaplus.co.il/gallery/1769509150925207.jpeg", priceLabel: "החל מ־415 ₪", rating: 9.6, sourceUrl: "https://www.spaplus.co.il/spa_OpolSky", sourceName: "ספא פלוס" },
];

export const hourlyPlaces: DiscoveryItem[] = [
  { id: "gentleman-haifa", world: "hourly", name: "ג׳נטלמן חיפה", location: "חיפה", area: "צפון", description: "שני חדרי סטודיו לשהייה קצרה עם כניסה עצמאית, מטבחון וחניה פרטית.", features: ["2 חדרים", "כניסה עצמאית", "מטבחון"], image: "https://www.roomsvip.com/gallery/8469a0409682242.jpeg", priceLabel: "שעה החל מ־200 ₪", sourceUrl: "https://roomsvip.com/Gentleman_Haifa", sourceName: "חדרים וי־איי־פי" },
  { id: "lago-suite", world: "hourly", name: "לאגו סוויט", location: "ירושלים", area: "ירושלים והסביבה", description: "מתחם סוויטות ויחידות אירוח עם אפשרויות לפי שעה או ללילה.", features: ["סוויטות", "ג׳קוזי", "אפשרות לבריכה"], image: "https://www.roomsvip.com/gallery/46695ba53962ffb.jpeg", priceLabel: "שעה החל מ־150 ₪", sourceUrl: "https://roomsvip.com/Lago_Suite", sourceName: "חדרים וי־איי־פי" },
  { id: "kinki-rooms", world: "hourly", name: "קינקי רומס", location: "ראשון לציון", area: "מרכז", description: "שלוש סוויטות מעוצבות לשהייה של כמה שעות או ללילה.", features: ["3 סוויטות", "חניה פרטית", "פינות ישיבה"], image: "https://www.roomsvip.com/gallery/5566a63b4bbd258.jpg", priceLabel: "שעה החל מ־330 ₪", sourceUrl: "https://roomsvip.com/Kinki_rooms", sourceName: "חדרים וי־איי־פי" },
  { id: "escape-love", world: "hourly", name: "אסקייפ לאב", location: "הרצליה", area: "מרכז", description: "ארבע סוויטות עם ג׳קוזי, חדר רחצה פרטי, חניה וכניסה עצמאית.", features: ["4 סוויטות", "ג׳קוזי", "כניסה עצמאית"], image: "https://www.roomsvip.com/gallery/956751a02ae1e08.jpg", priceLabel: "שעה החל מ־200 ₪", sourceUrl: "https://roomsvip.com/ascape_room", sourceName: "חדרים וי־איי־פי" },
  { id: "pninat-miel", world: "hourly", name: "פנינת מיאל", location: "אבן יהודה", area: "השרון", description: "שני צימרים עם ג׳קוזי, חצר, מטבח וחניה פרטית.", features: ["2 צימרים", "ג׳קוזי", "חצר פרטית"], image: "https://www.roomsvip.com/gallery/37681b26b41defc.JPG", priceLabel: "שעה החל מ־300 ₪", sourceUrl: "https://roomsvip.com/Pninat_Miel_Rooms", sourceName: "חדרים וי־איי־פי" },
  { id: "shanti-suites", world: "hourly", name: "שאנטי סוויט", location: "תל אביב", area: "מרכז", description: "מתחם של שמונה חדרים וסוויטות לשהייה לפי שעה או ללינה.", features: ["8 חדרים", "חניה", "לפי שעה או לילה"], image: "https://www.roomsvip.com/gallery/1268f9c9c70cb0b.jpg", priceLabel: "שעה החל מ־200 ₪", sourceUrl: "https://roomsvip.com/shanti_suites", sourceName: "חדרים וי־איי־פי" },
  { id: "ahava-beshnaim", world: "hourly", name: "אהבה בשניים", location: "ראשון לציון", area: "מרכז", description: "חדר בוטיק לשהייה קצרה עם שירות עצמאי וללא מפגש.", features: ["חדר בוטיק", "ללא מפגש", "לפי שעה או לילה"], image: "https://www.roomsvip.com/gallery/97672c6915de5a5.jpg", priceLabel: "שעה החל מ־300 ₪", sourceUrl: "https://roomsvip.com/ahava_beshanim", sourceName: "חדרים וי־איי־פי" },
  { id: "herzliya-suite", world: "hourly", name: "הרצליה סוויט", location: "הרצליה", area: "השרון", description: "סוויטה בגודל 40 מ״ר לשהייה של שעה, מספר שעות או לילה.", features: ["40 מ״ר", "פינת ישיבה", "לפי שעה או לילה"], image: "https://www.roomsvip.com/gallery/536a44d7d99e241.jpg", priceLabel: "שעה החל מ־400 ₪", sourceUrl: "https://roomsvip.com/Herzliya_Suite", sourceName: "חדרים וי־איי־פי" },
  { id: "graf-suites", world: "hourly", name: "סוויטות גראף", location: "ראשון לציון", area: "מרכז", description: "מלון סוויטות עם 13 חדרים בעיצובים שונים ואפשרות לשהייה קצרה או לילה.", features: ["13 סוויטות", "חניה", "חדרים בעיצובים שונים"], image: "https://www.roomsvip.com/gallery/666698b69106f74.jpg", priceLabel: "שעה החל מ־180 ₪", sourceUrl: "https://roomsvip.com/Graf_suite", sourceName: "חדרים וי־איי־פי" },
  { id: "titanic-spa", world: "hourly", name: "סוויטות טיטאניק", location: "ראשון לציון", area: "מרכז", description: "מתחם של 17 סוויטות עם אפשרויות אירוח קצרות לפי שעה.", features: ["17 סוויטות", "שהייה קצרה", "ראשון לציון"], image: "https://www.roomsvip.com/gallery/46673b29b3edff5.JPG", priceLabel: "שעה החל מ־120 ₪", sourceUrl: "https://roomsvip.com/Titanic_Spa", sourceName: "חדרים וי־איי־פי" },
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
  { id: "eilat-sunset", world: "activities", name: "שקיעה לאורך מפרץ אילת", location: "אילת", area: "אילת והערבה", description: "רעיון מערכתי לערב רגוע: הליכה בטיילת, עצירה מול הים וארוחה באזור המרינה.", features: ["מסלול קל", "מתאים לזוגות", "כשעתיים"], duration: "כשעתיים" },
  { id: "mount-zefahot", world: "activities", name: "בוקר בהר צפחות", location: "אילת", area: "אילת והערבה", description: "רעיון למסלול בוקר עם תצפיות אל מפרץ אילת. יש לבדוק תנאי מזג אוויר ומידע עדכני לפני היציאה.", features: ["תצפית", "מסלול הליכה", "יציאה מוקדמת"], duration: "3 עד 4 שעות" },
  { id: "kinneret-day", world: "activities", name: "יום סביב הכנרת", location: "סובב כנרת", area: "צפון", description: "רעיון ליום המשלב תצפית, עצירת מים וארוחה באחד מיישובי הסביבה.", features: ["נוף", "מים", "יום מלא"], duration: "יום מלא" },
  { id: "achziv-coast", world: "activities", name: "קו החוף של אכזיב", location: "גליל מערבי", area: "צפון", description: "רעיון לטיול חוף קצר עם נקודות תצפית ועצירה לפיקניק.", features: ["חוף", "פיקניק", "משפחות"], duration: "חצי יום" },
  { id: "jerusalem-market", world: "activities", name: "טעמים ומחנה יהודה", location: "ירושלים", area: "ירושלים והסביבה", description: "רעיון לסיור אוכל עצמאי בשוק ובשכונות הסמוכות, עם בחירה חופשית של עצירות.", features: ["אוכל", "הליכה עירונית", "ערב"], duration: "2 עד 3 שעות" },
  { id: "desert-morning", world: "activities", name: "בוקר מדברי רגוע", location: "נגב", area: "דרום", description: "רעיון ליציאה מוקדמת לתצפית מדברית, ארוחת בוקר בשטח וחזרה למקום לפני החום.", features: ["מדבר", "תצפית", "יציאה מוקדמת"], duration: "חצי יום" },
  { id: "horseback-idea", world: "activities", name: "טיול סוסים באזור", location: "לפי מקום האירוח", area: "חוויה בהזמנה", description: "רעיון לחיפוש חווה פעילה בקרבת מקום האירוח. הספק והזמינות ייבדקו לפני הצגה באתר החי.", features: ["סוסים", "זוגות", "משפחות"], duration: "כשעה וחצי", demo: true },
  { id: "atv-idea", world: "activities", name: "מסלול שטח וטרקטורונים", location: "לפי מקום האירוח", area: "חוויה בהזמנה", description: "רעיון לחוויית שטח שתוצמד למקום לפי מרחק, גיל משתתפים ותנאי המסלול.", features: ["שטח", "קבוצות", "בהזמנה מראש"], duration: "כשעתיים", demo: true },
];

export const discoveryItems = [...spaPlaces, ...hourlyPlaces, ...providerProfiles, ...activityIdeas];
