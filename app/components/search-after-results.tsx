"use client";

import Link from "next/link";
import { useRef } from "react";
import { useSearchParams } from "next/navigation";
import { StructuredData } from "./structured-data";
import { faqSchema } from "../lib/seo";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { eventPlaces, properties } from "../data/site-data";
import { isWholeCountrySelection, matchesSearchLocation, searchLocationOptions, type SearchMode } from "../data/search-taxonomy";
import { spaSearchHref, spaSearchRegions } from "../data/spa-search-landings";

export type SearchContentWorld = "vacation" | "events" | "spa" | "hourly" | "providers" | "activities";

export type SearchReviewHighlight = {
  name: string;
  href: string;
  rating: number;
  reviews?: number;
  context?: string;
};

export type ContextualSearchSuggestion = {
  label: string;
  params: Record<string, string | null>;
};

type DiscoveryLink = {
  label: string;
  href: string;
  meta: string;
};

const discoveryCopy: Record<SiteLanguage, {
  eyebrow: string;
  title: string;
  intro: string;
  regionPlaces: string;
  nearbyPlaces: string;
  countryAreas: string;
  tailoredSearches: string;
  generalSearches: string;
  destinationMeta: string;
  searchMeta: string;
  previous: string;
  next: string;
}> = {
  he: {
    eyebrow: "ממשיכים לגלות",
    title: "עוד רעיונות שמתאימים לחיפוש שלכם",
    intro: "עוברים בקלות ליישובים קרובים, אזורים דומים ושילובי חיפוש רלוונטיים.",
    regionPlaces: "יישובים שכדאי לבדוק באזור",
    nearbyPlaces: "מקומות נוספים בסביבה",
    countryAreas: "אזורים נוספים ברחבי הארץ",
    tailoredSearches: "חיפושים לפי הבחירה שלכם",
    generalSearches: "חיפושים קשורים",
    destinationMeta: "לצפייה במקומות באזור",
    searchMeta: "חיפוש ממוקד",
    previous: "הצגת האפשרויות הקודמות",
    next: "הצגת אפשרויות נוספות",
  },
  en: {
    eyebrow: "Keep exploring",
    title: "More ideas for your search",
    intro: "Move easily between nearby places, similar areas and relevant search combinations.",
    regionPlaces: "Places worth exploring in the area",
    nearbyPlaces: "More places nearby",
    countryAreas: "More areas across Israel",
    tailoredSearches: "Searches based on your choices",
    generalSearches: "Related searches",
    destinationMeta: "Explore places in this area",
    searchMeta: "Focused search",
    previous: "Show previous options",
    next: "Show more options",
  },
  ru: {
    eyebrow: "Продолжайте поиск",
    title: "Больше идей для вашего поиска",
    intro: "Легко переходите к ближайшим местам, похожим районам и подходящим вариантам поиска.",
    regionPlaces: "Места, которые стоит посмотреть в этом районе",
    nearbyPlaces: "Другие места поблизости",
    countryAreas: "Другие районы Израиля",
    tailoredSearches: "Поиск по вашим критериям",
    generalSearches: "Похожие запросы",
    destinationMeta: "Посмотреть места в районе",
    searchMeta: "Точный поиск",
    previous: "Показать предыдущие варианты",
    next: "Показать другие варианты",
  },
  fr: {
    eyebrow: "Poursuivez votre recherche",
    title: "D'autres idées adaptées à votre recherche",
    intro: "Passez facilement aux lieux proches, aux régions similaires et aux recherches pertinentes.",
    regionPlaces: "Lieux à découvrir dans la région",
    nearbyPlaces: "D'autres lieux à proximité",
    countryAreas: "D'autres régions en Israël",
    tailoredSearches: "Recherches selon vos choix",
    generalSearches: "Recherches associées",
    destinationMeta: "Découvrir les lieux de la région",
    searchMeta: "Recherche ciblée",
    previous: "Afficher les options précédentes",
    next: "Afficher plus d'options",
  },
};

