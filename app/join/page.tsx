import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { PartnerOnboarding } from "./partner-onboarding";
import type { JoinWorld } from "./worlds";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, faqSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "הצטרפות ופרסום עסק באתר",
  description: "פותחים עמוד עסק מלא באתר וי פור ויקיישן, מנהלים תוכן וזמינות ומתחילים לקבל חשיפה ופניות.",
  alternates: { canonical: "/join" },
};

const benefits = [
  ["עמוד עסק מלא", "גלריה, סרטונים, חבילות, שירותים, שאלות נפוצות ועמוד עומק שמוכן לחיפוש."],
  ["ניהול עצמי", "כניסה אישית לעדכון תמונות, מחירים, חבילות, פרטים ותוכן בלי להמתין לנציג."],
  ["יומן דיגיטלי", "גישה למערכת ביז אונליין לניהול העסק, היומן והזמינות מול האתר."],
  ["פניות במקום אחד", "לידים, בקשות מחיר, שיחות ופעולות של גולשים נשמרים בצורה מסודרת."],
  ["חשיפה בתוך המערכת", "הופעה בחיפוש, במפה, בעמודי קטגוריה ובהמלצות שמתאימות לגולש."],
  ["כלים לצמיחה", "נתוני צפייה ופניות, איסוף חוות דעת וקישור שקל לשתף עם לקוחות."],
];

const joinFaqs = [
  {
    question: "איך מצטרפים ומפרסמים עסק באתר?",
    answer: "בוחרים את תחום העסק, ממלאים את הפרטים בטופס המתאים ושולחים בקשה. ספקים יכולים לבחור מסלול פרסום, ובעולמות האירוח, האירועים, הספא, החדרים לפי שעה והאטרקציות ממשיכים לאחר הרישום עם נציג מומחה.",
  },
  {
    question: "האם תהליך ההצטרפות זהה לכל סוגי העסקים?",
    answer: "לא. מסלול ההצטרפות מותאם לתחום העסק. ספקים בוחרים חבילת פרסום, ואילו עסקים בתחומי האירוח והפנאי מתחילים ברישום קצר ובהתאמת דרך העבודה עם נציג מומחה.",
  },
  {
    question: "אילו מסלולי פרסום קיימים לספקים?",
    answer: "ספקים יכולים לבחור בין מסלול סטנדרט למסלול פרימיום, לפי היקף החשיפה וכלי הניהול המתאימים להם. בעמוד ההצטרפות מוצגים המחיר והמרכיבים של כל מסלול לפני שליחת הבקשה.",
  },
  {
    question: "האם אפשר לבחור חיוב חודשי או שנתי?",
    answer: "כן. במסלולי הספקים אפשר לבחור חיוב חודשי או התחייבות שנתית. הסכום ותנאי המסלול מוצגים בצורה ברורה לפני שליחת הבקשה.",
  },
  {
    question: "האם מחייבים מיד לאחר שליחת הטופס?",
    answer: "לא. הבקשה נבדקת לפני פתיחת החשבון ולפני ביצוע חיוב. נציג יכול ליצור קשר כדי להשלים פרטים ולוודא שהמסלול מתאים לעסק.",
  },
  {
    question: "מה אפשר לנהל במערכת העסק?",
    answer: "המערכת מיועדת לניהול פרטי העסק, תוכן, תמונות, שירותים, חבילות, מחירים, מבצעים, זמינות, פניות והזמנות, בהתאם לתחום ולמסלול שנבחר.",
  },
  {
    question: "מתי עמוד העסק עולה לאתר?",
    answer: "עמוד העסק עולה לאחר בדיקת הפרטים והשלמת התוכן הנדרש. זמן ההכנה תלוי בתחום, בכמות המידע ובתמונות שנמסרו.",
  },
  {
    question: "אילו פרטים כדאי להכין לפני ההרשמה?",
    answer: "מומלץ להכין שם עסק, פרטי קשר, אזורי שירות, תיאור קצר, רשימת שירותים או חבילות, מחירים מעודכנים ותמונות מקוריות שמותר לעסק לפרסם.",
  },
];

export default function JoinPage({ initialWorld }: { initialWorld?: JoinWorld }) {
  return (
    <PageShell showWorldSwitcher={false}>
      <main id="main-content">
        <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "הצטרפות ופרסום", path: "/join" }])} />
        <StructuredData data={faqSchema(joinFaqs)} />
        <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "הצטרפות ופרסום" }]} />
        <section className="join-hero join-hero--conversion">
          <div className="shell">
            <span className="eyebrow">מצטרפים לעולמות של וי פור ויקיישן</span>
            <h1>מצטרפים בדרך שמתאימה בדיוק לעסק שלכם</h1>
            <p>ספקים בוחרים חבילת פרסום ומתחילים אונליין. מקומות אירוח, אירועים, ספא, חדרים לפי שעה ואטרקציות מתחילים ברישום קצר וממשיכים עם נציג מומחה.</p>
            <div className="join-hero__actions">
              <Link className="button primary" href="#join-pricing">לבחירת מסלול</Link>
              <Link className="button subtle" href="#join-benefits">מה מקבלים?</Link>
            </div>
            <ul className="join-hero__trust" aria-label="יתרונות מרכזיים">
              <li>ללא דמי הקמה במחיר ההיכרות</li>
              <li>מחירון ודרך הצטרפות לפי תחום</li>
              <li>שליטה עצמית בעמוד העסק</li>
            </ul>
          </div>
        </section>

        <section id="join-benefits" className="section shell join-benefits" aria-labelledby="join-benefits-title">
          <div className="section-head">
            <div>
              <span className="eyebrow">יותר מעמוד באינדקס</span>
              <h2 id="join-benefits-title">מערכת אחת שמחברת פרסום, תוכן וזמינות</h2>
              <p>העסק מקבל נוכחות מלאה באתר וכלים שעוזרים לנהל אותה לאורך זמן.</p>
            </div>
          </div>
          <div className="join-benefits__grid">
            {benefits.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <PartnerOnboarding initialWorld={initialWorld} />

        <section className="section shell join-faq" aria-labelledby="join-faq-title">
          <div className="join-faq__intro">
            <span className="eyebrow">מידע לפני שמצטרפים</span>
            <h2 id="join-faq-title">שאלות ותשובות על הצטרפות ופרסום באתר</h2>
            <p>תשובות ברורות על מסלולי הפרסום, תהליך הבדיקה, החיוב וניהול עמוד העסק.</p>
          </div>
          <div className="join-faq__list">
            {joinFaqs.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </PageShell>
  );
}
