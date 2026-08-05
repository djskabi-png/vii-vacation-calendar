import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../../components/page-shell";

export const metadata: Metadata = { title: "תקנון האתר", description: "תנאי השימוש באתר וי פור ויקיישן.", alternates: { canonical: "/legal/terms/" } };

export default function TermsPage() {
  return <PageShell><main id="main-content"><article className="legal-page shell">
    <span className="eyebrow">מידע משפטי</span>
    <h1>תקנון האתר</h1>
    <p className="lead">השימוש באתר כפוף לתנאים שיוצגו במוצר ובתהליך ההזמנה.</p>
    <h2>מידע על מקומות והזמנות</h2>
    <p>יש לעבור על פרטי המקום, המחיר, הזמינות והמדיניות המוצגים לפני אישור הזמנה.</p>
    <h2>שאלות על התנאים</h2>
    <p>לשאלה נקודתית על מקום או הזמנה, אפשר לפנות אלינו עם הפרטים הרלוונטיים.</p>
    <Link className="button primary" href="/contact/">יצירת קשר</Link>
  </article></main></PageShell>;
}
