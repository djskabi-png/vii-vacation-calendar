/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { HomeShowcase } from "./components/home-showcase";
import { SearchBox } from "./components/search-box";
import { magazineArticles } from "./data/magazine-data";
import { destinations } from "./data/site-data";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content">
        <section className="home-hero">
          <div className="shell home-hero__content">
            <span className="eyebrow">נופש, אירועים, ספא וחוויות</span>
            <h1>כל החופשה, במקום אחד</h1>
            <p>מוצאים מקום לישון, מקום לחגוג, זמן להתפנק וכל מה שכיף לעשות מסביב.</p>
            <SearchBox showWorlds />
            <div className="quick-links" aria-label="חיפושים מהירים"><span>חיפושים מהירים:</span><Link href="/search/?type=וילה">וילות</Link><Link href="/search/?feature=בריכה">עם בריכה</Link><Link href="/search/?audience=משפחות">למשפחות</Link><Link href="/search/?location=צפון">בצפון</Link></div>
          </div>
          <div className="hero-orb hero-orb--one" /><div className="hero-orb hero-orb--two" />
        </section>

        <HomeShowcase />

        <section className="section shell" aria-labelledby="destination-title">
          <div className="section-head"><div><span className="eyebrow">בחרו כיוון</span><h2 id="destination-title">יעדים שכיף לברוח אליהם</h2></div><Link href="/destinations/">לכל היעדים</Link></div>
          <div className="destination-grid">{destinations.map((destination, index) => <Link key={destination.name} className={`destination-tile destination-tile--${index + 1}`} href={`/search/?location=${encodeURIComponent(destination.name)}`}><img src={destination.image} alt={destination.name} /><span><strong>{destination.name}</strong><small>{destination.subtitle}</small></span></Link>)}</div>
        </section>

        <section className="section shell why-section" aria-labelledby="why-title">
          <div><span className="eyebrow">פשוט לבחור נכון</span><h2 id="why-title">כל המידע, בלי ללכת לאיבוד</h2><p>החיפוש, הזמינות, פרטי המקום והמדיניות נמצאים במסלול אחד ברור, בכל מסך ובכל מכשיר.</p><Link className="button primary" href="/search/">מתחילים לחפש</Link></div>
          <div className="benefit-grid"><article><b>01</b><h3>חיפוש מדויק</h3><p>מסננים לפי אזור, תאריך, הרכב ומאפיינים.</p></article><article><b>02</b><h3>תמונה מלאה</h3><p>רואים מה כלול, למי המקום מתאים ומה זמין.</p></article><article><b>03</b><h3>בחירה רגועה</h3><p>שומרים מקומות ומשווים בקצב שלכם.</p></article></div>
        </section>

        <section className="section home-magazine" aria-labelledby="home-magazine-title">
          <div className="shell"><div className="section-head"><div><span className="eyebrow">מגזין וי</span><h2 id="home-magazine-title">רעיונות שממשיכים את החופשה</h2></div><Link href="/guides/">לכל הכתבות</Link></div><div className="home-magazine__grid">{magazineArticles.slice(0,3).map((article,index) => <article key={article.slug} className={index === 0 ? "featured" : ""}><Link href={`/guides/${article.slug}/`}><img src={article.image} alt={article.imageAlt} /><span>{article.category}</span><div><small>{article.readTime} דקות קריאה</small><h3>{article.title}</h3><p>{article.excerpt}</p></div></Link></article>)}</div></div>
        </section>

      </main>
    </PageShell>
  );
}
