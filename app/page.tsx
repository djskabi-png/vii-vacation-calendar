/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { HomeShowcase, HomeTrails } from "./components/home-showcase";
import { MasuExperience } from "./components/masu-experience";
import { SearchBox } from "./components/search-box";
import { magazineArticles } from "./data/magazine-data";
import { destinations } from "./data/site-data";
import { GiftIcon, PeopleIcon } from "./site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content">
        <section className="home-hero">
          <div className="shell home-hero__content">
            <h1>כל החופשה, במקום אחד</h1>
            <p>נופש, ספא, אירועים וכל מה שעושים מסביב.</p>
            <SearchBox showWorlds />
            <div className="quick-links" aria-label="חיפושים מהירים"><span>חיפושים מהירים:</span><Link href="/search" data-global-feedback="true" data-loading-label="פותחים מקומות נופש...">מקומות נופש</Link><Link href="/search?feature=בריכה" data-global-feedback="true" data-loading-label="מחפשים מקומות עם בריכה...">עם בריכה</Link><Link href="/events/search" data-global-feedback="true" data-loading-label="מחפשים מקומות לאירועים...">אירועים</Link><Link href="/vacations/north" data-global-feedback="true" data-loading-label="מחפשים נופש בצפון...">בצפון</Link></div>
          </div>
          <div className="hero-orb hero-orb--one" /><div className="hero-orb hero-orb--two" />
        </section>

        <HomeShowcase />

        <section className="section home-corporate-gift"><div className="shell"><Link className="home-corporate-gift__card home-corporate-gift__card--gift" href="/gift-card"><span className="home-corporate-gift__visual"><GiftIcon /></span><div><span className="eyebrow">מתנה שמשאירה את הבחירה אצלם</span><h2>גיפט קארד לכל העולמות של וי</h2><p>נופש, ספא, אירועים, אטרקציות ושירותים, במתנה אחת.</p><strong>יוצרים גיפט קארד</strong></div></Link><Link className="home-corporate-gift__card home-corporate-gift__card--corporate" href="/corporate"><span className="home-corporate-gift__visual"><PeopleIcon /></span><div><span className="eyebrow">למנהלות רווחה ולעסקים</span><h2>אירועי חברה, רווחה ומתנות לעובדים</h2><p>מקום, תוכן, ספקים וגיפט קארד במסלול אחד.</p><strong>למרכז הארגוני</strong></div></Link></div></section>

        <div className="section shell home-page-section"><MasuExperience context="stay" /></div>

        <section className="section shell home-page-section" aria-labelledby="destination-title">
          <div className="section-head"><div><span className="eyebrow">בחרו כיוון</span><h2 id="destination-title">יעדים שכיף לברוח אליהם</h2></div><Link href="/destinations">לכל היעדים</Link></div>
          <div className="destination-grid">{destinations.map((destination, index) => <Link key={destination.name} className={`destination-tile destination-tile--${index + 1}`} href={`/search?location=${encodeURIComponent(destination.name)}`}><img src={destination.image} alt={destination.name} title={destination.name} loading="lazy" decoding="async" /><span><strong>{destination.name}</strong><small>{destination.subtitle}</small></span></Link>)}</div>
        </section>

        <section className="section shell why-section home-page-section" aria-labelledby="why-title">
          <div><span className="eyebrow">פשוט לבחור נכון</span><h2 id="why-title">פרטי המקום, בלי ללכת לאיבוד</h2><p>מחפשים מקום לפי אזור ומאפיינים, רואים את הפרטים שהתקבלו מהספק, ומבררים מחיר וזמינות לפני הזמנה.</p><Link className="button primary" href="/search">מתחילים לחפש</Link></div>
          <div className="benefit-grid"><article><b>01</b><h3>חיפוש ממוקד</h3><p>מסננים לפי אזור, הרכב ומאפיינים שקיימים בנתוני הספק.</p></article><article><b>02</b><h3>מידע על המקום</h3><p>רואים תמונות, מתקנים ופרטי אירוח שהתקבלו מהספק.</p></article><article><b>03</b><h3>בדיקה לפני הזמנה</h3><p>מבררים תאריך, מחיר ותנאים לפני שמתחייבים.</p></article></div>
        </section>

        <section className="section home-magazine" aria-labelledby="home-magazine-title">
          <div className="shell"><div className="section-head"><div><span className="eyebrow">מגזין וי</span><h2 id="home-magazine-title">רעיונות שממשיכים את החופשה</h2></div><Link href="/guides">לכל הכתבות</Link></div><div className="home-magazine__grid">{magazineArticles.slice(0,3).map((article,index) => <article key={article.slug} className={index === 0 ? "featured" : ""}><Link href={`/guides/${article.slug}`}><img src={article.image} alt={article.imageAlt} title={article.imageAlt} loading="lazy" decoding="async" /><span>{article.category}</span><div><small>{article.readTime} דקות קריאה</small><h3>{article.title}</h3><p>{article.excerpt}</p></div></Link></article>)}</div></div>
        </section>

        <HomeTrails />

      </main>
    </PageShell>
  );
}
