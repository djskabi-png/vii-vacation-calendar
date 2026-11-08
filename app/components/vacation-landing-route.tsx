import { publicSearchContent } from "../lib/public-search-page-snapshot.ts";
import { hasCatalogNavigationHint } from "../../shared/public-catalog-navigation.ts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { SearchExperience } from "../search/page";
import { PublishedCatalogSeed } from "../lib/published-catalog-seed";
import { StructuredData } from "./structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { vacationRegionBySlug, vacationRegionListings } from "../data/vacation-landings";
import { completePlaceSearchResults, nearbySearchRecommendations } from "../lib/nearby-recommendations.ts";
import { matchesSearchLocation } from "../data/search-taxonomy.ts";
import { worldLocationPath } from "../lib/world-location-path.ts";
import { Suspense } from "react";
import { PageShell } from "./page-shell";
import { RegionalSearchLoading } from "./regional-search-loading";

export async function vacationLandingMetadata(regionSlug?: string | null): Promise<Metadata> {
  const region = vacationRegionBySlug(regionSlug);
  if (!region) return {};
  const approved = await publicSearchContent(`/vacations/${region.slug}`);
  const title = approved?.metaTitle || `נופש ב${region.label}`;
  const description = approved?.metaDescription || `מקומות נופש פעילים ב${region.label}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  const path = `/vacations/${region.slug}`;
  return { title, description, alternates: { canonical: path }, openGraph: { type: "website", url: path, title, description } };
}

export async function VacationLandingRoute({ regionSlug, locationOverride }: { regionSlug?: string | null; locationOverride?: string }) {
  const region = vacationRegionBySlug(regionSlug);
  const location = locationOverride || region?.label;
  if (!location) notFound();
  const path = locationOverride ? worldLocationPath("vacation", location) : `/vacations/${region!.slug}`;
  const approved = await publicSearchContent(path);
  const title = approved?.h1 || `נופש ב${location}`;
  const description = approved?.summary || `מקומות נופש פעילים ב${location}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  const guideTitle = `איך בוחרים מקום נופש ב${location}`;
  const guideParagraphs = approved?.body ? approved.body.split(/\n\s*\n/).filter(Boolean) : [
    `בעמוד זה מוצגים מקומות הנופש הפעילים ב${location}. אפשר להשוות בין סוגי האירוח, מספר האורחים, החדרים, המתקנים ואפשרויות יצירת הקשר שמופיעות בכל כרטיס.`,
    "מחיר וזמינות מוצגים רק כאשר הספק מסר מידע מתאים. כשאין יומן או מחיר מאומת, העמוד מפנה לבירור ישיר בטלפון או בוואטסאפ במקום להציג זמינות שאינה ידועה.",
  ];
  const faqs = approved?.faq.length ? approved.faq : [
    { question: `אילו מקומות נופש מופיעים ב${location}?`, answer: `מופיעים מקומות פעילים שהמיקום שלהם משויך ל${location} בקטלוג VII. התוצאות מתעדכנות לפי המידע שמתקבל מהספקים.` },
    { question: "איך יודעים אם אפשר להזמין אונליין?", answer: "אפשרות הזמנה אונליין מוצגת רק כאשר קיימים גם זמינות וגם מחיר מתאימים. במקומות אחרים אפשר לפנות ישירות לבירור." },
    { question: "האם אפשר לסנן לפי סוג מקום ומאפיינים?", answer: "כן. אפשר לסנן את התוצאות לפי סוג מקום, מספר אורחים, חדרי שינה, מתקנים ומאפייני חיפוש נוספים." },
  ];
  const requestHeaders = await headers();
  const isFlight = requestHeaders.get("rsc") === "1" || (requestHeaders.get("accept") || "").includes("text/x-component");
  if (region && !locationOverride && isFlight && hasCatalogNavigationHint(requestHeaders)) {
    // HTML keeps its complete, authoritative server projection for first visits
    // and crawlers. Navigation already has a public catalog reader in the
    // browser, so do not serialize and fetch the same catalog again in Flight.
    return <>
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: title, path }])} />
      <SearchExperience key={path} landing={{ path, title, description, breadcrumb: title, type: "הכל", area: location, guideTitle, guideParagraphs, faqs, clientCollectionSchema: true }} />
    </>;
  }
  const streamShell = Boolean(region && !locationOverride && !isFlight);
  const renderCatalogContent = async () => {
    const { publicRegionalVacationSearch } = await import("../lib/cached-public-vacation-search.ts");
    const publishedProperties = await publicRegionalVacationSearch();
    const listings = region && !locationOverride
      ? vacationRegionListings(region, publishedProperties)
      : publishedProperties.filter((property) => matchesSearchLocation(property, location));
    const initialListings = completePlaceSearchResults(listings, nearbySearchRecommendations(publishedProperties, location, [], {
      key: (property) => property.slug,
      origin: { location, area: location },
    }), (property) => property.slug);
    // Complete regional metadata keeps first-document counts and filters truthful.
    return <>
      <StructuredData data={collectionSchema(title, description, path, initialListings.map((property) => ({ name: property.name, path: `/business?id=${property.slug}`, image: property.image })))} />
      <PublishedCatalogSeed world="vacations" entries={initialListings} complete={false}><SearchExperience embedded={streamShell} landing={{ path, title, description, breadcrumb: title, type: "הכל", area: location, listingSlugs: listings.map((property) => property.slug), guideTitle, guideParagraphs, faqs }} /></PublishedCatalogSeed>
    </>;
  };
  if (streamShell) return <PageShell>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: title, path }])} />
    <Suspense fallback={<RegionalSearchLoading title={title} />}>
      {renderCatalogContent()}
    </Suspense>
  </PageShell>;
  const renderedCatalog = await renderCatalogContent();
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: title, path }])} />
    {renderedCatalog}
  </>;
}

