import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchExperience } from "../search/page";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import { PublishedCatalogSeed } from "../lib/published-catalog-seed";
import type { Property } from "../data/site-data";
import { publicVacationSearchProperties } from "../lib/public-vacation-search";
import { StructuredData } from "./structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { vacationRegionBySlug, vacationRegionListings } from "../data/vacation-landings";
import { completePlaceSearchResults, nearbySearchRecommendations } from "../lib/nearby-recommendations.ts";
import { matchesSearchLocation } from "../data/search-taxonomy.ts";
import { worldLocationPath } from "../lib/world-location-pages.ts";

export async function vacationLandingMetadata(regionSlug?: string | null): Promise<Metadata> {
  const region = vacationRegionBySlug(regionSlug);
  if (!region) return {};
  const title = `נופש ב${region.label}`;
  const description = `מקומות נופש פעילים ב${region.label}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  const path = `/vacations/${region.slug}`;
  return { title, description, alternates: { canonical: path }, openGraph: { type: "website", url: path, title, description } };
}

export async function VacationLandingRoute({ regionSlug, locationOverride }: { regionSlug?: string | null; locationOverride?: string }) {
  const publishedProperties = publicVacationSearchProperties(await publicCatalogSummaries<Property>("vacations"));
  const region = vacationRegionBySlug(regionSlug);
  const location = locationOverride || region?.label;
  if (!location) notFound();
  const listings = region && !locationOverride
    ? vacationRegionListings(region, publishedProperties)
    : publishedProperties.filter((property) => matchesSearchLocation(property, location));
  const represented = completePlaceSearchResults(listings, nearbySearchRecommendations(publishedProperties, location, [], {
    key: (property) => property.slug,
    origin: { location, area: location },
  }), (property) => property.slug);
  // Keep the first document useful and indexable without serializing hundreds
  // of repeated catalog records into both HTML and Flight. The client refreshes
  // the complete cached search view immediately after hydration.
  const initialListings = represented.slice(0, 60);
  const path = locationOverride ? worldLocationPath("vacation", location) : `/vacations/${region!.slug}`;
  const title = `נופש ב${location}`;
  const description = `מקומות נופש פעילים ב${location}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  const guideTitle = `איך בוחרים מקום נופש ב${location}`;
  const guideParagraphs = [
    `בעמוד זה מוצגים מקומות הנופש הפעילים ב${location}. אפשר להשוות בין סוגי האירוח, מספר האורחים, החדרים, המתקנים ואפשרויות יצירת הקשר שמופיעות בכל כרטיס.`,
    "מחיר וזמינות מוצגים רק כאשר הספק מסר מידע מתאים. כשאין יומן או מחיר מאומת, העמוד מפנה לבירור ישיר בטלפון או בוואטסאפ במקום להציג זמינות שאינה ידועה.",
  ];
  const faqs = [
    { question: `אילו מקומות נופש מופיעים ב${location}?`, answer: `מופיעים מקומות פעילים שהמיקום שלהם משויך ל${location} בקטלוג VII. התוצאות מתעדכנות לפי המידע שמתקבל מהספקים.` },
    { question: "איך יודעים אם אפשר להזמין אונליין?", answer: "אפשרות הזמנה אונליין מוצגת רק כאשר קיימים גם זמינות וגם מחיר מתאימים. במקומות אחרים אפשר לפנות ישירות לבירור." },
    { question: "האם אפשר לסנן לפי סוג מקום ומאפיינים?", answer: "כן. אפשר לסנן את התוצאות לפי סוג מקום, מספר אורחים, חדרי שינה, מתקנים ומאפייני חיפוש נוספים." },
  ];
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: title, path }])} />
    <StructuredData data={collectionSchema(title, description, path, initialListings.map((property) => ({ name: property.name, path: `/business?id=${property.slug}`, image: property.image })))} />
    <PublishedCatalogSeed world="vacations" entries={initialListings} complete={false}><SearchExperience landing={{ path, title, description, breadcrumb: title, type: "הכל", area: location, listingSlugs: listings.map((property) => property.slug), guideTitle, guideParagraphs, faqs }} /></PublishedCatalogSeed>
  </>;
}

