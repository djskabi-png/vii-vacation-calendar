import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../../components/page-shell";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";

export const metadata: Metadata = { title: "ביטול ושינוי הזמנה", description: "מידע ברור על שינוי, ביטול והחזר בהזמנות דרך וי פור ויקיישן.", alternates: { canonical: "/legal/cancellation" } };

export default function CancellationPage() {
  const crumbs = [{ name: "ראשי", path: "/" }, { name: "ביטול ושינוי הזמנה", path: "/legal/cancellation" }];
  return <PageShell><main id="main-content">
    <StructuredData data={breadcrumbSchema(crumbs)} />
    <BreadcrumbTrail className="world-breadcrumbs" items={[crumbs[0], { name: crumbs[1].name }]} />
    <article className="legal-page shell">
      <span className="eyebrow">הזמנות ושירות</span>
      <h1>ביטול ושינוי הזמנה</h1>
      <p className="lead">אין באתר מדיניות ביטול אחת לכל המקומות. לכל מקום, תאריך, מחיר או חבילה עשויים להיות תנאים שונים. התנאים המחייבים הם התנאים שהוצגו ואושרו בהזמנה המסוימת.</p>

      <h2>איפה מוצאים את התנאים המחייבים</h2>
      <p>בדקו את עמוד המקום, סיכום ההזמנה והאישור שנשלח אליכם. שם צריכים להופיע מועד האירוח, המחיר, שם נותן השירות, תנאי שינוי וביטול וכל זכות להחזר.</p>

      <h2>איך שולחים בקשת שינוי או ביטול</h2>
      <ol>
        <li>הכינו את מספר ההזמנה ואת פרטי הקשר שנמסרו בעת הביצוע.</li>
        <li>פתחו את מסך ניהול ההזמנה ושלחו בקשה מסודרת.</li>
        <li>אם באישור מופיעים פרטי נותן השירות, פנו גם אליו לפי ההוראות שבהזמנה.</li>
        <li>שמרו את אישור מסירת הבקשה ואת התשובה שהתקבלה.</li>
      </ol>

      <h2>מתי הביטול נכנס לתוקף</h2>
      <p>שליחת בקשה אינה מבטלת הזמנה באופן אוטומטי. הביטול או השינוי נכנסים לתוקף לאחר אישור הגורם שמטפל בהזמנה, ובהתאם לתנאים שאושרו בעת הביצוע.</p>

      <h2>החזר כספי</h2>
      <p>הזכאות להחזר, גובהו ומועד ביצועו נקבעים לפי תנאי ההזמנה והדין. כאשר התשלום בוצע ישירות לנותן השירות, בקשת ההחזר מטופלת מולו.</p>

      <h2>עזרה בניהול הבקשה</h2>
      <p>במסך ניהול ההזמנה ניתן למסור את מספר ההזמנה ואת הבקשה. אין למסור פרטי כרטיס אשראי או מידע רגיש בשדה חופשי.</p>
      <Link className="button primary" href="/booking?action=manage">מעבר לניהול ההזמנה</Link>
    </article>
  </main></PageShell>;
}
