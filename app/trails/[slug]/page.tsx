import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../../components/page-shell";
import { TrailCard, TrailVisual } from "../../components/trail-card";
import { getTrail, nearbyTrails, trails } from "../../data/trail-data";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, trailSchema } from "../../lib/seo";
import { FavoriteButton } from "../../components/favorite-button";
import { GuestReviewStudio } from "../../components/guest-review-studio";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";

export function generateStaticParams() {
  return trails.map((trail) => ({ slug: trail.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const trail = getTrail(slug);
  return {
    title: `${trail.name}, מדריך מסלול`,
    description: trail.summary,
    alternates: { canonical: `/trails/${trail.slug}` },
    openGraph: { type: "article", url: `/trails/${trail.slug}/`, title: trail.name, description: trail.summary },
    twitter: { card: "summary", title: trail.name, description: trail.summary },
  };
}

export default async function TrailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trail = getTrail(slug);
  const related = nearbyTrails(trail.mainArea, trail.region, 7).filter((item) => item.slug !== trail.slug).slice(0, 6);

  return <PageShell variant="activities">
    <main id="main-content" className="trail-detail">
      <StructuredData data={trailSchema(trail)} />
      <StructuredData data={breadcrumbSchema([
        { name: "ראשי", path: "/" },
        { name: "מסלולי טיול", path: "/trails/" },
        { name: trail.name, path: `/trails/${trail.slug}/` },
      ])} />
      <BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, { name: "מסלולי טיול", path: "/trails" }, { name: trail.name }]} />
      <section className="shell trail-detail__hero"><div><span className="eyebrow">מדריך המסלול של וי פור ויקיישן</span><h1>{trail.name}</h1><p>{trail.summary}</p><div className="trail-detail__quick"><span>{trail.region}</span><span>{trail.difficulty}</span><span>{trail.duration}</span><span>{trail.distance}</span></div><FavoriteButton id={trail.slug} world="trails" name={trail.name} location={`${trail.mainArea}, ${trail.region}`} href={`/trails/${trail.slug}`} meta={`${trail.duration} · ${trail.difficulty}`} compact={false} /></div><TrailVisual trail={trail} /></section>

      <div className="shell trail-detail__layout">
        <article className="trail-detail__content">
          <section aria-labelledby="trail-plan"><span className="eyebrow">התוכנית שלנו ליום הזה</span><h2 id="trail-plan">איך עושים את המסלול נכון</h2><ol className="trail-plan">{trail.dayPlan.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section>
          <section aria-labelledby="trail-highlights"><h2 id="trail-highlights">מה פוגשים בדרך</h2><div className="trail-highlight-grid">{trail.highlights.map((item) => <span key={item}>{item}</span>)}</div></section>
          <section className="trail-safety" aria-labelledby="trail-safety"><span className="eyebrow">לא יוצאים בלי לבדוק</span><h2 id="trail-safety">בטיחות ותנאים משתנים</h2><ul>{trail.safety.map((item) => <li key={item}>{item}</li>)}</ul><p>המידע אינו אישור שהמסלול פתוח כרגע. לפני היציאה בודקים מבזקים, תחזית, שעות פעילות והנחיות בשטח.</p><p className="trail-source-link">מקור המידע שנבדק: {trail.sourceName}</p></section>
          <section aria-labelledby="trail-who"><h2 id="trail-who">למי זה מתאים</h2><p>{trail.familyFit}</p><h3>נגישות במסלול</h3><p>{trail.accessibility}</p></section>
        </article>

        <aside className="trail-detail__aside"><div><span className="eyebrow">כרטיס מסלול</span><dl><div><dt>אזור</dt><dd>{trail.region}</dd></div><div><dt>קושי</dt><dd>{trail.difficulty}</dd></div><div><dt>משך</dt><dd>{trail.duration}</dd></div><div><dt>מרחק</dt><dd>{trail.distance}</dd></div><div><dt>אופי</dt><dd>{trail.routeType}</dd></div><div><dt>עונה מומלצת</dt><dd>{trail.bestSeason}</dd></div></dl><div className="trail-source-link"><strong>נקודת התחלה לחיפוש במפה</strong><span>{trail.mapQuery}</span><small>המידע נשאר בתוך VII. לפני היציאה מאמתים פתיחה והנחיות בטיחות מול הגורם הרשמי.</small></div></div></aside>
      </div>

      <div className="section shell"><GuestReviewStudio placeName={trail.name} subjectId={trail.slug} subjectType="trail" /></div>

      <section className="section section-tint"><div className="shell"><div className="section-head"><div><span className="eyebrow">עוד רעיונות באזור ובאותו סגנון</span><h2>ממשיכים לטייל</h2></div><Link href="/trails">לכל המסלולים</Link></div><div className="trail-grid trail-grid--related">{related.map((item) => <TrailCard key={item.slug} trail={item} compact />)}</div></div></section>
    </main>
  </PageShell>;
}
