"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type SiteLanguage = "he" | "en" | "ru" | "fr";

type LocaleContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
};

const LocaleContext = createContext<LocaleContextValue>({ language: "he", setLanguage: () => undefined });
const languageStorageKey = "vii-site-language";
const hebrewPattern = /[\u0590-\u05ff]/;
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ["aria-label", "alt", "placeholder", "title"];
let originalDocumentTitle = "";

type TranslationBundle = Record<Exclude<SiteLanguage, "he">, Record<string, string>>;
let loadedTranslations: TranslationBundle | null = null;
let translationRequest: Promise<TranslationBundle> | null = null;

function loadTranslations() {
  translationRequest ??= import("./translations.generated.json").then((module) => {
    loadedTranslations = module.default as TranslationBundle;
    return loadedTranslations;
  });
  return translationRequest;
}

const curatedTranslations: Record<Exclude<SiteLanguage, "he">, Record<string, string>> = {
  en: {
    "וי פור ויקיישן": "VII Vacation",
    "וי פור ויקיישן | מוצאים את החופשה שמתאימה לכם": "VII Vacation | Find your perfect stay",
    "כל החופשה, במקום אחד": "Your whole getaway, in one place",
    "מוצאים את החופשה שמתאימה לכם": "Find the getaway that fits you",
    "נופש": "Stays", "אירועים": "Events", "ספא": "Spa", "לפי שעה": "Hourly stays", "ספקים": "Services", "מה עושים": "Things to do",
    "מומלצים שכדאי להכיר": "Recommended stays",
    "המקומות שעושים חשק לארוז": "Places worth packing for",
    "לכל המקומות": "View all stays", "הקודם": "Previous", "הבא": "Next",
    "כל הארץ": "All of Israel", "נופש ברחבי הארץ": "Stays across Israel",
    "יצירת קשר": "Contact us", "פתיחת תפריט": "Open menu", "סגירת תפריט": "Close menu",
    "תצוגה על מפה": "Map view", "תצוגת רשימה": "List view", "פרטים וזמינות": "Details and availability",
    "גלגלת להגדלה ולהקטנה": "Scroll to zoom in and out",
    "סינון": "Filter", "סינון תוצאות": "Filter results", "מיון לפי": "Sort by", "מומלצים": "Recommended",
    "מחיר לפי תאריך": "Price for selected dates", "מקום אירוח שלם": "Entire place",
    "בריכת שחייה": "Swimming pool", "משחקי שולחן": "Games tables", "מטבח מאובזר": "Fully equipped kitchen",
    "אילת והערבה": "Eilat and the Arava", "מישור החוף הדרומי": "Southern Coastal Plain", "סובב כנרת": "Sea of Galilee area",
    "בקעת הירדן": "Jordan Valley", "גליל עליון": "Upper Galilee", "ירושלים והרי יהודה": "Jerusalem and the Judean Hills",
    "גליל מערבי": "Western Galilee", "צפון": "Northern Israel", "כלנית": "Kalanit", "עזריקם": "Azrikam", "אביבים": "Avivim", "גפן": "Gefen", "גלגל": "Gilgal", "שומרה": "Shomera",
    "אקווה ריזורט, וילת החוף": "Aqua Resort, Beachfront Villa", "קסם הרימון": "Kesem HaRimon", "אחוזת האור": "Ahuzat Or",
    "א.ר סוויטות": "A.R. Suites", "סול, מתחם אירוח ואירועים": "Sol, Stay and Events", "סוויטות אינסוף": "Infinity Suites",
    "סוויטות הגן הקסום גפן": "HaGan HaKasum Gefen Suites", "אחוזת אנאאל בגליל": "Anael Estate in the Galilee",
    "וילת הבשמים": "Perfumes Villa", "אחוזת השושנים בוטיק": "Ahuzat HaShoshanim Boutique",
    "נגישות מלאה ומאומתת": "Verified full accessibility", "הצהרת נגישות": "Accessibility statement",
    "הגלריה של": "Gallery of", "כל הסיפור": "All photos", "המקום והמתקנים": "Property and amenities", "יחידות האירוח": "Accommodation units", "חדרי השינה": "Bedrooms", "סרטונים": "Videos", "סגירת הגלריה": "Close gallery", "לגלריה המלאה": "View full gallery",
    "גלריית אורחים": "Guest gallery", "הוספת תמונות וחוות דעת": "Add photos and a review", "תמונות אורחים מאומתות": "Verified guest photos", "חוות דעת מאומתת": "Verified review", "צירוף אסמכתה לביקור": "Attach proof of visit", "בחירת תמונות": "Choose photos",
    "עוזר חכם": "Smart assistant", "שאלו אותי": "Ask me", "העוזר של וי": "VII assistant", "המחשה פעילה באתר": "Interactive preview", "מה תרצו למצוא?": "What would you like to find?", "שליחה": "Send", "סגירת העוזר": "Close assistant",
    "כל הכיוונים": "All regions", "דרום ואילת": "South and Eilat", "צפון וכנרת": "North and Galilee", "לקבוצות": "For groups",
    "היום": "Today", "מחר": "Tomorrow", "סוף השבוע הקרוב": "This weekend", "אוגוסט": "August", "ראש השנה": "Rosh Hashanah", "סוכות": "Sukkot",
    "חופשה באוגוסט": "August getaway", "חופשה בראש השנה": "Rosh Hashanah getaway", "חופשה בסוכות": "Sukkot getaway",
    "זמינות קרובה": "Coming up now", "תקופות מבוקשות": "Popular periods", "התקופה שבחרתם": "Your selected period",
    "בדיקת זמינות": "Check availability", "לכל המקומות בתקופה": "View all stays for this period",
    "חיפוש לפי תאריך קרוב": "Search by a near date", "חיפוש לפי תקופה מבוקשת": "Search by a popular period",
    "מתחילים מהיום, ממחר או מסוף השבוע הקרוב, ואפשר לקפוץ ישר גם לאוגוסט ולחגים. כל בחירה פותחת חיפוש ממוקד לתקופה שבחרתם.": "Start with today, tomorrow or this weekend, or jump straight to August and the holidays. Each choice opens a focused search for that period.",
    "הכרטיסים הם קיצורי חיפוש. זמינות ומחיר סופי יאומתו לאחר בחירת תאריך והרכב.": "These cards are search shortcuts. Availability and final pricing are confirmed after selecting dates and guests.",
  },
  ru: {
    "וי פור ויקיישן": "VII Vacation",
    "וי פור ויקיישן | מוצאים את החופשה שמתאימה לכם": "VII Vacation | Найдите идеальный отдых",
    "כל החופשה, במקום אחד": "Весь отдых в одном месте",
    "מוצאים את החופשה שמתאימה לכם": "Найдите отдых, который подходит именно вам",
    "נופש": "Отдых", "אירועים": "Мероприятия", "ספא": "Спа", "לפי שעה": "Почасовой отдых", "ספקים": "Услуги", "מה עושים": "Чем заняться",
    "מומלצים שכדאי להכיר": "Рекомендуемые места",
    "המקומות שעושים חשק לארוז": "Места, ради которых хочется собрать чемодан",
    "לכל המקומות": "Все места", "הקודם": "Назад", "הבא": "Вперёд",
    "כל הארץ": "Весь Израиль", "נופש ברחבי הארץ": "Отдых по всему Израилю",
    "יצירת קשר": "Связаться с нами", "פתיחת תפריט": "Открыть меню", "סגירת תפריט": "Закрыть меню",
    "תצוגה על מפה": "На карте", "תצוגת רשימה": "Списком", "פרטים וזמינות": "Подробнее и проверить даты",
    "גלגלת להגדלה ולהקטנה": "Прокрутите для изменения масштаба",
    "סינון": "Фильтры", "סינון תוצאות": "Фильтры", "מיון לפי": "Сортировать", "מומלצים": "Рекомендуемые",
    "מחיר לפי תאריך": "Цена на выбранные даты", "מקום אירוח שלם": "Отдельный объект целиком",
    "בריכת שחייה": "Бассейн", "משחקי שולחן": "Игровые столы", "מטבח מאובזר": "Полностью оборудованная кухня",
    "אילת והערבה": "Эйлат и Арава", "מישור החוף הדרומי": "Южная прибрежная равнина", "סובב כנרת": "Район Кинерета",
    "בקעת הירדן": "Иорданская долина", "גליל עליון": "Верхняя Галилея", "ירושלים והרי יהודה": "Иерусалим и Иудейские горы",
    "גליל מערבי": "Западная Галилея", "צפון": "Север Израиля", "כלנית": "Каланит", "עזריקם": "Азрикам", "אביבים": "Авивим", "גפן": "Гефен", "גלגל": "Гильгаль", "שומרה": "Шомера",
    "אקווה ריזורט, וילת החוף": "Aqua Resort, вилла у моря", "קסם הרימון": "Kesem HaRimon", "אחוזת האור": "Ahuzat Or",
    "א.ר סוויטות": "A.R. Suites", "סול, מתחם אירוח ואירועים": "Sol, отдых и мероприятия", "סוויטות אינסוף": "Infinity Suites",
    "סוויטות הגן הקסום גפן": "HaGan HaKasum Gefen Suites", "אחוזת אנאאל בגליל": "Anael Estate в Галилее",
    "וילת הבשמים": "Perfumes Villa", "אחוזת השושנים בוטיק": "Ahuzat HaShoshanim Boutique",
    "נגישות מלאה ומאומתת": "Подтверждённая полная доступность", "הצהרת נגישות": "Заявление о доступности",
    "הגלריה של": "Галерея", "כל הסיפור": "Все фотографии", "המקום והמתקנים": "Объект и удобства", "יחידות האירוח": "Варианты размещения", "חדרי השינה": "Спальни", "סרטונים": "Видео", "סגירת הגלריה": "Закрыть галерею", "לגלריה המלאה": "Открыть всю галерею",
    "גלריית אורחים": "Галерея гостей", "הוספת תמונות וחוות דעת": "Добавить фото и отзыв", "תמונות אורחים מאומתות": "Проверенные фото гостей", "חוות דעת מאומתת": "Проверенный отзыв", "צירוף אסמכתה לביקור": "Подтвердить посещение", "בחירת תמונות": "Выбрать фотографии",
    "עוזר חכם": "Умный помощник", "שאלו אותי": "Спросите меня", "העוזר של וי": "Помощник VII", "המחשה פעילה באתר": "Интерактивная версия", "מה תרצו למצוא?": "Что вы хотите найти?", "שליחה": "Отправить", "סגירת העוזר": "Закрыть помощника",
    "כל הכיוונים": "Все регионы", "דרום ואילת": "Юг и Эйлат", "צפון וכנרת": "Север и Кинерет", "לקבוצות": "Для групп",
    "היום": "Сегодня", "מחר": "Завтра", "סוף השבוע הקרוב": "Ближайшие выходные", "אוגוסט": "Август", "ראש השנה": "Рош ха-Шана", "סוכות": "Суккот",
    "חופשה באוגוסט": "Отдых в августе", "חופשה בראש השנה": "Отдых на Рош ха-Шана", "חופשה בסוכות": "Отдых на Суккот",
    "זמינות קרובה": "Ближайшие даты", "תקופות מבוקשות": "Популярные периоды", "התקופה שבחרתם": "Выбранный период",
    "בדיקת זמינות": "Проверить даты", "לכל המקומות בתקופה": "Все места на этот период",
    "חיפוש לפי תאריך קרוב": "Поиск по ближайшей дате", "חיפוש לפי תקופה מבוקשת": "Поиск по популярному периоду",
    "מתחילים מהיום, ממחר או מסוף השבוע הקרוב, ואפשר לקפוץ ישר גם לאוגוסט ולחגים. כל בחירה פותחת חיפוש ממוקד לתקופה שבחרתם.": "Начните с сегодняшнего дня, завтра или ближайших выходных, либо сразу выберите август и праздники. Каждый вариант открывает поиск на выбранный период.",
    "הכרטיסים הם קיצורי חיפוש. זמינות ומחיר סופי יאומתו לאחר בחירת תאריך והרכב.": "Карточки ведут к поиску. Наличие мест и итоговая цена подтверждаются после выбора дат и состава гостей.",
  },
  fr: {
    "\u05d5\u05d9 \u05e4\u05d5\u05e8 \u05d5\u05d9\u05e7\u05d9\u05d9\u05e9\u05df": "VII Vacation",
    "\u05db\u05dc \u05d4\u05d7\u05d5\u05e4\u05e9\u05d4, \u05d1\u05de\u05e7\u05d5\u05dd \u05d0\u05d7\u05d3": "Toutes vos vacances, au même endroit",
    "\u05de\u05d5\u05e6\u05d0\u05d9\u05dd \u05d0\u05ea \u05d4\u05d7\u05d5\u05e4\u05e9\u05d4 \u05e9\u05de\u05ea\u05d0\u05d9\u05de\u05d4 \u05dc\u05db\u05dd": "Trouvez le séjour qui vous correspond",
    "\u05e0\u05d5\u05e4\u05e9": "Séjours", "\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd": "Événements", "\u05e1\u05e4\u05d0": "Spa", "\u05dc\u05e4\u05d9 \u05e9\u05e2\u05d4": "Séjours à l'heure", "\u05e1\u05e4\u05e7\u05d9\u05dd": "Services", "\u05de\u05d4 \u05e2\u05d5\u05e9\u05d9\u05dd": "À faire",
    "\u05db\u05dc \u05d4\u05d0\u05e8\u05e5": "Tout Israël", "\u05d9\u05e6\u05d9\u05e8\u05ea \u05e7\u05e9\u05e8": "Nous contacter",
    "\u05ea\u05e6\u05d5\u05d2\u05d4 \u05e2\u05dc \u05de\u05e4\u05d4": "Afficher la carte", "\u05ea\u05e6\u05d5\u05d2\u05ea \u05e8\u05e9\u05d9\u05de\u05d4": "Afficher la liste",
    "\u05e1\u05d9\u05e0\u05d5\u05df": "Filtres", "\u05e1\u05d9\u05e0\u05d5\u05df \u05ea\u05d5\u05e6\u05d0\u05d5\u05ea": "Filtrer les résultats", "\u05de\u05d5\u05de\u05dc\u05e6\u05d9\u05dd": "Recommandés",
    "\u05d1\u05d3\u05d9\u05e7\u05ea \u05d6\u05de\u05d9\u05e0\u05d5\u05ea": "Vérifier les disponibilités", "\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05d6\u05de\u05d9\u05e0\u05d5\u05ea": "Détails et disponibilités",
    "\u05de\u05d2\u05d6\u05d9\u05df": "Magazine", "\u05d7\u05d3\u05e9": "Nouveau", "\u05ea\u05e4\u05e8\u05d9\u05d8": "Menu", "\u05e9\u05e4\u05d4": "Langue",
    "\u05e0\u05d2\u05d9\u05e9\u05d5\u05ea \u05de\u05dc\u05d0\u05d4 \u05d5\u05de\u05d0\u05d5\u05de\u05ea\u05ea": "Accessibilité complète vérifiée",
  },
};