const worldSearchPaths: Record<SearchContentWorld, string> = {
  vacation: "/search",
  events: "/events/search",
  spa: "/spas",
  hourly: "/hourly",
  providers: "/providers",
  activities: "/attractions",
};

function contextualHref(
  world: SearchContentWorld,
  language: SiteLanguage,
  currentQuery: string,
  updates: Record<string, string | null>,
) {
  const params = new URLSearchParams(currentQuery);
  params.delete("v");
  params.delete("release");
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  const path = localizedPath(worldSearchPaths[world], language);
  return query ? `${path}?${query}` : path;
}

function destinationOptions(world: SearchContentWorld, location?: string) {
  const mode: SearchMode | null = world === "vacation" || world === "events" || world === "spa" || world === "hourly" ? world : null;
  if (!mode) return [];
  const options = searchLocationOptions(mode);
  if (!location || isWholeCountrySelection(location)) {
    return options.filter((item) => !isWholeCountrySelection(item)).slice(0, 10);
  }

  const inventory = world === "events" ? eventPlaces : world === "vacation" ? properties.filter((item) => item.active !== false && !item.demoOperations?.fictional) : [];
  if (!inventory.length) return options.filter((item) => item !== location && !isWholeCountrySelection(item)).slice(0, 10);

  const exactPlaces = inventory.filter((item) => item.location === location);
  const matchingAreas = new Set(exactPlaces.map((item) => item.area).filter(Boolean));
  const nearby = inventory
    .filter((item) => exactPlaces.length ? matchingAreas.has(item.area) : matchesSearchLocation(item, location))
    .map((item) => item.location)
    .filter((item): item is string => Boolean(item) && item !== location);
  const uniqueNearby = [...new Set(nearby)];
  if (uniqueNearby.length >= 3) return uniqueNearby.slice(0, 12);

  const matchingOptions = options.filter((item) => item !== location && !isWholeCountrySelection(item));
  return [...new Set([...uniqueNearby, ...matchingOptions])].slice(0, 10);
}

function destinationHref(
  world: SearchContentWorld,
  language: SiteLanguage,
  currentQuery: string,
  locationParam: string,
  destination: string,
) {
  if (world === "spa") {
    const region = spaSearchRegions.find((entry) => entry.label === destination);
    if (region) return localizedPath(spaSearchHref({ region, features: [] }), language);
  }
  return contextualHref(world, language, currentQuery, { [locationParam]: isWholeCountrySelection(destination) ? null : destination });
}

function DiscoveryRail({ title, links, previousLabel, nextLabel }: {
  title: string;
  links: DiscoveryLink[];
  previousLabel: string;
  nextLabel: string;
}) {
  const railRef = useRef<HTMLElement>(null);
  const move = (direction: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(260, rail.clientWidth * 0.72), behavior: "smooth" });
  };

  if (!links.length) return null;
  return <div className="search-depth__rail-block">
    <div className="search-depth__rail-head">
      <h3>{title}</h3>
      <div className="search-depth__rail-controls">
        <button type="button" onClick={() => move(-1)} aria-label={previousLabel}>‹</button>
        <button type="button" onClick={() => move(1)} aria-label={nextLabel}>›</button>
      </div>
    </div>
    <nav ref={railRef} className="search-depth__rail" aria-label={title}>
      {links.map((item) => <Link className="search-depth__discovery-card" key={`${item.href}-${item.label}`} href={item.href}>
        <span className="search-depth__discovery-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg></span>
        <strong>{item.label}</strong>
        <small>{item.meta}</small>
        <span className="search-depth__discovery-arrow" aria-hidden="true">←</span>
      </Link>)}
    </nav>
  </div>;
}

type SearchContent = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  reviewCriteria: string[];
  faqs: Array<{ question: string; answer: string }>;
  related: Array<{ label: string; href: string }>;
};

