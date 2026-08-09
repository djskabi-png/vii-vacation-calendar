"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { languageFromPathname, localizedPath, type SiteLanguage } from "./locale-routing";

export type { SiteLanguage } from "./locale-routing";

type LocaleContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  translate: (value: string) => string;
};

const LocaleContext = createContext<LocaleContextValue>({ language: "he", setLanguage: () => undefined, translate: (value) => value });
const languageStorageKey = "vii-site-language";
const hebrewPattern = /[\u0590-\u05ff]/;
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ["aria-label", "alt", "placeholder", "title"];
let originalDocumentTitle = "";

type GeneratedLanguage = Exclude<SiteLanguage, "he">;
type TranslationDictionary = Record<string, string>;
const loadedTranslations: Partial<Record<GeneratedLanguage, TranslationDictionary>> = {};
const translationRequests: Partial<Record<GeneratedLanguage, Promise<TranslationDictionary>>> = {};

function loadTranslations(language: GeneratedLanguage) {
  const existing = translationRequests[language];
  if (existing) return existing;
  const request = (language === "en"
    ? import("./translations.en.generated.json")
    : language === "ru"
      ? import("./translations.ru.generated.json")
      : import("./translations.fr.generated.json"))
    .then((module) => {
      const translations = module.default as TranslationDictionary;
      loadedTranslations[language] = translations;
      return translations;
    });
  translationRequests[language] = request;
  return request;
}

