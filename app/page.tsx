/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { HomeShowcase, HomeTrails, HomeLiveSections, HomeCatalogLoading, HomeRatingsSection, type HomeRatedPlace } from "./components/home-showcase";
import { MasuExperience } from "./components/masu-experience";
import { SearchBox } from "./components/search-box";
import { HomeQuickSearches } from "./components/home-discovery-sections";
import { magazineArticles } from "./data/magazine-data";
import { managedMagazineArticles } from "./lib/managed-public-content";
import { EditorialCover } from "./components/editorial-cover";
import { headers } from "next/headers";
import { destinations, visualTourProperties } from "./data/site-data";
import type { EventPlace, Property } from "./data/site-data";
import { hourlyPlacesFromCatalog, paidAttractions, providerProfiles } from "./data/world-data";
import hourlyCatalog from "./data/sergey-hourly-catalog.json";
import { publicCatalogReviewPreviews, publicCatalogSummaries } from "./lib/public-catalog-read.ts";
import { dailyRotationCompare, rotateDaily } from "./lib/daily-rotation";
import { GiftIcon, PeopleIcon } from "./site-header";
import { HomeMobileRail } from "./components/home-mobile-rail";
import "./home-mobile.css";
import { serverPublicCopy } from "./i18n/server-public-copy";
import { eligibleHomeTourProperties } from "./lib/home-video-selection";
import { readWorldAvailability } from "./lib/world-availability";

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
  const tourPlaces = rotateDaily(eligibleHomeTourProperties([
    ...properties,
    ...visualTourProperties,
  ]), (place) => place.slug, "home-tours").slice(0, 7);
  const selected = new Map<string, Property>();
  [...destinationPlaces, ...tourPlaces].forEach((place) => selected.set(place.slug, place));
  return [...selected.values()].map(({ slug, name, location, area, image, videos }) => ({ slug, name, location, area, image, videos }));
}

async function HomeCatalogShowcase() {
  const [properties, eventPlaces, hourlyCatalogPlaces] = await Promise.all([
    publicCatalogSummaries<Property>("vacations").catch(() => []),
    publicCatalogSummaries<EventPlace>("events").catch(() => []),
    publicCatalogSummaries<(typeof hourlyCatalog.places)[number]>("rooms").catch(() => []),
  ]);
  const showcaseProperties = homeShowcaseProperties(properties);
  const showcaseEvents = rotateDaily(eventPlaces.filter((place) => place.image),
    (place) => place.slug, "home-events").slice(0, 20).map((place) => ({
      ...place,
      images: (place.images?.length ? place.images : [place.image]).slice(0, 3),
      description: place.description?.slice(0, 220) || "",
      features: place.features?.slice(0, 4) || [],
    }));
  const showcaseHourly = hourlyPlacesFromCatalog(hourlyCatalogPlaces);
  return <HomeShowcase properties={showcaseProperties} eventPlaces={showcaseEvents}
    hourlyPlaces={showcaseHourly} providerPreview={providerProfiles[0]} attractionPreview={paidAttractions[0]} />;
}

async function HomeRatings() {
  const properties = await publicCatalogSummaries<Property>("vacations").catch(() => []);
  const ratedPlaces = await homeRatedPlaces(properties).catch(() => []);
  return ratedPlaces.length ? <HomeRatingsSection ratedPlaces={ratedPlaces} /> : null;
}

async function HomeMagazineSection() {
  const locale = (await headers()).get("x-vii-locale") || "he";
  const managedArticles = await managedMagazineArticles(magazineArticles).catch(() => magazineArticles);
  const homeArticles = managedArticles.filter(article => !article.publishedLocales || article.publishedLocales.includes(locale)).slice(0,3);
  return <section className="section home-magazine" aria-labelledby="home-magazine-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">מגזין וי</span><h2 id="home-magazine-title">רעיונות שממשיכים את החופשה</h2></div><Link href="/guides">לכל הכתבות</Link></div><HomeMobileRail id="home-magazine-rail" label="רעיונות שממשיכים את החופשה" className="home-magazine__grid">{homeArticles.map((article,index) => <article key={article.slug} className={index === 0 ? "featured" : ""}><Link href={`/guides/${article.slug}`}><EditorialCover slug={article.slug} src={article.image} alt={article.imageAlt} title={article.imageTitle} /><span>{article.category}</span><div><small>{article.readTime} דקות קריאה</small><h3>{article.title}</h3><p>{article.excerpt}</p></div></Link></article>)}</HomeMobileRail></div></section>;
}

export default async function HomePage() {
  const { translate } = await serverPublicCopy();
  const worldAvailability = await readWorldAvailability();
  return (
    <PageShell>
      <main id="main-content" className="home-page">
        <section className="home-hero">
          <div className="shell home-hero__content">
            <h1>{translate("כל מה שעושים בחופש, במקום אחד")}</h1>
            <p>{translate("נופש, ספא, אירועים ופעילויות. מחפשים ומזמינים ישר כאן.")}</p>
            <SearchBox showWorlds />
            <HomeQuickSearches />
          </div>
        </section>

        <HomeLiveSections />
        <Suspense fallback={<HomeCatalogLoading />}><HomeCatalogShowcase /></Suspense>
        <Suspense fallback={null}><HomeRatings /></Suspense>

        <section className="section home-corporate-gift"><div className="shell"><Link className="home-corporate-gift__card home-corporate-gift__card--gift" href="/gift-card"><span className="home-corporate-gift__visual"><GiftIcon /></span><div><h2>גיפט קארד לכל העולמות של וי</h2><p>נופש, ספא, אירועים, אטרקציות ושירותים, במתנה אחת.</p><strong>יוצרים גיפט קארד</strong></div></Link>{worldAvailability.corporate ? <Link className="home-corporate-gift__card home-corporate-gift__card--corporate" href="/corporate"><span className="home-corporate-gift__visual"><PeopleIcon /></span><div><span className="eyebrow">למנהלות רווחה ולעסקים</span><h2>אירועי חברה, רווחה ומתנות לעובדים</h2><p>מקום, תוכן, ספקים וגיפט קארד במסלול אחד.</p><strong>למרכז הארגוני</strong></div></Link> : null}</div></section>

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