const contentByWorld: Record<SearchContentWorld, SearchContent> = {
  vacation: {
    eyebrow: "מתכננים את החופשה נכון",
    title: "איך בוחרים מקום נופש שמתאים באמת",
    paragraphs: [
      "כדאי להתחיל מהתאריכים, מספר האורחים והאזור, ורק אחר כך להשוות בין סוגי האירוח. במתחם עם כמה יחידות חשוב לבדוק כמה יחידות מזמינים בפועל, כמה חדרי שינה יש בכל יחידה ומה משותף לכל האורחים.",
      "המחיר שמופיע בתוצאות הוא נקודת התחלה. לפני הזמנה בודקים מה כלול, אילו תוספות מחויבות בנפרד, מהי מדיניות הביטול והאם הזמינות אושרה לתאריכים ולהרכב שבחרתם.",
    ],
    reviewCriteria: ["ניקיון ותחזוקת המקום", "התאמה בין התמונות למציאות", "שירות, זמינות ותגובה לבקשות"],
    faqs: [
      { question: "איך בודקים זמינות לתאריך מסוים?", answer: "נכנסים לעמוד המקום, בוחרים תאריכי כניסה ויציאה וכמות אורחים, ואז ממשיכים להזמנה מקוונת או שולחים למתחם בקשת זמינות מסודרת." },
      { question: "האם המחיר בתוצאות הוא המחיר הסופי?", answer: "לא תמיד. המחיר הסופי עשוי להשתנות לפי התאריכים, מספר האורחים, היחידה, אורך השהייה ותוספות. הסכום המחייב מוצג או מאושר לפני ההזמנה." },
      { question: "מה ההבדל בין יחידות אירוח לחדרי שינה?", answer: "יחידת אירוח היא מקום שניתן להזמין בנפרד. חדר שינה נמצא בתוך יחידה ואינו נחשב ליחידת אירוח נוספת." },
    ],
    related: [
      { label: "וילות בצפון", href: "/villas/%D7%A6%D7%A4%D7%95%D7%9F" }, { label: "מתחמי סוויטות", href: "/suite-complexes" }, { label: "דירות נופש", href: "/vacation-apartments" }, { label: "סוויטות יוקרה", href: "/luxury-suites" }, { label: "נופש עם בריכה", href: "/search?pool=1" }, { label: "נופש נגיש", href: "/search?accessible=1" },
    ],
  },
  events: {
    eyebrow: "לפני שסוגרים תאריך",
    title: "כך משווים בין מקומות לאירועים",
    paragraphs: [
      "מספר המשתתפים הוא רק נקודת הפתיחה. כדאי לבדוק את מבנה החלל, אפשרויות הישיבה, אזורי החוץ, מגבלות הרעש, הנגישות ודרך ההגעה בשעה שבה האירוע צפוי להתקיים.",
      "לפני אישור מבקשים הצעה מלאה שמפרטת את שעות האירוע, הציוד, כוח האדם, הניקיון, האבטחה, התוספות ומדיניות הביטול. כך אפשר להשוות הצעות לפי תמורה ולא רק לפי מחיר פתיחה.",
    ],
    reviewCriteria: ["התנהלות הצוות לפני האירוע", "עמידה בזמנים ובהתחייבויות", "איכות המקום בזמן אירוע אמיתי"],
    faqs: [
      { question: "מתי כדאי לבדוק זמינות למקום לאירוע?", answer: "מומלץ לבדוק מיד לאחר שיש תאריך משוער וכמות משתתפים. בתקופות עמוסות כדאי לפנות מוקדם יותר ולהחזיק חלופה נוספת." },
      { question: "מה חשוב לכלול בהצעת המחיר?", answer: "יש לכלול שכירות, ציוד, ניקיון, אבטחה, שעות נוספות, ספקים חיצוניים, מסים ותנאי ביטול או שינוי." },
      { question: "איך יודעים שהמקום מתאים לכמות המשתתפים?", answer: "בודקים את הקיבולת לפי צורת האירוח המתוכננת ולא רק את המספר המרבי, כולל רחבת ריקודים, ישיבה, מזנון ומעברים נגישים." },
    ],
    related: [
      { label: "אירועים במרכז", href: "/events/search/%D7%9E%D7%A8%D7%9B%D7%96" }, { label: "אירועים בצפון", href: "/events/search/%D7%A6%D7%A4%D7%95%D7%9F" }, { label: "אירועים בדרום", href: "/events/search/%D7%93%D7%A8%D7%95%D7%9D" }, { label: "ספקים לאירועים", href: "/providers" }, { label: "אירועי חברה", href: "/corporate" }, { label: "גיפט קארד", href: "/gift-card" },
    ],
  },
  spa: {
    eyebrow: "בוחרים חבילת ספא",
    title: "מה כדאי לבדוק לפני שמזמינים טיפול",
    paragraphs: [
      "משווים בין סוג הטיפול, משך הטיפול, זמן השהייה במתחם והמתקנים הכלולים. בחבילה זוגית או ביום כיף חשוב לבדוק אם הארוחה, הבריכה, הסאונה והסוויטה הפרטית כלולים במחיר.",
      "התאריך והשעה משפיעים על הזמינות ולעיתים גם על המחיר. לפני תשלום בודקים מי נותן את הטיפול, מה מדיניות השינויים והאם קיימות מגבלות בריאותיות שצריך למסור מראש.",
    ],
    reviewCriteria: ["רמת המטפלים והטיפול", "ניקיון ושקט במתחם", "מה באמת נכלל בחבילה"],
    faqs: [
      { question: "מה ההבדל בין טיפול לחבילת ספא?", answer: "טיפול כולל את זמן הטיפול עצמו. חבילה יכולה לכלול גם מתקנים, ארוחה, סוויטה, בריכה או זמן שהייה נוסף." },
      { question: "איך בודקים זמינות לשעה מסוימת?", answer: "בוחרים חבילה, מספר משתתפים ותאריך. בשלב הבא מוצגות השעות הזמינות או נשלחת בקשה לאישור מול מתחם הספא." },
      { question: "האם המחיר כולל שימוש במתקנים?", answer: "רק אם הדבר מצוין בפרטי החבילה. כדאי לבדוק אילו מתקנים פעילים בתאריך הביקור ולכמה זמן ניתן להשתמש בהם." },
    ],
    related: [
      { label: "ספא זוגי", href: "/spas/search/couples" }, { label: "ספא ליחיד", href: "/spas/search/single" }, { label: "יום כיף בספא", href: "/spas/spa-day" }, { label: "ספא עם בריכה", href: "/spas/spa-with-pool" }, { label: "ספא עם ג׳קוזי", href: "/spas/spa-with-jacuzzi" }, { label: "ספא במלון", href: "/spas/hotel-spa" },
    ],
  },
  hourly: {
    eyebrow: "שהייה קצרה בלי אי ודאות",
    title: "איך בוחרים חדר לפי שעה",
    paragraphs: [
      "בוחרים קודם עיר או אזור, משך שהייה ושעת הגעה משוערת. לאחר מכן משווים מחיר למשך המבוקש, כניסה עצמאית, חניה, פרטיות, מתקנים ותנאי הארכה.",
      "השעה והחדר הפנוי מאושרים ישירות מול המקום. אין להסתמך רק על מחיר פתיחה, וחשוב לוודא מראש את המחיר הכולל, אמצעי התשלום והנחיות הכניסה.",
    ],
    reviewCriteria: ["פרטיות וכניסה נוחה", "ניקיון החדר והמתקנים", "דיוק במחיר ובמשך השהייה"],
    faqs: [
      { question: "איך מזמינים חדר לפי שעה?", answer: "בוחרים מקום ומשך שהייה, מציגים את מספר הטלפון ומאשרים ישירות מול המקום שעה, חדר פנוי ומחיר סופי." },
      { question: "האם המחיר הוא לשעה אחת?", answer: "לא בהכרח. בכל מקום מוצגים פרקי הזמן והמחירים שנמסרו, ולכן חשוב לבחור את משך השהייה המתאים לפני החיוג." },
      { question: "אפשר להזמין ללא מפגש?", answer: "בחלק מהמקומות קיימת כניסה עצמאית או אפשרות ללא מפגש. יש לוודא זאת בפרטי המקום ובשיחת האישור." },
    ],
    related: [
      { label: "חדרים לפי שעה במרכז", href: "/hourly/search/%D7%9E%D7%A8%D7%9B%D7%96" }, { label: "חדרים לפי שעה בצפון", href: "/hourly/search/%D7%A6%D7%A4%D7%95%D7%9F" }, { label: "חדרים לפי שעה בירושלים", href: "/hourly/search/%D7%99%D7%A8%D7%95%D7%A9%D7%9C%D7%99%D7%9D" }, { label: "חדרים עם ג׳קוזי", href: "/hourly?features=jacuzzi" }, { label: "חדרים עם חניה", href: "/hourly?features=parking" }, { label: "מקומות נופש ללילה", href: "/search" },
    ],
  },
  providers: {
    eyebrow: "בוחרים איש מקצוע",
    title: "מה בודקים לפני שסוגרים עם ספק",
    paragraphs: [
      "מגדירים את סוג השירות, התאריך, המיקום ומספר המשתתפים, ואז משווים ניסיון, היקף השירות, ציוד, זמן הגעה ומה נדרש מהמארחים. לספק שמגיע למקום האירוח חשוב לוודא מראש את אזור השירות.",
      "הצעה מסודרת צריכה לכלול מחיר, מסים, מקדמה, שעות עבודה, ביטול, דרישות חשמל או שטח וכל תוספת אפשרית. זה מונע פערים בין השיחה הראשונית לבין השירות ביום האירוע.",
    ],
    reviewCriteria: ["עמידה בזמנים ותקשורת", "איכות השירות בזמן אמת", "התאמה בין ההצעה למה שסופק"],
    faqs: [
      { question: "איך פונים לספק מתוך האתר?", answer: "נכנסים לעמוד הספק ומשתמשים בדרך ההזמנה שמופיעה בו. כאשר הפנייה עוברת בוואטסאפ, הפרטים נשמרים לפני פתיחת השיחה." },
      { question: "מה צריך לשלוח כדי לקבל הצעת מחיר?", answer: "מומלץ לציין תאריך, מיקום, מספר משתתפים, סוג האירוע, שעות משוערות והשירות המדויק שאתם מבקשים." },
      { question: "האם כל ספק עובד בכל הארץ?", answer: "לא. אזורי השירות משתנים בין ספקים ולעיתים כרוכים בעלות נסיעה, לכן בודקים זאת לפני אישור." },
    ],
    related: [
      { label: "שפים וקייטרינג", href: "/providers?category=food" }, { label: "מוזיקה ותקליטנים", href: "/providers?category=music" }, { label: "מופעים ואמנים", href: "/providers?category=entertainment" }, { label: "צילום לאירועים", href: "/providers?category=photo" }, { label: "עיצוב ובלונים", href: "/providers?category=design" }, { label: "מקומות לאירועים", href: "/events/search" },
    ],
  },
  activities: {
    eyebrow: "מתכננים פעילות",
    title: "איך בוחרים אטרקציה שמתאימה להרכב",
    paragraphs: [
      "מתחילים באזור, בגיל המשתתפים וברמת האתגר הרצויה. לאחר מכן בודקים משך הפעילות, ציוד, מגבלות רפואיות, מזג אוויר, נקודת מפגש ומה קורה במקרה של שינוי או ביטול.",
      "בפעילות עם ספק חשוב לקבל לפני האישור את שם המפעיל, המחיר המלא, הביטוח, מה כלול והאם הפעילות אכן מתקיימת בתאריך המבוקש.",
    ],
    reviewCriteria: ["התאמה לגיל ולרמת הקושי", "בטיחות והדרכה", "עמידה במשך ובתכולת הפעילות"],
    faqs: [
      { question: "איך יודעים אם הפעילות מתאימה לילדים?", answer: "בודקים גיל מינימלי, גובה או משקל, רמת מאמץ, ליווי מבוגר וציוד נדרש בפרטי הפעילות." },
      { question: "מה קורה אם מזג האוויר משתנה?", answer: "המדיניות תלויה בספק ובפעילות. לפני הזמנה בודקים אפשרות דחייה, חלופה, ביטול והחזר." },
      { question: "האם המחיר כולל ציוד וביטוח?", answer: "רק אם הדבר מצוין במפורש. יש לוודא מה כלול, איזה ציוד אישי נדרש ומהם תנאי הביטוח והמגבלות." },
    ],
    related: [
      { label: "אטרקציות בצפון", href: "/attractions?area=%D7%A6%D7%A4%D7%95%D7%9F" }, { label: "אטרקציות במרכז", href: "/attractions?area=%D7%9E%D7%A8%D7%9B%D7%96%20%D7%95%D7%AA%D7%9C%20%D7%90%D7%91%D7%99%D7%91" }, { label: "אטרקציות בדרום", href: "/attractions?area=%D7%93%D7%A8%D7%95%D7%9D%20%D7%95%D7%A0%D7%92%D7%91" }, { label: "שטח ואדרנלין", href: "/attractions?type=%D7%A9%D7%98%D7%97%20%D7%95%D7%90%D7%93%D7%A8%D7%A0%D7%9C%D7%99%D7%9F" }, { label: "מים ומשפחה", href: "/attractions?type=%D7%9E%D7%99%D7%9D%20%D7%95%D7%9E%D7%A9%D7%A4%D7%97%D7%94" }, { label: "מסלולי טיול עצמאיים", href: "/trails" },
    ],
  },
};

