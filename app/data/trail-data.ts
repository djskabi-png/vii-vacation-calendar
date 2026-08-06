export type TrailDifficulty = "קל" | "בינוני" | "למיטיבי לכת";

export const mainTrailAreas = ["צפון", "כנרת", "חיפה", "מרכז", "תל אביב", "דרום ונגב", "ירושלים", "אילת והסביבה"] as const;
export type MainTrailArea = (typeof mainTrailAreas)[number];

export type Trail = {
  slug: string;
  name: string;
  mainArea: MainTrailArea;
  region: string;
  areaTags: string[];
  nature: string[];
  distance: string;
  duration: string;
  difficulty: TrailDifficulty;
  routeType: string;
  bestSeason: string;
  familyFit: string;
  accessibility: string;
  summary: string;
  highlights: string[];
  dayPlan: string[];
  safety: string[];
  officialSource: string;
  sourceName: string;
  mapQuery: string;
  tone: "water" | "coast" | "forest" | "desert" | "wetland";
};

type BaseTrail = Omit<Trail, "mainArea">;

const baseTrails: BaseTrail[] = [
  {
    slug: "snir-hatzbani",
    name: "נחל שניר, חצבאני",
    region: "אצבע הגליל",
    areaTags: ["צפון", "גליל עליון", "קריית שמונה", "מטולה"],
    nature: ["נחל", "מים", "צמחיית גדות"],
    distance: "עד 3.5 ק״מ",
    duration: "חצי שעה עד שעתיים",
    difficulty: "בינוני",
    routeType: "מעגלי קצר או קווי ארוך",
    bestSeason: "כל השנה, בכפוף לתנאי הזרימה",
    familyFit: "המסלול הקצר מתאים למשפחות. הארוך דורש היערכות והקפצת רכב.",
    accessibility: "בשמורה יש מסלול מונגש, בריכת שכשוך ומתקני יום. לא כל המסלול הארוך מונגש.",
    summary: "מסלול רטוב וירוק לאורך אחד ממקורות הירדן, עם אפשרות לבחור בין טעימה משפחתית קצרה לבין הליכה ארוכה יותר לצד הנחל.",
    highlights: ["הליכה לצד ובתוך המים", "בריכת שכשוך", "פארק חושים", "מצפור אל הנחל"],
    dayPlan: ["מתחילים במסלול האדום מן החניון", "בוחרים במסלול הקצר או ממשיכים למסלול הארוך", "מסיימים בשכשוך ובפיקניק רק באזורים המותרים"],
    safety: ["נעלי הליכה שמתאימות למים", "יש לבדוק את עוצמת הזרימה ואת מבזקי השמורה", "למסלול הארוך נדרשת הקפצת רכב"],
    officialSource: "https://www.parks.org.il/trip/%D7%9E%D7%98%D7%99%D7%99%D7%9C%D7%99%D7%9D-%D7%91%D7%A9%D7%9E%D7%95%D7%A8%D7%AA-%D7%94%D7%98%D7%91%D7%A2-%D7%A0%D7%97%D7%9C-%D7%A9%D7%A0%D7%99%D7%A8-%D7%97%D7%A6%D7%91%D7%90%D7%A0%D7%99/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "שמורת טבע נחל שניר",
    tone: "water",
  },
  {
    slug: "banias-middle",
    name: "נחל חרמון, הבניאס התיכון",
    region: "מורדות החרמון",
    areaTags: ["צפון", "גולן", "גליל עליון", "קריית שמונה"],
    nature: ["נחל", "בריכות", "קניון בזלתי"],
    distance: "כ-3 ק״מ",
    duration: "3 עד 4 שעות",
    difficulty: "בינוני",
    routeType: "קווי",
    bestSeason: "סתיו עד אביב. בקיץ יוצאים רק בשעות מתאימות",
    familyFit: "מתאים למשפחות מטיילות שמורגלות בהליכה בינונית.",
    accessibility: "המסלול התיכון אינו מסלול מונגש.",
    summary: "הליכה לאורך נחל חרמון בין צמחיית גדות, בריכות מים ונקודת הסיפור של הטנק הסורי ההפוך.",
    highlights: ["נחל זורם", "בריכות מים", "הטנק הסורי ההפוך", "צל של עצי דולב וער אציל"],
    dayPlan: ["משאירים רכב מאסף בנקודת הסיום", "יורדים מבית העלמין של קיבוץ שניר אל הערוץ", "צועדים דרומה לאורך הנחל עד היציאה לשאר ישוב"],
    safety: ["אין להיכנס למים לאורך המסלול", "יש לתכנן רכב מאסף", "בודקים מבזקים ושעות אור לפני היציאה"],
    officialSource: "https://www.parks.org.il/new/syrian-tank/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "קיבוץ שניר בית עלמין",
    tone: "water",
  },
  {
    slug: "el-al-waterfalls",
    name: "נחל אל על והמפל הלבן",
    region: "דרום רמת הגולן",
    areaTags: ["צפון", "גולן", "כנרת"],
    nature: ["מפלים", "בריכות", "בזלת וקירטון"],
    distance: "כ-5 ק״מ",
    duration: "2 עד 3 שעות",
    difficulty: "בינוני",
    routeType: "קווי",
    bestSeason: "כל השנה, ללא עומס חום",
    familyFit: "מתאים למשפחות מטיילות מיטיבות לכת.",
    accessibility: "הירידה לנחל והמפל אינה מונגשת.",
    summary: "מסלול בין שני עולמות גאולוגיים, סלעי בזלת כהים וקירות קירטון לבנים, עם מפל ובריכה בלב הקניון.",
    highlights: ["המפל הלבן", "בריכות נחל", "בוסתנים", "ניגוד בין בזלת לקירטון"],
    dayPlan: ["מתחילים בחניון אליעד", "יורדים אל המפל הלבן ועוצרים רק במקומות בטוחים", "ממשיכים לכיוון חניון המפלים באבני איתן"],
    safety: ["אין לשבת בקרבת קירות המפל בגלל סכנת אבנים", "רוב הדרך חשופה לשמש", "נדרשת הקפצת רכב למסלול המלא"],
    officialSource: "https://www.parks.org.il/trip/elal-lavan/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "נחל אל על המפל הלבן",
    tone: "water",
  },
  {
    slug: "tel-dan-short",
    name: "תל דן, המסלול המשפחתי",
    region: "אצבע הגליל",
    areaTags: ["צפון", "גליל עליון", "קריית שמונה", "מטולה"],
    nature: ["נחל", "יער", "מעיינות"],
    distance: "מסלול קצר בשטח השמורה",
    duration: "כשעה",
    difficulty: "קל",
    routeType: "מעגלי",
    bestSeason: "כל השנה",
    familyFit: "מתאים למשפחות ולפעוטות בחלקים המונגשים.",
    accessibility: "חלק ניכר מן המסלול הקצר והאתרים המרכזיים נגישים.",
    summary: "מסלול מוצל לצד פלגי דן, גשרי עץ, טחנת קמח ואתר עתיקות, שמתאים גם ליום חם בצפון.",
    highlights: ["פלגי נחל דן", "עץ פו הדב", "טחנת קמח", "השער הכנעני"],
    dayPlan: ["יוצאים מרחבת החניה בשביל הנגיש", "עוצרים במרפסת התצפית על הזרימה", "ממשיכים לפי הזמן לאתר העתיקות וחוזרים לחניון"],
    safety: ["נשארים על השבילים המסומנים", "משגיחים על ילדים ליד המים", "בודקים שעות כניסה והזמנה מראש"],
    officialSource: "https://www.parks.org.il/trip/dan/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "שמורת טבע תל דן",
    tone: "forest",
  },
  {
    slug: "ein-afek-wetland",
    name: "עין אפק, גשרים מעל הביצה",
    region: "עמק עכו",
    areaTags: ["צפון", "גליל מערבי", "חיפה", "עכו"],
    nature: ["ביצה", "אגם", "ציפורים"],
    distance: "כמה מאות מטרים",
    duration: "2 עד 3 שעות",
    difficulty: "קל",
    routeType: "מעגלי",
    bestSeason: "כל השנה, עם אופי שונה בכל עונה",
    familyFit: "מתאים למשפחות. פעוטות מומלץ לשאת במנשא ליד הגשר הצף.",
    accessibility: "חניה, מבואה, טחנת הקמח, שבילי בטון ומרפסות תצפית נגישים.",
    summary: "מסלול קצר שמרגיש כמו עולם אחר, מעל מעיינות וביצה, בין עופות מים, צמחיית גדות וטחנת קמח עתיקה.",
    highlights: ["הגשר הצף", "עופות מים", "טחנת קמח", "תצפית על הביצה"],
    dayPlan: ["מתחילים בגן המקלט לצמחים", "עוברים בטחנת הקמח", "צועדים בזהירות על הגשר הצף וחוזרים דרך נקודות התצפית"],
    safety: ["לגשר הצף אין מעקה", "אין להאכיל בעלי חיים", "בודקים שעות פתיחה ומזג אוויר"],
    officialSource: "https://www.parks.org.il/trip/en-afek/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "שמורת טבע עין אפק",
    tone: "wetland",
  },
  {
    slug: "dor-habonim-coast",
    name: "חוף דור הבונים",
    region: "חוף הכרמל",
    areaTags: ["חיפה", "כרמל", "מרכז", "זכרון יעקב"],
    nature: ["חוף", "מפרצונים", "כורכר"],
    distance: "2.5 ק״מ",
    duration: "2 עד 3 שעות",
    difficulty: "קל",
    routeType: "מעגלי",
    bestSeason: "סתיו עד אביב. בקיץ בשעות הקרירות",
    familyFit: "מתאים למשפחות שמסוגלות ללכת בשביל חוף חשוף.",
    accessibility: "המסלול המלא אינו מונגש לכל אורכו.",
    summary: "הליכה בין מפרצונים, רכסי כורכר ומערות שנוצרו מפעולת הגלים, בלי לוותר על זמן שקט מול הים.",
    highlights: ["מפרצונים טבעיים", "מערה ימית", "סלעי כורכר", "פריחה עונתית"],
    dayPlan: ["יוצאים מהחניון הדרומי", "הולכים לאורך קו החוף ועוצרים בנקודות התצפית", "חוזרים במסלול המעגלי אל החניון"],
    safety: ["מתרחקים משפת מצוק וגלים גבוהים", "המסלול חשוף לשמש", "אין להיכנס לאזורים שנסגרו או למערות בזמן ים סוער"],
    officialSource: "https://www.parks.org.il/trip/bonim/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "שמורת טבע חוף דור הבונים",
    tone: "coast",
  },
  {
    slug: "jordan-river-bridges",
    name: "מגשר הדודות לגשר אריק",
    region: "צפון הכנרת",
    areaTags: ["כנרת", "גולן", "צפון"],
    nature: ["נהר", "צמחיית גדות", "נוף"],
    distance: "כ-3.5 ק״מ",
    duration: "2 עד 3 שעות",
    difficulty: "קל",
    routeType: "קווי",
    bestSeason: "סתיו עד אביב, לא בימים חמים",
    familyFit: "מתאים למשפחות, עם תכנון רכב מאסף.",
    accessibility: "שביל הטבע הקווי אינו מונגש לכל אורכו.",
    summary: "הליכה רגועה לאורך הירדן ההררי, בין גשרים, מים זורמים וצמחיית גדות, קרוב למקומות הלינה סביב הכנרת.",
    highlights: ["נהר הירדן", "גשר הדודות", "גשר אריק", "פינות נוף לאורך המים"],
    dayPlan: ["משאירים רכב בגשר אריק", "מתחילים בצד המערבי של גשר הדודות", "צועדים בשביל המסומן עד נקודת הסיום"],
    safety: ["המסלול חשוף ולא מתאים לשרב", "אחרי גשם הדרך עשויה להיות בוצית", "אין להבעיר אש או ללון בשטח השמורה"],
    officialSource: "https://www.parks.org.il/trip/dodot/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "גשר הדודות",
    tone: "water",
  },
  {
    slug: "har-kfir",
    name: "הר כפיר",
    region: "מרום הגליל",
    areaTags: ["צפון", "גליל עליון", "בית ג׳אן", "כרמיאל"],
    nature: ["חורש", "תצפיות", "פריחה"],
    distance: "כ-1.7 ק״מ",
    duration: "שעה עד שעתיים",
    difficulty: "קל",
    routeType: "מעגלי",
    bestSeason: "חורף ואביב",
    familyFit: "מתאים למשפחות שאוהבות הליכה קצרה ותצפיות.",
    accessibility: "שביל טבע הררי שאינו מונגש.",
    summary: "מסלול קצר בחורש ים תיכוני עם תצפיות רחבות ופריחה עונתית, בחירה טובה לבוקר רגוע בגליל.",
    highlights: ["חורש מוצל", "תצפיות גליל", "פריחה באביב", "מסלול קצר"],
    dayPlan: ["נכנסים לבית ג׳אן לפי הוראות המקור", "עוקבים אחרי סימון השבילים", "עוצרים לתצפית וחוזרים באותו מעגל"],
    safety: ["אין להסתמך על ניווט בלבד עד נקודת ההתחלה", "נשארים על השביל", "מומלץ לשלב רק אם יש מספיק שעות אור"],
    officialSource: "https://www.parks.org.il/trip/kfir/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "הר כפיר בית ג׳אן",
    tone: "forest",
  },
  {
    slug: "tzur-natan",
    name: "צור נתן ונחל אלכסנדר העליון",
    region: "מזרח השרון",
    areaTags: ["מרכז", "שרון", "כפר סבא", "נתניה"],
    nature: ["יער", "נחל", "תצפיות"],
    distance: "כ-5 ק״מ",
    duration: "כ-4 שעות",
    difficulty: "בינוני",
    routeType: "מסלול טבע עם ירידה ועלייה",
    bestSeason: "חורף ואביב",
    familyFit: "מתאים למשפחות מטיילות עם כושר הליכה בינוני.",
    accessibility: "שביל טבע עם עליות וירידות, אינו מונגש.",
    summary: "מסלול פחות מוכר בין יער, ערוץ נחל אלכסנדר, פריחה ונוף פתוח, במרחק סביר מיישובי השרון.",
    highlights: ["נחל אלכסנדר העליון", "יער אורנים וברושים", "פריחה", "תצפיות"],
    dayPlan: ["מתחילים סמוך ליער צור יצחק", "יורדים אל ערוץ הנחל", "מסיימים בעלייה חזרה לנקודת המוצא"],
    safety: ["יש בורות ומערות בשטח, לא סוטים מהשביל", "המסלול מסתיים בעלייה", "אין לשהות בשטח בשעות החשכה"],
    officialSource: "https://www.parks.org.il/trip/tzur-natan/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "יער צור יצחק",
    tone: "forest",
  },
  {
    slug: "ein-prat",
    name: "עין פרת, נווה מדבר קרוב לירושלים",
    region: "מדבר יהודה",
    areaTags: ["ירושלים", "מדבר יהודה", "ים המלח", "מעלה אדומים"],
    nature: ["מעיין", "קניון מדברי", "בריכות"],
    distance: "כ-2 ק״מ",
    duration: "כ-3 שעות, אפשר להישאר יותר",
    difficulty: "קל",
    routeType: "מסלול קצר וגמיש",
    bestSeason: "סתיו עד אביב, בקיץ בשעות הקרירות",
    familyFit: "מתאים למשפחות, עם השגחה רציפה ליד המים.",
    accessibility: "יש לבדוק במקור הרשמי את המסלול הנגיש המעודכן.",
    summary: "נביעה ירוקה בתוך קניון מדברי, עם בריכות, חורשה, אמות מים ומנזר, למסלול שאפשר להפוך לחצי יום רגוע.",
    highlights: ["בריכת התמר", "מעיינות", "מנזר פארן", "מצוקי מדבר יהודה"],
    dayPlan: ["יורדים מן המבואה אל אזור המעיין", "מטיילים בין הנביעה והשרידים", "משאירים זמן למנוחה בצל לפני העלייה"],
    safety: ["בודקים סכנת שיטפונות ומזג אוויר", "אין לשתות ממי המעיין", "נכנסים רק בשעות הפעילות ובמסלולים הפתוחים"],
    officialSource: "https://www.parks.org.il/trip/prat/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "שמורת טבע עין פרת",
    tone: "desert",
  },
  {
    slug: "nahal-masor",
    name: "נחל מסור והר מסור",
    region: "הערבה התיכונה",
    areaTags: ["ערבה", "אילת", "דרום", "עין יהב"],
    nature: ["מדבר", "מעוק", "תצפית"],
    distance: "כ-3 ק״מ הליכה ועוד כ-24 ק״מ נסיעת שטח",
    duration: "2 עד 4 שעות",
    difficulty: "למיטיבי לכת",
    routeType: "מעגלי, כולל נסיעת שטח",
    bestSeason: "חורף ואביב בלבד",
    familyFit: "למשפחות מיטיבות לכת ובעלות רכב מתאים בלבד.",
    accessibility: "המסלול אינו מונגש ודורש נסיעת שטח.",
    summary: "הר משונן, ערוץ מדברי ומעוק קצר ומוצל, במסלול שמיועד למי שמחפשים הרפתקה אמיתית ולא עצירה קלילה בדרך.",
    highlights: ["תצפית מהר מסור", "מעוק מדברי", "עצי שיטה", "גבי חורף בעונה"],
    dayPlan: ["בודקים מראש התאמת הרכב והדרך", "נוסעים בזהירות לנקודת ההליכה", "עולים לתצפית וחוזרים דרך המעוק"],
    safety: ["אין לצאת בשרב או בסכנת שיטפונות", "נדרשים מפת סימון, מים וטלפון טעון", "המסלול מתאים רק למטיילים מנוסים"],
    officialSource: "https://www.parks.org.il/trip/masor-river/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "נחל מסור",
    tone: "desert",
  },
  {
    slug: "mamshit-stream",
    name: "ממשית ונחל ממשית",
    region: "צפון הנגב",
    areaTags: ["נגב", "דרום", "דימונה", "ים המלח"],
    nature: ["מדבר", "קניון", "עתיקות"],
    distance: "כ-2.5 ק״מ בנחל",
    duration: "כשעתיים בנחל ועוד כשעה באתר",
    difficulty: "בינוני",
    routeType: "מסלול אתר ומסלול נחל",
    bestSeason: "סתיו עד אביב",
    familyFit: "מתאים למשפחות מטיילות, בהתאם לקטע שנבחר.",
    accessibility: "האתר כולל אזורים מוסדרים. מסלול הנחל אינו מונגש לכל אורכו.",
    summary: "שילוב חזק בין עיר נבטית, תצפיות ומסלול מדברי בנחל, שמתאים ליום שבו רוצים גם סיפור וגם הליכה.",
    highlights: ["עיר נבטית", "נחל ממשית", "סכרים קדומים", "תצפיות מדבר"],
    dayPlan: ["מתחילים באתר ממשית", "מקדישים זמן למבנים ולתצפיות", "ממשיכים למסלול הנחל רק לפי תנאי היום והשעות"],
    safety: ["בודקים סכנת שיטפונות", "לא יוצאים בשעות חום", "מתאימים את המסלול לשעות הפעילות באתר"],
    officialSource: "https://www.parks.org.il/trip/mamshit/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "גן לאומי ממשית",
    tone: "desert",
  },
  {
    slug: "nahal-sfunim",
    name: "מערת ספונים ומצוק מגדים",
    region: "הכרמל",
    areaTags: ["חיפה", "כרמל", "צפון", "עתלית"],
    nature: ["חורש", "מערה", "מצוק"],
    distance: "3 ק״מ קווי או 4 ק״מ מעגלי",
    duration: "3 עד 4 שעות",
    difficulty: "בינוני",
    routeType: "קווי קל או מעגלי בינוני",
    bestSeason: "סתיו עד אביב",
    familyFit: "המסלול הקווי מתאים למשפחות. המעגלי דורש יכולת טובה יותר.",
    accessibility: "שביל טבע ומערה שאינם מונגשים.",
    summary: "הליכה בחורש הכרמל אל מערה ומצוק, עם בחירה בין מסלול קווי רגוע יותר לגרסה מעגלית מאתגרת יותר.",
    highlights: ["מערת ספונים", "חורש כרמל", "מצוק מגדים", "תצפית אל החוף"],
    dayPlan: ["בוחרים מראש קווי או מעגלי", "צועדים בחורש אל המערה", "חוזרים באותה דרך או ממשיכים להשלמת המעגל"],
    safety: ["נדרש פנס לביקור במערה", "אחרי גשם בודקים תנאי שביל", "לא נכנסים למערה אם התנאים אינם בטוחים"],
    officialSource: "https://www.parks.org.il/trip/sfunim/",
    sourceName: "רשות הטבע והגנים",
    mapQuery: "נחל ספונים",
    tone: "forest",
  },
];

