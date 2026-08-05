import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { trails } from "../data/trail-data";
import { TrailsExplorer } from "./trails-explorer";
import { StructuredData } from "../components/structured-data";
import { collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "מסלולי טיול בישראל למטייל העצמאי",
  description: "מסלולי מים, מפלים, חופים, יערות ומדבר עם דרגת קושי, משך, עונה ומידע בטיחותי ממקורות רשמיים.",
  alternates: { canonical: "/trails" },
};

export default function TrailsPage() {
  return <PageShell variant="activities">
    <main id="main-content" className="trails-page">
      <StructuredData data={collectionSchema("מסלולי טיול בישראל למטייל העצמאי", "מסלולי מים, חופים, יערות ומדבר עם מידע בטיחותי ומקור רשמי.", "/trails/", trails.map((trail) => ({ name: trail.name, path: `/trails/${trail.slug}/` })))} />
      <section className="trails-hero"><div className="shell trails-hero__layout"><div><span className="eyebrow">מסלולי טיול שהופקו במיוחד למטיילי וי פור ויקיישן</span><h1>יוצאים מהצימר. נכנסים לישראל היפה.</h1><p>מפלים, נהרות, מעיינות, חופים, יערות ומדבר. בוחרים לפי אזור, זמן ודרגת קושי ומקבלים תוכנית טיול ברורה עם מקור רשמי.</p><div className="trails-hero__actions"><a className="button primary" href="#trail-search">מציאת מסלול</a><Link className="button light" href="/activities">גם אטרקציות בתשלום</Link></div></div><div className="trails-hero__map" aria-hidden="true"><span>צפון</span><i /><i /><i /><strong>{trails.length}</strong><small>מסלולים מוכנים</small><b>דרום</b></div></div></section>
      <section className="trail-trust"><div className="shell"><strong>מידע אחראי לפני שיוצאים</strong><p>התוכן כאן הוא תכנון מערכת של וי פור ויקיישן על בסיס מקורות רשמיים. תנאי שטח, סגירות, מזג אוויר, שעות ותשלום יכולים להשתנות. נכנסים למקור הרשמי ביום הטיול ופועלים לפי השילוט בשטח.</p></div></section>
      <section id="trail-search" className="section shell trail-explorer"><div className="section-head"><div><span className="eyebrow">מוצאים את הקצב שלכם</span><h2>לאיזה טבע מתחשק לצאת?</h2></div></div><TrailsExplorer /></section>
    </main>
  </PageShell>;
}
