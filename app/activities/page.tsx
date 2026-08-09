import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { TrailCard } from "../components/trail-card";
import { paidAttractions } from "../data/world-data";
import { trails } from "../data/trail-data";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "מה עושים בחופשה, אטרקציות ומסלולי טיול",
  description: "מסלולי טיול עצמאיים ואטרקציות בתשלום לפי אזור, זמן ואופי החופשה.",
  alternates: { canonical: "/activities" },
};

export default function ActivitiesPage() {
  return <PageShell variant="activities">
    <main id="main-content" className="activities-hub">
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "מה עושים בחופשה", path: "/activities" }])} />
      <StructuredData data={collectionSchema("מה עושים בחופשה", "מסלולי טיול עצמאיים ואטרקציות בתשלום ברחבי ישראל.", "/activities", [{ name: "מסלולי טיול", path: "/trails" }, { name: "אטרקציות", path: "/attractions" }])} />
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "מה עושים בחופשה" }]} />
      <section className="world-hero activities-hub__hero"><div className="shell"><h1>בוחרים איך לבלות את היום</h1><p>שני אזורים ברורים: מסלול עצמאי בטבע עם מידע מלא, או אטרקציה בתשלום עם התאמת ספק ותהליך הזמנה.</p><div className="activities-hub__choices"><Link href="/trails"><strong>מסלולי טיולים</strong><span>48 מסלולים, לפחות שישה בכל אזור ראשי</span><small>למסלולים</small></Link><Link href="/attractions"><strong>אטרקציות בתשלום</strong><span>שטח, מים, סוסים, אוכל וסדנאות</span><small>לאטרקציות</small></Link></div></div></section>

      <section id="independent-trails" className="section shell activities-hub__trails"><div className="section-head"><div><span className="eyebrow">הנישה החדשה למטייל העצמאי</span><h2>מסלולים שהופקו במיוחד למטיילי וי פור ויקיישן</h2><p>כל מסלול כולל זמן, קושי, אופי, עונה, בטיחות וקישור למקור הרשמי.</p></div><Link href="/trails">לכל {trails.length} המסלולים</Link></div><div className="trail-grid trail-grid--featured">{trails.slice(0, 4).map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</div><Link className="button primary activities-hub__all" href="/trails">מציאת מסלול לפי אזור וקושי</Link></section>

      <section id="bookable-activities" className="section section-tint"><div className="shell activities-hub__paid"><div><span className="eyebrow">אטרקציות בתשלום</span><h2>{paidAttractions.length} סוגי חוויה שמתחילים בבחירה נכונה</h2><p>עמוד נפרד שמאפשר לסנן לפי אזור וסוג חוויה, להבין מה כלול ולעבור להזמנה רק לאחר אימות הספק, המחיר והזמינות.</p><Link className="button primary" href="/attractions">לעמוד האטרקציות</Link></div><div className="activities-hub__paid-types">{paidAttractions.slice(0, 6).map((item) => <Link key={item.id} href={`/discover/place/${item.id}`}><strong>{item.name}</strong><span>{item.location}</span></Link>)}</div></div></section>
    </main>
  </PageShell>;
}