export function SearchAfterResults({
  world,
  location,
  reviewHighlights = [],
  hideGuideAndFaq = false,
  searchSuggestions = [],
}: {
  world: SearchContentWorld;
  location?: string;
  reviewHighlights?: SearchReviewHighlight[];
  hideGuideAndFaq?: boolean;
  searchSuggestions?: ContextualSearchSuggestion[];
}) {
  const { language, translate } = useSiteLanguage();
  const searchParams = useSearchParams();
  const content = contentByWorld[world];
  const discovery = discoveryCopy[language];
  const reviews = reviewHighlights.filter((item) => Number.isFinite(item.rating) && item.rating > 0).slice(0, 3);
  const translatedLocation = location ? translate(location) : "";
  const normalizedLocation = translatedLocation.trim().toLocaleLowerCase();
  const wholeCountryLabels = ["\u05d4\u05db\u05dc", "\u05db\u05dc \u05d4\u05d0\u05e8\u05e5", "all-country", "all", "all israel", "whole country", "\u0432\u0441\u0435", "\u0432\u0441\u044f \u0441\u0442\u0440\u0430\u043d\u0430", "\u0432\u0435\u0441\u044c \u0438\u0437\u0440\u0430\u0438\u043b\u044c", "tous", "tout isra\u00ebl", "toute isra\u00ebl"];
  const locationPrefixes: Record<SiteLanguage, string> = { he: " \u05d1\u05d0\u05d6\u05d5\u05e8 ", en: " in ", ru: " \u0432 \u0440\u0435\u0433\u0438\u043e\u043d\u0435 ", fr: " dans la r\u00e9gion " };
  const locationLabel = location && !wholeCountryLabels.includes(normalizedLocation) ? `${locationPrefixes[language]}${translatedLocation}` : "";
  const currentQuery = searchParams.toString();
  const destinations = destinationOptions(world, location);
  const locationParam = world === "activities" || world === "providers" ? "area" : "location";
  const destinationLinks: DiscoveryLink[] = destinations.map((destination) => ({
    label: translate(destination),
    href: destinationHref(world, language, currentQuery, locationParam, destination),
    meta: discovery.destinationMeta,
  }));
  const contextualLinks: DiscoveryLink[] = searchSuggestions.length
    ? searchSuggestions.map((item) => ({ label: translate(item.label), href: contextualHref(world, language, currentQuery, item.params), meta: discovery.searchMeta }))
    : content.related.map((item) => ({ label: translate(item.label), href: localizedPath(item.href, language), meta: discovery.searchMeta }));
  const isExactPlace = Boolean(location && !isWholeCountrySelection(location) && (world === "vacation" ? properties : world === "events" ? eventPlaces : []).some((item) => item.location === location));
  const destinationTitle = !location || isWholeCountrySelection(location) ? discovery.countryAreas : isExactPlace ? discovery.nearbyPlaces : discovery.regionPlaces;

  return <section className={`search-depth search-depth--${world}`} aria-label={`מידע נוסף לתכנון${locationLabel}`}>
    {!hideGuideAndFaq ? <StructuredData data={faqSchema(content.faqs)} /> : null}
    <div className="shell search-depth__inner">
      {!hideGuideAndFaq ? <section className="search-depth__guide" aria-labelledby={`search-guide-${world}`}>
        <span className="eyebrow">{content.eyebrow}</span>
        <h2 id={`search-guide-${world}`}>{content.title}{locationLabel}</h2>
        <div>{content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      </section> : null}

      <section className="search-depth__reviews" aria-labelledby={`search-reviews-${world}`}>
        <div className="search-depth__section-head"><span className="eyebrow">חוות דעת שעוזרות לבחור</span><h2 id={`search-reviews-${world}`}>{reviews.length ? "דירוגים ממקומות שמופיעים בתוצאות" : "מה כדאי לבדוק בחוות הדעת"}</h2><p>{reviews.length ? "הציונים מבוססים על נתוני הדירוג שפורסמו במקור המידע של כל מקום. לקריאת ההקשר המלא נכנסים לעמוד המקום." : "לפני שמחליטים, מחפשים בחוות הדעת מידע עקבי על הדברים שמשפיעים באמת על החוויה."}</p></div>
        {reviews.length ? <div className="search-depth__review-grid">{reviews.map((review) => <Link key={review.href} href={review.href}><span>{review.context || "דירוג שפורסם במקור המידע"}</span><strong><bdi dir="ltr">{review.rating.toLocaleString("he-IL", { maximumFractionDigits: 1 })}</bdi><small aria-hidden="true">★</small></strong><h3>{review.name}</h3>{review.reviews ? <p>{review.reviews} חוות דעת שפורסמו</p> : <p>לפרטים ולמקור הדירוג</p>}</Link>)}</div> : <ul className="search-depth__review-checklist">{content.reviewCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>}
      </section>

      {!hideGuideAndFaq ? <section className="search-depth__faq" aria-labelledby={`search-faq-${world}`}>
        <span className="eyebrow">תשובות לפני שבוחרים</span>
        <h2 id={`search-faq-${world}`}>שאלות נפוצות</h2>
        <div>{content.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </section> : null}

      <section className="search-depth__related search-depth__discovery" aria-labelledby={`search-related-${world}`}>
        <div className="search-depth__discovery-intro"><span className="eyebrow">{discovery.eyebrow}</span><h2 id={`search-related-${world}`}>{discovery.title}</h2><p>{discovery.intro}</p></div>
        <DiscoveryRail title={destinationTitle} links={destinationLinks} previousLabel={discovery.previous} nextLabel={discovery.next} />
        <DiscoveryRail title={searchSuggestions.length ? discovery.tailoredSearches : discovery.generalSearches} links={contextualLinks} previousLabel={discovery.previous} nextLabel={discovery.next} />
      </section>
    </div>
  </section>;
}
