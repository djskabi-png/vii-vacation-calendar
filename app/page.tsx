/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { HomeShowcase, HomeTrails, HomeLiveSections, HomeCatalogLoading, type HomeRatedPlace } from "./components/home-showcase";
import { MasuExperience } from "./components/masu-experience";
import { SearchBox } from "./components/search-box";
import { HomeQuickSearches } from "./components/home-discovery-sections";
import { magazineArticles } from "./data/magazine-data";
import { destinations, visualTourProperties } from "./data/site-data";
import type { EventPlace, Property } from "./data/site-data";
import { hourlyPlacesFromCatalog, paidAttractions, providerProfiles, spaPlacesFromSites } from "./data/world-data";
import type { SpaPlusSite } from "./data/spaplus";
import hourlyCatalog from "./data/sergey-hourly-catalog.json";
import { publicCatalogReviewPreviews, publicCatalogSummaries } from "./lib/public-catalog-read.ts";
import { dailyRotationCompare, rotateDaily, rotateWithinTiers } from "./lib/daily-rotation";
import { GiftIcon, PeopleIcon } from "./site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

type SupplierReview = { author?: string; text?: string; date?: string };
type SupplierReviewDetail = { reviews?: SupplierReview[] };

async function homeRatedPlaces(properties: Property[]): Promise<HomeRatedPlace[]> {
  const candidates = properties
    .filter((place) => place.image && Number(place.score) > 0 && Number(place.reviews) >= 5 && /^vacation-\d+$/.test(place.slug))
    .sort((a, b) => Number(b.score) - Number(a.score) || dailyRotationCompare(a.slug, b.slug, "home-reviews"))
    .slice(0, 14);
  const details = await publicCatalogReviewPreviews<SupplierReviewDetail>("vacations", candidates.map((place) => Number(place.slug.slice("vacation-".length))));
  const withReviews = candidates.map((place) => {
    const supplierId = Number(place.slug.slice("vacation-".length));
    const detail = details.get(supplierId);
    const review = detail?.reviews?.find((entry) => typeof entry.text === "string" && entry.text.trim().length >= 30);
    return review ? { place, reviewText: review.text!.trim(), reviewAuthor: review.author?.trim() || "אורח", reviewDate: review.date || "" } : null;
  });
  return withReviews.filter((entry): entry is HomeRatedPlace => entry !== null).slice(0, 7);
}

const destinationMatchers = [
  (area: string, location: string) => /גליל|גולן/.test(area) && location !== "",
  (area: string) => /כנרת/.test(area),
  (area: string) => /ירושלים|יהודה/.test(area),
  (area: string) => /מישור החוף|שרון|מרכז/.test(area),
  (area: string, location: string) => /נגב|דרום|ערבה/.test(area) && location !== "אילת",
  (_area: string, location: string) => location === "אילת",
];

function homeShowcaseProperties(properties: Property[]) {
  const destinationCandidates = rotateDaily(properties.filter((place) => place.image), (place) => place.slug, "home-destination-images");
  const usedImages = new Set<string>();
  const destinationPlaces = destinationMatchers.map((matches) => {
    const candidates = destinationCandidates.filter((place) => matches(place.area, place.location));
    const place = candidates.find((candidate) => !usedImages.has(candidate.image)) || candidates[0];
    if (place?.image) usedImages.add(place.image);
    return place;
  }).filter((place): place is Property => Boolean(place));
  const tourPlaces = rotateDaily([
    ...properties.filter((place) => place.videos?.length),
    ...visualTourProperties,
  ], (place) => place.slug, "home-tours").slice(0, 7);
  const selected = new Map<string, Property>();
  [...destinationPlaces, ...tourPlaces].forEach((place) => selected.set(place.slug, place));
  return [...selected.values()].map(({ slug, name, location, area, image, videos }) => ({ slug, name, location, area, image, videos }));
}

