import type { Metadata } from "next";
import { PageShell } from "../../components/page-shell";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";

export const metadata: Metadata = { title: "תקנון האתר", description: "תנאי השימוש באתר וי פור ויקיישן.", alternates: { canonical: "/legal/terms" } };

export default function TermsPage() {
  return <PageShell><main id="main-content"><StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "תקנון האתר", path: "/legal/terms" }])} /><BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "תקנון האתר" }]} /><article className="legal-page shell">
    <span className="eyebrow">מידע משפטי</span>
    <h1>תקנון האתר</h1>
    <p className="lead">השימוש באתר כפוף לתנאים שיוצגו במוצר ובתהליך ההזמנה.</p>
    <h2>מידע על מקומות והזמנות</h2>
    <p>יש לעבור על פרטי המקום, המחיר, הזמינות והמדיניות המוצגים לפני אישור הזמנה.</p>
    <h2>שאלות על התנאים</h2>
    <p>ההסבר המלא מופיע בתהליך ההזמנה ובאישור ההזמנה שנשלח לאחר בדיקת זמינות ומחיר.</p>
  </article></main></PageShell>;
}
