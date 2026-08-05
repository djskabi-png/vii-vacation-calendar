"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import translations from "./translations.generated.json";

export type SiteLanguage = "he" | "en" | "ru";

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
  },
};

const finalUiTranslations: Record<Exclude<SiteLanguage, "he">, Record<string, string>> = {
  en: {
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
  },
  ru: {
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
  },
};

function normalizeLanguage(value: string | null): SiteLanguage {
  return value === "en" || value === "ru" ? value : "he";
}

function initialLanguage(): SiteLanguage {
  if (typeof window === "undefined") return "he";
  const urlLanguage = new URLSearchParams(window.location.search).get("lang");
  return normalizeLanguage(urlLanguage || localStorage.getItem(languageStorageKey));
}

function dictionary(language: SiteLanguage): Record<string, string> {
  return language === "he" ? {} : translations[language];
}

function translateDynamic(value: string, language: Exclude<SiteLanguage, "he">) {
  const showPlacesMatch = value.match(/^\u05d4\u05e6\u05d2\u05ea (\d+) \u05de\u05e7\u05d5\u05de\u05d5\u05ea$/);
  if (showPlacesMatch) {
    return language === "en"
      ? "Show " + showPlacesMatch[1] + " places"
      : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c " + showPlacesMatch[1] + " \u043c\u0435\u0441\u0442";
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
  } else {
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
        : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c " + count + " " + russianPlace;
    if (textNode.nodeValue !== label) textNode.nodeValue = label;
  });
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>("he");
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
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useContext(LocaleContext);
  const select = useRef<HTMLSelectElement>(null);
  const labels = { he: "עברית", en: "English", ru: "Русский" } as const;
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
