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
import { completeNearbyResults, nearbySearchRecommendations } from "../lib/nearby-recommendations.ts";

export async function vacationLandingMetadata(regionSlug?: string | null): Promise<Metadata> {
  const region = vacationRegionBySlug(regionSlug);
  if (!region) return {};
  const title = `נופש ב${region.label}`;
  const description = `מקומות נופש פעילים ב${region.label}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  const path = `/vacations/${region.slug}`;
  return { title, description, alternates: { canonical: path }, openGraph: { type: "website", url: path, title, description } };
}

export async function VacationLandingRoute({ regionSlug }: { regionSlug?: string | null }) {
  const publishedProperties = publicVacationSearchProperties(await publicCatalogSummaries<Property>("vacations"));
  const region = vacationRegionBySlug(regionSlug);
  if (!region) notFound();
  const listings = vacationRegionListings(region, publishedProperties);
  const represented = completeNearbyResults(listings, nearbySearchRecommendations(publishedProperties, region.label, [], {
    key: (property) => property.slug,
    origin: { location: region.label, area: region.label },
  }), (property) => property.slug);
  const path = `/vacations/${region.slug}`;
  const title = `נופש ב${region.label}`;
  const description = `מקומות נופש פעילים ב${region.label}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: title, path }])} />
    <StructuredData data={collectionSchema(title, description, path, represented.map((property) => ({ name: property.name, path: `/business?id=${property.slug}`, image: property.image })))} />
    <PublishedCatalogSeed world="vacations" entries={publishedProperties}><SearchExperience landing={{ path, title, description, breadcrumb: title, type: "הכל", area: region.label, listingSlugs: listings.map((property) => property.slug) }} /></PublishedCatalogSeed>
  </>;
}

