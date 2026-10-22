/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "./page-shell";
import { BreadcrumbTrail } from "./breadcrumb-trail";
import { StructuredData } from "./structured-data";
import { PreviewCardGallery } from "./preview-card-gallery";
import type { EventPlace, Property } from "../data/site-data";
import { hourlyPlacesFromCatalog, spaPlacesFromSites, type DiscoveryItem } from "../data/world-data";
import type { SpaPlusSite } from "../data/spaplus";
import hourlyCatalog from "../data/sergey-hourly-catalog.json";
import { matchesSearchLocation } from "../data/search-taxonomy";
import { matchesVacationSearchFilter } from "../lib/vacation-search-filter-index";
import { completeNearbyResults, nearbyRecommendations } from "../lib/nearby-recommendations";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import type { SearchOpportunity } from "../lib/search-opportunities.ts";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import styles from "../find/[slug]/search-landing.module.css";

type Result = { id: string; name: string; location: string; area: string; description: string; image?: string; images: string[]; href: string };

function filterEvent(place: EventPlace, location: string, filters: Record<string, string | number | boolean>) {
  return matchesSearchLocation(place, location) && (typeof filters.type !== "string" || place.type === filters.type) &&
    (typeof filters.eventType !== "string" || place.eventTypes.includes(filters.eventType)) &&
    (typeof filters.guests !== "number" || place.capacityScope === "unit" || place.guests >= filters.guests) &&
    (filters.noise !== true || place.features.some((feature) => feature.includes("ללא הגבלת רעש")));
}

async function resultsFor(world: string, location: string, filters: Record<string, string | number | boolean>, fallbackMode?: "nearby"): Promise<{ items: Result[]; expanded: boolean }> {
  if (world === "events") return { items: (await publicCatalogSummaries<EventPlace>("events")).filter((place) => filterEvent(place, location, filters)).map((place) => ({ id: place.slug, name: place.name, location: place.location, area: place.area, description: place.description, image: place.image, images: place.images.slice(0, 10), href: `/events/place/${place.slug}` })), expanded: false };
  if (world === "vacation") {
    const catalog = await publicCatalogSummaries<Property>("vacations");
    const featureIds = typeof filters.features === "string" ? filters.features.split(",").filter(Boolean) : [];
    const eligible = catalog.filter((place) => (typeof filters.type !== "string" || place.type === filters.type) &&
      (typeof filters.guests !== "number" || place.guests >= filters.guests) && featureIds.every((id) => matchesVacationSearchFilter(place, id)));
    const exact = eligible.filter((place) => matchesSearchLocation(place, location));
    const nearby = fallbackMode === "nearby" && exact.length < 3
      ? nearbyRecommendations(eligible, { location, area: location }, { key: (place) => place.slug, limit: 12, minimum: 3 }).items : [];
    const selected = completeNearbyResults(exact, nearby, (place) => place.slug, fallbackMode === "nearby" ? 3 : exact.length);
    return { items: selected.map((place) => ({ id: place.slug, name: place.name, location: place.location, area: place.area, description: place.description, image: place.image, images: place.images.slice(0, 10), href: `/business?id=${encodeURIComponent(place.slug)}` })), expanded: selected.some((place) => !exact.includes(place)) };
  }
  let places: DiscoveryItem[] = [];
  if (world === "spa") places = spaPlacesFromSites(await publicCatalogSummaries<SpaPlusSite>("spa"));
  if (world === "hourly") places = hourlyPlacesFromCatalog(await publicCatalogSummaries<(typeof hourlyCatalog.places)[number]>("rooms"));
  return { items: places.filter((place) => matchesSearchLocation(place, location)).map((place) => ({ id: place.id, name: place.name, location: place.location, area: place.area, description: place.description, image: place.image, images: (place.images || []).slice(0, 10), href: `/discover/place/${place.id}` })), expanded: false };
}

export function managedSearchPageMetadata(page: SearchOpportunity): Metadata {
  return { title: page.metaTitle, description: page.metaDescription, alternates: { canonical: page.canonicalPath }, robots: { index: true, follow: true }, openGraph: { type: "website", url: page.canonicalPath, title: page.metaTitle, description: page.metaDescription } };
}

export async function ManagedSearchLanding({ page }: { page: SearchOpportunity }) {
  const resolved = await resultsFor(page.world, page.location, page.filters, page.fallbackMode);
  const results = resolved.items;
  const worldLabel = page.world === "events" ? "אירועים" : page.world === "vacation" ? "נופש" : page.world === "spa" ? "ספא" : "חדרים לפי שעה";
  const variant = page.world === "vacation" ? "vacation" : page.world === "events" ? "events" : page.world === "hourly" ? "hourly" : "spa";
  return <PageShell variant={variant}><main id="main-content" className={styles.page} dir="rtl">
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: worldLabel, path: page.sourcePath.split("?")[0] }, { name: page.h1, path: page.canonicalPath }])} />
    <StructuredData data={collectionSchema(page.h1, page.metaDescription, page.canonicalPath, results.map((result) => ({ name: result.name, path: result.href, image: result.image })))} />
    <div className={styles.shell}><BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, { name: worldLabel, path: page.sourcePath.split("?")[0] }, { name: page.h1 }]} />
      <header className={styles.hero}><div><span>{worldLabel} · {page.location}</span><h1>{page.h1}</h1><p>{page.summary}</p></div><a href={page.sourcePath} className={styles.editSearch}>שינוי החיפוש</a></header>
      <section className={styles.results} aria-labelledby="managed-results-title"><div className={styles.resultsHead}><div><h2 id="managed-results-title">מקומות שמתאימים לחיפוש</h2><p>{results.length.toLocaleString("he-IL")} תוצאות</p></div></div>{resolved.expanded ? <p role="status">לא נמצאו מספיק מקומות בהתאמה המדויקת, ולכן הוספנו אפשרויות קרובות שעומדות בשאר הסינונים.</p> : null}{results.length ? <div className={`${styles.grid} managed-place-results`}>{results.slice(0, 24).map((result) => <article key={result.id}>
        {result.image || result.images.length ? <PreviewCardGallery className={styles.resultMedia} name={result.name} images={[result.image || "", ...result.images]} href={result.href} /> : <span className={styles.imageFallback} aria-hidden="true">VII</span>}
        <Link className={styles.resultBody} href={result.href}><small>{result.location} · {result.area}</small><h3>{result.name}</h3><p>{result.description}</p><strong>לפרטי המקום</strong></Link>
      </article>)}</div> : <div className={styles.empty}><h3>עדיין אין תוצאות שמתאימות לכל הבחירות</h3><p>אפשר לפתוח את החיפוש ולשנות אזור או מסנן.</p><a href={page.sourcePath}>שינוי החיפוש</a></div>}</section>
      <section className={styles.editorial} aria-labelledby="managed-content-title"><h2 id="managed-content-title">מה חשוב לדעת</h2>{page.body.split(/\n{2,}/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>
      {page.faq.length ? <section className={styles.faq} aria-labelledby="managed-faq-title"><h2 id="managed-faq-title">שאלות נפוצות</h2>{page.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section> : null}
    </div>
  </main></PageShell>;
}
