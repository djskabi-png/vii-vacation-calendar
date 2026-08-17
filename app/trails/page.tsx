import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { trails } from "../data/trail-data";
import { TrailsExplorer } from "./trails-explorer";
import { StructuredData } from "../components/structured-data";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "מסלולי טיול בישראל למטייל העצמאי",
  description: "מסלולי מים, מפלים, חופים, יערות ומדבר עם דרגת קושי, משך, עונה ומידע בטיחותי ממקורות רשמיים.",
  alternates: { canonical: "/trails" },
};

export default function TrailsPage() {
  return <PageShell variant="activities">
    <main id="main-content" className="trails-page">
      <StructuredData data={collectionSchema("מסלולי טיול בישראל למטייל העצמאי", "מסלולי מים, חופים, יערות ומדבר עם מידע בטיחותי ומקור רשמי.", "/trails/", trails.map((trail) => ({ name: trail.name, path: `/trails/${trail.slug}/` })))} />
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "מסלולי טיול", path: "/trails" }])} />
      <section className="special-search-rail"><div className="shell"><a className="special-search-summary" href="#trail-search"><span><strong>כל הארץ</strong><small>בחרו אזור, טבע ודרגת קושי</small></span><b>שינוי חיפוש</b></a></div></section>
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "מסלולי טיול" }]} />
      <section className="trails-hero"><div className="shell"><span className="eyebrow">מסלולי טיול שהופקו במיוחד למטיילי וי פור ויקיישן</span><h1>יוצאים מהצימר. נכנסים לישראל היפה.</h1><p>מפלים, נהרות, מעיינות, חופים, יערות ומדבר. בוחרים לפי אזור, זמן ודרגת קושי ומקבלים תוכנית טיול ברורה עם מקור רשמי.</p></div></section>
      <section id="trail-search" className="section shell trail-explorer"><TrailsExplorer /></section>
      <section className="trail-trust"><div className="shell"><strong>מידע אחראי לפני שיוצאים</strong><p>התוכן כאן הוא תכנון מערכת של וי פור ויקיישן על בסיס מקורות רשמיים. תנאי שטח, סגירות, מזג אוויר, שעות ותשלום יכולים להשתנות. נכנסים למקור הרשמי ביום הטיול ופועלים לפי השילוט בשטח.</p><Link href="/attractions">גם אטרקציות בתשלום</Link></div></section>
    </main>
  </PageShell>;
}