async function HomeCatalogShowcase() {
  const propertiesPromise = publicCatalogSummaries<Property>("vacations");
  const ratedPlacesPromise = propertiesPromise.then(homeRatedPlaces);
  const [properties, eventPlaces, spaSites, hourlyCatalogPlaces, ratedPlaces] = await Promise.all([
    propertiesPromise,
    publicCatalogSummaries<EventPlace>("events"),
    publicCatalogSummaries<SpaPlusSite>("spa"),
    publicCatalogSummaries<(typeof hourlyCatalog.places)[number]>("rooms"),
    ratedPlacesPromise,
  ]);
  const showcaseProperties = homeShowcaseProperties(properties);
  const showcaseEvents = rotateDaily(eventPlaces.filter((place) => place.image),
    (place) => place.slug, "home-events").slice(0, 5);
  const showcaseSpas = rotateWithinTiers(spaPlacesFromSites(spaSites),
    (item) => item.image && item.priceLabel ? 0 : item.image ? 1 : 2,
    (item) => item.id, "home-spa").slice(0, 7);
  const showcaseHourly = hourlyPlacesFromCatalog(hourlyCatalogPlaces);
  return <HomeShowcase properties={showcaseProperties} eventPlaces={showcaseEvents} ratedPlaces={ratedPlaces}
    spaPlaces={showcaseSpas} hourlyPlaces={showcaseHourly} providerPreview={providerProfiles[0]} attractionPreview={paidAttractions[0]} />;
}

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content">
        <section className="home-hero">
          <div className="shell home-hero__content">
            <h1>כל החופשה, במקום אחד</h1>
            <p>נופש, ספא, אירועים וכל מה שעושים מסביב.</p>
            <SearchBox showWorlds />
            <HomeQuickSearches />
          </div>
        </section>

        <HomeLiveSections />
        <Suspense fallback={<HomeCatalogLoading />}><HomeCatalogShowcase /></Suspense>

        <section className="section home-corporate-gift"><div className="shell"><Link className="home-corporate-gift__card home-corporate-gift__card--gift" href="/gift-card"><span className="home-corporate-gift__visual"><GiftIcon /></span><div><span className="eyebrow">מתנה שמשאירה את הבחירה אצלם</span><h2>גיפט קארד לכל העולמות של וי</h2><p>נופש, ספא, אירועים, אטרקציות ושירותים, במתנה אחת.</p><strong>יוצרים גיפט קארד</strong></div></Link><Link className="home-corporate-gift__card home-corporate-gift__card--corporate" href="/corporate"><span className="home-corporate-gift__visual"><PeopleIcon /></span><div><span className="eyebrow">למנהלות רווחה ולעסקים</span><h2>אירועי חברה, רווחה ומתנות לעובדים</h2><p>מקום, תוכן, ספקים וגיפט קארד במסלול אחד.</p><strong>למרכז הארגוני</strong></div></Link></div></section>

        <div className="section shell home-page-section"><MasuExperience context="stay" /></div>

        <section className="section shell home-page-section" aria-labelledby="destination-title">
          <div className="section-head"><div><span className="eyebrow">בחרו כיוון</span><h2 id="destination-title">יעדים שכיף לברוח אליהם</h2></div><Link href="/destinations">לכל היעדים</Link></div>
          <div className="destination-grid">{destinations.map((destination, index) => <Link key={destination.name} className={`destination-tile destination-tile--${index + 1}`} href={`/search?location=${encodeURIComponent(destination.name)}`} prefetch={false}><img src={destination.image} alt={destination.name} title={destination.name} loading="lazy" decoding="async" /><span><strong>{destination.name}</strong><small>{destination.subtitle}</small></span></Link>)}</div>
        </section>

        <section className="section shell why-section home-page-section" aria-labelledby="why-title">
          <div><span className="eyebrow">פשוט לבחור נכון</span><h2 id="why-title">פרטי המקום, בלי ללכת לאיבוד</h2><p>מחפשים מקום לפי אזור ומאפיינים, רואים את הפרטים שהתקבלו מהספק, ומבררים מחיר וזמינות לפני הזמנה.</p><Link className="button primary" href="/search" prefetch={false} data-global-feedback="true" data-loading-label="פותחים את החיפוש...">מתחילים לחפש</Link></div>
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
