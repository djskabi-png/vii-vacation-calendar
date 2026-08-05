import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";

export const metadata: Metadata = {
  title: "הצהרת נגישות",
  description: "מידע על נגישות אתר וי פור ויקיישן, כלי העזר, הסדרי השירות ודרכי דיווח על בעיית נגישות.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return <PageShell>
    <main id="main-content">
      <article className="accessibility-statement shell">
        <header>
          <span className="eyebrow">שירות שווה לכולם</span>
          <h1>הצהרת נגישות</h1>
          <p className="lead">אנחנו פועלים כדי לאפשר לכל אדם להשתמש באתר, למצוא מקום מתאים ולקבל מידע ברור לפני הזמנה.</p>
          <p className="accessibility-statement__date">נוסח עבודה מעודכן ליום 5 באוגוסט 2026</p>
        </header>

        <aside className="accessibility-statement__notice" aria-label="עדכון בנוגע להצהרת הנגישות">
          <strong>הצהרת הנגישות נמצאת בתהליך השלמה</strong>
          <p>פרטי רכז הנגישות והסדרי הנגישות הפיזיים של משרדי מפעיל האתר יפורסמו לאחר מסירה ואימות. עד אז אפשר לדווח על קושי או לבקש התאמה דרך טופס יצירת הקשר.</p>
        </aside>

        <section>
          <h2>תקן ומסגרת העבודה</h2>
          <p>האתר נבנה ונבדק במטרה להתאים לדרישות התקן הישראלי 5568 ברמת AA, המבוסס על הנחיות WCAG 2.0. הצהרה זו אינה חוות דעת משפטית ואינה מחליפה בדיקה של מורשה נגישות או גורם מקצועי מוסמך.</p>
        </section>

        <section>
          <h2>התאמות הנגישות באתר</h2>
          <ul>
            <li>מבנה עמודים סמנטי, כותרות מדורגות ואזור תוכן ראשי.</li>
            <li>קישור לדילוג ישיר לתוכן המרכזי.</li>
            <li>ניווט והפעלת רכיבים באמצעות מקלדת.</li>
            <li>סימון ברור של המיקוד בעת ניווט במקלדת.</li>
            <li>טקסט חלופי לתמונות תוכן ושמות נגישים לכפתורים.</li>
            <li>תצוגה מותאמת למסכים בגדלים שונים ולהגדלת טקסט.</li>
            <li>כלי עזר לשינוי גודל הטקסט, ניגודיות, צבעי אפור, הדגשת קישורים, ריווח, מיקוד והפחתת תנועה.</li>
            <li>שמירת העדפות התצוגה במכשיר של המשתמש.</li>
          </ul>
        </section>

        <section>
          <h2>נגישות מקומות האירוח והאירועים</h2>
          <p>נגישות האתר אינה מעידה על הנגישות הפיזית של מקום אירוח, אולם אירועים, ספא או חדר לפי שעה. בכל כרטיס ובכל עמוד מקום מוצג מצב נגישות נפרד כחלק מתוכן המקום.</p>
          <div className="accessibility-status-explainer">
            <article><strong>נגישות מאומתת</strong><p>התקבל מידע מפורט ממקור מאושר לגבי ההתאמות במקום.</p></article>
            <article><strong>נגישות חלקית</strong><p>חלק מהשירותים נגישים וחלקם כוללים מגבלות שמפורטות בעמוד.</p></article>
            <article><strong>המקום אינו נגיש</strong><p>נמסר ואומת שקיימת מגבלה מהותית המונעת נגישות.</p></article>
            <article><strong>מידע הנגישות טרם אומת</strong><p>לא התקבל מידע מספק ולכן האתר אינו מניח שהמקום נגיש או שאינו נגיש.</p></article>
          </div>
          <p>לפני הזמנה מומלץ לאמת מול המקום את החניה, הדרך מהחניה לכניסה, מדרגות, רוחב פתחים, חדר רחצה נגיש, מעלית, גישה לבריכה או לספא, אמצעי עזר לשמיעה ולראייה ומדיניות כניסה עם חיית שירות.</p>
        </section>

        <section>
          <h2>כלי הנגישות</h2>
          <p>קישור להצהרת הנגישות נמצא בתפריט הראשי ובתחתית כל עמוד. האתר תומך בניווט מקלדת, הגדלת תצוגה והעדפות נגישות המוגדרות במערכת ההפעלה ובדפדפן.</p>
        </section>

        <section>
          <h2>תוכן ושירותים של צד שלישי</h2>
          <p>בחלק מהעמודים עשויים להופיע מפות, קישורים, מערכות תשלום או רכיבים שמופעלים בידי ספקים חיצוניים. אנחנו פועלים לבחור פתרונות נגישים, אך השליטה המלאה ברכיבים אלה נמצאת לעיתים בידי הספק החיצוני. אם נתקלתם בקושי, נשמח לסייע במציאת חלופה נגישה.</p>
        </section>

        <section>
          <h2>הסדרי נגישות בשירות ובמשרדים</h2>
          <p><strong>המידע ממתין לאישור מפעיל האתר.</strong> כתובת קבלת הקהל והסדרי החניה, הדרך הנגישה, המעלית, השירותים ואמצעי העזר יפורסמו לאחר מסירה ואימות.</p>
        </section>

        <section>
          <h2>רכז נגישות</h2>
          <p><strong>פרטי רכז הנגישות טרם נמסרו.</strong> עד לפרסום פרטים מאומתים אפשר להעביר בקשת התאמה או דיווח דרך טופס יצירת הקשר.</p>
        </section>

        <section>
          <h2>דיווח על בעיית נגישות</h2>
          <p>אם נתקלתם בבעיה, כתבו לנו מה ניסיתם לעשות, באיזה עמוד, באיזה דפדפן ומכשיר השתמשתם ואם נעזרתם בקורא מסך או בטכנולוגיה מסייעת. המידע יעזור לנו לבדוק ולתקן במהירות.</p>
          <Link className="button primary" href="/contact">דיווח על בעיית נגישות</Link>
        </section>

        <section className="accessibility-statement__sources">
          <h2>מקורות רשמיים</h2>
          <ul>
            <li><a href="https://www.gov.il/he/pages/declaration_website_accessibility?chapterIndex=1" target="_blank" rel="noreferrer">מדריך ממשלתי להצהרת נגישות ולפרסום הסדרים</a></li>
            <li><a href="https://www.gov.il/he/pages/website_accessibility?chapterIndex=3" target="_blank" rel="noreferrer">מדריך ממשלתי לנגישות אתרי אינטרנט</a></li>
            <li><a href="https://www.gov.il/BlobFolder/guide/accommodating_service_providing_rules/he/sitedocs_service_acessibility_regulations.pdf" target="_blank" rel="noreferrer">תקנות שוויון זכויות לאנשים עם מוגבלות, התאמות נגישות לשירות</a></li>
          </ul>
        </section>
      </article>
    </main>
  </PageShell>;
}
