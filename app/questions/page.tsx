import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, faqSchema } from "../lib/seo";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";

export const metadata: Metadata = {
  title: "שאלות ותשובות על נופש, אירועים, ספא וטיולים",
  description: "תשובות ברורות לשאלות נפוצות לפני שבוחרים וילה, סוויטה, מקום לאירוע, ספא, חדר לפי שעה או מסלול טיול בישראל.",
  alternates: { canonical: "/questions" },
  openGraph: {
    type: "article",
    url: "/questions/",
    title: "שאלות ותשובות לפני חופשה או אירוע",
    description: "מידע ברור שעוזר לבחור נכון מקום, הרכב, חדרים, מתקנים ופעילויות.",
  },
};

const sections = [
  {
    title: "בחירת מקום נופש",
    items: [
      { question: "איך בוחרים מקום נופש שמתאים להרכב?", answer: "מתחילים במספר המבוגרים והילדים, בודקים כמה חדרי שינה ומיטות נדרשים, ואז משווים פרטיות, מרחבים משותפים, מתקנים ומיקום. מספר האורחים לבדו לא מספר אם המקום באמת מתאים להרכב." },
      { question: "מה ההבדל בין וילה שלמה למתחם עם כמה יחידות?", answer: "וילה שלמה מוזמנת כמרחב אחד לקבוצה אחת. מתחם עם כמה יחידות כולל סוויטות או יחידות נפרדות ולעיתים אזורים משותפים. בעמוד המקום מוצגים מבנה המתחם וחדרי השינה בנפרד כדי למנוע בלבול." },
      { question: "איפה רואים את חדרי השינה והמיטות?", answer: "בעמודי המקומות שבהם קיים מידע מאומת מופיע אזור נפרד בשם איפה ישנים. לכל חדר מוצגים סוגי המיטות, הקומה, האבזור ותמונה כאשר יש שיוך מאומת לתמונה." },
      { question: "איך יודעים אם המקום מתאים למשפחות או לקבוצות?", answer: "בודקים את קהל היעד שמופיע בעמוד, מספר חדרי השינה, פריסת היחידות, המרחבים המשותפים והכללים. לקבוצה עם כמה משפחות חשוב לבדוק גם פרטיות בין היחידות ולא רק קיבולת כוללת." },
    ],
  },
  {
    title: "זמינות, מחיר ומדיניות",
    items: [
      { question: "איך בודקים זמינות לתאריך מסוים?", answer: "בוחרים תאריכים והרכב אורחים במנוע החיפוש או בעמוד המקום. זמינות חיה ומחיר סופי יוצגו לאחר השלמת החיבור למערכת הניהול וההזמנות." },
      { question: "למה לא מוצג מחיר קבוע לכל מקום?", answer: "המחיר עשוי להשתנות לפי תאריך, מספר לילות, הרכב אורחים, יחידה ותוספות. הצגת מחיר לא מאומת עלולה להטעות, ולכן מחיר סופי צריך להגיע ממערכת ההזמנות עבור הבחירה המדויקת." },
      { question: "איפה בודקים תנאי ביטול?", answer: "התנאים המחייבים צריכים להופיע לפני השלמת הזמנה ולהתאים למקום ולתאריך שנבחרו. באתר קיים גם עמוד מידע כללי על ביטול ושינוי הזמנות." },
    ],
  },
  {
    title: "אירועים, ספא וחדרים לפי שעה",
    items: [
      { question: "איך מוצאים מקום שמתאים לאירוע פרטי?", answer: "בוחרים אזור, תאריך וכמות משתתפים, ואז מסננים לפי סוג האירוע והמתקנים הנדרשים. בעמוד המקום חשוב לבדוק קיבולת, מגבלות רעש, אזורי ישיבה ומדיניות." },
      { question: "מה צריך לבדוק לפני שמזמינים מקום למסיבה?", answer: "בודקים קיבולת אמיתית, שעות פעילות, הגבלת רעש, מערכות הגברה, חניה, אבטחה, מזון ומשקאות ותנאי ביטול. אין להסיק שמתקן קיים אם הוא לא מופיע בפרטי המקום." },
      { question: "איך בוחרים חבילת ספא?", answer: "משווים את סוג הטיפול, משך הטיפול, שימוש במתקנים, ארוחה, פרטיות ומיקום. המחיר והזמינות חייבים להיבדק מול מקור ההזמנה העדכני." },
      { question: "מה ההבדל בין חדר לפי שעה ללינה רגילה?", answer: "חדר לפי שעה מיועד לשהייה קצרה וגמישה. יש מקומות שמציעים גם לילה, אך משך השהייה, שעות הכניסה והמחיר משתנים בין מקום למקום." },
    ],
  },
  {
    title: "מידע, תמונות ונגישות",
    items: [
      { question: "האם התמונות באתר הן של המקום עצמו?", answer: "תמונות של עסק מוצגות רק כאשר הן משויכות למקום ממקור מאושר. סיורים חזותיים באתר נערכו מתמונות המקום ומסומנים בהתאם, ואינם מוצגים כסרטון רציף שצולם במתחם." },
      { question: "איך מפרסמים תמונת אורח או חוות דעת?", answer: "הזרימה המתוכננת מבקשת הוכחת ביקור, דירוג ותמונות. התוכן אמור לעבור אישור לפני פרסום. כל עוד צד השרת ומנגנון האישור אינם מחוברים, הטופס משמש להצגת התהליך בלבד ואינו שומר פרסום חי." },
      { question: "איך יודעים אם מקום נגיש?", answer: "בעמוד המקום מוצג מצב הנגישות לפי מידע מאומת. אם המידע טרם אומת, הדבר נאמר במפורש ומומלץ לבדוק מול המקום את ההתאמות המדויקות הנדרשות לפני ההזמנה." },
      { question: "איך מוצאים מסלול טיול ליד מקום האירוח?", answer: "בעמודי מקומות מוצגים מסלולים לפי התאמה אזורית, ובאזור המסלולים אפשר לסנן לפי אזור, טבע ודרגת קושי. לפני יציאה בודקים מצב מסלול, מזג אוויר והנחיות במקור הרשמי שמקושר במדריך." },
    ],
  },
];