const finalUiTranslations: Record<Exclude<SiteLanguage, "he">, Record<string, string>> = {
  en: {
    "הנציג החכם של האתר": "Site concierge",
    "נציג החופשה של וי": "Your VII vacation concierge",
    "זמין עכשיו באתר": "Online on the site",
    "סגירת הנציג": "Close concierge",
    "מתכננים משהו טוב?": "Planning something special?",
    "דברו איתי חופשי, אני מכיר את כל העולמות באתר.": "Tell me freely. I know every part of the site.",
    "נושאים נפוצים": "Popular topics",
    "כתבו לנציג מה תרצו למצוא": "Tell the concierge what you want to find",
    "אפשר לכתוב לי הכל...": "You can ask me anything...",
    "שליחת הודעה": "Send message",
    "רוצים להמשיך עם שירות הלקוחות?": "Prefer customer service?",
    "מעבר לוואטסאפ": "Continue on WhatsApp",
    "נציג החופשה שלכם": "Your vacation concierge",
    "איך אפשר לעזור?": "How can I help?",
    "הודעה חדשה": "New message",
    "פרטי המקום, אפשרויות השהייה והפנייה מרוכזים כאן כדי שאפשר יהיה לבחור בלי לצאת מהאתר.": "Property details, stay options and enquiries are all here, so you can choose without leaving VII.",
    "מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.": "Zoom and move the interactive map right here on the page.",
    "היי, אני הנציג החכם של וי. ספרו לי בחופשיות מה אתם מתכננים, למי, איפה ומתי. אעזור לכם להתמקד ואמצא את העמוד הנכון באתר.": "Hi, I’m VII’s smart concierge. Tell me what you are planning, for whom, where and when. I’ll help you focus and find the right page on the site.",
    "מחפשים נופש": "Find a vacation",
    "אירוע או חגיגה": "Event or celebration",
    "ספא או יום כיף": "Spa or day pass",
    "מה עושים באזור": "Things to do nearby",
    "חדר לכמה שעות": "A room for a few hours",
    "למסלול הזה נבנה הצעה מותאמת": "We will build a tailored offer for this category",
    "המחיר אינו מחויב בשלב הזה": "No payment is charged at this stage",
    "המסלול שנבחר לספקים ולאטרקציות": "Selected plan for suppliers and attractions",
    "פתיחת חשבון והמשך לאימות": "Open an account and continue to verification",
    "שליחת בקשת הצטרפות": "Send membership request",
    "פותחים את החשבון...": "Opening your account...",
    "הקמת העמוד התחילה": "Your page setup has started",
    "פרטי העסק והמסלול שבחרתם נשמרו. לאחר אימות קצר תקבלו גישה להעלאת התוכן וקישור אישי לתשלום מאובטח.": "Your business details and selected plan were saved. After a short verification, you will receive access to upload content and a personal secure payment link.",
    "חזרה לדף הבית": "Back to the home page",
    "השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.": "The request was not sent. Your details remain in the form so you can try again.",
    "\u05e0\u05d5\u05e4\u05e9 \u05d1\u05d0\u05d9\u05dc\u05ea \u05d5\u05d4\u05e2\u05e8\u05d1\u05d4": "Stays in Eilat and the Arava",
    "\u05e0\u05d9\u05e7\u05d5\u05d9 \u05d4\u05db\u05dc": "Clear all",
    "\u05e0\u05d9\u05e7\u05d5\u05d9 \u05e1\u05d9\u05e0\u05d5\u05e0\u05d9\u05dd": "Clear filters",
    "\u05e1\u05d2\u05d9\u05e8\u05d4": "Close",
    "\u05e1\u05d2\u05d9\u05e8\u05ea \u05e1\u05d9\u05e0\u05d5\u05df": "Close filters",
    "\u05e1\u05d5\u05d2 \u05de\u05e7\u05d5\u05dd": "Place type",
    "\u05d4\u05db\u05dc": "All",
    "\u05de\u05d0\u05e4\u05d9\u05d9\u05e0\u05d9\u05dd": "Amenities",
    "\u05d4\u05e4\u05e8\u05d8\u05d9\u05d5\u05ea \u05e9\u05dc\u05db\u05dd \u05d7\u05e9\u05d5\u05d1\u05d4": "Your privacy matters",
    "\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05db\u05dc": "Allow all",
    "\u05d7\u05d9\u05d5\u05e0\u05d9\u05d9\u05dd \u05d1\u05dc\u05d1\u05d3": "Essential only",
    "\u05d4\u05e2\u05d3\u05e4\u05d5\u05ea": "Preferences",
    "\u05e9\u05de\u05d9\u05e8\u05d4": "Save",
    "\u05e0\u05e9\u05de\u05e8": "Saved",
    "\u05e9\u05d9\u05ea\u05d5\u05e3": "Share",
    "\u05d4\u05e6\u05d2 \u05de\u05e1\u05e4\u05e8": "Show phone number",
    "\u05d1\u05d3\u05d9\u05e7\u05ea \u05d6\u05de\u05d9\u05e0\u05d5\u05ea": "Check availability",
    "\u05e2\u05dc \u05d4\u05de\u05e7\u05d5\u05dd": "About",
    "\u05d0\u05d9\u05e4\u05d4 \u05d9\u05e9\u05e0\u05d9\u05dd?": "Where you sleep",
    "\u05e0\u05d2\u05d9\u05e9\u05d5\u05ea \u05d1\u05de\u05e7\u05d5\u05dd": "Accessibility",
    "\u05de\u05d9\u05e7\u05d5\u05dd": "Location",
    "\u05d7\u05e9\u05d5\u05d1 \u05dc\u05d3\u05e2\u05ea": "Good to know",
    "\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05d0\u05ea\u05e8": "Site menu",
    "\u05e0\u05d9\u05d5\u05d5\u05d8 \u05de\u05dc\u05d0": "Full navigation",
    "\u05de\u05ea\u05d7\u05d9\u05dc\u05d9\u05dd \u05de\u05db\u05d0\u05df": "Start here",
    "\u05dc\u05d0\u05df \u05ea\u05e8\u05e6\u05d5 \u05dc\u05d4\u05d2\u05d9\u05e2?": "Where would you like to go?",
    "\u05e0\u05d5\u05e4\u05e9, \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd, \u05e1\u05e4\u05d0, \u05e1\u05e4\u05e7\u05d9\u05dd \u05d5\u05d7\u05d5\u05d5\u05d9\u05d5\u05ea, \u05d1\u05de\u05e7\u05d5\u05dd \u05d0\u05d7\u05d3.": "Stays, events, spa, services and experiences, all in one place.",
    "\u05d5\u05d9\u05dc\u05d5\u05ea, \u05e1\u05d5\u05d5\u05d9\u05d8\u05d5\u05ea \u05d5\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d0\u05d9\u05e8\u05d5\u05d7": "Villas, suites and places to stay",
    "\u05dc\u05d5\u05e4\u05d8\u05d9\u05dd \u05d5\u05de\u05ea\u05d7\u05de\u05d9\u05dd \u05dc\u05db\u05dc \u05d7\u05d2\u05d9\u05d2\u05d4": "Lofts and venues for every celebration",
    "\u05db\u05dc \u05de\u05d4 \u05e9\u05db\u05d9\u05e3 \u05dc\u05e2\u05e9\u05d5\u05ea, \u05d1\u05d3\u05d9\u05d5\u05e7 \u05d1\u05d3\u05e8\u05da \u05e9\u05dc\u05db\u05dd.": "Everything worth doing, your way.",
    "\u05e7\u05d1\u05e6\u05d9\u05dd \u05d7\u05d9\u05d5\u05e0\u05d9\u05d9\u05dd \u05e9\u05d5\u05de\u05e8\u05d9\u05dd \u05e2\u05dc \u05ea\u05e4\u05e7\u05d5\u05d3 \u05d4\u05d0\u05ea\u05e8. \u05db\u05dc\u05d9\u05dd \u05e0\u05d5\u05e1\u05e4\u05d9\u05dd \u05d9\u05d5\u05e4\u05e2\u05dc\u05d5 \u05e8\u05e7 \u05dc\u05e4\u05d9 \u05d4\u05d1\u05d7\u05d9\u05e8\u05d4 \u05e9\u05dc\u05db\u05dd.": "Essential cookies keep the site working. Optional tools are enabled only with your permission.",
    "\u05d4\u05d0\u05d6\u05d5\u05e8 \u05e9\u05de\u05d5\u05e6\u05d2 \u05d1\u05de\u05e4\u05d4": "Area shown on the map",
    "\u05dc\u05e4\u05e8\u05d8\u05d9 \u05d4\u05de\u05e7\u05d5\u05dd": "View place details",
    "\u05d4\u05e6\u05d2\u05ea": "Show",
    "\u05d4\u05e6\u05d2": "Show",
    "\u05de\u05e1\u05e4\u05e8": "number",
    "\u05dc\u05d4\u05e6\u05d9\u05d2": "Show",
    "\u05e2\u05d3": "Up to",
    "\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd": "guests",
    "בוחרים בדרך שנוחה לכם": "Choose the view that suits you",
    "המקומות מסומנים על מפה אינטראקטיבית": "Places are shown on an interactive map",
    "מפה אינטראקטיבית": "Interactive map",
    "פתיחת המפה": "Open map",
    "המפה נטענת...": "Loading map...",
    "טוענים את המפה ואת הסמנים...": "Loading map and markers...",
    "רואים את כל המקומות, משווים אזורים ובוחרים בקלות": "See every place, compare areas and choose easily",
    "מוצג אזור המקום. נקודת ההגעה המדויקת נמסרת לאחר אישור.": "The place area is shown. Exact arrival details are provided after confirmation.",
    "מכירים את האזור לפני שמגיעים": "Explore the area before you arrive",
    "המקום על המפה": "The place on the map",
    "בודקים את האזור, המרחקים והדרך הנוחה להגיע לחוויית הספא.": "Check the area, distances and the easiest way to reach your spa experience.",
    "רואים את אזור המקום ושומרים על פרטיות מלאה. פרטי ההגעה המדויקים נמסרים לאחר אישור.": "See the place area while preserving full privacy. Exact arrival details are provided after confirmation.",
    "ספא וטיפולים": "Spa and treatments",
    "שהייה לפי שעה": "Hourly stay",
    "חבילות וטיפולים": "Packages and treatments",
    "שהייה קצרה": "Short stay",
  },
  ru: {
    "הנציג החכם של האתר": "Умный консультант сайта",
    "נציג החופשה של וי": "Ваш консультант VII",
    "זמין עכשיו באתר": "Сейчас онлайн",
    "סגירת הנציג": "Закрыть консультанта",
    "מתכננים משהו טוב?": "Планируете что-то особенное?",
    "דברו איתי חופשי, אני מכיר את כל העולמות באתר.": "Пишите свободно. Я знаю все разделы сайта.",
    "נושאים נפוצים": "Популярные темы",
    "כתבו לנציג מה תרצו למצוא": "Напишите консультанту, что вы хотите найти",
    "אפשר לכתוב לי הכל...": "Спросите меня о чём угодно...",
    "שליחת הודעה": "Отправить сообщение",
    "רוצים להמשיך עם שירות הלקוחות?": "Хотите продолжить со службой поддержки?",
    "מעבר לוואטסאפ": "Перейти в WhatsApp",
    "נציג החופשה שלכם": "Ваш консультант по отдыху",
    "איך אפשר לעזור?": "Чем помочь?",
    "הודעה חדשה": "Новое сообщение",
    "פרטי המקום, אפשרויות השהייה והפנייה מרוכזים כאן כדי שאפשר יהיה לבחור בלי לצאת מהאתר.": "Все сведения об объекте, варианты размещения и запрос собраны здесь, чтобы выбрать, не покидая VII.",
    "מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.": "Масштабируйте и перемещайте интерактивную карту прямо на этой странице.",
    "היי, אני הנציג החכם של וי. ספרו לי בחופשיות מה אתם מתכננים, למי, איפה ומתי. אעזור לכם להתמקד ואמצא את העמוד הנכון באתר.": "Здравствуйте, я умный консультант VII. Расскажите, что вы планируете, для кого, где и когда. Я помогу уточнить запрос и найти нужную страницу сайта.",
    "מחפשים נופש": "Найти отдых",
    "אירוע או חגיגה": "Мероприятие",
    "ספא או יום כיף": "Спа или день отдыха",
    "מה עושים באזור": "Что делать рядом",
    "חדר לכמה שעות": "Номер на несколько часов",
    "למסלול הזה נבנה הצעה מותאמת": "Для этой категории мы подготовим индивидуальное предложение",
    "המחיר אינו מחויב בשלב הזה": "На этом этапе оплата не взимается",
    "המסלול שנבחר לספקים ולאטרקציות": "Выбранный тариф для поставщиков и достопримечательностей",
    "פתיחת חשבון והמשך לאימות": "Открыть аккаунт и перейти к проверке",
    "שליחת בקשת הצטרפות": "Отправить заявку на подключение",
    "פותחים את החשבון...": "Открываем ваш аккаунт...",
    "הקמת העמוד התחילה": "Создание страницы началось",
    "פרטי העסק והמסלול שבחרתם נשמרו. לאחר אימות קצר תקבלו גישה להעלאת התוכן וקישור אישי לתשלום מאובטח.": "Данные компании и выбранный тариф сохранены. После короткой проверки вы получите доступ для загрузки контента и личную ссылку на безопасную оплату.",
    "חזרה לדף הבית": "Вернуться на главную",
    "השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.": "Заявка не отправлена. Данные остались в форме, и вы можете попробовать снова.",
    "\u05e0\u05d5\u05e4\u05e9 \u05d1\u05d0\u05d9\u05dc\u05ea \u05d5\u05d4\u05e2\u05e8\u05d1\u05d4": "\u041e\u0442\u0434\u044b\u0445 \u0432 \u042d\u0439\u043b\u0430\u0442\u0435 \u0438 \u0410\u0440\u0430\u0432\u0435",
    "\u05e0\u05d9\u05e7\u05d5\u05d9 \u05d4\u05db\u05dc": "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0432\u0441\u0451",
    "\u05e0\u05d9\u05e7\u05d5\u05d9 \u05e1\u05d9\u05e0\u05d5\u05e0\u05d9\u05dd": "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b",
    "\u05e1\u05d2\u05d9\u05e8\u05d4": "\u0417\u0430\u043a\u0440\u044b\u0442\u044c",
    "\u05e1\u05d2\u05d9\u05e8\u05ea \u05e1\u05d9\u05e0\u05d5\u05df": "\u0417\u0430\u043a\u0440\u044b\u05e2",
    "\u05e1\u05d5\u05d2 \u05de\u05e7\u05d5\u05dd": "\u0422\u0438\u043f \u043c\u0435\u0441\u0442\u0430",
    "\u05d4\u05db\u05dc": "\u0412\u0441\u0435",
    "\u05de\u05d0\u05e4\u05d9\u05d9\u05e0\u05d9\u05dd": "\u0423\u0434\u043e\u0431\u0441\u0442\u0432\u0430",
    "\u05d4\u05e4\u05e8\u05d8\u05d9\u05d5\u05ea \u05e9\u05dc\u05db\u05dd \u05d7\u05e9\u05d5\u05d1\u05d4": "\u0412\u0430\u0448\u0430 \u043a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0432\u0430\u0436\u043d\u0430",
    "\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05db\u05dc": "\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u0432\u0441\u0451",
    "\u05d7\u05d9\u05d5\u05e0\u05d9\u05d9\u05dd \u05d1\u05dc\u05d1\u05d3": "\u0422\u043e\u043b\u044c\u043a\u043e \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u044b\u0435",
    "\u05d4\u05e2\u05d3\u05e4\u05d5\u05ea": "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
    "\u05e9\u05de\u05d9\u05e8\u05d4": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
    "\u05e0\u05e9\u05de\u05e8": "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e",
    "\u05e9\u05d9\u05ea\u05d5\u05e3": "\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f",
    "\u05d4\u05e6\u05d2 \u05de\u05e1\u05e4\u05e8": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0442\u0435\u043b\u0435\u0444\u043e\u043d",
    "\u05d1\u05d3\u05d9\u05e7\u05ea \u05d6\u05de\u05d9\u05e0\u05d5\u05ea": "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043d\u0430\u043b\u0438\u0447\u0438\u0435",
    "\u05e2\u05dc \u05d4\u05de\u05e7\u05d5\u05dd": "\u041e \u043c\u0435\u0441\u0442\u0435",
    "\u05d0\u05d9\u05e4\u05d4 \u05d9\u05e9\u05e0\u05d9\u05dd?": "\u0413\u0434\u0435 \u0432\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u0441\u043f\u0430\u0442\u044c",
    "\u05e0\u05d2\u05d9\u05e9\u05d5\u05ea \u05d1\u05de\u05e7\u05d5\u05dd": "\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0441\u0442\u044c",
    "\u05de\u05d9\u05e7\u05d5\u05dd": "\u041c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435",
    "\u05d7\u05e9\u05d5\u05d1 \u05dc\u05d3\u05e2\u05ea": "\u0412\u0430\u0436\u043d\u043e \u0437\u043d\u0430\u0442\u044c",
    "\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05d0\u05ea\u05e8": "\u041c\u0435\u043d\u044e \u0441\u0430\u0439\u0442\u0430",
    "\u05e0\u05d9\u05d5\u05d5\u05d8 \u05de\u05dc\u05d0": "\u041f\u043e\u043b\u043d\u0430\u044f \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f",
    "\u05de\u05ea\u05d7\u05d9\u05dc\u05d9\u05dd \u05de\u05db\u05d0\u05df": "\u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u0437\u0434\u0435\u0441\u044c",
    "\u05dc\u05d0\u05df \u05ea\u05e8\u05e6\u05d5 \u05dc\u05d4\u05d2\u05d9\u05e2?": "\u041a\u0443\u0434\u0430 \u0432\u044b \u0445\u043e\u0442\u0438\u0442\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c\u0441\u044f?",
    "\u05e0\u05d5\u05e4\u05e9, \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd, \u05e1\u05e4\u05d0, \u05e1\u05e4\u05e7\u05d9\u05dd \u05d5\u05d7\u05d5\u05d5\u05d9\u05d5\u05ea, \u05d1\u05de\u05e7\u05d5\u05dd \u05d0\u05d7\u05d3.": "\u041e\u0442\u0434\u044b\u0445, \u043c\u0435\u0440\u043e\u043f\u0440\u0438\u044f\u0442\u0438\u044f, \u0441\u043f\u0430, \u0443\u0441\u043b\u0443\u0433\u0438 \u0438 \u0432\u043f\u0435\u0447\u0430\u0442\u043b\u0435\u043d\u0438\u044f, \u0432\u0441\u0451 \u0432 \u043e\u0434\u043d\u043e\u043c \u043c\u0435\u0441\u0442\u0435.",
    "\u05d5\u05d9\u05dc\u05d5\u05ea, \u05e1\u05d5\u05d5\u05d9\u05d8\u05d5\u05ea \u05d5\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d0\u05d9\u05e8\u05d5\u05d7": "\u0412\u0438\u043b\u043b\u044b, \u043b\u044e\u043a\u0441\u044b \u0438 \u043c\u0435\u0441\u0442\u0430 \u0434\u043b\u044f \u043e\u0442\u0434\u044b\u0445\u0430",
    "\u05dc\u05d5\u05e4\u05d8\u05d9\u05dd \u05d5\u05de\u05ea\u05d7\u05de\u05d9\u05dd \u05dc\u05db\u05dc \u05d7\u05d2\u05d9\u05d2\u05d4": "\u041b\u043e\u0444\u0442\u044b \u0438 \u043f\u043b\u043e\u0449\u0430\u0434\u043a\u0438 \u0434\u043b\u044f \u043b\u044e\u0431\u043e\u0433\u043e \u043f\u0440\u0430\u0437\u0434\u043d\u0438\u043a\u0430",
    "\u05db\u05dc \u05de\u05d4 \u05e9\u05db\u05d9\u05e3 \u05dc\u05e2\u05e9\u05d5\u05ea, \u05d1\u05d3\u05d9\u05d5\u05e7 \u05d1\u05d3\u05e8\u05da \u05e9\u05dc\u05db\u05dd.": "\u0412\u0441\u0451 \u0441\u0430\u043c\u043e\u0435 \u0438\u043d\u0442\u0435\u0440\u0435\u0441\u043d\u043e\u0435, \u043f\u043e-\u0432\u0430\u0448\u0435\u043c\u0443.",
    "\u05e7\u05d1\u05e6\u05d9\u05dd \u05d7\u05d9\u05d5\u05e0\u05d9\u05d9\u05dd \u05e9\u05d5\u05de\u05e8\u05d9\u05dd \u05e2\u05dc \u05ea\u05e4\u05e7\u05d5\u05d3 \u05d4\u05d0\u05ea\u05e8. \u05db\u05dc\u05d9\u05dd \u05e0\u05d5\u05e1\u05e4\u05d9\u05dd \u05d9\u05d5\u05e4\u05e2\u05dc\u05d5 \u05e8\u05e7 \u05dc\u05e4\u05d9 \u05d4\u05d1\u05d7\u05d9\u05e8\u05d4 \u05e9\u05dc\u05db\u05dd.": "\u041d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u044b\u0435 cookie \u043e\u0431\u0435\u0441\u043f\u0435\u0447\u0438\u0432\u0430\u044e\u0442 \u0440\u0430\u0431\u043e\u0442\u0443 \u0441\u0430\u0439\u0442\u0430. \u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b \u0432\u043a\u043b\u044e\u0447\u0430\u044e\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0441 \u0432\u0430\u0448\u0435\u0433\u043e \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u044f.",
    "\u05d4\u05d0\u05d6\u05d5\u05e8 \u05e9\u05de\u05d5\u05e6\u05d2 \u05d1\u05de\u05e4\u05d4": "\u041e\u0431\u043b\u0430\u0441\u0442\u044c \u043d\u0430 \u043a\u0430\u0440\u0442\u0435",
    "\u05dc\u05e4\u05e8\u05d8\u05d9 \u05d4\u05de\u05e7\u05d5\u05dd": "\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u0435\u0435 \u043e \u043c\u0435\u0441\u0442\u0435",
    "\u05d4\u05e6\u05d2\u05ea": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c",
    "\u05d4\u05e6\u05d2": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c",
    "\u05de\u05e1\u05e4\u05e8": "\u043d\u043e\u043c\u0435\u0440",
    "\u05dc\u05d4\u05e6\u05d9\u05d2": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c",
    "\u05e2\u05d3": "\u0434\u043e",
    "\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd": "\u0433\u043e\u0441\u0442\u0435\u0439",
    "בוחרים בדרך שנוחה לכם": "Выберите удобный вид",
    "המקומות מסומנים על מפה אינטראקטיבית": "Места отмечены на интерактивной карте",
    "מפה אינטראקטיבית": "Интерактивная карта",
    "פתיחת המפה": "Открыть карту",
    "המפה נטענת...": "Карта загружается...",
    "טוענים את המפה ואת הסמנים...": "Загружаем карту и маркеры...",
    "רואים את כל המקומות, משווים אזורים ובוחרים בקלות": "Все места на карте, сравнивайте районы и выбирайте",
    "מוצג אזור המקום. נקודת ההגעה המדויקת נמסרת לאחר אישור.": "Показан район. Точные данные для прибытия предоставляются после подтверждения.",
    "מכירים את האזור לפני שמגיעים": "Изучите район до приезда",
    "המקום על המפה": "Место на карте",
    "בודקים את האזור, המרחקים והדרך הנוחה להגיע לחוויית הספא.": "Проверьте район, расстояния и удобный маршрут до спа.",
    "רואים את אזור המקום ושומרים על פרטיות מלאה. פרטי ההגעה המדויקים נמסרים לאחר אישור.": "Показан район места, конфиденциальность сохранена. Точные данные для прибытия предоставляются после подтверждения.",
    "ספא וטיפולים": "Спа и процедуры",
    "שהייה לפי שעה": "Почасовое пребывание",
    "חבילות וטיפולים": "Пакеты и процедуры",
    "שהייה קצרה": "Короткое пребывание",
  },
  fr: {
    "הנציג החכם של האתר": "Concierge intelligent du site",
    "נציג החופשה של וי": "Votre concierge VII",
    "זמין עכשיו באתר": "Disponible sur le site",
    "סגירת הנציג": "Fermer le concierge",
    "מתכננים משהו טוב?": "Vous préparez un beau projet ?",
    "דברו איתי חופשי, אני מכיר את כל העולמות באתר.": "Parlez-moi librement. Je connais tous les univers du site.",
    "נושאים נפוצים": "Sujets populaires",
    "כתבו לנציג מה תרצו למצוא": "Dites au concierge ce que vous recherchez",
    "אפשר לכתוב לי הכל...": "Vous pouvez tout me demander...",
    "שליחת הודעה": "Envoyer le message",
    "רוצים להמשיך עם שירות הלקוחות?": "Vous préférez le service client ?",
    "מעבר לוואטסאפ": "Continuer sur WhatsApp",
    "נציג החופשה שלכם": "Votre concierge vacances",
    "איך אפשר לעזור?": "Comment vous aider ?",
    "הודעה חדשה": "Nouveau message",
    "פרטי המקום, אפשרויות השהייה והפנייה מרוכזים כאן כדי שאפשר יהיה לבחור בלי לצאת מהאתר.": "Les informations du lieu, les options de séjour et la demande sont réunies ici pour choisir sans quitter VII.",
    "מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.": "Zoomez et déplacez la carte interactive directement sur cette page.",
    "היי, אני הנציג החכם של וי. ספרו לי בחופשיות מה אתם מתכננים, למי, איפה ומתי. אעזור לכם להתמקד ואמצא את העמוד הנכון באתר.": "Bonjour, je suis le concierge intelligent de VII. Dites-moi ce que vous préparez, pour qui, où et quand. Je vous aiderai à préciser votre recherche et à trouver la bonne page.",
    "מחפשים נופש": "Trouver un séjour",
    "אירוע או חגיגה": "Événement ou fête",
    "ספא או יום כיף": "Spa ou journée détente",
    "מה עושים באזור": "Que faire à proximité",
    "חדר לכמה שעות": "Une chambre pour quelques heures",
    "למסלול הזה נבנה הצעה מותאמת": "Nous préparerons une offre sur mesure pour cette catégorie",
    "המחיר אינו מחויב בשלב הזה": "Aucun paiement n’est facturé à cette étape",
    "המסלול שנבחר לספקים ולאטרקציות": "Formule sélectionnée pour les prestataires et les attractions",
    "פתיחת חשבון והמשך לאימות": "Ouvrir un compte et continuer vers la vérification",
    "שליחת בקשת הצטרפות": "Envoyer la demande d’inscription",
    "פותחים את החשבון...": "Ouverture de votre compte...",
    "הקמת העמוד התחילה": "La création de votre page a commencé",
    "פרטי העסק והמסלול שבחרתם נשמרו. לאחר אימות קצר תקבלו גישה להעלאת התוכן וקישור אישי לתשלום מאובטח.": "Les informations de l’entreprise et la formule choisie ont été enregistrées. Après une courte vérification, vous recevrez un accès pour importer le contenu et un lien personnel de paiement sécurisé.",
    "חזרה לדף הבית": "Retour à l’accueil",
    "השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.": "La demande n’a pas été envoyée. Vos informations restent dans le formulaire afin que vous puissiez réessayer.",
    "\u05e0\u05d5\u05e4\u05e9 \u05d1\u05d0\u05d9\u05dc\u05ea \u05d5\u05d4\u05e2\u05e8\u05d1\u05d4": "Séjours à Eilat et dans l'Arava",
    "\u05e0\u05d9\u05e7\u05d5\u05d9 \u05d4\u05db\u05dc": "Tout effacer",
    "\u05e0\u05d9\u05e7\u05d5\u05d9 \u05e1\u05d9\u05e0\u05d5\u05e0\u05d9\u05dd": "Réinitialiser les filtres",
    "\u05e1\u05d2\u05d9\u05e8\u05d4": "Fermer",
    "\u05e1\u05d2\u05d9\u05e8\u05ea \u05e1\u05d9\u05e0\u05d5\u05df": "Fermer les filtres",
    "\u05e1\u05d5\u05d2 \u05de\u05e7\u05d5\u05dd": "Type de lieu",
    "\u05d4\u05db\u05dc": "Tous",
    "\u05de\u05d0\u05e4\u05d9\u05d9\u05e0\u05d9\u05dd": "Équipements",
    "\u05d4\u05e4\u05e8\u05d8\u05d9\u05d5\u05ea \u05e9\u05dc\u05db\u05dd \u05d7\u05e9\u05d5\u05d1\u05d4": "Votre vie privée compte",
    "\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05db\u05dc": "Tout autoriser",
    "\u05d7\u05d9\u05d5\u05e0\u05d9\u05d9\u05dd \u05d1\u05dc\u05d1\u05d3": "Essentiels uniquement",
    "\u05d4\u05e2\u05d3\u05e4\u05d5\u05ea": "Préférences",
    "\u05e9\u05de\u05d9\u05e8\u05d4": "Enregistrer",
    "\u05e0\u05e9\u05de\u05e8": "Enregistré",
    "\u05e9\u05d9\u05ea\u05d5\u05e3": "Partager",
    "\u05d4\u05e6\u05d2 \u05de\u05e1\u05e4\u05e8": "Afficher le numéro",
    "\u05d1\u05d3\u05d9\u05e7\u05ea \u05d6\u05de\u05d9\u05e0\u05d5\u05ea": "Vérifier les disponibilités",
    "\u05e2\u05dc \u05d4\u05de\u05e7\u05d5\u05dd": "À propos",
    "\u05d0\u05d9\u05e4\u05d4 \u05d9\u05e9\u05e0\u05d9\u05dd?": "Où dormirez-vous ?",
    "\u05e0\u05d2\u05d9\u05e9\u05d5\u05ea \u05d1\u05de\u05e7\u05d5\u05dd": "Accessibilité",
    "\u05de\u05d9\u05e7\u05d5\u05dd": "Emplacement",
    "\u05d7\u05e9\u05d5\u05d1 \u05dc\u05d3\u05e2\u05ea": "Bon à savoir",
    "\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05d0\u05ea\u05e8": "Menu du site",
    "\u05e0\u05d9\u05d5\u05d5\u05d8 \u05de\u05dc\u05d0": "Navigation complète",
    "\u05de\u05ea\u05d7\u05d9\u05dc\u05d9\u05dd \u05de\u05db\u05d0\u05df": "Commencez ici",
    "\u05dc\u05d0\u05df \u05ea\u05e8\u05e6\u05d5 \u05dc\u05d4\u05d2\u05d9\u05e2?": "Où souhaitez-vous aller ?",
    "\u05e0\u05d5\u05e4\u05e9, \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd, \u05e1\u05e4\u05d0, \u05e1\u05e4\u05e7\u05d9\u05dd \u05d5\u05d7\u05d5\u05d5\u05d9\u05d5\u05ea, \u05d1\u05de\u05e7\u05d5\u05dd \u05d0\u05d7\u05d3.": "Séjours, événements, spa, services et expériences, au même endroit.",
    "\u05d5\u05d9\u05dc\u05d5\u05ea, \u05e1\u05d5\u05d5\u05d9\u05d8\u05d5\u05ea \u05d5\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d0\u05d9\u05e8\u05d5\u05d7": "Villas, suites et hébergements",
    "\u05dc\u05d5\u05e4\u05d8\u05d9\u05dd \u05d5\u05de\u05ea\u05d7\u05de\u05d9\u05dd \u05dc\u05db\u05dc \u05d7\u05d2\u05d9\u05d2\u05d4": "Lofts et lieux pour toutes les célébrations",
    "\u05db\u05dc \u05de\u05d4 \u05e9\u05db\u05d9\u05e3 \u05dc\u05e2\u05e9\u05d5\u05ea, \u05d1\u05d3\u05d9\u05d5\u05e7 \u05d1\u05d3\u05e8\u05da \u05e9\u05dc\u05db\u05dd.": "Tout ce qui vaut la peine d'être vécu, à votre façon.",
    "\u05d0\u05d9\u05da \u05d1\u05d5\u05d7\u05e8\u05d9\u05dd \u05de\u05e7\u05d5\u05dd \u05e9\u05d1\u05d0\u05de\u05ea \u05de\u05ea\u05d0\u05d9\u05dd \u05dc\u05d4\u05e8\u05db\u05d1 \u05e9\u05dc\u05db\u05dd": "Comment choisir un hébergement vraiment adapté à votre groupe",
    "\u05d4\u05d0\u05d6\u05d5\u05e8 \u05e9\u05de\u05d5\u05e6\u05d2 \u05d1\u05de\u05e4\u05d4": "Zone affichée sur la carte",
    "\u05dc\u05e4\u05e8\u05d8\u05d9 \u05d4\u05de\u05e7\u05d5\u05dd": "Voir les détails du lieu",
    "\u05d4\u05e6\u05d2\u05ea": "Afficher", "\u05d4\u05e6\u05d2": "Afficher", "\u05de\u05e1\u05e4\u05e8": "numéro", "\u05dc\u05d4\u05e6\u05d9\u05d2": "Afficher", "\u05e2\u05d3": "Jusqu'à", "\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd": "voyageurs",
    "בוחרים בדרך שנוחה לכם": "Choisissez la vue qui vous convient",
    "המקומות מסומנים על מפה אינטראקטיבית": "Les lieux sont indiqués sur une carte interactive",
    "מפה אינטראקטיבית": "Carte interactive",
    "פתיחת המפה": "Ouvrir la carte",
    "המפה נטענת...": "Chargement de la carte...",
    "טוענים את המפה ואת הסמנים...": "Chargement de la carte et des repères...",
    "רואים את כל המקומות, משווים אזורים ובוחרים בקלות": "Affichez tous les lieux, comparez les zones et choisissez facilement",
    "מוצג אזור המקום. נקודת ההגעה המדויקת נמסרת לאחר אישור.": "La zone du lieu est affichée. Les indications exactes sont fournies après confirmation.",
    "מכירים את האזור לפני שמגיעים": "Découvrez la zone avant votre arrivée",
    "המקום על המפה": "Le lieu sur la carte",
    "בודקים את האזור, המרחקים והדרך הנוחה להגיע לחוויית הספא.": "Vérifiez la zone, les distances et le trajet le plus pratique vers votre expérience spa.",
    "רואים את אזור המקום ושומרים על פרטיות מלאה. פרטי ההגעה המדויקים נמסרים לאחר אישור.": "La zone du lieu est visible tout en préservant votre confidentialité. Les indications exactes sont fournies après confirmation.",
    "ספא וטיפולים": "Spa et soins",
    "שהייה לפי שעה": "Séjour à l'heure",
    "חבילות וטיפולים": "Formules et soins",
    "שהייה קצרה": "Court séjour",
  },
};

