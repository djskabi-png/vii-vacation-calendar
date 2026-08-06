import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../../components/page-shell";

export const metadata: Metadata = { title: "ביטול הזמנה", description: "מידע על ביטול ושינוי הזמנות באתר וי פור ויקיישן.", alternates: { canonical: "/legal/cancellation" } };

export default function CancellationPage() {
  return <PageShell><main id="main-content"><article className="legal-page shell">
    <span className="eyebrow">הזמנות ושירות</span>
    <h1>ביטול הזמנה</h1>
    <p className="lead">תנאי הביטול נקבעים לפי פרטי ההזמנה והמדיניות שהוצגה במועד ביצועה.</p>
    <h2>לפני שמבטלים</h2>
    <p>מומלץ להכין את מספר ההזמנה ולבדוק את התנאים שמופיעים באישור שקיבלתם.</p>
    <h2>שליחת בקשת ביטול או שינוי</h2>
    <p>מזינים את מספר ההזמנה ואת הבקשה. הפרטים נכנסים ישירות למסלול ניהול ההזמנות.</p>
    <Link className="button primary" href="/booking?action=manage">ניהול הזמנה</Link>
  </article></main></PageShell>;
}
