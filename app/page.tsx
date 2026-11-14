/* eslint-disable @next/next/no-img-element */

import { Suspense } from "react";
import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { HomeShowcase, HomeTrails, HomeLiveSections } from "./components/home-showcase";
import { HomeLiveSectionsSeeded } from "./components/home-live-sections-seeded";
import { MasuExperience } from "./components/masu-experience";
import { SearchBox } from "./components/search-box";
import { HomeQuickSearches } from "./components/home-discovery-sections";
import { magazineArticles } from "./data/magazine-data";
import { managedMagazineArticles } from "./lib/managed-public-content";
import { isMagazineArticlePublicAt } from "./lib/magazine-schedule";
import { EditorialCover } from "./components/editorial-cover";
import { headers } from "next/headers";
import { destinations } from "./data/site-data";
import { GiftIcon, PeopleIcon } from "./site-header";
import { HomeMobileRail } from "./components/home-mobile-rail";
import "./home-mobile.css";
import "./home-performance.css";
import { serverPublicCopy } from "./i18n/server-public-copy";
import { readWorldAvailability } from "./lib/world-availability";
import { localizedPath, type SiteLanguage } from "./i18n/locale-routing";
import { homeShowcaseAttraction, homeShowcaseEvents, homeShowcaseHourly, homeShowcaseProperties, homeShowcaseProvider } from "./data/home-showcase-fallback";
import { readHomepagePresentation } from "./lib/homepage-presentation";
import { runtimeDatabase } from "./lib/runtime-database";

async function HomeMagazineSection() {
  const requestedLocale = (await headers()).get("x-vii-locale") || "he";
  const locale: SiteLanguage = ["he", "en", "ru", "fr"].includes(requestedLocale) ? requestedLocale as SiteLanguage : "he";
  const managedArticles = await managedMagazineArticles(magazineArticles).catch(() => magazineArticles.filter((article) => isMagazineArticlePublicAt(article)));
  const homeArticles = managedArticles.filter(article => !article.publishedLocales || article.publishedLocales.includes(locale)).slice(0,3);
  return <section className="section home-magazine" aria-labelledby="home-magazine-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">מגזין וי</span><h2 id="home-magazine-title">רעיונות שממשיכים את החופשה</h2></div><Link href={localizedPath("/guides", locale)}>לכל הכתבות</Link></div><HomeMobileRail id="home-magazine-rail" label="רעיונות שממשיכים את החופשה" className="home-magazine__grid">{homeArticles.map((article,index) => <article key={article.slug} className={index === 0 ? "featured" : ""}><Link href={localizedPath(`/guides/${article.slug}`, locale)}><EditorialCover slug={article.slug} src={article.image} alt={article.imageAlt} title={article.imageTitle} /><span>{article.category}</span><div><small>{article.readTime} דקות קריאה</small><h3>{article.title}</h3><p>{article.excerpt}</p></div></Link></article>)}</HomeMobileRail></div></section>;
}

export default async function HomePage() {
  const { translate, language } = await serverPublicCopy();
  const [worldAvailability, homePresentation] = await Promise.all([
    readWorldAvailability(),
    runtimeDatabase().then((db) => readHomepagePresentation(db, language, "vacation")).catch(() => readHomepagePresentation(undefined, language, "vacation")),
  ]);
  return (
    <PageShell>
      <main id="main-content" className="home-page">
        <section className="home-hero">
          <div className="shell home-hero__content">
            <h1>{translate("כל מה שעושים בחופש, במקום אחד")}</h1>
            <p>{translate("נופש, ספא, אירועים ופעילויות. מחפשים ומזמינים ישר כאן.")}</p>
            <SearchBox showWorlds />
            <HomeQuickSearches initialPresentation={homePresentation} />
          </div>
        </section>

        <Suspense fallback={<HomeLiveSections pendingSeed />}><HomeLiveSectionsSeeded /></Suspense>
        <HomeShowcase properties={homeShowcaseProperties} eventPlaces={homeShowcaseEvents}
          hourlyPlaces={homeShowcaseHourly} providerPreview={homeShowcaseProvider} attractionPreview={homeShowcaseAttraction} />

        {worldAvailability["gift-card"] || worldAvailability.corporate ? <section className="section home-corporate-gift"><div className="shell">{worldAvailability["gift-card"] ? <Link className="home-corporate-gift__card home-corporate-gift__card--gift" href="/gift-card"><span className="home-corporate-gift__visual"><GiftIcon /></span><div><h2>גיפט קארד לכל העולמות של וי</h2><p>נופש, ספא, אירועים, אטרקציות ושירותים, במתנה אחת.</p><strong>יוצרים גיפט קארד</strong></div></Link> : null}{worldAvailability.corporate ? <Link className="home-corporate-gift__card home-corporate-gift__card--corporate" href="/corporate"><span className="home-corporate-gift__visual"><PeopleIcon /></span><div><span className="eyebrow">למנהלות רווחה ולעסקים</span><h2>אירועי חברה, רווחה ומתנות לעובדים</h2><p>{worldAvailability["gift-card"] ? "מקום, תוכן, ספקים וגיפט קארד במסלול אחד." : "מקום, תוכן וספקים במסלול אחד."}</p><strong>למרכז הארגוני</strong></div></Link> : null}</div></section> : null}

        <div className="section shell home-page-section"><MasuExperience context="stay" /></div>

        <section className="section shell home-page-section" aria-labelledby="destination-title">
          <div className="section-head"><div><h2 id="destination-title">יעדים שכיף לברוח אליהם</h2></div><Link href="/destinations">לכל היעדים</Link></div>
          <div className="destination-grid">{destinations.map((destination, index) => <Link key={destination.name} className={`destination-tile destination-tile--${index + 1}`} href={`/search?location=${encodeURIComponent(destination.name)}`} prefetch={false}><img src={destination.image} alt={destination.name} title={destination.name} loading="lazy" decoding="async" /><span><strong>{destination.name}</strong><small>{destination.subtitle}</small></span></Link>)}</div>
        </section>

        <section className="section shell why-section home-page-section" aria-labelledby="why-title">
          <div><h2 id="why-title">פרטי המקום, בלי ללכת לאיבוד</h2><p>בוחרים אזור והרכב, משווים תמונות ומתקנים ובודקים מחיר וזמינות לפני שמזמינים.</p><Link className="button primary" href="/search" prefetch={false} data-global-feedback="true" data-loading-label="פותחים את החיפוש...">מתחילים לחפש</Link></div>
          <div className="benefit-grid"><article><b>01</b><h3>חיפוש ממוקד</h3><p>מצמצמים את החיפוש לפי האזור, מספר האורחים ומה שחשוב לכם.</p></article><article><b>02</b><h3>מידע על המקום</h3><p>משווים תמונות, מתקנים ופרטי אירוח לפני שבוחרים.</p></article><article><b>03</b><h3>בדיקה לפני הזמנה</h3><p>בודקים את התאריך, המחיר והתנאים לפני שמתחייבים.</p></article></div>
        </section>

        <Suspense fallback={null}><HomeMagazineSection /></Suspense>

        <HomeTrails />

      </main>
    </PageShell>
  );
}