function normalizeLanguage(value: string | null): SiteLanguage {
  return value === "en" || value === "ru" || value === "fr" ? value : "he";
}

function initialLanguage(): SiteLanguage {
  if (typeof window === "undefined") return "he";
  const urlLanguage = new URLSearchParams(window.location.search).get("lang");
  return normalizeLanguage(urlLanguage || localStorage.getItem(languageStorageKey));
}

function dictionary(language: SiteLanguage): Record<string, string> {
  return language === "he" ? {} : loadedTranslations?.[language] || {};
}

function translateDynamic(value: string, language: Exclude<SiteLanguage, "he">) {
  const showPlacesMatch = value.match(/^\u05d4\u05e6\u05d2\u05ea (\d+) \u05de\u05e7\u05d5\u05de\u05d5\u05ea$/);
  if (showPlacesMatch) {
    return language === "en"
      ? "Show " + showPlacesMatch[1] + " places"
      : language === "fr"
        ? "Afficher " + showPlacesMatch[1] + " lieux"
        : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c " + showPlacesMatch[1] + " \u043c\u0435\u0441\u0442";
  }

  const placesInListMatch = value.match(/^(\d+) \u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d1\u05e8\u05e9\u05d9\u05de\u05d4$/);
  if (placesInListMatch) {
    return language === "en"
      ? placesInListMatch[1] + " places in the list"
      : language === "fr"
        ? placesInListMatch[1] + " lieux dans la liste"
        : placesInListMatch[1] + " \u043c\u0435\u0441\u0442 \u0432 \u0441\u043f\u0438\u0441\u043a\u0435";
  }

  const placesOnMapMatch = value.match(/^(\d+) \u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05e2\u05dc \u05d4\u05de\u05e4\u05d4$/);
  if (placesOnMapMatch) {
    return language === "en"
      ? placesOnMapMatch[1] + " places on the map"
      : language === "fr"
        ? placesOnMapMatch[1] + " lieux sur la carte"
        : placesOnMapMatch[1] + " \u043c\u0435\u0441\u0442 \u043d\u0430 \u043a\u0430\u0440\u0442\u0435";
  }

  const destinationMatch = value.match(/^\u05e0\u05d5\u05e4\u05e9 \u05d1(.+)$/);
  if (destinationMatch) {
    const sourceDestination = destinationMatch[1];
    const translatedDestination = finalUiTranslations[language][sourceDestination]
      || curatedTranslations[language][sourceDestination]
      || dictionary(language)[sourceDestination]
      || sourceDestination;
    return language === "en"
      ? "Stays in " + translatedDestination
      : language === "fr"
        ? "Séjours à " + translatedDestination
        : "\u041e\u0442\u0434\u044b\u0445 \u0432 " + translatedDestination;
  }

  const rules: Array<[RegExp, (...parts: string[]) => string]> = language === "en"
    ? [
      [/^עד (\d+) אורחים$/, (count) => `Up to ${count} guests`],
      [/^(\d+) אורחים$/, (count) => `${count} guests`],
      [/^לפחות (\d+) אורחים$/, (count) => `At least ${count} guests`],
      [/^לפחות (\d+) משתתפים$/, (count) => `At least ${count} participants`],
      [/^(\d+) משתתפים$/, (count) => `${count} participants`],
      [/^(\d+) תוצאות$/, (count) => `${count} results`],
      [/^(\d+) תמונות$/, (count) => `${count} photos`],
      [/^(\d+) חדרי שינה$/, (count) => `${count} bedrooms`],
      [/^חדר שינה (\d+)$/, (count) => `Bedroom ${count}`],
      [/^(\d+) יחידות$/, (count) => `${count} units`],
      [/^מינימום (\d+) לילות$/, (count) => `${count}-night minimum`],
      [/^(\d+) דקות קריאה$/, (count) => `${count} min read`],
      [/^(\d+) מתוך (\d+) מקומות מאומתים מוצגים$/, (shown, total) => `${shown} of ${total} verified places shown`],
    ]
    : language === "fr"
      ? [
        [/^\u05e2\u05d3 (\d+) \u05d0\u05d5\u05e8\u05d7\u05d9\u05dd$/, (count) => `Jusqu'à ${count} voyageurs`],
        [/^(\d+) \u05d0\u05d5\u05e8\u05d7\u05d9\u05dd$/, (count) => `${count} voyageurs`],
        [/^\u05dc\u05e4\u05d7\u05d5\u05ea (\d+) \u05d0\u05d5\u05e8\u05d7\u05d9\u05dd$/, (count) => `Au moins ${count} voyageurs`],
        [/^\u05dc\u05e4\u05d7\u05d5\u05ea (\d+) \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd$/, (count) => `Au moins ${count} participants`],
        [/^(\d+) \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd$/, (count) => `${count} participants`],
        [/^(\d+) \u05ea\u05d5\u05e6\u05d0\u05d5\u05ea$/, (count) => `${count} résultats`],
        [/^(\d+) \u05ea\u05de\u05d5\u05e0\u05d5\u05ea$/, (count) => `${count} photos`],
        [/^(\d+) \u05d7\u05d3\u05e8\u05d9 \u05e9\u05d9\u05e0\u05d4$/, (count) => `${count} chambres`],
        [/^\u05d7\u05d3\u05e8 \u05e9\u05d9\u05e0\u05d4 (\d+)$/, (count) => `Chambre ${count}`],
        [/^(\d+) \u05d9\u05d7\u05d9\u05d3\u05d5\u05ea$/, (count) => `${count} unités`],
        [/^\u05de\u05d9\u05e0\u05d9\u05de\u05d5\u05dd (\d+) \u05dc\u05d9\u05dc\u05d5\u05ea$/, (count) => `${count} nuits minimum`],
        [/^(\d+) \u05d3\u05e7\u05d5\u05ea \u05e7\u05e8\u05d9\u05d0\u05d4$/, (count) => `${count} min de lecture`],
        [/^(\d+) \u05de\u05ea\u05d5\u05da (\d+) \u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05de\u05d0\u05d5\u05de\u05ea\u05d9\u05dd \u05de\u05d5\u05e6\u05d2\u05d9\u05dd$/, (shown, total) => `${shown} lieux vérifiés sur ${total} affichés`],
      ]
      : [
      [/^עד (\d+) אורחים$/, (count) => `До ${count} гостей`],
      [/^(\d+) אורחים$/, (count) => `${count} гостей`],
      [/^לפחות (\d+) אורחים$/, (count) => `Не менее ${count} гостей`],
      [/^לפחות (\d+) משתתפים$/, (count) => `Не менее ${count} участников`],
      [/^(\d+) משתתפים$/, (count) => `${count} участников`],
      [/^(\d+) תוצאות$/, (count) => `${count} результатов`],
      [/^(\d+) תמונות$/, (count) => `${count} фото`],
      [/^(\d+) חדרי שינה$/, (count) => `${count} спален`],
      [/^חדר שינה (\d+)$/, (count) => `Спальня ${count}`],
      [/^(\d+) יחידות$/, (count) => `${count} вариантов`],
      [/^מינימום (\d+) לילות$/, (count) => `Минимум ${count} ночи`],
      [/^(\d+) דקות קריאה$/, (count) => `${count} мин. чтения`],
      [/^(\d+) מתוך (\d+) מקומות מאומתים מוצגים$/, (shown, total) => `Показано ${shown} из ${total} проверенных мест`],
    ];

  for (const [pattern, formatter] of rules) {
    const match = value.match(pattern);
    if (match) return formatter(...match.slice(1));
  }
  return value;
}

