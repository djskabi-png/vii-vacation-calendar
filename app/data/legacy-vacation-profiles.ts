export type LocalizedLegacyCopy = {
  he: string;
  en: string;
  ru: string;
  fr: string;
};

export type LegacyReview = {
  author: LocalizedLegacyCopy;
  visitedAt: string;
  rating: number;
  summary: LocalizedLegacyCopy;
};

export type LegacyVacationProfile = {
  sourceUrl: string;
  checkedAt: string;
  rating?: number;
  reviewCount?: number;
  verifiedStartingPrice?: number;
  features: string[];
  highlights: Array<{ label: string; icon: "units" | "pool" | "spa" | "games" | "garden" | "kitchen" | "view" | "parking" | "accessibility" | "events" | "default" }>;
  featureGroups: Array<{ title: string; items: string[] }>;
  reviews: LegacyReview[];
};

const guest = (he: string, en = "Verified guest", ru = "Проверенный гость", fr = "Client vérifié"): LocalizedLegacyCopy => ({ he, en, ru, fr });
const copy = (he: string, en: string, ru: string, fr: string): LocalizedLegacyCopy => ({ he, en, ru, fr });

// Every value below was checked against the matching VII legacy property page.
// Review text is a faithful summary, not a quotation. Availability and prices are
// used only when a dated public inventory snapshot is stored with source provenance.
export const legacyVacationProfiles: Record<string, LegacyVacationProfile> = {
  "hilat-hanof": {
    sourceUrl: "https://www.vii.co.il/hilat_hanof",
    checkedAt: "2026-08-14",
    rating: 10,
    reviewCount: 180,
    verifiedStartingPrice: 850,
    features: ["4 בקתות עץ", "בריכת שחייה מול הנוף", "ג׳קוזי זוגי בכל בקתה", "חדר אוכל ומטבח משותף", "מדשאות ופינות ישיבה", "עמדת ברביקיו", "נגישות לאנשים עם מוגבלות"],
    highlights: [{ label: "4 בקתות עץ", icon: "units" }, { label: "בריכה צלולה מול הנוף", icon: "pool" }, { label: "ג׳קוזי זוגי בכל בקתה", icon: "spa" }, { label: "חדר אוכל ומטבח משותף", icon: "kitchen" }],
    featureGroups: [
      { title: "בכל בקתה", items: ["מיטה זוגית 160×200", "ג׳קוזי זוגי", "מטבחון מאובזר", "פינת אוכל", "מיזוג אוויר", "טלוויזיה חכמה 50 אינץ׳", "ערוצי yes", "אינטרנט אלחוטי"] },
      { title: "במתחם המשותף", items: ["בריכת שחייה", "ריהוט גן", "פינות שיזוף", "מדשאות", "עמדת ברביקיו", "מטבח חוץ", "חדר אוכל ומטבח משותף"] },
      { title: "מידע חשוב", items: ["צ׳ק־אין החל מ־15:00", "צ׳ק־אאוט עד 11:00", "מתאים למשפחות, לזוגות ולקבוצות", "מתאים לציבור הדתי", "ללא מסיבות רועשות"] },
    ],
    reviews: [
      { author: guest("הודיה"), visitedAt: "2024-06-21", rating: 10, summary: copy("האורחת ציינה שהבקתות מרווחות ומאובזרות, ושיבחה במיוחד את הנוף.", "The guest found the cabins spacious and well equipped, and especially praised the view.", "Гостья отметила просторные и хорошо оборудованные домики и особенно похвалила вид.", "La cliente a trouvé les chalets spacieux et bien équipés, et a particulièrement apprécié la vue.") },
      { author: guest("לינוי"), visitedAt: "2024-06-27", rating: 10, summary: copy("האורחת תיארה חוויית אירוח מושלמת ומקום שמתאים לחופשה מפנקת.", "The guest described a perfect hosting experience and a place suited to a relaxing getaway.", "Гостья описала прекрасный отдых и место, подходящее для приятного отпуска.", "La cliente a décrit une expérience parfaite et un lieu idéal pour un séjour reposant.") },
      { author: guest("אורחת מאומתת"), visitedAt: "2024-05-16", rating: 10, summary: copy("המשפחה ציינה מקום נקי ומרווח, שירות קשוב של לירון והתאמה טובה לילדים.", "The family highlighted the clean, spacious setting, Liron’s attentive service and the suitability for children.", "Семья отметила чистоту, простор, внимательное обслуживание Лирона и удобство для детей.", "La famille a souligné la propreté, l’espace, l’accueil attentionné de Liron et l’adaptation aux enfants.") },
      { author: guest("אורח מאומת"), visitedAt: "2024-04-25", rating: 10, summary: copy("האורח שיבח את הניקיון, את המרחב ואת המענה המהיר לכל בקשה.", "The guest praised the cleanliness, the spacious grounds and the quick response to every request.", "Гость похвалил чистоту, просторную территорию и быстрый ответ на каждую просьбу.", "Le client a apprécié la propreté, les grands espaces et la réponse rapide à chaque demande.") },
    ],
  },
  "vacation-vila-harel": {
    sourceUrl: "https://www.vii.co.il/vila_harel",
    checkedAt: "2026-08-13",
    rating: 10,
    reviewCount: 1,
    features: ["8 חדרי שינה עם חדרי רחצה פרטיים", "בריכה מחוממת ומגודרת", "2 מטבחים מאובזרים", "2 סלונים ופינות אוכל", "חניה פרטית", "אינטרנט אלחוטי", "מתאים למשפחות ולציבור הדתי"],
    highlights: [{ label: "וילה עם 8 חדרי שינה", icon: "units" }, { label: "בריכה מחוממת בגודל 10×4.5 מטר", icon: "pool" }, { label: "לינה עד 30 אורחים", icon: "default" }, { label: "שני מטבחים מאובזרים", icon: "kitchen" }],
    featureGroups: [
      { title: "המתחם החיצוני", items: ["בריכה מחוממת, מגודרת ומוארת", "ריהוט גן", "פינות ישיבה ואוכל", "עמדת מנגל"] },
      { title: "המתחם הפנימי", items: ["2 מטבחים מאובזרים", "2 מסכי טלוויזיה", "ערוצי yes", "אינטרנט אלחוטי", "2 פינות אוכל"] },
      { title: "קהל יעד", items: ["משפחות", "זוגות", "ציבור דתי", "ללא מסיבות רועשות"] },
    ],
    reviews: [{
      author: guest("אריאל ב."), visitedAt: "2025-08-14", rating: 10,
      summary: copy("האורח שיבח את המארח, את התאמת התמונות למציאות, את הבריכה ואת הקרבה לבית הכנסת.", "The guest praised the host, the accurate photos, the pool and the nearby synagogue.", "Гость отметил хозяина, точность фотографий, бассейн и близость синагоги.", "Le client a apprécié l’accueil, la fidélité des photos, la piscine et la synagogue voisine."),
    }],
  },
  "vacation-villa-esem-harimon": {
    sourceUrl: "https://www.vii.co.il/villa_esem_harimon",
    checkedAt: "2026-08-13",
    rating: 9.8,
    reviewCount: 52,
    verifiedStartingPrice: 1100,
    features: ["4 סוויטות", "4 חדרי שינה ו-4 חדרי רחצה", "בריכת שחייה", "ג׳קוזי ספא", "חצר משותפת", "שולחנות משחק", "עמדת מנגל", "לינה עד 14 אורחים"],
    highlights: [{ label: "4 סוויטות", icon: "units" }, { label: "בריכת שחייה", icon: "pool" }, { label: "ג׳קוזי ספא", icon: "spa" }, { label: "לינה עד 14 אורחים", icon: "default" }],
    featureGroups: [
      { title: "המתחם החיצוני", items: ["בריכת שחייה", "ג׳קוזי ספא", "מדשאה", "פינות ישיבה", "עמדת מנגל"] },
      { title: "הסוויטות", items: ["4 חדרי שינה", "4 חדרי רחצה", "מטבחונים", "מיזוג", "מסכי טלוויזיה"] },
      { title: "פנאי", items: ["שולחנות משחק", "מערכת שמע", "חצר משותפת"] },
    ],
    reviews: [
      { author: guest("רינת"), visitedAt: "2025-05-27", rating: 10, summary: copy("המשפחה תיארה מארחים אדיבים וחוויה מוצלחת עם הילדים סביב הבריכה והג׳קוזי.", "The family described kind hosts and a great stay with the children by the pool and hot tub.", "Семья отметила радушных хозяев и отличный отдых с детьми у бассейна и джакузи.", "La famille a apprécié les hôtes attentionnés et le séjour avec les enfants autour de la piscine et du jacuzzi.") },
      { author: guest("רחל נ."), visitedAt: "2025-05-22", rating: 10, summary: copy("האורחת ציינה רמת אירוח גבוהה, ניקיון, פינוק ומארח שדאג לכל צורך.", "The guest highlighted the high standard, cleanliness, comfort and an attentive host.", "Гостья отметила высокий уровень, чистоту, комфорт и внимательного хозяина.", "La cliente a souligné le niveau élevé, la propreté, le confort et l’attention de l’hôte.") },
      { author: guest("אושרית ס."), visitedAt: "2025-02-19", rating: 10, summary: copy("האורחת תיארה מקום נקי ומסודר, מארח סבלני ותחושה ביתית.", "The guest described a clean, orderly place, a patient host and a homely atmosphere.", "Гостья описала чистое и аккуратное место, терпеливого хозяина и домашнюю атмосферу.", "La cliente a décrit un lieu propre et ordonné, un hôte patient et une atmosphère chaleureuse.") },
    ],
  },
  "vacation-gesthouse-royal": {
    sourceUrl: "https://www.vii.co.il/gesthouse_royal",
    checkedAt: "2026-08-13",
    rating: 9.6,
    reviewCount: 26,
    verifiedStartingPrice: 3900,
    features: ["5 חדרי שינה ו-5 חדרי רחצה", "בריכת שחייה", "מערכת הגברה", "מטבח מאובזר", "לינה עד 20 אורחים", "אירועים עד 30 אורחים", "עמדת מנגל"],
    highlights: [{ label: "5 חדרי שינה", icon: "units" }, { label: "בריכת שחייה", icon: "pool" }, { label: "אירועים עד 30 אורחים", icon: "events" }, { label: "לינה עד 20 אורחים", icon: "default" }],
    featureGroups: [
      { title: "אירוח ואירועים", items: ["לינה עד 20 אורחים", "אירועים עד 30 אורחים", "ימי הולדת", "ערבי גיבוש", "מסיבות פרטיות"] },
      { title: "אבזור", items: ["בריכת שחייה", "מערכת הגברה", "פינות ישיבה", "עמדת מנגל", "מטבח מאובזר"] },
      { title: "שירותים בתוספת תשלום", items: ["שף פרטי", "שולחן שוק", "צלם מגנטים", "עיצוב המקום"] },
    ],
    reviews: [
      { author: guest("ברוך נ."), visitedAt: "2026-07-26", rating: 10, summary: copy("האורח שיבח את היחס של בעל המקום, לצד הערות על חימום הבריכה ושעת הפינוי.", "The guest praised the owner’s attitude while noting the pool heating and early checkout time.", "Гость похвалил отношение владельца, но отметил подогрев бассейна и ранний выезд.", "Le client a apprécié l’attitude du propriétaire, tout en signalant le chauffage de la piscine et l’heure de départ.") },
      { author: guest("רייקינך ש."), visitedAt: "2026-05-29", rating: 8, summary: copy("האורחת ציינה שהמתחם מוצלח, אך הבריכה הייתה קרה והאזור החיצוני היה חם.", "The guest liked the venue but noted that the pool was cold and the outdoor area was hot.", "Гостье понравилось место, но бассейн был холодным, а на улице было жарко.", "La cliente a apprécié le lieu, mais a trouvé la piscine froide et l’espace extérieur chaud.") },
      { author: guest("אלפסי ב."), visitedAt: "2026-01-02", rating: 4, summary: copy("האורחת דיווחה על תקלות תחזוקה, בריכה שלא הייתה מחוממת וחוסר זמינות בשירות.", "The guest reported maintenance issues, an unheated pool and difficulty getting service.", "Гостья сообщила о проблемах с обслуживанием, холодном бассейне и трудностях со связью.", "La cliente a signalé des problèmes d’entretien, une piscine non chauffée et un service peu disponible.") },
    ],
  },
  "vacation-villa-yotam": {
    sourceUrl: "https://www.vii.co.il/villa_yotam",
    checkedAt: "2026-08-13",
    rating: 10,
    reviewCount: 3,
    features: ["4 חדרי שינה", "לינה עד 11 אורחים", "בריכה מחוממת", "מטבח מאובזר", "חניה", "אינטרנט אלחוטי", "Xbox", "ללא מסיבות רועשות"],
    highlights: [{ label: "4 חדרי שינה", icon: "units" }, { label: "בריכה מחוממת", icon: "pool" }, { label: "לינה עד 11 אורחים", icon: "default" }, { label: "חניה פרטית", icon: "parking" }],
    featureGroups: [
      { title: "המתחם", items: ["בריכה מחוממת", "חצר פרטית", "עמדת מנגל", "פינות ישיבה"] },
      { title: "בפנים", items: ["4 חדרי שינה", "מטבח מאובזר", "מסכי טלוויזיה", "אינטרנט אלחוטי", "Xbox"] },
      { title: "כללים", items: ["לינה עד 11 אורחים", "ללא מסיבות רועשות"] },
    ],
    reviews: [
      { author: guest("יאנקי"), visitedAt: "2020-03-12", rating: 10, summary: copy("האורח תיאר מקום מושלם, נקי ומסודר שמתאים לחופשה באילת.", "The guest described a perfect, clean and orderly place for a stay in Eilat.", "Гость описал отличное, чистое и аккуратное место для отдыха в Эйлате.", "Le client a décrit un lieu parfait, propre et bien ordonné pour un séjour à Eilat.") },
      { author: guest("נטליה"), visitedAt: "2019-05-09", rating: 10, summary: copy("האורחת הודתה על האירוח וציינה שנהנתה מאוד מהווילה.", "The guest thanked the hosts and said she greatly enjoyed the villa.", "Гостья поблагодарила хозяев и отметила, что ей очень понравилась вилла.", "La cliente a remercié les hôtes et a beaucoup apprécié la villa.") },
      { author: guest("צאלה"), visitedAt: "2020-05-21", rating: 10, summary: copy("האורחת תיארה חופשה מוצלחת ומקום נעים שמתאים למשפחה.", "The guest described a successful stay in a pleasant place suited to families.", "Гостья описала удачный отдых в приятном месте для семей.", "La cliente a décrit un séjour réussi dans un lieu agréable adapté aux familles.") },
    ],
  },
  "vacation-villa-circle": {
    sourceUrl: "https://www.vii.co.il/Villa_Circle",
    checkedAt: "2026-08-13",
    rating: 9.6,
    reviewCount: 99,
    features: ["3 וילות צמודות", "בריכת שחייה", "ג׳קוזי ספא", "סאונה יבשה ורטובה", "מטבח מאובזר", "שולחנות משחק", "נוף גלילי", "מתאים למשפחות ולקבוצות"],
    highlights: [{ label: "3 וילות צמודות", icon: "units" }, { label: "בריכת שחייה בגודל 3.5×12 מטר", icon: "pool" }, { label: "ג׳קוזי וסאונה", icon: "spa" }, { label: "נוף גלילי", icon: "view" }],
    featureGroups: [
      { title: "המתחם החיצוני", items: ["בריכת שחייה", "ג׳קוזי ספא", "סאונה יבשה ורטובה", "פינות שיזוף", "עמדת מנגל"] },
      { title: "המתחם הפנימי", items: ["מטבח מאובזר", "מסך 75 אינץ׳", "פינת אוכל", "סלון מעוצב", "ממ״ד"] },
      { title: "פנאי וקהל יעד", items: ["סנוקר", "פינג פונג", "כדורגל שולחן", "משפחות", "קבוצות", "ציבור דתי"] },
    ],
    reviews: [
      { author: guest("רוויה ב."), visitedAt: "2026-08-09", rating: 2, summary: copy("האורחת דיווחה על רמת ניקיון ותחזוקה נמוכה ועל מענה שלא סיפק אותה.", "The guest reported poor cleanliness and maintenance and was dissatisfied with the response.", "Гостья сообщила о низком уровне чистоты и обслуживания и осталась недовольна ответом.", "La cliente a signalé un manque de propreté et d’entretien ainsi qu’une réponse insatisfaisante.") },
      { author: guest("יובל"), visitedAt: "2026-07-30", rating: 6, summary: copy("האורח ציין שהמתחם מרווח ומתאים לקבוצה, אך העלה הערות על תחזוקה, ציוד וניקיון.", "The guest found the venue spacious and group-friendly but noted maintenance, equipment and cleanliness issues.", "Гость отметил простор и удобство для группы, но указал на обслуживание, оснащение и чистоту.", "Le client a trouvé le lieu spacieux et adapté aux groupes, mais a relevé des problèmes d’entretien, d’équipement et de propreté.") },
      { author: guest("שי ע."), visitedAt: "2026-07-30", rating: 10, summary: copy("האורח סיכם את השהות כחוויה מושלמת.", "The guest described the stay as perfect.", "Гость назвал отдых идеальным.", "Le client a décrit le séjour comme parfait.") },
    ],
  },
};
