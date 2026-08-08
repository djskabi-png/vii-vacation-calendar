import type { Metadata } from "next";
import { PageShell } from "../../components/page-shell";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";

export const metadata: Metadata = { title: "מדיניות פרטיות", description: "מדיניות הפרטיות של אתר וי פור ויקיישן.", alternates: { canonical: "/legal/privacy" } };

export default function PrivacyPage() {
  return <PageShell><main id="main-content"><StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "מדיניות פרטיות", path: "/legal/privacy" }])} /><BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "מדיניות פרטיות" }]} /><article className="legal-page shell">
    <span className="eyebrow">מידע משפטי</span>
    <h1>מדיניות פרטיות</h1>
    <p className="lead">הפרטיות שלכם חשובה לנו. השימוש במידע נעשה בהתאם לבחירות שלכם ולצורך מתן השירות.</p>
    <h2>העדפות בדפדפן</h2>
    <p>אפשר לבחור בין קבצים חיוניים לבין שירותים נוספים דרך חלון העדפות הפרטיות.</p>
    <h2>ניהול המידע שנמסר בהזמנה</h2>
    <p>בקשה לעדכון או למחיקה של מידע שנמסר בהזמנה נשלחת מתוך מסך ניהול ההזמנה, יחד עם מספר ההזמנה לצורך זיהוי.</p>
  </article></main></PageShell>;
}