const curatedTranslations: Record<Exclude<SiteLanguage, "he">, Record<string, string>> = {
  en: {
    "ראשי": "Home",
    "מסלולי טיול ואטרקציות": "Trails and attractions",
    "בוחרים איך לבלות את היום": "Choose how to spend your day",
    "שני אזורים ברורים: מסלול עצמאי בטבע עם מידע מלא, או אטרקציה בתשלום עם התאמת ספק ותהליך הזמנה.": "Choose an independent nature trail with complete practical information, or a paid attraction with a clear provider and booking process.",
    "מסלולי טיולים": "Hiking trails",
    "48 מסלולים, לפחות שישה בכל אזור ראשי": "48 trails, with at least six in every main region",
    "למסלולים": "Explore trails",
    "אטרקציות בתשלום": "Paid attractions",
    "שטח, מים, סוסים, אוכל וסדנאות": "Off-road adventures, water activities, horse riding, food and workshops",
    "לאטרקציות": "Explore attractions",
    "יוצאים מהצימר. נכנסים לישראל היפה.": "Leave your stay behind. Step into Israel’s beautiful outdoors.",
    "לכל": "View all",
    "המסלולים": "trails",
    "סוגי חוויה שמתחילים בבחירה נכונה": "experience types, one clear place to start",
    "יעדי נופש פופולריים": "Popular stay destinations",
    "מקומות לאירועים לפי אזור": "Event venues by region",
    "חדרים לפי שעה לפי אזור": "Hourly stays by region",
    "שירותים לאירוח ולאירועים": "Stay and event services",
    "מסלולים ואטרקציות": "Trails and attractions",
    "וילות נופש לפי אזור": "Vacation villas by region",
    "מתחמי סוויטות לפי אזור": "Suite complexes by region",
    "סוויטות יוקרה לפי אזור": "Luxury suites by region",
    "דירות נופש לפי אזור": "Vacation apartments by region",
    "בתי ספא לפי אזור": "Spas by region",
    "ספא בתל אביב": "Spas in Tel Aviv",
    "ספא בירושלים": "Spas in Jerusalem",
    "ספא במרכז": "Spas in Central Israel",
    "ספא בצפון": "Spas in Northern Israel",
    "ספא בחיפה": "Spas in Haifa",
    "\u05de\u05e4\u05d4 \u05d0\u05d9\u05e0\u05d8\u05e8\u05d0\u05e7\u05d8\u05d9\u05d1\u05d9\u05ea \u05e9\u05dc \u05d4\u05de\u05e7\u05d5\u05de\u05d5\u05ea": "Interactive map of places",
    "\u05d7\u05d6\u05e8\u05d4 \u05dc\u05ea\u05e6\u05d5\u05d2\u05ea \u05e8\u05e9\u05d9\u05de\u05d4": "Back to list view",
    "\u05d7\u05d6\u05e8\u05d4 \u05dc\u05e8\u05e9\u05d9\u05de\u05d4": "Back to list",
    "\u05e1\u05d2\u05d9\u05e8\u05ea \u05e4\u05e8\u05d8\u05d9 \u05d4\u05de\u05e7\u05d5\u05dd": "Close place details",
    "\u05d4\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05e9\u05de\u05d5\u05e6\u05d2\u05d9\u05dd \u05e2\u05dc \u05d4\u05de\u05e4\u05d4": "Places shown on the map",
    "\u05e9\u05dd \u05dc\u05d4\u05d6\u05de\u05e0\u05d4": "Booking name",
    "\u05d0\u05d9\u05da \u05dc\u05e4\u05e0\u05d5\u05ea \u05d0\u05dc\u05d9\u05db\u05dd?": "How should we address you?",
    "\u05d8\u05dc\u05e4\u05d5\u05df \u05dc\u05d7\u05d6\u05e8\u05d4": "Callback phone",
    "\u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df": "Phone number",
    "\u05d4\u05e2\u05e8\u05d4 \u05dc\u05d1\u05e2\u05dc \u05d4\u05de\u05e7\u05d5\u05dd": "Note to the host",
    "\u05d1\u05e7\u05e9\u05d4 \u05de\u05d9\u05d5\u05d7\u05d3\u05ea, \u05d2\u05d9\u05dc\u05d0\u05d9 \u05d9\u05dc\u05d3\u05d9\u05dd \u05d0\u05d5 \u05db\u05dc \u05e4\u05e8\u05d8 \u05d7\u05e9\u05d5\u05d1": "Special request, children's ages or any important detail",
    "\u05d1\u05d7\u05d9\u05e8\u05ea \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd": "Choose dates",
    "\u05d1\u05d7\u05e8\u05d5 \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05db\u05d3\u05d9 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e9\u05d4": "Choose dates to send a request",
    "\u05d4\u05e2\u05d3\u05e4\u05d4 \u05dc\u05e9\u05d9\u05d7\u05d4? \u05d7\u05d9\u05d5\u05d2 \u05dc\u05de\u05e7\u05d5\u05dd": "Prefer to talk? Call the property",
    "\u05d4\u05d1\u05e7\u05e9\u05d4 \u05e0\u05e4\u05ea\u05d7\u05ea \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05e2\u05dd \u05d4\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd, \u05de\u05e1\u05e4\u05e8 \u05d4\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd \u05d5\u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05e9\u05de\u05d9\u05dc\u05d0\u05ea\u05dd. \u05d4\u05d4\u05d6\u05de\u05e0\u05d4 \u05e1\u05d5\u05e4\u05d9\u05ea \u05e8\u05e7 \u05dc\u05d0\u05d7\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05de\u05e7\u05d5\u05dd.": "Your request opens in WhatsApp with the dates, guest count and details you entered. The booking is final only after the property confirms it.",
    "\u05de\u05e1\u05e0\u05e0\u05d9\u05dd \u05dc\u05e4\u05d9 \u05de\u05d4 \u05e9\u05d7\u05e9\u05d5\u05d1 \u05dc\u05db\u05dd": "Filter by what matters to you",
    "\u05de\u05ea\u05d7\u05de\u05d9 \u05e1\u05e4\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5": "spa venues found",
    "\u05e1\u05e4\u05d0 \u05d1\u05d5\u05d8\u05d9\u05e7 \u05d0\u05d5 \u05e4\u05e8\u05d8\u05d9": "Boutique or private spa",
    "\u05d1\u05d7\u05e8\u05d5 \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd": "Choose dates",
    "\u05d0\u05d9\u05dc\u05ea": "Eilat",
    "\u05e6\u05e4\u05d5\u05df": "North",
    "\u05db\u05e0\u05e8\u05ea": "Sea of Galilee",
    "\u05d2\u05dc\u05d9\u05dc \u05de\u05e2\u05e8\u05d1\u05d9": "Western Galilee",
    "\u05de\u05e8\u05db\u05d6": "Central Israel",
    "\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd": "Jerusalem",
    "\u05d9\u05dd \u05d4\u05de\u05dc\u05d7": "Dead Sea",
    "\u05de\u05e1\u05dc\u05d5\u05dc\u05d9 \u05d8\u05d9\u05d5\u05dc\u05d9\u05dd": "Hiking trails",
    "\u05d4\u05d7\u05e9\u05d1\u05d5\u05df \u05d4\u05d0\u05d9\u05e9\u05d9 \u05e9\u05dc\u05d9": "My account",
    "\u05e4\u05e8\u05e1\u05d5\u05dd \u05d5\u05d4\u05e6\u05d8\u05e8\u05e4\u05d5\u05ea \u05dc\u05d0\u05ea\u05e8": "Advertise and join VII",
    "\u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d6\u05de\u05e0\u05d4": "Manage booking",
    "\u05e4\u05ea\u05d9\u05d7\u05ea \u05db\u05dc\u05d9 \u05d4\u05e0\u05d2\u05d9\u05e9\u05d5\u05ea": "Open accessibility tools",
    "\u05db\u05dc\u05d9 \u05e0\u05d2\u05d9\u05e9\u05d5\u05ea": "Accessibility tools",
    "וי פור ויקיישן": "VII Vacation",
    "וי פור ויקיישן | מוצאים את החופשה שמתאימה לכם": "VII Vacation | Find your perfect stay",
    "כל החופשה, במקום אחד": "Your whole getaway, in one place",
    "מוצאים את החופשה שמתאימה לכם": "Find the getaway that fits you",
    "נופש": "Stays", "אירועים": "Events", "ספא": "Spa", "לפי שעה": "Hourly stays", "ספקים": "Services", "מה עושים": "Things to do",
    "אטרקציות": "Attractions", "גיפט קארד": "Gift card", "עוד": "More", "עוד ב־VII": "More from VII", "כל העולמות והתוכן": "All worlds and guides",
    "אירועי חברה ורווחה": "Corporate events and wellbeing", "חבילות מלאות לארגונים": "Complete packages for organizations", "שפים, תקליטנים ושירותים": "Chefs, DJs and services",
    "מה עושים בסביבה": "Things to do nearby", "כל הרעיונות במקום אחד": "Every idea in one place", "מסלולי טיול": "Trails", "טיולים עצמאיים לפי אזור": "Independent trails by region",
    "מגזין ומדריכים": "Magazine and guides", "רעיונות, תוכן ומדריכים": "Ideas, stories and guides",
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
    "ראשי": "Главная",
    "מסלולי טיול ואטרקציות": "Маршруты и развлечения",
    "בוחרים איך לבלות את היום": "Выберите, как провести день",
    "שני אזורים ברורים: מסלול עצמאי בטבע עם מידע מלא, או אטרקציה בתשלום עם התאמת ספק ותהליך הזמנה.": "Выберите самостоятельный маршрут на природе с полной практической информацией или платное развлечение с понятным процессом выбора и бронирования.",
    "מסלולי טיולים": "Пешеходные маршруты",
    "48 מסלולים, לפחות שישה בכל אזור ראשי": "48 маршрутов, не менее шести в каждом основном регионе",
    "למסלולים": "Смотреть маршруты",
    "אטרקציות בתשלום": "Платные развлечения",
    "שטח, מים, סוסים, אוכל וסדנאות": "Поездки по бездорожью, водные развлечения, конные прогулки, гастрономия и мастер-классы",
    "לאטרקציות": "Смотреть развлечения",
    "יוצאים מהצימר. נכנסים לישראל היפה.": "Оставьте место проживания позади. Откройте для себя красоту Израиля.",
    "לכל": "Смотреть все",
    "המסלולים": "маршрутов",
    "סוגי חוויה שמתחילים בבחירה נכונה": "видов отдыха, с понятным выбором с самого начала",
    "יעדי נופש פופולריים": "Популярные направления",
    "מקומות לאירועים לפי אזור": "Площадки для мероприятий по регионам",
    "חדרים לפי שעה לפי אזור": "Почасовые номера по регионам",
    "שירותים לאירוח ולאירועים": "Услуги для отдыха и мероприятий",
    "מסלולים ואטרקציות": "Маршруты и развлечения",
    "וילות נופש לפי אזור": "Виллы для отдыха по регионам",
    "מתחמי סוויטות לפי אזור": "Комплексы люксов по регионам",
    "סוויטות יוקרה לפי אזור": "Люксы премиум-класса по регионам",
    "דירות נופש לפי אזור": "Апартаменты для отдыха по регионам",
    "בתי ספא לפי אזור": "Спа по регионам",
    "ספא בתל אביב": "Спа в Тель-Авиве",
    "ספא בירושלים": "Спа в Иерусалиме",
    "ספא במרכז": "Спа в центре Израиля",
    "ספא בצפון": "Спа на севере Израиля",
    "ספא בחיפה": "Спа в Хайфе",
    "\u05de\u05e4\u05d4 \u05d0\u05d9\u05e0\u05d8\u05e8\u05d0\u05e7\u05d8\u05d9\u05d1\u05d9\u05ea \u05e9\u05dc \u05d4\u05de\u05e7\u05d5\u05de\u05d5\u05ea": "Интерактивная карта мест",
    "\u05d7\u05d6\u05e8\u05d4 \u05dc\u05ea\u05e6\u05d5\u05d2\u05ea \u05e8\u05e9\u05d9\u05de\u05d4": "Вернуться к списку",
    "\u05d7\u05d6\u05e8\u05d4 \u05dc\u05e8\u05e9\u05d9\u05de\u05d4": "Назад к списку",
    "\u05e1\u05d2\u05d9\u05e8\u05ea \u05e4\u05e8\u05d8\u05d9 \u05d4\u05de\u05e7\u05d5\u05dd": "Закрыть карточку места",
    "\u05d4\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05e9\u05de\u05d5\u05e6\u05d2\u05d9\u05dd \u05e2\u05dc \u05d4\u05de\u05e4\u05d4": "Места на карте",
    "\u05e9\u05dd \u05dc\u05d4\u05d6\u05de\u05e0\u05d4": "Имя для бронирования",
    "\u05d0\u05d9\u05da \u05dc\u05e4\u05e0\u05d5\u05ea \u05d0\u05dc\u05d9\u05db\u05dd?": "Как к вам обращаться?",
    "\u05d8\u05dc\u05e4\u05d5\u05df \u05dc\u05d7\u05d6\u05e8\u05d4": "Телефон для связи",
    "\u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df": "Номер телефона",
    "\u05d4\u05e2\u05e8\u05d4 \u05dc\u05d1\u05e2\u05dc \u05d4\u05de\u05e7\u05d5\u05dd": "Сообщение владельцу",
    "\u05d1\u05e7\u05e9\u05d4 \u05de\u05d9\u05d5\u05d7\u05d3\u05ea, \u05d2\u05d9\u05dc\u05d0\u05d9 \u05d9\u05dc\u05d3\u05d9\u05dd \u05d0\u05d5 \u05db\u05dc \u05e4\u05e8\u05d8 \u05d7\u05e9\u05d5\u05d1": "Особые пожелания, возраст детей или важная информация",
    "\u05d1\u05d7\u05d9\u05e8\u05ea \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd": "Выбрать даты",
    "\u05d1\u05d7\u05e8\u05d5 \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05db\u05d3\u05d9 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e9\u05d4": "Выберите даты, чтобы отправить запрос",
    "\u05d4\u05e2\u05d3\u05e4\u05d4 \u05dc\u05e9\u05d9\u05d7\u05d4? \u05d7\u05d9\u05d5\u05d2 \u05dc\u05de\u05e7\u05d5\u05dd": "Предпочитаете звонок? Позвонить объекту",
    "\u05d4\u05d1\u05e7\u05e9\u05d4 \u05e0\u05e4\u05ea\u05d7\u05ea \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05e2\u05dd \u05d4\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd, \u05de\u05e1\u05e4\u05e8 \u05d4\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd \u05d5\u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05e9\u05de\u05d9\u05dc\u05d0\u05ea\u05dd. \u05d4\u05d4\u05d6\u05de\u05e0\u05d4 \u05e1\u05d5\u05e4\u05d9\u05ea \u05e8\u05e7 \u05dc\u05d0\u05d7\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05de\u05e7\u05d5\u05dd.": "Запрос откроется в WhatsApp с датами, числом гостей и введёнными данными. Бронирование окончательно только после подтверждения объектом.",
    "\u05de\u05e1\u05e0\u05e0\u05d9\u05dd \u05dc\u05e4\u05d9 \u05de\u05d4 \u05e9\u05d7\u05e9\u05d5\u05d1 \u05dc\u05db\u05dd": "Фильтры по важным параметрам",
    "\u05de\u05ea\u05d7\u05de\u05d9 \u05e1\u05e4\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5": "спа-центров найдено",
    "\u05e1\u05e4\u05d0 \u05d1\u05d5\u05d8\u05d9\u05e7 \u05d0\u05d5 \u05e4\u05e8\u05d8\u05d9": "Бутик-спа или частный спа",
    "\u05d1\u05d7\u05e8\u05d5 \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd": "Выберите даты",
    "\u05d0\u05d9\u05dc\u05ea": "Эйлат",
    "\u05e6\u05e4\u05d5\u05df": "Север",
    "\u05db\u05e0\u05e8\u05ea": "Кинерет",
    "\u05d2\u05dc\u05d9\u05dc \u05de\u05e2\u05e8\u05d1\u05d9": "Западная Галилея",
    "\u05de\u05e8\u05db\u05d6": "Центр Израиля",
    "\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd": "Иерусалим",
    "\u05d9\u05dd \u05d4\u05de\u05dc\u05d7": "Мёртвое море",
    "\u05de\u05e1\u05dc\u05d5\u05dc\u05d9 \u05d8\u05d9\u05d5\u05dc\u05d9\u05dd": "Маршруты",
    "\u05d4\u05d7\u05e9\u05d1\u05d5\u05df \u05d4\u05d0\u05d9\u05e9\u05d9 \u05e9\u05dc\u05d9": "Мой аккаунт",
    "\u05e4\u05e8\u05e1\u05d5\u05dd \u05d5\u05d4\u05e6\u05d8\u05e8\u05e4\u05d5\u05ea \u05dc\u05d0\u05ea\u05e8": "Реклама и подключение к VII",
    "\u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d6\u05de\u05e0\u05d4": "Управление бронированием",
    "\u05e4\u05ea\u05d9\u05d7\u05ea \u05db\u05dc\u05d9 \u05d4\u05e0\u05d2\u05d9\u05e9\u05d5\u05ea": "Открыть инструменты доступности",
    "\u05db\u05dc\u05d9 \u05e0\u05d2\u05d9\u05e9\u05d5\u05ea": "Инструменты доступности",
    "וי פור ויקיישן": "VII Vacation",
    "וי פור ויקיישן | מוצאים את החופשה שמתאימה לכם": "VII Vacation | Найдите идеальный отдых",
    "כל החופשה, במקום אחד": "Весь отдых в одном месте",
    "מוצאים את החופשה שמתאימה לכם": "Найдите отдых, который подходит именно вам",
    "נופש": "Отдых", "אירועים": "Мероприятия", "ספא": "Спа", "לפי שעה": "Почасовой отдых", "ספקים": "Услуги", "מה עושים": "Чем заняться",
    "אטרקציות": "Развлечения", "גיפט קארד": "Подарочная карта", "עוד": "Ещё", "עוד ב־VII": "Ещё в VII", "כל העולמות והתוכן": "Все разделы и материалы",
    "אירועי חברה ורווחה": "Корпоративные события", "חבילות מלאות לארגונים": "Готовые пакеты для компаний", "שפים, תקליטנים ושירותים": "Повара, диджеи и услуги",
    "מה עושים בסביבה": "Чем заняться рядом", "כל הרעיונות במקום אחד": "Все идеи в одном месте", "מסלולי טיול": "Маршруты", "טיולים עצמאיים לפי אזור": "Самостоятельные маршруты по регионам",
    "מגזין ומדריכים": "Журнал и гиды", "רעיונות, תוכן ומדריכים": "Идеи, статьи и путеводители",
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
    "ראשי": "Accueil",
    "מסלולי טיול ואטרקציות": "Randonnées et activités",
    "בוחרים איך לבלות את היום": "Choisissez comment profiter de votre journée",
    "שני אזורים ברורים: מסלול עצמאי בטבע עם מידע מלא, או אטרקציה בתשלום עם התאמת ספק ותהליך הזמנה.": "Choisissez une randonnée autonome avec toutes les informations pratiques, ou une activité payante avec un prestataire identifié et un parcours de réservation clair.",
    "מסלולי טיולים": "Randonnées",
    "48 מסלולים, לפחות שישה בכל אזור ראשי": "48 parcours, avec au moins six itinéraires dans chaque grande région",
    "למסלולים": "Voir les randonnées",
    "אטרקציות בתשלום": "Activités payantes",
    "שטח, מים, סוסים, אוכל וסדנאות": "Tout-terrain, activités nautiques, équitation, gastronomie et ateliers",
    "לאטרקציות": "Voir les activités",
    "יוצאים מהצימר. נכנסים לישראל היפה.": "Quittez votre hébergement. Partez à la découverte des plus beaux paysages d’Israël.",
    "לכל": "Voir les",
    "המסלולים": "parcours",
    "סוגי חוויה שמתחילים בבחירה נכונה": "types d’expérience, un point de départ clair",
    "יעדי נופש פופולריים": "Destinations de séjour populaires",
    "מקומות לאירועים לפי אזור": "Lieux événementiels par région",
    "חדרים לפי שעה לפי אזור": "Chambres à l’heure par région",
    "שירותים לאירוח ולאירועים": "Services pour séjours et événements",
    "מסלולים ואטרקציות": "Itinéraires et attractions",
    "וילות נופש לפי אזור": "Villas de vacances par région",
    "מתחמי סוויטות לפי אזור": "Complexes de suites par région",
    "סוויטות יוקרה לפי אזור": "Suites de luxe par région",
    "דירות נופש לפי אזור": "Appartements de vacances par région",
    "בתי ספא לפי אזור": "Spas par région",
    "ספא בתל אביב": "Spas à Tel-Aviv",
    "ספא בירושלים": "Spas à Jérusalem",
    "ספא במרכז": "Spas dans le centre d’Israël",
    "ספא בצפון": "Spas dans le nord d’Israël",
    "ספא בחיפה": "Spas à Haïfa",
    "הצגת תוצאות על המפה": "Afficher les résultats sur la carte",
    "חזרה לתצוגת רשימה": "Revenir à la liste",
    "תצוגה על מפה": "Carte",
    "תצוגת רשימה": "Liste",
    "איך בוחרים מקום נופש שמתאים להרכב?": "Comment choisir un hébergement adapté à votre groupe ?",
    "איך בוחרים מקום שבאמת מתאים להרכב שלכם": "Comment choisir un hébergement vraiment adapté à votre groupe",
    "הכרטיסים אינם מציגים זמינות חיה. המחיר והזמינות הסופיים יאומתו לאחר בחירת תאריך והרכב.": "Les offres n’affichent pas la disponibilité en temps réel. Le prix final et la disponibilité sont confirmés après le choix de la date et du groupe.",
    "משווים בין בתי ספא, חבילות וטיפולים ובוחרים לפי אזור, הרכב וסוג החוויה.": "Comparez les spas, les formules et les soins selon la région, la composition du groupe et le type d’expérience.",
    "שולחים אזור, תאריך והרכב": "Indiquez la région, la date et la composition du groupe",
    "\u05de\u05e4\u05d4 \u05d0\u05d9\u05e0\u05d8\u05e8\u05d0\u05e7\u05d8\u05d9\u05d1\u05d9\u05ea \u05e9\u05dc \u05d4\u05de\u05e7\u05d5\u05de\u05d5\u05ea": "Carte interactive des lieux",
    "\u05d7\u05d6\u05e8\u05d4 \u05dc\u05ea\u05e6\u05d5\u05d2\u05ea \u05e8\u05e9\u05d9\u05de\u05d4": "Retour à la liste",
    "\u05d7\u05d6\u05e8\u05d4 \u05dc\u05e8\u05e9\u05d9\u05de\u05d4": "Retour à la liste",
    "\u05e1\u05d2\u05d9\u05e8\u05ea \u05e4\u05e8\u05d8\u05d9 \u05d4\u05de\u05e7\u05d5\u05dd": "Fermer les détails du lieu",
    "\u05d4\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05e9\u05de\u05d5\u05e6\u05d2\u05d9\u05dd \u05e2\u05dc \u05d4\u05de\u05e4\u05d4": "Lieux affichés sur la carte",
    "\u05e9\u05dd \u05dc\u05d4\u05d6\u05de\u05e0\u05d4": "Nom de la réservation",
    "\u05d0\u05d9\u05da \u05dc\u05e4\u05e0\u05d5\u05ea \u05d0\u05dc\u05d9\u05db\u05dd?": "Comment devons-nous vous appeler ?",
    "\u05d8\u05dc\u05e4\u05d5\u05df \u05dc\u05d7\u05d6\u05e8\u05d4": "Téléphone de rappel",
    "\u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df": "Numéro de téléphone",
    "\u05d4\u05e2\u05e8\u05d4 \u05dc\u05d1\u05e2\u05dc \u05d4\u05de\u05e7\u05d5\u05dd": "Message au propriétaire",
    "\u05d1\u05e7\u05e9\u05d4 \u05de\u05d9\u05d5\u05d7\u05d3\u05ea, \u05d2\u05d9\u05dc\u05d0\u05d9 \u05d9\u05dc\u05d3\u05d9\u05dd \u05d0\u05d5 \u05db\u05dc \u05e4\u05e8\u05d8 \u05d7\u05e9\u05d5\u05d1": "Demande spéciale, âge des enfants ou toute information importante",
    "\u05d1\u05d7\u05d9\u05e8\u05ea \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd": "Choisir les dates",
    "\u05d1\u05d7\u05e8\u05d5 \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05db\u05d3\u05d9 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e9\u05d4": "Choisissez les dates pour envoyer une demande",
    "\u05d4\u05e2\u05d3\u05e4\u05d4 \u05dc\u05e9\u05d9\u05d7\u05d4? \u05d7\u05d9\u05d5\u05d2 \u05dc\u05de\u05e7\u05d5\u05dd": "Vous préférez parler ? Appelez l'établissement",
    "\u05d4\u05d1\u05e7\u05e9\u05d4 \u05e0\u05e4\u05ea\u05d7\u05ea \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05e2\u05dd \u05d4\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd, \u05de\u05e1\u05e4\u05e8 \u05d4\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd \u05d5\u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05e9\u05de\u05d9\u05dc\u05d0\u05ea\u05dd. \u05d4\u05d4\u05d6\u05de\u05e0\u05d4 \u05e1\u05d5\u05e4\u05d9\u05ea \u05e8\u05e7 \u05dc\u05d0\u05d7\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05de\u05e7\u05d5\u05dd.": "La demande s'ouvre dans WhatsApp avec les dates, le nombre de voyageurs et les informations saisies. La réservation n'est définitive qu'après confirmation de l'établissement.",
    "\u05de\u05e1\u05e0\u05e0\u05d9\u05dd \u05dc\u05e4\u05d9 \u05de\u05d4 \u05e9\u05d7\u05e9\u05d5\u05d1 \u05dc\u05db\u05dd": "Filtrez selon vos priorités",
    "\u05de\u05ea\u05d7\u05de\u05d9 \u05e1\u05e4\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5": "spas trouvés",
    "\u05e1\u05e4\u05d0 \u05d1\u05d5\u05d8\u05d9\u05e7 \u05d0\u05d5 \u05e4\u05e8\u05d8\u05d9": "Spa boutique ou privé",
    "\u05d1\u05d7\u05e8\u05d5 \u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd": "Choisir les dates",
    "\u05d0\u05d9\u05dc\u05ea": "Eilat",
    "\u05e6\u05e4\u05d5\u05df": "Nord",
    "\u05db\u05e0\u05e8\u05ea": "Lac de Tibériade",
    "\u05d2\u05dc\u05d9\u05dc \u05de\u05e2\u05e8\u05d1\u05d9": "Galilée occidentale",
    "\u05de\u05e8\u05db\u05d6": "Centre d'Israël",
    "\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd": "Jérusalem",
    "\u05d9\u05dd \u05d4\u05de\u05dc\u05d7": "Mer Morte",
    "\u05de\u05e1\u05dc\u05d5\u05dc\u05d9 \u05d8\u05d9\u05d5\u05dc\u05d9\u05dd": "Randonnées",
    "\u05d4\u05d7\u05e9\u05d1\u05d5\u05df \u05d4\u05d0\u05d9\u05e9\u05d9 \u05e9\u05dc\u05d9": "Mon compte",
    "\u05e4\u05e8\u05e1\u05d5\u05dd \u05d5\u05d4\u05e6\u05d8\u05e8\u05e4\u05d5\u05ea \u05dc\u05d0\u05ea\u05e8": "Publier et rejoindre VII",
    "\u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d6\u05de\u05e0\u05d4": "Gérer une réservation",
    "\u05e4\u05ea\u05d9\u05d7\u05ea \u05db\u05dc\u05d9 \u05d4\u05e0\u05d2\u05d9\u05e9\u05d5\u05ea": "Ouvrir les outils d'accessibilité",
    "\u05db\u05dc\u05d9 \u05e0\u05d2\u05d9\u05e9\u05d5\u05ea": "Outils d'accessibilité",
    "\u05d5\u05d9 \u05e4\u05d5\u05e8 \u05d5\u05d9\u05e7\u05d9\u05d9\u05e9\u05df": "VII Vacation",
    "\u05db\u05dc \u05d4\u05d7\u05d5\u05e4\u05e9\u05d4, \u05d1\u05de\u05e7\u05d5\u05dd \u05d0\u05d7\u05d3": "Toutes vos vacances, au même endroit",
    "\u05de\u05d5\u05e6\u05d0\u05d9\u05dd \u05d0\u05ea \u05d4\u05d7\u05d5\u05e4\u05e9\u05d4 \u05e9\u05de\u05ea\u05d0\u05d9\u05de\u05d4 \u05dc\u05db\u05dd": "Trouvez le séjour qui vous correspond",
    "\u05e0\u05d5\u05e4\u05e9": "Séjours", "\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd": "Événements", "\u05e1\u05e4\u05d0": "Spa", "\u05dc\u05e4\u05d9 \u05e9\u05e2\u05d4": "Séjours à l'heure", "\u05e1\u05e4\u05e7\u05d9\u05dd": "Services", "\u05de\u05d4 \u05e2\u05d5\u05e9\u05d9\u05dd": "À faire",
    "אטרקציות": "Attractions", "גיפט קארד": "Carte cadeau", "עוד": "Plus", "עוד ב־VII": "Plus sur VII", "כל העולמות והתוכן": "Tous les univers et les guides",
    "אירועי חברה ורווחה": "Événements d’entreprise et bien-être", "חבילות מלאות לארגונים": "Formules complètes pour les organisations", "שפים, תקליטנים ושירותים": "Chefs, DJ et services",
    "מה עושים בסביבה": "À faire à proximité", "כל הרעיונות במקום אחד": "Toutes les idées au même endroit", "מסלולי טיול": "Itinéraires", "טיולים עצמאיים לפי אזור": "Itinéraires autonomes par région",
    "מגזין ומדריכים": "Magazine et guides", "רעיונות, תוכן ומדריכים": "Idées, articles et guides",
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
    "חברות": "Corporate",
    "שינוי חיפוש": "Change search",
    "סגירת החיפוש": "Close search",
    "סינון תוצאות ספא": "Filter spa results",
    "סוג המקום, מתקנים וחבילות": "Place type, amenities and packages",
    "ספא בבית מלון": "Hotel spa",
    "חבילה זוגית": "Couples package",
    "חבילה עם ארוחה": "Package with a meal",
    "החליקו לעוד סינונים": "Swipe for more filters",
    "סינונים פעילים": "Active filters",
    "סינונים פעילים:": "Active filters:",
    "לא נמצאו מתחמים שמתאימים לכל הסינונים": "No spa venues match all filters",
    "אפשר להסיר מאפיין אחד או לבחור אזור רחב יותר.": "Remove one filter or choose a wider area.",
    "הצגת כל מתחמי הספא": "Show all spa venues",
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
    "חברות": "Для компаний",
    "שינוי חיפוש": "Изменить поиск",
    "סגירת החיפוש": "Закрыть поиск",
    "סינון תוצאות ספא": "Фильтр результатов спа",
    "סוג המקום, מתקנים וחבילות": "Тип места, удобства и пакеты",
    "ספא בבית מלון": "Спа в отеле",
    "חבילה זוגית": "Пакет для пары",
    "חבילה עם ארוחה": "Пакет с питанием",
    "החליקו לעוד סינונים": "Проведите, чтобы увидеть больше фильтров",
    "סינונים פעילים": "Активные фильтры",
    "סינונים פעילים:": "Активные фильтры:",
    "לא נמצאו מתחמים שמתאימים לכל הסינונים": "Нет спа, соответствующих всем фильтрам",
    "אפשר להסיר מאפיין אחד או לבחור אזור רחב יותר.": "Уберите один фильтр или выберите более широкий регион.",
    "הצגת כל מתחמי הספא": "Показать все спа",
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
    "חברות": "Entreprises",
    "שינוי חיפוש": "Modifier la recherche",
    "סגירת החיפוש": "Fermer la recherche",
    "סינון תוצאות ספא": "Filtrer les résultats spa",
    "סוג המקום, מתקנים וחבילות": "Type de lieu, équipements et formules",
    "ספא בבית מלון": "Spa d’hôtel",
    "חבילה זוגית": "Formule en duo",
    "חבילה עם ארוחה": "Formule avec repas",
    "החליקו לעוד סינונים": "Faites glisser pour voir plus de filtres",
    "סינונים פעילים": "Filtres actifs",
    "סינונים פעילים:": "Filtres actifs :",
    "לא נמצאו מתחמים שמתאימים לכל הסינונים": "Aucun spa ne correspond à tous les filtres",
    "אפשר להסיר מאפיין אחד או לבחור אזור רחב יותר.": "Retirez un filtre ou choisissez une zone plus large.",
    "הצגת כל מתחמי הספא": "Afficher tous les spas",
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

function initialLanguage(): SiteLanguage {
  // The server source is Hebrew. Start from the same state during hydration,
  // then synchronize with the localized route after the first client commit.
  return "he";
}

function dictionary(language: SiteLanguage): Record<string, string> {
  return language === "he" ? {} : loadedTranslations[language] || {};
}

function translateDynamic(value: string, language: Exclude<SiteLanguage, "he">) {
  const translatePart = (source: string) => finalUiTranslations[language][source]
    || curatedTranslations[language][source]
    || dictionary(language)[source]
    || source;

  // Some client components already localize the action label while their
  // CMS-backed place or trail name is still Hebrew. Translate that embedded
  // entity as well so accessible names never become bilingual.
  const localizedPrefixMatch = value.match(/^([^:\u0590-\u05ff]+):\s*(.+[\u0590-\u05ff].*)$/);
  if (localizedPrefixMatch) {
    return `${localizedPrefixMatch[1]}: ${translatePart(localizedPrefixMatch[2])}`;
  }

  const allTrailsMatch = value.match(/^לכל (\d+) המסלולים$/);
  if (allTrailsMatch) {
    return language === "en"
      ? `View all ${allTrailsMatch[1]} trails`
      : language === "fr"
        ? `Voir les ${allTrailsMatch[1]} parcours`
        : `Смотреть все ${allTrailsMatch[1]} маршрутов`;
  }

  const experienceTypesMatch = value.match(/^(\d+) סוגי חוויה שמתחילים בבחירה נכונה$/);
  if (experienceTypesMatch) {
    return language === "en"
      ? `${experienceTypesMatch[1]} experience types, one clear place to start`
      : language === "fr"
        ? `${experienceTypesMatch[1]} types d’expérience, un point de départ clair`
        : `${experienceTypesMatch[1]} видов отдыха, с понятным выбором с самого начала`;
  }

  const searchSummaryMatch = value.match(/^שינוי חיפוש\.\s*(.+)$/);
  if (searchSummaryMatch) {
    const translatedSummary = searchSummaryMatch[1]
      .split(/\s*[·•]\s*/)
      .map((part) => translateValue(part, language).trim())
      .join(" · ");
    return language === "en"
      ? `Change search. ${translatedSummary}`
      : language === "fr"
        ? `Modifier la recherche. ${translatedSummary}`
        : `Изменить поиск. ${translatedSummary}`;
  }

  const removeFilterMatch = value.match(/^הסרת הסינון (.+)$/);
  if (removeFilterMatch) {
    const label = translatePart(removeFilterMatch[1]);
    return language === "en"
      ? `Remove ${label} filter`
      : language === "fr"
        ? `Retirer le filtre ${label}`
        : `Убрать фильтр ${label}`;
  }

  const favoriteMatch = value.match(/^(שמירת|הסרת) (.+) (?:במקומות שאהבתי|מהמקומות שאהבתי)$/);
  if (favoriteMatch) {
    const name = translatePart(favoriteMatch[2]);
    const saving = favoriteMatch[1] === "שמירת";
    return language === "en"
      ? `${saving ? "Save" : "Remove"} ${name} ${saving ? "to" : "from"} favorites`
      : language === "fr"
        ? `${saving ? "Ajouter" : "Retirer"} ${name} ${saving ? "aux" : "des"} favoris`
        : `${saving ? "Добавить" : "Удалить"} ${name} ${saving ? "в избранное" : "из избранного"}`;
  }

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

  const hourlyResultsMatch = value.match(/^(\d+) מקומות נמצאו$/);
  if (hourlyResultsMatch) {
    const count = Number(hourlyResultsMatch[1]);
    if (language === "en") return count === 1 ? "One place found" : `${count} places found`;
    if (language === "fr") return count === 1 ? "Un lieu trouvé" : `${count} lieux trouvés`;
    const noun = count % 10 === 1 && count % 100 !== 11 ? "место" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "места" : "мест";
    return `Найдено ${count} ${noun}`;
  }

  const spaResultsMatch = value.match(/^(\d+) בתי ספא(?: בישראל| ב(?!אזור המוצג במפה)(.+))$/);
  if (spaResultsMatch) {
    const count = Number(spaResultsMatch[1]);
    const sourceLocation = spaResultsMatch[2];
    const location = sourceLocation ? translatePart(sourceLocation) : null;
    if (language === "en") return `${count} ${count === 1 ? "spa" : "spas"}${location ? ` in ${location}` : " in Israel"}`;
    if (language === "fr") return `${count} spa${count === 1 ? "" : "s"}${location ? ` à ${location}` : " en Israël"}`;
    const noun = count % 10 === 1 && count % 100 !== 11 ? "спа-центр" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "спа-центра" : "спа-центров";
    return `${count} ${noun}${location ? ` в ${location}` : " в Израиле"}`;
  }

  const spaMapResultsMatch = value.match(/^(\d+) בתי ספא באזור המוצג במפה$/);
  if (spaMapResultsMatch) {
    const count = Number(spaMapResultsMatch[1]);
    if (language === "en") return `${count} ${count === 1 ? "spa" : "spas"} in the map area`;
    if (language === "fr") return `${count} spa${count === 1 ? "" : "s"} dans la zone affichée`;
    const noun = count % 10 === 1 && count % 100 !== 11 ? "спа-центр" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "спа-центра" : "спа-центров";
    return `${count} ${noun} в области карты`;
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
    if (translatedDestination === sourceDestination) return value;
    return language === "en"
      ? "Stays in " + translatedDestination
      : language === "fr"
        ? "Séjours à " + translatedDestination
        : "\u041e\u0442\u0434\u044b\u0445 \u0432 " + translatedDestination;
  }

  const regionalFooterMatch = value.match(/^(מקומות לאירועים|חדרים לפי שעה|ספא|וילות נופש|מתחמי סוויטות|סוויטות יוקרה|דירות נופש) ב(.+)$/);
  if (regionalFooterMatch) {
    const [, topic, sourceRegion] = regionalFooterMatch;
    const translatedRegion = translatePart(sourceRegion);
    if (translatedRegion === sourceRegion) return value;
    const topics = {
      en: {
        "מקומות לאירועים": "Event venues",
        "חדרים לפי שעה": "Hourly stays",
        "ספא": "Spas",
        "וילות נופש": "Vacation villas",
        "מתחמי סוויטות": "Suite complexes",
        "סוויטות יוקרה": "Luxury suites",
        "דירות נופש": "Vacation apartments",
      },
      ru: {
        "מקומות לאירועים": "Площадки для мероприятий",
        "חדרים לפי שעה": "Почасовые номера",
        "ספא": "Спа",
        "וילות נופש": "Виллы для отдыха",
        "מתחמי סוויטות": "Комплексы люксов",
        "סוויטות יוקרה": "Люксы премиум-класса",
        "דירות נופש": "Апартаменты для отдыха",
      },
      fr: {
        "מקומות לאירועים": "Lieux événementiels",
        "חדרים לפי שעה": "Chambres à l’heure",
        "ספא": "Spas",
        "וילות נופש": "Villas de vacances",
        "מתחמי סוויטות": "Complexes de suites",
        "סוויטות יוקרה": "Suites de luxe",
        "דירות נופש": "Appartements de vacances",
      },
    } as const;
    const translatedTopic = topics[language][topic as keyof typeof topics.en];
    if (language === "en") return `${translatedTopic} in ${translatedRegion}`;
    if (language === "fr") return `${translatedTopic} à ${translatedRegion}`;
    return `${translatedTopic}, ${translatedRegion}`;
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

  // Hebrew is the server-rendered source language. Rewalking the full document
  // on Hebrew routes adds work without changing a single node.
  if (language !== "he") applyLanguageToRoot(document.body, language);

  if (document.title && hebrewPattern.test(document.title)) originalDocumentTitle = document.title;
  if (originalDocumentTitle) document.title = translateValue(originalDocumentTitle, language);
}

function applyLanguageToRoot(root: Node, language: SiteLanguage) {
  const translateTextNode = (textNode: Text) => {
    const parent = textNode.parentElement;
    if (!parent || parent.closest("[data-no-translate]") || ["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].includes(parent.tagName)) return;
    if (hebrewPattern.test(textNode.data) && !originalText.has(textNode)) originalText.set(textNode, textNode.data);
    const source = originalText.get(textNode);
    if (!source) return;
    const translated = translateValue(source, language);
    if (textNode.data !== translated) textNode.data = translated;
  };

  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
  } else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      translateTextNode(node);
      node = walker.nextNode() as Text | null;
    }
  }

  const rootElement = root.nodeType === Node.ELEMENT_NODE ? root as Element : root.parentElement;
  const elements = rootElement ? [rootElement, ...rootElement.querySelectorAll("*")] : [];
  elements.forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    const saved = originalAttributes.get(element) || new Map<string, string>();
    translatedAttributes.forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (current && hebrewPattern.test(current) && !saved.has(attribute)) saved.set(attribute, current);
      const source = saved.get(attribute);
      if (source) {
        const translated = translateValue(source, language);
        if (current !== translated) element.setAttribute(attribute, translated);
      }
    });
    if (saved.size) originalAttributes.set(element, saved);
  });

  const anchors = elements.filter((element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement && element.hasAttribute("href"));
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    const localizedHref = localizedPath(href, language);
    if (href !== localizedHref) anchor.setAttribute("href", localizedHref);
  });

  elements.filter((element): element is HTMLElement => element instanceof HTMLElement && element.classList.contains("filter-apply")).forEach((button) => {
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
  const [language, setLanguageState] = useState<SiteLanguage>(() => initialLanguage());
  const [translationVersion, setTranslationVersion] = useState(0);
  const observer = useRef<MutationObserver | null>(null);

  const setLanguage = (nextLanguage: SiteLanguage) => {
    localStorage.setItem(languageStorageKey, nextLanguage);
    const url = new URL(window.location.href);
    url.searchParams.delete("lang");
    const destination = localizedPath(`${url.pathname}${url.search}${url.hash}`, nextLanguage);
    window.location.assign(destination);
  };

  useEffect(() => {
    const syncLanguageWithRoute = () => {
      const routeLanguage = languageFromPathname(window.location.pathname);
      localStorage.setItem(languageStorageKey, routeLanguage);
      setLanguageState(routeLanguage);
    };
    syncLanguageWithRoute();
    window.addEventListener("popstate", syncLanguageWithRoute);
    return () => window.removeEventListener("popstate", syncLanguageWithRoute);
  }, []);

  useEffect(() => {
    const preserveLanguageOnInternalNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      const destination = localizedPath(href, language);
      if (language === "he" && destination === href) return;
      // Keep the localized URL while allowing Next to retain its fast
      // client-side navigation instead of forcing a full document reload.
      if (destination !== href) anchor.setAttribute("href", destination);
    };
    document.addEventListener("click", preserveLanguageOnInternalNavigation, true);
    return () => document.removeEventListener("click", preserveLanguageOnInternalNavigation, true);
  }, [language]);

  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const localeAwareUrl = (url?: string | URL | null) => {
      if (url == null) return url;
      const rawUrl = String(url);
      if (rawUrl.startsWith("#")) return url;
      const resolved = new URL(rawUrl, window.location.href);
      if (resolved.origin !== window.location.origin) return url;
      return localizedPath(`${resolved.pathname}${resolved.search}${resolved.hash}`, language);
    };
    window.history.pushState = (state, unused, url) => originalPushState(state, unused, localeAwareUrl(url));
    window.history.replaceState = (state, unused, url) => originalReplaceState(state, unused, localeAwareUrl(url));
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [language]);

  useEffect(() => {
    if (language === "he" || loadedTranslations[language]) return;
    let active = true;
    void loadTranslations(language).then(() => {
      if (active) setTranslationVersion((version) => version + 1);
    }).catch(() => {
      document.documentElement.removeAttribute("data-locale-pending");
    });
    return () => { active = false; };
  }, [language]);

  useEffect(() => {
    applyLanguage(language);
    const translationReady = language === "he" || Boolean(loadedTranslations[language]);
    if (translationReady) document.documentElement.removeAttribute("data-locale-pending");
    observer.current?.disconnect();
    if (language === "he") return;
    let frame = 0;
    const pendingRoots = new Set<Node>();
    const observe = () => observer.current?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatedAttributes });
    observer.current = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "childList") record.addedNodes.forEach((node) => pendingRoots.add(node));
        else pendingRoots.add(record.target);
      });
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        observer.current?.disconnect();
        pendingRoots.forEach((root) => {
          if (root.isConnected) applyLanguageToRoot(root, language);
        });
        pendingRoots.clear();
        observe();
      });
    });
    observe();
    const settleFrame = window.requestAnimationFrame(() => applyLanguageToRoot(document.body, language));
    const settleTimer = window.setTimeout(() => applyLanguageToRoot(document.body, language), 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
      window.clearTimeout(settleTimer);
      observer.current?.disconnect();
    };
  }, [language, translationVersion]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    translate: (source: string) => translateValue(source, language),
  }), [language, translationVersion]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function LanguageSwitcher({ compact = false, iconOnly = false }: { compact?: boolean; iconOnly?: boolean }) {
  const { language, setLanguage } = useContext(LocaleContext);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const labels = { he: "עברית", en: "English", ru: "Русский", fr: "Français" } as const;
  const chooserLabels = { he: "בחירת שפה", en: "Choose language", ru: "Выбрать язык", fr: "Choisir la langue" } as const;

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  const handleTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true);
    window.requestAnimationFrame(() => {
      const options = root.current?.querySelectorAll<HTMLButtonElement>(".language-option");
      const activeIndex = (Object.keys(labels) as SiteLanguage[]).indexOf(language);
      options?.[event.key === "ArrowUp" ? options.length - 1 : Math.max(activeIndex, 0)]?.focus();
    });
  };

  return <div ref={root} data-no-translate className={`language-switcher ${open ? "is-open" : ""} ${compact ? "language-switcher--compact" : ""} ${iconOnly ? "language-switcher--icon-only" : ""}`}>
    <button
      ref={trigger}
      className="language-trigger"
      type="button"
      aria-label={chooserLabels[language]}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={handleTriggerKey}
    >
      <svg className="language-trigger__globe" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z" />
      </svg>
      <span className="language-trigger__label" lang={language} dir={language === "he" ? "rtl" : "ltr"}>{labels[language]}</span>
      <svg className="language-trigger__chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </button>
    <div id={menuId} className="language-menu" role="menu" aria-label={chooserLabels[language]} hidden={!open}>
      <div className="language-menu__eyebrow">{chooserLabels[language]}</div>
      {(Object.keys(labels) as SiteLanguage[]).map((code) => (
        <button
          className={`language-option ${language === code ? "is-active" : ""}`}
          key={code}
          type="button"
          role="menuitemradio"
          aria-checked={language === code}
          lang={code}
          dir={code === "he" ? "rtl" : "ltr"}
          onClick={() => {
            setLanguage(code);
            setOpen(false);
            trigger.current?.focus();
          }}
        >
          <span className="language-option__mark" aria-hidden="true">{language === code ? "✓" : ""}</span>
          <span>{labels[code]}</span>
          <small>{code.toUpperCase()}</small>
        </button>
      ))}
    </div>
  </div>;
}

export function useSiteLanguage() {
  return useContext(LocaleContext);
}
