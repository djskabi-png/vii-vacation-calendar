import Link from "next/link";
import { PageShell } from "../../components/page-shell";

export default function CancellationPage() {
  return <PageShell><main id="main-content"><article className="legal-page shell">
    <span className="eyebrow">הזמנות ושירות</span>
    <h1>ביטול הזמנה</h1>
    <p className="lead">תנאי הביטול נקבעים לפי פרטי ההזמנה והמדיניות שהוצגה במועד ביצועה.</p>
    <h2>לפני שמבטלים</h2>
    <p>מומלץ להכין את מספר ההזמנה ולבדוק את התנאים שמופיעים באישור שקיבלתם.</p>
    <h2>צריכים עזרה?</h2>
    <p>אפשר לפנות אלינו עם שם המקום, תאריכי האירוח ומספר ההזמנה, ונעביר את הפרטים לבדיקה.</p>
    <Link className="button primary" href="/contact/">יצירת קשר</Link>
  </article></main></PageShell>;
}