const baseMainAreas: Record<string, MainTrailArea> = {
  "snir-hatzbani": "צפון",
  "banias-middle": "צפון",
  "tel-dan-short": "צפון",
  "har-kfir": "צפון",
  "el-al-waterfalls": "כנרת",
  "jordan-river-bridges": "כנרת",
  "ein-afek-wetland": "חיפה",
  "dor-habonim-coast": "חיפה",
  "nahal-sfunim": "חיפה",
  "tzur-natan": "מרכז",
  "nahal-masor": "דרום ונגב",
  "mamshit-stream": "דרום ונגב",
  "ein-prat": "ירושלים",
};

type NewTrail = Pick<Trail, "slug" | "name" | "mainArea" | "region" | "areaTags" | "nature" | "distance" | "duration" | "difficulty" | "routeType" | "bestSeason" | "summary" | "officialSource" | "sourceName" | "mapQuery" | "tone"> & Partial<Pick<Trail, "familyFit" | "accessibility" | "highlights" | "dayPlan" | "safety">>;

function makeTrail(input: NewTrail): Trail {
  return {
    ...input,
    familyFit: input.familyFit || (input.difficulty === "קל" ? "מתאים למשפחות שמורגלות בהליכה קצרה." : "מתאים למשפחות מטיילות לאחר התאמת המסלול לגיל ולכושר."),
    accessibility: input.accessibility || "זהו שביל טבע שאינו מונגש לכל אורכו. יש לבדוק התאמות נקודתיות במקור הרשמי.",
    highlights: input.highlights || [input.nature[0], input.nature[1] || "תצפית", input.region],
    dayPlan: input.dayPlan || ["בודקים את מצב המסלול ומזג האוויר במקור הרשמי", "מתחילים בנקודת המוצא המסומנת ונשארים על השביל", "משאירים זמן לעצירה וחוזרים לפני החשכה"],
    safety: input.safety || ["מטיילים רק בשביל מסומן", "מצטיידים במים, כובע, נעלי הליכה וטלפון טעון", "לא יוצאים בשרב, בסכנת שיטפונות או כאשר האתר סגור"],
  };
}