const allQuestions = sections.flatMap((section) => section.items);

export default function QuestionsPage() {
  return <PageShell>
    <main id="main-content" className="questions-page">
      <StructuredData data={faqSchema(allQuestions)} />
      <StructuredData data={breadcrumbSchema([
        { name: "ראשי", path: "/" },
        { name: "שאלות ותשובות", path: "/questions/" },
      ])} />
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "מידע ושירות", path: "/guides" }, { name: "שאלות ותשובות" }]} />
      <header className="shell questions-hero">
        <span className="eyebrow">תשובות לפני שמחליטים</span>
        <h1>כל מה שרוצים לדעת לפני חופשה, אירוע או יום פינוק</h1>
        <p>ריכזנו תשובות קצרות וברורות לשאלות שחוזרות לפני בחירת מקום. המידע בעמוד אינו מחליף את התנאים המחייבים שיוצגו בתהליך ההזמנה.</p>
        <nav aria-label="נושאים בעמוד">
          {sections.map((section, index) => <a key={section.title} href={`#questions-${index}`}>{section.title}</a>)}
        </nav>
      </header>
      <div className="shell questions-layout">
        {sections.map((section, sectionIndex) => <section key={section.title} id={`questions-${sectionIndex}`} aria-labelledby={`questions-title-${sectionIndex}`}>
          <h2 id={`questions-title-${sectionIndex}`}>{section.title}</h2>
          <div className="questions-list">
            {section.items.map((item) => <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>)}
          </div>
        </section>)}
      </div>
      <section className="section section-tint questions-cta">
        <div className="shell"><div><span className="eyebrow">מוכנים להתקדם</span><h2>עוברים מהשאלה לחיפוש מדויק</h2><p>בחרו עולם, אזור והרכב וקבלו מקומות שמתאימים למה שאתם באמת צריכים.</p></div><Link className="button primary" href="/search">לחיפוש מקומות</Link></div>
      </section>
    </main>
  </PageShell>;
}
