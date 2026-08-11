"use client";

import Link from "next/link";
import { StructuredData } from "./structured-data";
import { faqSchema } from "../lib/seo";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

export type SearchContentWorld = "vacation" | "events" | "spa" | "hourly" | "providers" | "activities";

export type SearchReviewHighlight = {
  name: string;
  href: string;
  rating: number;
  reviews?: number;
  context?: string;
};

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
      { label: "ספא זוגי", href: "/spas?spaFor=couple" }, { label: "ספא ליחיד", href: "/spas?spaFor=single" }, { label: "יום כיף בספא", href: "/spas/day-pass" }, { label: "ספא עם בריכה", href: "/spas/pool" }, { label: "ספא עם ג׳קוזי", href: "/spas/jacuzzi" }, { label: "ספא במלון", href: "/spas/hotel" },
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
}: {
  world: SearchContentWorld;
  location?: string;
  reviewHighlights?: SearchReviewHighlight[];
  hideGuideAndFaq?: boolean;
}) {
  const { language, translate } = useSiteLanguage();
  const content = contentByWorld[world];
  const reviews = reviewHighlights.filter((item) => Number.isFinite(item.rating) && item.rating > 0).slice(0, 3);
  const translatedLocation = location ? translate(location) : "";
  const normalizedLocation = translatedLocation.trim().toLocaleLowerCase();
  const wholeCountryLabels = ["\u05d4\u05db\u05dc", "\u05db\u05dc \u05d4\u05d0\u05e8\u05e5", "all-country", "all", "all israel", "whole country", "\u0432\u0441\u0435", "\u0432\u0441\u044f \u0441\u0442\u0440\u0430\u043d\u0430", "\u0432\u0435\u0441\u044c \u0438\u0437\u0440\u0430\u0438\u043b\u044c", "tous", "tout isra\u00ebl", "toute isra\u00ebl"];
  const locationPrefixes: Record<SiteLanguage, string> = { he: " \u05d1\u05d0\u05d6\u05d5\u05e8 ", en: " in ", ru: " \u0432 \u0440\u0435\u0433\u0438\u043e\u043d\u0435 ", fr: " dans la r\u00e9gion " };
  const locationLabel = location && !wholeCountryLabels.includes(normalizedLocation) ? `${locationPrefixes[language]}${translatedLocation}` : "";

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

      <section className="search-depth__related" aria-labelledby={`search-related-${world}`}>
        <div><span className="eyebrow">ממשיכים לחפש</span><h2 id={`search-related-${world}`}>חיפושים קשורים</h2><p>אפשר לעבור לחיפוש ממוקד נוסף בלי לאבד את הדרך חזרה לתוצאות.</p></div>
        <nav aria-label="חיפושים קשורים">{content.related.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href}>{item.label}</Link>)}</nav>
      </section>
    </div>
  </section>;
}