const supplementalTrails: Trail[] = [
  makeTrail({ slug: "nahal-kziv-montfort", name: "נחל כזיב, עין טמיר ומבצר מונפור", mainArea: "צפון", region: "גליל מערבי", areaTags: ["צפון", "גליל מערבי", "מעלות", "נהריה"], nature: ["נחל", "מעיין", "חורש"], distance: "כ־8 ק״מ", duration: "4 עד 6 שעות", difficulty: "למיטיבי לכת", routeType: "מעגלי", bestSeason: "סתיו עד אביב, ובקיץ רק בשעות מתאימות", summary: "יום הליכה מלא אל ערוץ נחל כזיב, עין טמיר ומבצר מונפור, עם ירידות ועליות משמעותיות ונוף גלילי ירוק.", officialSource: "https://www.parks.org.il/trip/monfor/", sourceName: "רשות הטבע והגנים", mapQuery: "מצפה הילה נחל כזיב", tone: "water", highlights: ["עין טמיר", "מבצר מונפור", "חורש גלילי", "אפיק נחל כזיב"] }),
  makeTrail({ slug: "keshet-cave", name: "מערת קשת ושביל הבוסתנים", mainArea: "צפון", region: "גליל מערבי", areaTags: ["צפון", "גליל מערבי", "אדמית", "נהריה"], nature: ["מצוק", "חורש", "תצפית"], distance: "כקילומטר עד 2 ק״מ", duration: "שעה עד שעתיים", difficulty: "קל", routeType: "מעגלי קצר", bestSeason: "כל השנה, ללא עומס חום", summary: "מסלול קצר ונגיש ברובו אל קשת סלע מרשימה ותצפית רחבה על נחל בצת והגליל המערבי.", officialSource: "https://www.parks.org.il/trip/keshet/", sourceName: "רשות הטבע והגנים", mapQuery: "פארק אדמית מערת קשת", tone: "forest", accessibility: "השביל מן החניה אל תצפית מערת קשת מונגש. שבילי המשך אינם מונגשים במלואם.", highlights: ["מערת קשת", "תצפית לנחל בצת", "שביל הבוסתנים", "חורבת אדמית"] }),

  makeTrail({ slug: "arbel-lookouts", name: "מצוק הארבל ומסלול המצפורים", mainArea: "כנרת", region: "גליל תחתון", areaTags: ["כנרת", "טבריה", "ארבל"], nature: ["מצוק", "תצפית", "עתיקות"], distance: "כשני ק״מ במסלול המשפחתי", duration: "שעה וחצי עד שלוש שעות", difficulty: "קל", routeType: "מעגלי", bestSeason: "סתיו עד אביב, ובקיץ בשעות הבוקר", summary: "מסלול מצפורים משפחתי מעל הכנרת, עם אפשרות להישאר בגרסה הקלה בלי לרדת בשביל המצוק האתגרי.", officialSource: "https://www.parks.org.il/trip/arbel/", sourceName: "רשות הטבע והגנים", mapQuery: "גן לאומי ושמורת טבע ארבל", tone: "forest", safety: ["המסלול האתגרי במצוק כולל יתדות ואינו מתאים לכל מטייל", "מתרחקים משפת המצוק ונשמעים להוראות האתר", "בודקים רוח, חום ושעות פתיחה"] }),
  makeTrail({ slug: "majrasa-family", name: "המג׳רסה, המסלול הרטוב המשפחתי", mainArea: "כנרת", region: "בקעת בית צידה", areaTags: ["כנרת", "גולן", "בית צידה"], nature: ["מים", "לגונה", "צמחיית גדות"], distance: "עד כ־800 מטר במים", duration: "שעה וחצי עד שלוש שעות", difficulty: "קל", routeType: "הלוך וחזרה בשביל יבש", bestSeason: "אביב עד סתיו, לפי מצב המים", summary: "הליכה מרעננת במים רדודים יחסית בשפך נחל דליות, עם יציאות מסודרות וחזרה בשביל יבש.", officialSource: "https://www.parks.org.il/reserve-park/majrase/", sourceName: "רשות הטבע והגנים", mapQuery: "שמורת טבע מג׳רסה", tone: "water", accessibility: "באתר קיים מסלול נגיש עד אזור המים. המסלול הרטוב אינו מונגש לכל אורכו.", safety: ["בודקים מראש אם המסלול הרטוב פתוח", "ילדים נשארים בהשגחה רצופה", "נכנסים עם נעליים מתאימות למים ולא שותים ממי הנחל"] }),
  makeTrail({ slug: "gamla-lookouts", name: "גמלא, מצפור הנשרים והעיר העתיקה", mainArea: "כנרת", region: "מרכז הגולן", areaTags: ["כנרת", "גולן", "קצרין"], nature: ["קניון", "עופות דורסים", "עתיקות"], distance: "מקילומטר ועד מסלול יום", duration: "שעה עד חמש שעות", difficulty: "בינוני", routeType: "מסלולים מעגליים וקוויים", bestSeason: "סתיו עד אביב", summary: "שמורה שמאפשרת לבחור בין תצפית נגישה יחסית על קניון גמלא לבין ירידה ארוכה לעיר העתיקה.", officialSource: "https://www.parks.org.il/reserve-park/gamla/", sourceName: "רשות הטבע והגנים", mapQuery: "שמורת טבע גמלא", tone: "forest", highlights: ["מצפור הנשרים", "העיר העתיקה", "קניון גמלא", "מפל גמלא"] }),
  makeTrail({ slug: "swiss-forest-kinneret", name: "יער שווייץ ומצפורי הכנרת", mainArea: "כנרת", region: "טבריה והכנרת", areaTags: ["כנרת", "טבריה", "פוריה"], nature: ["יער", "תצפית", "נוף כנרת"], distance: "כ־3 ק״מ בקטע הליכה מוצע", duration: "שעה וחצי עד שעתיים", difficulty: "קל", routeType: "הלוך ושוב", bestSeason: "כל השנה, ללא עומס חום", summary: "הליכה נוחה בין מצפורים מעל טבריה והכנרת, שמתאימה לבוקר רגוע או לשעת שקיעה.", officialSource: "https://www.kkl.org.il/parks_and_forests/swiss_forest/", sourceName: "קרן קימת לישראל", mapQuery: "יער שווייץ טבריה", tone: "forest" }),

  makeTrail({ slug: "nahal-mearot", name: "נחל מערות ומערות האדם הקדמון", mainArea: "חיפה", region: "חוף הכרמל", areaTags: ["חיפה", "כרמל", "זכרון יעקב", "עתלית"], nature: ["מערות", "הר", "ארכיאולוגיה"], distance: "כשני ק״מ במסלול הקצר", duration: "שעתיים עד שלוש שעות", difficulty: "קל", routeType: "מעגלי", bestSeason: "כל השנה, ללא עומס חום", summary: "מסלול בין מערות פרהיסטוריות ותצפיות כרמל, עם אפשרות לביקור קצר ונוח או להמשך בעלייה לרכס.", officialSource: "https://www.parks.org.il/trip/meaarot/", sourceName: "רשות הטבע והגנים", mapQuery: "שמורת טבע נחל מערות", tone: "forest", accessibility: "מערת הנחל והחיזיון נגישים. מסלולי הרכס והמדרגות אינם מונגשים במלואם." }),
  makeTrail({ slug: "little-switzerland-carmel", name: "שוויצריה הקטנה ונחל כלח", mainArea: "חיפה", region: "הכרמל", areaTags: ["חיפה", "כרמל", "אוניברסיטת חיפה"], nature: ["חורש", "מצוק", "ערוץ"], distance: "כ־3 עד 5 ק״מ", duration: "שעתיים עד ארבע שעות", difficulty: "בינוני", routeType: "מעגלי", bestSeason: "סתיו עד אביב", summary: "מסלול חורש קלאסי בכרמל בין ערוץ נחל כלח, מצוקים ותצפיות, קרוב לחיפה אבל בתחושת טבע מלאה.", officialSource: "https://www.parks.org.il/reserve-park/carmel/", sourceName: "רשות הטבע והגנים", mapQuery: "חניון שוויצריה הקטנה", tone: "forest" }),
  makeTrail({ slug: "nahal-siach", name: "נחל שיח, מעיינות ומנזר הכרמליתים", mainArea: "חיפה", region: "חיפה והכרמל", areaTags: ["חיפה", "כרמל", "כבביר"], nature: ["נחל", "מעיינות", "חורש"], distance: "כ־3 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "בינוני", routeType: "קווי", bestSeason: "סתיו עד אביב", summary: "ירידה עירונית אל טבע כרמלי, מעיינות, בוסתן ומנזר עתיק, במסלול שמצריך תכנון נקודת סיום.", officialSource: "https://www.haifa.muni.il/place/nahal-siach/", sourceName: "עיריית חיפה", mapQuery: "נחל שיח חיפה", tone: "water", safety: ["מתכננים מראש חזרה או רכב מאסף", "אחרי גשם הסלעים עלולים להיות חלקים", "נשארים על השביל ומכבדים את האתרים לאורך הדרך"] }),

  makeTrail({ slug: "alexander-turtle-bridge", name: "נחל אלכסנדר וגשר הצבים", mainArea: "מרכז", region: "עמק חפר", areaTags: ["מרכז", "שרון", "נתניה", "עמק חפר"], nature: ["נחל", "צבים", "פארק"], distance: "כ־4 ק״מ הלוך ושוב", duration: "שעתיים עד שלוש שעות", difficulty: "קל", routeType: "הלוך ושוב", bestSeason: "כל השנה, ללא עומס חום", summary: "שביל מישורי לצד נחל אלכסנדר אל גשר הצבים, עם נקודות תצפית ופינות עצירה למשפחות.", officialSource: "https://www.kkl.org.il/parks_and_forests/alexander_river/", sourceName: "קרן קימת לישראל", mapQuery: "גשר הצבים נחל אלכסנדר", tone: "wetland", safety: ["אין להאכיל או לגעת בצבים", "נשארים מאחורי המעקות ובשבילים", "נמנעים מהליכה בשעות חמות"] }),
  makeTrail({ slug: "apollonia-cliff", name: "אפולוניה, המבצר מעל הים", mainArea: "מרכז", region: "דרום השרון", areaTags: ["מרכז", "הרצליה", "שרון"], nature: ["מצוק", "ים", "עתיקות"], distance: "כ־2 ק״מ", duration: "שעה וחצי עד שלוש שעות", difficulty: "קל", routeType: "מעגלי", bestSeason: "כל השנה, ללא עומס חום", summary: "מסלול נגיש ברובו בין חפיר, שרידי עיר ומבצר צלבני שניצב על מצוק מעל הים.", officialSource: "https://www.parks.org.il/trip/apolonya/", sourceName: "רשות הטבע והגנים", mapQuery: "גן לאומי אפולוניה", tone: "coast", accessibility: "רוב המסלול המרכזי והמצפורים נגישים. יש לבדוק התאמות נקודתיות באתר." }),
  makeTrail({ slug: "yarkon-tel-afek", name: "תל אפק ומקורות הירקון", mainArea: "מרכז", region: "פתח תקווה וראש העין", areaTags: ["מרכז", "פתח תקווה", "ראש העין"], nature: ["נחל", "אגם", "עתיקות"], distance: "כ־3 ק״מ", duration: "שעתיים עד ארבע שעות", difficulty: "קל", routeType: "מעגלי", bestSeason: "כל השנה", summary: "טיול רגוע בין מבצר אנטיפטריס, אגם, בריכות חורף ומקורות הירקון, עם שבילים קצרים שמתאימים למשפחה.", officialSource: "https://www.parks.org.il/reserve-park/yarkon/", sourceName: "רשות הטבע והגנים", mapQuery: "גן לאומי ירקון תל אפק", tone: "wetland", accessibility: "באתר שבילים נגישים אל מוקדי העניין המרכזיים." }),
  makeTrail({ slug: "ein-hemed", name: "עין חמד, נחל כסלון והמצודה", mainArea: "מרכז", region: "מבואות ירושלים", areaTags: ["מרכז", "אבו גוש", "ירושלים"], nature: ["נחל", "חורש", "מצודה"], distance: "כקילומטר", duration: "שעה עד שלוש שעות", difficulty: "קל", routeType: "מעגלי", bestSeason: "כל השנה", summary: "מסלול קצר ומוצל יחסית לצד ערוץ נחל כסלון, מדשאות ומבנה צלבני, מתאים לעצירה בדרך לירושלים.", officialSource: "https://www.parks.org.il/reserve-park/en-hemed/", sourceName: "רשות הטבע והגנים", mapQuery: "גן לאומי עין חמד", tone: "forest", accessibility: "האתר כולל חניה, שבילים ואזורי פיקניק נגישים." }),
  makeTrail({ slug: "palmahim-estuary", name: "שפך נחל שורק וחוף פלמחים", mainArea: "מרכז", region: "השפלה והחוף", areaTags: ["מרכז", "ראשון לציון", "יבנה", "פלמחים"], nature: ["חוף", "נחל", "דיונות"], distance: "כ־4 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "קל", routeType: "הלוך ושוב", bestSeason: "סתיו עד אביב, ובקיץ בשעות הקרירות", summary: "הליכה בין שפך נחל, דיונות וחוף פתוח, עם תצפיות על סביבת החולות והים.", officialSource: "https://www.parks.org.il/reserve-park/palmachim/", sourceName: "רשות הטבע והגנים", mapQuery: "גן לאומי חוף פלמחים", tone: "coast" }),

  makeTrail({ slug: "tel-aviv-independence-trail", name: "שביל העצמאות בשדרות רוטשילד", mainArea: "תל אביב", region: "לב תל אביב", areaTags: ["תל אביב", "רוטשילד", "מרכז העיר"], nature: ["עיר", "היסטוריה", "אדריכלות"], distance: "כקילומטר", duration: "שעה עד שעתיים", difficulty: "קל", routeType: "קווי", bestSeason: "כל השנה", summary: "מסלול עירוני מסומן שמחבר עשר תחנות מסיפור ראשית תל אביב והכרזת העצמאות.", officialSource: "https://www.tel-aviv.gov.il/Visitors/KnowTelAviv/Pages/IndependenceTrail.aspx", sourceName: "עיריית תל אביב יפו", mapQuery: "שביל העצמאות תל אביב", tone: "coast", accessibility: "המסלול עובר במרחב עירוני מרוצף. יש מעברי כביש ומקטעים משתנים." }),
  makeTrail({ slug: "seven-mills-yarkon", name: "שבע טחנות ולאורך הירקון", mainArea: "תל אביב", region: "פארק הירקון", areaTags: ["תל אביב", "ירקון", "רמת גן"], nature: ["נחל", "פארק", "ציפורים"], distance: "כ־5 ק״מ הלוך ושוב", duration: "שעתיים", difficulty: "קל", routeType: "הלוך ושוב", bestSeason: "כל השנה, בשעות הקרירות", summary: "הליכה מישורית לצד הירקון דרך מתחם שבע טחנות, צמחיית גדות, מדשאות ופינות תצפית.", officialSource: "https://www.tel-aviv.gov.il/Residents/Environment/Pages/ParksAndGardens.aspx", sourceName: "עיריית תל אביב יפו", mapQuery: "שבע טחנות פארק הירקון", tone: "wetland" }),
  makeTrail({ slug: "jaffa-port-charles-clore", name: "מנמל יפו לפארק צ׳רלס קלור", mainArea: "תל אביב", region: "יפו ורצועת החוף", areaTags: ["תל אביב", "יפו", "נמל יפו"], nature: ["ים", "טיילת", "עיר עתיקה"], distance: "כ־3 ק״מ", duration: "שעה וחצי עד שלוש שעות", difficulty: "קל", routeType: "קווי", bestSeason: "כל השנה", summary: "מסלול טיילת פתוח שמחבר את נמל יפו, חופי יפו ופארק צ׳רלס קלור מול הים.", officialSource: "https://www.tel-aviv.gov.il/Visitors/KnowTelAviv/Pages/KnowTelAviv.aspx", sourceName: "עיריית תל אביב יפו", mapQuery: "נמל יפו", tone: "coast", accessibility: "רוב המסלול מרוצף ומישורי. יש לבדוק עבודות ושינויים זמניים לאורך הטיילת." }),
  makeTrail({ slug: "old-jaffa-alley-loop", name: "סמטאות יפו העתיקה וגן הפסגה", mainArea: "תל אביב", region: "יפו העתיקה", areaTags: ["תל אביב", "יפו", "שוק הפשפשים"], nature: ["עיר עתיקה", "תצפית", "אמנות"], distance: "כ־2 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "קל", routeType: "מעגלי", bestSeason: "כל השנה", summary: "מסלול עירוני בין כיכר קדומים, סמטאות האמנים, גן הפסגה ונקודות תצפית אל קו החוף.", officialSource: "https://www.tel-aviv.gov.il/Visitors/KnowTelAviv/Pages/KnowTelAviv.aspx", sourceName: "עיריית תל אביב יפו", mapQuery: "כיכר קדומים יפו", tone: "coast", accessibility: "בחלק מהסמטאות יש מדרגות ואבנים משתלבות. אפשר לבחור חלופה נגישה סביב הכיכרות והטיילת." }),
  makeTrail({ slug: "reading-tel-baruch", name: "פארק רידינג עד חוף תל ברוך", mainArea: "תל אביב", region: "צפון תל אביב", areaTags: ["תל אביב", "רידינג", "תל ברוך"], nature: ["חוף", "פארק", "טיילת"], distance: "כ־4 ק״מ", duration: "שעה וחצי עד שעתיים", difficulty: "קל", routeType: "קווי", bestSeason: "כל השנה, בשעות הקרירות", summary: "הליכת חוף צפונית שמתחילה בשפך הירקון, עוברת בפארק רידינג וממשיכה בטיילת לכיוון תל ברוך.", officialSource: "https://www.tel-aviv.gov.il/Pages/MainItemPage.aspx?ItemID=2291&ListID=81e17809-311d-4bba-9bf1-2363bb9debcd&WebID=3af57d92-807c-43c5-8d5f-6fd455eb2776", sourceName: "עיריית תל אביב יפו", mapQuery: "פארק רידינג", tone: "coast" }),
  makeTrail({ slug: "neve-tzedek-railway-park", name: "נווה צדק ופארק המסילה", mainArea: "תל אביב", region: "דרום תל אביב", areaTags: ["תל אביב", "נווה צדק", "פארק המסילה"], nature: ["עיר", "אדריכלות", "פארק"], distance: "כ־3 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "קל", routeType: "מעגלי מוצע", bestSeason: "כל השנה", summary: "מסלול עירוני בין פארק המסילה, בתי נווה צדק, מרכז סוזן דלל והרחובות הראשונים של העיר.", officialSource: "https://www.tel-aviv.gov.il/Visitors/KnowTelAviv/Pages/KnowTelAviv.aspx", sourceName: "עיריית תל אביב יפו", mapQuery: "פארק המסילה תל אביב", tone: "forest", accessibility: "פארק המסילה נגיש. ברחובות ההיסטוריים רוחב המדרכות והמעברים משתנה." }),

  makeTrail({ slug: "ein-avdat", name: "עין עבדת, הקניון והמעיינות", mainArea: "דרום ונגב", region: "שדה בוקר", areaTags: ["דרום", "נגב", "שדה בוקר", "מצפה רמון"], nature: ["קניון", "מעיין", "מדבר"], distance: "כ־2 ק״מ בגרסה הקצרה", duration: "שעה וחצי עד שלוש שעות", difficulty: "בינוני", routeType: "הלוך ושוב או קווי", bestSeason: "סתיו עד אביב", summary: "קניון גיר עמוק עם נביעות, צמחיית מים ומצוקים, בגרסה קצרה למשפחות או בעלייה מאתגרת יותר.", officialSource: "https://www.parks.org.il/reserve-park/en-avdat/", sourceName: "רשות הטבע והגנים", mapQuery: "גן לאומי עין עבדת", tone: "desert", safety: ["אין כניסה למים", "המסלול העליון כולל מדרגות ויתדות", "בודקים עומס חום, שיטפונות ושעות כניסה"] }),
  makeTrail({ slug: "nahal-havarim", name: "נחל חווארים ובור חווארים", mainArea: "דרום ונגב", region: "שדה בוקר", areaTags: ["דרום", "נגב", "שדה בוקר"], nature: ["חוואר", "מדבר", "בור מים"], distance: "כ־4 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "בינוני", routeType: "קווי", bestSeason: "סתיו עד אביב", summary: "מסלול מדברי בהיר בין בור מים נבטי, ערוץ חוואר ונוף פתוח, פופולרי גם בלילות ירח בתכנון זהיר.", officialSource: "https://www.parks.org.il/new/star-trip-khan-beerot-2019/", sourceName: "רשות הטבע והגנים", mapQuery: "בור חווארים", tone: "desert", safety: ["נדרשת הקפצת רכב למסלול המלא", "טיול לילה מתאים רק עם ניסיון, מפה וציוד", "אין לצאת בסכנת שיטפונות או עומס חום"] }),
  makeTrail({ slug: "ramon-carpentry", name: "המנסרה במכתש רמון", mainArea: "דרום ונגב", region: "מכתש רמון", areaTags: ["דרום", "נגב", "מצפה רמון"], nature: ["מכתש", "גאולוגיה", "מדבר"], distance: "כקילומטר", duration: "כשעה", difficulty: "קל", routeType: "מעגלי קצר", bestSeason: "סתיו עד אביב, ובקיץ מוקדם", summary: "שביל קצר מעל תופעת טבע של אבני חול דמויות מנסרות, בלב הנוף הגאולוגי של מכתש רמון.", officialSource: "https://www.parks.org.il/reserve-park/ramon/", sourceName: "רשות הטבע והגנים", mapQuery: "המנסרה מכתש רמון", tone: "desert" }),
  makeTrail({ slug: "besor-suspension-bridge", name: "דרך הבשור והגשר התלוי", mainArea: "דרום ונגב", region: "הנגב המערבי", areaTags: ["דרום", "נגב מערבי", "אופקים", "אשכול"], nature: ["נחל", "גשר", "בתרונות"], distance: "מסלול נהיגה עם הליכות קצרות", duration: "שלוש עד חמש שעות", difficulty: "קל", routeType: "דרך נוף קווית", bestSeason: "חורף ואביב", summary: "דרך נוף לאורך נחל הבשור עם גשר תלוי, מצפורים, מאגרים והליכות קצרות בין תחנות.", officialSource: "https://www.kkl.org.il/travel/trips/besor_stream/", sourceName: "קרן קימת לישראל", mapQuery: "הגשר התלוי נחל הבשור", tone: "wetland", safety: ["נוסעים רק בדרך המותרת לרכב פרטי", "אין להתקרב לערוץ בזמן שיטפון", "בודקים פתיחת דרכים והנחיות אזוריות לפני היציאה"] }),

  makeTrail({ slug: "sataf-village-trail", name: "שביל הכפר בסטף", mainArea: "ירושלים", region: "הרי ירושלים", areaTags: ["ירושלים", "סטף", "עין כרם"], nature: ["מעיינות", "טרסות", "בוסתנים"], distance: "כ־2 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "קל", routeType: "קווי עם אפשרות חזרה מעגלית", bestSeason: "כל השנה", summary: "הליכה בין עין ביכורה, עין סטף, טרסות חקלאיות ובוסתנים ששומרים את נופי החקלאות הקדומה.", officialSource: "https://www.kkl.org.il/travel/trips/sataf/", sourceName: "קרן קימת לישראל", mapQuery: "סטף חניה עליונה", tone: "forest" }),
  makeTrail({ slug: "aminadav-springs", name: "שביל המעיינות ביער עמינדב", mainArea: "ירושלים", region: "רכס עמינדב", areaTags: ["ירושלים", "עין כרם", "אבן ספיר"], nature: ["מעיינות", "חורש", "טרסות"], distance: "כ־3 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "בינוני", routeType: "קווי", bestSeason: "סתיו עד אביב", summary: "שביל רגלי בין מעיינות שכבה, טרסות וחורש טבעי במדרונות שמדרום מערב לירושלים.", officialSource: "https://www.kkl.org.il/travel/trips/26891/", sourceName: "קרן קימת לישראל", mapQuery: "שביל המעיינות יער עמינדב", tone: "water" }),
  makeTrail({ slug: "jerusalem-forest-cedar", name: "שביל הארז ביער ירושלים", mainArea: "ירושלים", region: "יער ירושלים", areaTags: ["ירושלים", "הר הרצל", "עין כרם"], nature: ["יער", "תצפית", "מורשת"], distance: "כ־4 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "בינוני", routeType: "מעגלי", bestSeason: "כל השנה, ללא עומס חום", summary: "מסלול יער מעגלי בין חורש, ארז בן גוריון ותצפיות לעבר עין כרם והרי ירושלים.", officialSource: "https://www.kkl.org.il/travel/trips/jerusalem_forest/", sourceName: "קרן קימת לישראל", mapQuery: "יער ירושלים חניוני לב היער", tone: "forest" }),
  makeTrail({ slug: "ein-kobi", name: "עין קובי והטרסות בפארק בגין", mainArea: "ירושלים", region: "פארק בגין", areaTags: ["ירושלים", "מבוא ביתר", "צור הדסה"], nature: ["מעיין", "בוסתנים", "טרסות"], distance: "כשני ק״מ", duration: "שעה וחצי עד שלוש שעות", difficulty: "קל", routeType: "מעגלי קצר", bestSeason: "כל השנה", summary: "מסלול קצר סביב מעיין נקבה, טרסות ובוסתנים בפינה שקטה של הרי ירושלים.", officialSource: "https://www.kkl.org.il/travel/kkl_p_beg/", sourceName: "קרן קימת לישראל", mapQuery: "עין קובי פארק בגין", tone: "forest" }),
  makeTrail({ slug: "mount-tayasim-ein-tayasim", name: "מהר טייסים לעין טייסים", mainArea: "ירושלים", region: "הרי ירושלים", areaTags: ["ירושלים", "רמת רזיאל", "צובה"], nature: ["הר", "מעיין", "תצפית"], distance: "כ־3 ק״מ", duration: "שעתיים עד שלוש שעות", difficulty: "בינוני", routeType: "קווי", bestSeason: "סתיו עד אביב", summary: "ירידה מהר טייסים אל מעיין קטן, דרך חורש ותצפיות לנחל שורק ולהרי ירושלים.", officialSource: "https://www.kkl.org.il/travel/trips/187/", sourceName: "קרן קימת לישראל", mapQuery: "הר טייסים", tone: "forest" }),

  makeTrail({ slug: "mount-zefahot-eilat", name: "הר צפחות ותצפית ארבע המדינות", mainArea: "אילת והסביבה", region: "הרי אילת", areaTags: ["אילת", "הערבה", "הרי אילת"], nature: ["הר", "תצפית", "מדבר"], distance: "כ־4 ק״מ", duration: "שלוש עד ארבע שעות", difficulty: "למיטיבי לכת", routeType: "קווי", bestSeason: "חורף ואביב, ביציאה מוקדמת", summary: "עלייה לפסגה הדרומית שמעל מפרץ אילת, עם תצפית רחבה אל ים סוף והרי המדינות השכנות.", officialSource: "https://www.parks.org.il/trip/tzfachot/", sourceName: "רשות הטבע והגנים", mapQuery: "הר צפחות", tone: "desert", safety: ["יוצאים רק בשעות קרירות ועם כמות מים מלאה", "המסלול תלול וחשוף", "מתכננים נקודת סיום והסעה מראש"] }),
  makeTrail({ slug: "red-canyon-eilat", name: "הקניון האדום", mainArea: "אילת והסביבה", region: "הרי אילת", areaTags: ["אילת", "הערבה", "כביש 12"], nature: ["קניון", "אבן חול", "מדבר"], distance: "כ־2 ק״מ", duration: "שעה וחצי עד שעתיים", difficulty: "בינוני", routeType: "מעגלי", bestSeason: "סתיו עד אביב", summary: "מסלול קצר ומרשים בנקיק אבן חול אדומה, עם ירידות בסולמות ויציאה חזרה מעל הקניון.", officialSource: "https://www.parks.org.il/activity/%D7%94%D7%98%D7%91%D7%A2-%D7%94%D7%95%D7%90-%D7%94%D7%99%D7%95%D7%A6%D7%A8-%D7%94%D7%9E%D7%95%D7%9B%D7%A9%D7%A8-%D7%91%D7%99%D7%95%D7%AA%D7%A8-%D7%94%D7%A7%D7%A0%D7%99%D7%95%D7%9F-%D7%94/", sourceName: "רשות הטבע והגנים", mapQuery: "הקניון האדום אילת", tone: "desert", safety: ["המסלול כולל סולמות וירידות צרות", "אין להיכנס בסכנת שיטפונות", "לא יוצאים בעומס חום"] }),
  makeTrail({ slug: "shchoret-canyon", name: "קניון שחורת והסלעים הצבעוניים", mainArea: "אילת והסביבה", region: "הרי אילת", areaTags: ["אילת", "הערבה", "שחורת"], nature: ["קניון", "סלעים צבעוניים", "מדבר"], distance: "כ־5 ק״מ", duration: "שלוש עד ארבע שעות", difficulty: "בינוני", routeType: "מעגלי", bestSeason: "סתיו עד אביב", summary: "מסלול משפחתי למטיילים מנוסים בין סלעים שחורים, ורודים ואדומים, מדרגות סלע ותצפית למפרץ.", officialSource: "https://www.parks.org.il/trip/shchoret/", sourceName: "רשות הטבע והגנים", mapQuery: "קניון שחורת", tone: "desert" }),
  makeTrail({ slug: "amram-pillars", name: "עמודי עמרם", mainArea: "אילת והסביבה", region: "הרי אילת", areaTags: ["אילת", "הערבה", "עמודי עמרם"], nature: ["עמודי סלע", "קניון", "מדבר"], distance: "כ־2 ק״מ", duration: "שעה וחצי עד שעתיים", difficulty: "קל", routeType: "הלוך ושוב", bestSeason: "סתיו עד אביב", summary: "הליכה קצרה אל עמודי אבן חול טבעיים בגווני אדום, בתוך ערוץ מדברי רחב מצפון לאילת.", officialSource: "https://www.parks.org.il/reserve-park/eilat-mountains/", sourceName: "רשות הטבע והגנים", mapQuery: "עמודי עמרם", tone: "desert", safety: ["דרך הגישה עשויה להשתנות לאחר שיטפונות", "בודקים התאמת הרכב והדרך לפני היציאה", "אין לצאת בעומס חום"] }),
  makeTrail({ slug: "timna-arches", name: "הקשתות ועמודי שלמה בפארק תמנע", mainArea: "אילת והסביבה", region: "בקעת תמנע", areaTags: ["אילת", "הערבה", "תמנע"], nature: ["קשתות סלע", "מדבר", "מכרות קדומים"], distance: "מספר הליכות קצרות בין תחנות", duration: "שלוש עד חמש שעות", difficulty: "קל", routeType: "נסיעה עם מסלולים קצרים", bestSeason: "סתיו עד אביב", summary: "יום מדברי שמשלב נסיעה בין תחנות והליכות קצרות אל קשתות, עמודי שלמה ואתרי כרייה עתיקים.", officialSource: "https://www.parktimna.co.il/", sourceName: "פארק תמנע", mapQuery: "פארק תמנע", tone: "desert", accessibility: "חלק מן התחנות והמבואות נגישים. שבילי החול והסלע אינם מונגשים במלואם." }),
  makeTrail({ slug: "eilat-birding-park", name: "פארק הצפרות ובריכות המלח", mainArea: "אילת והסביבה", region: "הערבה הדרומית", areaTags: ["אילת", "הערבה", "פארק הצפרות"], nature: ["ציפורים", "בריכות מלח", "מדבר"], distance: "כ־2 עד 3 ק״מ", duration: "שעה וחצי עד שלוש שעות", difficulty: "קל", routeType: "מעגלי", bestSeason: "כל השנה, בשיא הנדידה באביב ובסתיו", summary: "מסלול מישורי בין מסתורי תצפית, בריכות מים ומלח וציר נדידה בינלאומי של ציפורים.", officialSource: "https://eilatbirds.com/", sourceName: "מרכז הצפרות אילת", mapQuery: "פארק הצפרות אילת", tone: "wetland", accessibility: "השבילים המרכזיים ומסתורי התצפית נוחים יחסית. מומלץ לבדוק נגישות מעודכנת לפני הביקור." }),
];

export const trails: Trail[] = [
  ...baseTrails.map((trail) => ({ ...trail, mainArea: baseMainAreas[trail.slug] } as Trail)),
  ...supplementalTrails,
];

export const regions = ["הכל", ...mainTrailAreas];
export const natureTypes = ["הכל", ...Array.from(new Set(trails.flatMap((trail) => trail.nature)))];

export function getTrail(slug: string) {
  return trails.find((trail) => trail.slug === slug) || trails[0];
}

export function nearbyTrails(area: string, location: string, limit = 6) {
  const exact = trails.filter((trail) => trail.areaTags.some((tag) => area.includes(tag) || location.includes(tag)));
  const fallback = area.includes("צפון") || area.includes("גליל") || area.includes("כנרת")
    ? trails.filter((trail) => trail.mainArea === "צפון" || trail.mainArea === "כנרת")
    : area.includes("ירושלים") || area.includes("ים המלח")
      ? trails.filter((trail) => trail.mainArea === "ירושלים" || trail.mainArea === "דרום ונגב")
      : area.includes("אילת") || area.includes("ערבה")
        ? trails.filter((trail) => trail.mainArea === "אילת והסביבה")
        : trails.filter((trail) => trail.mainArea === "מרכז" || trail.mainArea === "תל אביב" || trail.mainArea === "חיפה");
  return [...exact, ...fallback, ...trails].filter((trail, index, all) => all.findIndex((item) => item.slug === trail.slug) === index).slice(0, limit);
}
