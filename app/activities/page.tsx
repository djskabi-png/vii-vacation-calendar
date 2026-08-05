import type { Metadata } from "next";
import Link from "next/link";
import { DiscoveryCard } from "../components/discovery-card";
import { PageShell } from "../components/page-shell";
import { TrailCard } from "../components/trail-card";
import { activityIdeas } from "../data/world-data";
import { trails } from "../data/trail-data";

export const metadata: Metadata = {
  title: "מה עושים בחופשה, אטרקציות ומסלולי טיול",
  description: "מסלולי טיול עצמאיים ואטרקציות בתשלום לפי אזור, זמן ואופי החופשה.",
  alternates: { canonical: "/activities" },
};

export default function ActivitiesPage() {
  return <PageShell variant="activities">
    <main id="main-content" className="activities-hub">
      <section className="world-hero activities-hub__hero"><div className="shell"><span className="eyebrow">מה עושים כשיוצאים ממקום האירוח</span><h1>בוחרים איך לבלות את היום</h1><p>שני מסלולים ברורים: טיול עצמאי בטבע עם מדריך מלא, או אטרקציה וחוויה שמזמינים מראש.</p><div className="activities-hub__choices"><a href="#independent-trails"><strong>מסלולי טיול עצמאיים</strong><span>מפלים, נחלים, חופים, יערות ומדבר</span></a><a href="#bookable-activities"><strong>אטרקציות בתשלום</strong><span>שטח, סוסים וחוויות עם ספק</span></a></div></div></section>

      <section id="independent-trails" className="section shell activities-hub__trails"><div className="section-head"><div><span className="eyebrow">הנישה החדשה למטייל העצמאי</span><h2>מסלולים שהופקו במיוחד למטיילי וי פור ויקיישן</h2><p>כל מסלול כולל זמן, קושי, אופי, עונה, בטיחות וקישור למקור הרשמי.</p></div><Link href="/trails">לכל {trails.length} המסלולים</Link></div><div className="trail-grid trail-grid--featured">{trails.slice(0, 4).map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</div><Link className="button primary activities-hub__all" href="/trails">מציאת מסלול לפי אזור וקושי</Link></section>

      <section id="bookable-activities" className="section section-tint"><div className="shell"><div className="section-head"><div><span className="eyebrow">עוד רעיונות ליום מושלם</span><h2>חוויות ותוכניות עם עמוד מלא</h2><p>כל אפשרות כוללת תמונה, תכנון שלב אחר שלב, הכנה ושאלות נפוצות. בחוויה עם ספק, שם הספק והמחיר מאושרים לפני ההזמנה.</p></div></div><div className="discovery-grid">{activityIdeas.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div><p className="source-note">תמונות האווירה מסומנות בבירור ואינן מוצגות כתמונה של ספק מסוים.</p></div></section>
    </main>
  </PageShell>;
}
