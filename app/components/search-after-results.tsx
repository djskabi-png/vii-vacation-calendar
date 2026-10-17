"use client";

import Link from "next/link";
import Image from "next/image";
import { useId, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { StructuredData } from "./structured-data";
import { faqSchema } from "../lib/seo";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { isWholeCountrySelection, matchesSearchLocation, searchLocationOptions, type SearchMode } from "../data/search-taxonomy";
import { spaSearchHref, spaSearchRegions, spaSearchStateFromValues } from "../data/spa-search-landings";
import { DepthTopicIcon } from "./depth-topic-icon";
import { defaultDepthSuggestions, depthLocationParam, depthQuery, depthTopicKey, secondaryDepthLayers, type DepthSuggestion, type DepthWorld } from "../lib/world-depth-policy";
import { activityDepthTopics, trailDepthTopics } from "../lib/world-depth-topics";
import { SliderRailControls } from "./slider-rail-controls";
import { buildSearchDepthLocationLayers, isPlaceTypeSuggestion, type SearchDepthInventoryPlace } from "../lib/search-depth-model";
import { useSearchDepthSeed } from "./search-depth-seed";

export type SearchContentWorld = DepthWorld;

export type SearchReviewHighlight = {
  name: string;
  href: string;
  rating: number;
  reviews?: number;
  context?: string;
};

export type ContextualSearchSuggestion = DepthSuggestion;

type DiscoveryLink = {
  label: string;
  href: string;
  meta: string;
  topic?: string;
};

type VisualDiscoveryLink = DiscoveryLink & {
  image: string;
  imageLabel?: string;
};

const discoveryCopy: Record<SiteLanguage, {
  eyebrow: string;
  title: string;
  intro: string;
  regionPlaces: string;
  suitableRegions: string;
  citiesInArea: string;
  additionalRegions: string;
  placeTypes: string;
  smartSearches: string;
  trails: string;
  providers: string;
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
    suitableRegions: "אזורים שמתאימים לחיפוש",
    citiesInArea: "יישובים",
    additionalRegions: "אזורים נוספים שכדאי להכיר",
    placeTypes: "סוגי מקום",
    smartSearches: "חיפושים חכמים",
    trails: "טיולים",
    providers: "ספקים שיכולים להשלים את החופשה",
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
    suitableRegions: "Regions that fit this search",
    citiesInArea: "Cities and places",
    additionalRegions: "More regions to explore",
    placeTypes: "Place types",
    smartSearches: "Smart related searches",
    trails: "Trails",
    providers: "Services that can complement your stay",
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
    suitableRegions: "Подходящие регионы",
    citiesInArea: "Города и места",
    additionalRegions: "Другие регионы",
    placeTypes: "Типы размещения",
    smartSearches: "Умные связанные запросы",
    trails: "Маршруты",
    providers: "Услуги для вашего отдыха",
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
    suitableRegions: "Régions adaptées à cette recherche",
    citiesInArea: "Villes et lieux",
    additionalRegions: "Autres régions à découvrir",
    placeTypes: "Types d'hébergement",
    smartSearches: "Recherches intelligentes associées",
    trails: "Randonnées",
    providers: "Services pour compléter votre séjour",
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
  trails: "/trails",
};

function contextualHref(
  world: SearchContentWorld,
  language: SiteLanguage,
  currentQuery: string,
  updates: Record<string, string | null>,
  customPath?: string,
) {
  const params = depthQuery(world, currentQuery, updates);
  if (world === "spa") {
    const state = spaSearchStateFromValues(params.get("location") || undefined, params.get("spaFor") || undefined, (params.get("features") || "").split(",").filter(Boolean));
    const path = localizedPath(spaSearchHref(state), language);
    const extra = new URLSearchParams();
    if (params.get("location") && !state.region) extra.set("location", params.get("location")!);
    if (params.get("date")) extra.set("date", params.get("date")!);
    return extra.size ? `${path}?${extra}` : path;
  }
  let targetPath = customPath || worldSearchPaths[world];
  const topics = world === "activities" ? activityDepthTopics : world === "trails" ? trailDepthTopics : [];
  const topic = topics.find(entry => Object.entries(entry.params).every(([key, value]) => params.get(key) === value));
  if (topic && !customPath) {
    targetPath = `${worldSearchPaths[world]}/explore/${topic.slug}`;
    Object.keys(topic.params).forEach(key => params.delete(key));
  }
  const query = params.toString();
  const path = localizedPath(targetPath, language);
  return query ? `${path}?${query}` : path;
}

function destinationOptions(world: SearchContentWorld, location?: string, inventory: SearchDepthInventoryPlace[] = []) {
  const mode: SearchMode | null = world === "vacation" || world === "events" || world === "spa" || world === "hourly" ? world : null;
  if (!mode) return [];
  const options = searchLocationOptions(mode);
  if (!location || isWholeCountrySelection(location)) {
    return options.filter((item) => !isWholeCountrySelection(item)).slice(0, 10);
  }

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

function scopeSuggestionLabel(label: string, location: string, language: SiteLanguage, kind: "type" | "smart") {
  if (!location) return label;
  if (language !== "he") {
    const preposition = language === "en" ? "in" : language === "ru" ? "в регионе" : "dans la région";
    return `${label} ${preposition} ${location}`;
  }
  const place = `ב${location}`;
  if (kind === "type") return `${label} ${place}`;
  for (const prefix of ["נופש", "אירועים"]) {
    if (label === prefix) return `${prefix} ${place}`;
    if (label.startsWith(`${prefix} `)) return `${prefix} ${place}${label.slice(prefix.length)}`;
  }
  return `${label} ${place}`;
}

function matchesDepthTerm(value: string, location: string, contextArea: string) {
  const normalized = value.toLocaleLowerCase();
  return [location, contextArea].filter(Boolean).some((term) => {
    const candidate = term.toLocaleLowerCase();
    return normalized.includes(candidate) || candidate.includes(normalized);
  });
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
    if (region) {
      const incoming = new URLSearchParams(currentQuery);
      const state = spaSearchStateFromValues(destination, incoming.get("spaFor") || undefined, (incoming.get("features") || "").split(",").filter(Boolean));
      const path = localizedPath(spaSearchHref(state), language);
      return incoming.get("date") ? `${path}?date=${encodeURIComponent(incoming.get("date")!)}` : path;
    }
  }
  return contextualHref(world, language, currentQuery, { [locationParam]: isWholeCountrySelection(destination) ? null : destination });
}

function DiscoveryRail({ title, links }: {
  title: string;
  links: DiscoveryLink[];
}) {
  const railRef = useRef<HTMLElement>(null);
  const railId = useId();

  if (!links.length) return null;
  return <div className="search-depth__rail-block">
    <div className="search-depth__rail-head">
      <h3>{title}</h3>
      <SliderRailControls railId={railId} railRef={railRef} label={title} className="search-depth__rail-controls" />
    </div>
    <nav id={railId} ref={railRef} className="search-depth__rail" data-horizontal-rail aria-label={title}>
      {links.map((item) => <Link className="search-depth__discovery-card" key={`${item.href}-${item.label}`} href={item.href}>
        <DepthTopicIcon topic={item.topic || "compass"} />
        <strong>{item.label}</strong>
        <small>{item.meta}</small>
        <span className="search-depth__discovery-arrow" aria-hidden="true">←</span>
      </Link>)}
    </nav>
  </div>;
}

function VisualDiscoveryRail({ title, links }: { title: string; links: VisualDiscoveryLink[] }) {
  const railRef = useRef<HTMLElement>(null);
  const railId = useId();
  if (!links.length) return null;
  return <div className="search-depth__rail-block search-depth__rail-block--visual">
    <div className="search-depth__rail-head">
      <h3>{title}</h3>
      <SliderRailControls railId={railId} railRef={railRef} label={title} className="search-depth__rail-controls" />
    </div>
    <nav id={railId} ref={railRef} className="search-depth__rail search-depth__visual-rail" data-horizontal-rail aria-label={title}>
      {links.map((item) => <Link className="search-depth__visual-card" key={`${item.href}-${item.label}`} href={item.href}>
        <span className="search-depth__visual-media"><Image src={item.image} alt={item.imageLabel ? `${item.label}, ${item.imageLabel}` : item.label} title={item.imageLabel ? `${item.label}, ${item.imageLabel}` : item.label} width={560} height={360} loading="lazy" /></span>
        {item.imageLabel ? <span className="image-context-label">{item.imageLabel}</span> : null}
        <span className="search-depth__visual-body"><strong>{item.label}</strong><small>{item.meta}</small><span aria-hidden="true">←</span></span>
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

const contentByWorld: Record<Exclude<SearchContentWorld, "trails">, SearchContent> = {
  vacation: {
    eyebrow: "מתכננים את החופשה נכון",
    title: "איך בוחרים מקום נופש שמתאים באמת",
    paragraphs: [
      "כדאי להתחיל מהתאריכים, מספר האורחים והאזור, ורק אחר כך להשוות בין סוגי האירוח. במתחם עם כמה יחידות חשוב לבדוק כמה יחידות מזמינים בפועל, כמה חדרי שינה יש בכל יחידה ומה משותף לכל האורחים.",
      "לפני שמאשרים הזמנה, בודקים את המחיר לתאריכים ולהרכב שבחרתם, מה כלול ומהי מדיניות הביטול.",
    ],
    reviewCriteria: ["ניקיון ותחזוקת המקום", "התאמה בין התמונות למציאות", "שירות, זמינות ותגובה לבקשות"],
    faqs: [
      { question: "איך בודקים זמינות לתאריך מסוים?", answer: "נכנסים לעמוד המקום, בוחרים תאריכי כניסה ויציאה וכמות אורחים ושולחים בקשה לבירור מול המקום. בחירת תאריכים לבדה אינה אישור זמינות." },
      { question: "האם יש מחיר סופי בתוצאות?", answer: "מחיר סופי מתייחס לתאריכים ולהרכב מסוימים. לפני אישור ההזמנה, ודאו שהסכום והתנאים תואמים לבחירה שלכם." },
      { question: "מה ההבדל בין יחידות אירוח לחדרי שינה?", answer: "יחידת אירוח היא מקום שניתן להזמין בנפרד. חדר שינה נמצא בתוך יחידה ואינו נחשב ליחידת אירוח נוספת." },
    ],
    related: [
      { label: "נופש בצפון", href: "/vacations/north" }, { label: "נופש בכנרת", href: "/vacations/kinneret" }, { label: "נופש בירושלים", href: "/vacations/jerusalem" }, { label: "נופש במרכז", href: "/vacations/center" }, { label: "מקומות עם בריכה", href: "/search?feature=בריכה" }, { label: "כל מקומות הנופש", href: "/search" },
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
      { label: "שפים וקייטרינג", href: "/providers/food" }, { label: "מוזיקה ותקליטנים", href: "/providers/music" }, { label: "מופעים ואמנים", href: "/providers/entertainment" }, { label: "צילום לאירועים", href: "/providers/photo" }, { label: "עיצוב ובלונים", href: "/providers/design" }, { label: "מקומות לאירועים", href: "/events/search" },
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
  inventory = [],
  discoveryOnly = false,
  baseParams = {},
}: {
  world: SearchContentWorld;
  location?: string;
  reviewHighlights?: SearchReviewHighlight[];
  hideGuideAndFaq?: boolean;
  searchSuggestions?: ContextualSearchSuggestion[];
  inventory?: SearchDepthInventoryPlace[];
  discoveryOnly?: boolean;
  baseParams?: Record<string, string>;
}) {
  const { language, translate } = useSiteLanguage();
  // Supplier catalogs can contain non-geographic service labels. They are not
  // destinations, and must never become region or city landing suggestions.
  if (world === "spa") inventory = inventory.filter(item => spaSearchRegions.some(region => region.label === item.area));
  const searchParams = useSearchParams();
  const content = contentByWorld[world === "trails" ? "activities" : world];
  const locationParam = depthLocationParam(world);
  location = searchParams.get(locationParam) || location || baseParams[locationParam];
  const discovery = discoveryCopy[language];
  const depthSeed = useSearchDepthSeed();
  const reviews = reviewHighlights.filter((item) => Number.isFinite(item.rating) && item.rating > 0).slice(0, 3);
  const translatedLocation = location ? translate(location) : "";
  const normalizedLocation = translatedLocation.trim().toLocaleLowerCase();
  const wholeCountryLabels = ["\u05d4\u05db\u05dc", "\u05db\u05dc \u05d4\u05d0\u05e8\u05e5", "all-country", "all", "all israel", "whole country", "\u0432\u0441\u0435", "\u0432\u0441\u044f \u0441\u0442\u0440\u0430\u043d\u0430", "\u0432\u0435\u0441\u044c \u0438\u0437\u0440\u0430\u0438\u043b\u044c", "tous", "tout isra\u00ebl", "toute isra\u00ebl"];
  const locationPrefixes: Record<SiteLanguage, string> = { he: " \u05d1\u05d0\u05d6\u05d5\u05e8 ", en: " in ", ru: " \u0432 \u0440\u0435\u0433\u0438\u043e\u043d\u0435 ", fr: " dans la r\u00e9gion " };
  const locationLabel = location && !wholeCountryLabels.includes(normalizedLocation) ? `${locationPrefixes[language]}${translatedLocation}` : "";
  const titleLocationPrefixes: Record<SiteLanguage, string> = { he: " ב", en: " in ", ru: " в регионе ", fr: " dans la région " };
  const titleLocationLabel = location && !wholeCountryLabels.includes(normalizedLocation) ? `${titleLocationPrefixes[language]}${translatedLocation}` : "";
  const mergedQuery = new URLSearchParams(baseParams);
  searchParams.forEach((value, key) => mergedQuery.set(key, value));
  const currentQuery = depthQuery(world, mergedQuery.toString(), {}, location).toString();
  const mode: SearchMode | null = world === "vacation" || world === "events" || world === "spa" || world === "hourly" ? world : null;
  const locationLayers = mode ? buildSearchDepthLocationLayers(mode, location, inventory) : secondaryDepthLayers(world, location, inventory);
  const destinations = locationLayers.suitableRegions.length ? locationLayers.suitableRegions : destinationOptions(world, location, inventory);
  const regionLinks: DiscoveryLink[] = destinations.map((destination) => ({
    label: translate(destination),
    href: destinationHref(world, language, currentQuery, locationParam, destination),
    meta: discovery.destinationMeta,
    topic: depthTopicKey(destination, world),
  }));
  const cityLinks: DiscoveryLink[] = locationLayers.cities.map((destination) => ({ label: translate(destination), href: world === "activities" || world === "trails" ? contextualHref(world, language, currentQuery, { q: destination }) : destinationHref(world, language, currentQuery, locationParam, destination), meta: discovery.destinationMeta, topic: "city" }));
  const additionalRegionLinks: DiscoveryLink[] = locationLayers.additionalRegions.filter((destination) => !destinations.includes(destination)).map((destination) => ({ label: translate(destination), href: destinationHref(world, language, currentQuery, locationParam, destination), meta: discovery.destinationMeta, topic: depthTopicKey(destination, world) }));
  const suggestions = searchSuggestions.length ? searchSuggestions : defaultDepthSuggestions(world, inventory);
  const translatedSuggestions = suggestions.filter(item => !Object.keys(item.params).length || !Object.entries(item.params).every(([key, value]) => new URLSearchParams(currentQuery).get(key) === value)).map((item) => ({ item, label: translate(item.label) }));
  const scopedLocation = locationLabel ? translatedLocation : "";
  const typesTitle = world === "providers" ? translate("סוג השירות") : world === "activities" ? translate("סוג חוויה") : world === "trails" ? translate("סוג טבע") : discovery.placeTypes;
  const typeSuggestion = (item: ContextualSearchSuggestion) => item.kind === "type" || isPlaceTypeSuggestion(item.params);
  const typeLinks: DiscoveryLink[] = translatedSuggestions.filter(({ item }) => typeSuggestion(item)).map(({ item, label }) => ({
    label: scopeSuggestionLabel(label, scopedLocation, language, "type"), href: contextualHref(world, language, currentQuery, item.params, item.path), meta: discovery.searchMeta, topic: depthTopicKey(item.label, world, item.params),
  }));
  const smartLinks: DiscoveryLink[] = translatedSuggestions.filter(({ item }) => !typeSuggestion(item)).map(({ item, label }) => ({ label: scopeSuggestionLabel(label, scopedLocation, language, "smart"), href: contextualHref(world, language, currentQuery, item.params, item.path), meta: discovery.searchMeta, topic: depthTopicKey(item.label, world, item.params) }));
  const contextualComplementsAllowed = (world === "vacation" || world === "events") && Boolean(location) && !isWholeCountrySelection(location);
  const trailLinks: VisualDiscoveryLink[] = contextualComplementsAllowed ? depthSeed.trails
    .map((trail) => ({ trail, score: trail.areaTags.reduce((score, tag) => matchesDepthTerm(tag, location || "", locationLayers.contextArea) ? Math.max(score, tag === location ? 3 : 1) : score, 0) }))
    .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
    .map(({ trail }) => ({ label: translate(trail.name), href: localizedPath(`/trails/${trail.slug}`, language), meta: language === "he" ? trail.meta : `${translate(trail.mainArea)} · ${translate(trail.region)}`, image: trail.image, imageLabel: language === "he" ? "תמונת המחשה" : language === "en" ? "Illustrative image" : language === "ru" ? "Иллюстрация" : "Image d’illustration" })) : [];
  const providerLinks: VisualDiscoveryLink[] = contextualComplementsAllowed ? depthSeed.providers
    .filter((provider) => {
      const coverage = [provider.location, ...provider.serviceAreas];
      return coverage.some((value) => /כל הארץ|בכל הארץ|לפי מיקום/.test(value) || matchesDepthTerm(value, location || "", locationLayers.contextArea));
    }).slice(0, 8)
    .map((provider) => ({ label: provider.name, href: localizedPath(`/discover/place/${provider.id}`, language), meta: language === "he" ? provider.meta : translate(provider.area), image: provider.image })) : [];

  return <section className={`search-depth search-depth--${world}`} aria-label={`מידע נוסף לתכנון${locationLabel}`}>
    {!hideGuideAndFaq && !discoveryOnly ? <StructuredData data={faqSchema(content.faqs)} /> : null}
    <div className="shell search-depth__inner">
      {!hideGuideAndFaq && !discoveryOnly ? <section className="search-depth__guide" aria-labelledby={`search-guide-${world}`}>
        <span className="eyebrow">{content.eyebrow}</span>
        <h2 id={`search-guide-${world}`}>{content.title}{locationLabel}</h2>
        <div>{content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      </section> : null}

      {!discoveryOnly ? <section className="search-depth__reviews" aria-labelledby={`search-reviews-${world}`}>
        <div className="search-depth__section-head"><span className="eyebrow">חוות דעת שעוזרות לבחור</span><h2 id={`search-reviews-${world}`}>{reviews.length ? "דירוגים ממקומות שמופיעים בתוצאות" : "מה כדאי לבדוק בחוות הדעת"}</h2><p>{reviews.length ? "הציונים מבוססים על נתוני הדירוג שפורסמו במקור המידע של כל מקום. לקריאת ההקשר המלא נכנסים לעמוד המקום." : "לפני שמחליטים, מחפשים בחוות הדעת מידע עקבי על הדברים שמשפיעים באמת על החוויה."}</p></div>
        {reviews.length ? <div className="search-depth__review-grid">{reviews.map((review) => <Link key={review.href} href={review.href}><span>{review.context || "דירוג שפורסם במקור המידע"}</span><strong><bdi dir="ltr">{review.rating.toLocaleString("he-IL", { maximumFractionDigits: 1 })}</bdi><small aria-hidden="true">★</small></strong><h3>{review.name}</h3>{review.reviews ? <p>{review.reviews} חוות דעת שפורסמו</p> : <p>לפרטים ולמקור הדירוג</p>}</Link>)}</div> : <ul className="search-depth__review-checklist">{content.reviewCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>}
      </section> : null}

      {!hideGuideAndFaq && !discoveryOnly ? <section className="search-depth__faq" aria-labelledby={`search-faq-${world}`}>
        <span className="eyebrow">תשובות לפני שבוחרים</span>
        <h2 id={`search-faq-${world}`}>שאלות נפוצות</h2>
        <div>{content.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </section> : null}

      <section className="search-depth__related search-depth__discovery" aria-labelledby={`search-related-${world}`}>
        <div className="search-depth__discovery-intro"><span className="eyebrow">{discovery.eyebrow}</span><h2 id={`search-related-${world}`}>{discovery.title}</h2><p>{discovery.intro}</p></div>
        <DiscoveryRail title={!location || isWholeCountrySelection(location) ? discovery.countryAreas : `${discovery.suitableRegions}${titleLocationLabel}`} links={regionLinks} />
        <DiscoveryRail title={`${world === "trails" ? discovery.additionalRegions : discovery.citiesInArea}${titleLocationLabel}`} links={cityLinks} />
        <DiscoveryRail title={`${typesTitle}${titleLocationLabel}`} links={typeLinks} />
        <DiscoveryRail title={`${searchSuggestions.length ? discovery.smartSearches : discovery.generalSearches}${titleLocationLabel}`} links={smartLinks} />
        <DiscoveryRail title={discovery.additionalRegions} links={additionalRegionLinks} />
        <VisualDiscoveryRail title={`${discovery.trails}${titleLocationLabel}`} links={trailLinks} />
        <VisualDiscoveryRail title={discovery.providers} links={providerLinks} />
      </section>
    </div>
  </section>;
}