function translateValue(value: string, language: SiteLanguage) {
  if (language === "he" || !hebrewPattern.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.trim().replace(/\s+/g, " ");
  const exact = finalUiTranslations[language][core] || curatedTranslations[language][core] || dictionary(language)[core];
  let translated = exact || translateDynamic(core, language);
  if (language === "en") {
    translated = translated
      .replace(/^presentation (\d+) places$/i, "Show $1 places")
      .replace(/^(\d+) out of (\d+) Verified locations are shown$/i, "$1 of $2 verified places shown")
      .replace(/\buntil (\d+) guests\b/gi, "up to $1 guests")
      .replace(/\buntil\b/gi, "up to")
      .replace(/\bUpper roll\b/g, "Upper Galilee")
      .replace(/\bSob Kinneret\b/g, "Sea of Galilee area")
      .replace(/\bVifor Vacation\b/g, "VII Vacation")
      .replace(/\btable games\b/gi, "games tables")
      .replace(/\bcomplete accommodation\b/gi, "entire place")
      .replace(/\ba entire place\b/gi, "an entire place");
  } else if (language === "ru") {
    translated = translated
      .replace(/^дозать (\d+) мест$/i, "Показать $1 мест")
      .replace(/\u0417\u0430\u043a\u0440\u044b\u05e2/g, "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b")
      .replace(/пока\s+(\d+)\s+гости/gi, "до $1 гостей")
      .replace(/до\s+(\d+)\s+гости/gi, "до $1 гостей")
      .replace(/пока/gi, "до")
      .replace(/(\d+)\s+единицы/gi, "$1 варианта размещения")
      .replace(/Верхний валок/g, "Верхняя Галилея")
      .replace(/Соб Кинерет/g, "район Кинерета")
      .replace(/Вифор Отпуск/g, "VII Vacation")
      .replace(/полное (?:проживание|размещение)/gi, "отдельный объект целиком")
      .replace(/настольные игры/gi, "игровые столы");
  }
  return `${leading}${translated}${trailing}`;
}

function applyLanguage(language: SiteLanguage) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "he" ? "rtl" : "ltr";
  document.documentElement.dataset.locale = language;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (parent && !["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].includes(parent.tagName)) {
      if (hebrewPattern.test(node.data)) originalText.set(node, node.data);
      const source = originalText.get(node);
      if (source) {
        const translated = translateValue(source, language);
        if (node.data !== translated) node.data = translated;
      }
    }
    node = walker.nextNode() as Text | null;
  }

  document.body.querySelectorAll("*").forEach((element) => {
    const saved = originalAttributes.get(element) || new Map<string, string>();
    translatedAttributes.forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (current && hebrewPattern.test(current)) saved.set(attribute, current);
      const source = saved.get(attribute);
      if (source) {
        const translated = translateValue(source, language);
        if (current !== translated) element.setAttribute(attribute, translated);
      }
    });
    if (saved.size) originalAttributes.set(element, saved);
  });

  if (document.title && hebrewPattern.test(document.title)) originalDocumentTitle = document.title;
  if (originalDocumentTitle) document.title = translateValue(originalDocumentTitle, language);

  document.body.querySelectorAll<HTMLElement>(".filter-apply").forEach((button) => {
    const count = button.textContent?.match(/\d+/)?.[0];
    const textNode = button.firstChild;
    if (!count || !textNode || textNode.nodeType !== Node.TEXT_NODE) return;
    const numericCount = Number(count);
    const russianPlace = numericCount % 10 === 1 && numericCount % 100 !== 11
      ? "\u043c\u0435\u0441\u0442\u043e"
      : numericCount % 10 >= 2 && numericCount % 10 <= 4 && !(numericCount % 100 >= 12 && numericCount % 100 <= 14)
        ? "\u043c\u0435\u0441\u0442\u0430"
        : "\u043c\u0435\u0441\u0442";
    const label = language === "he"
      ? "\u05d4\u05e6\u05d2\u05ea " + count + " \u05de\u05e7\u05d5\u05de\u05d5\u05ea"
      : language === "en"
        ? "Show " + count + " places"
        : language === "fr"
          ? "Afficher " + count + " lieux"
          : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c " + count + " " + russianPlace;
    if (textNode.nodeValue !== label) textNode.nodeValue = label;
  });
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>("he");
  const [translationVersion, setTranslationVersion] = useState(0);
  const observer = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setLanguageState(initialLanguage()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLanguage = (nextLanguage: SiteLanguage) => {
    localStorage.setItem(languageStorageKey, nextLanguage);
    const url = new URL(window.location.href);
    if (nextLanguage === "he") url.searchParams.delete("lang");
    else url.searchParams.set("lang", nextLanguage);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    if (language === "he" || loadedTranslations) return;
    let active = true;
    void loadTranslations().then(() => {
      if (active) setTranslationVersion((version) => version + 1);
    });
    return () => { active = false; };
  }, [language]);

  useLayoutEffect(() => {
    applyLanguage(language);
    observer.current?.disconnect();
    let frame = 0;
    observer.current = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => applyLanguage(language));
    });
    observer.current.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatedAttributes });
    return () => { window.cancelAnimationFrame(frame); observer.current?.disconnect(); };
  }, [language, translationVersion]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useContext(LocaleContext);
  const select = useRef<HTMLSelectElement>(null);
  const labels = { he: "עברית", en: "English", ru: "Русский", fr: "Français" } as const;
  useLayoutEffect(() => { if (select.current) select.current.value = language; }, [language]);
  return <label className={`language-switcher ${compact ? "language-switcher--compact" : ""}`}>
    <span aria-hidden="true">◎</span>
    <span className="sr-only">שפה</span>
    <select ref={select} defaultValue="he" onChange={(event) => setLanguage(event.target.value as SiteLanguage)} aria-label="שפה">
      {(Object.keys(labels) as SiteLanguage[]).map((code) => <option key={code} value={code}>{labels[code]}</option>)}
    </select>
  </label>;
}

export function useSiteLanguage() {
  return useContext(LocaleContext);
}
