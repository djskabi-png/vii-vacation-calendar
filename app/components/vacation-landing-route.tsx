import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchExperience } from "../search/page";
import { StructuredData } from "./structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { vacationRegionBySlug, vacationRegionListings } from "../data/vacation-landings";

export function vacationLandingMetadata(regionSlug?: string | null): Metadata {
  const region = vacationRegionBySlug(regionSlug);
  if (!region || !vacationRegionListings(region).length) return {};
  const title = `נופש ב${region.label}`;
  const description = `מקומות נופש פעילים ב${region.label}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  return { title, description, alternates: { canonical: `/vacations/${region.slug}` } };
}

export function VacationLandingRoute({ regionSlug }: { regionSlug?: string | null }) {
  const region = vacationRegionBySlug(regionSlug);
  if (!region) notFound();
  const listings = vacationRegionListings(region);
  if (!listings.length) notFound();
  const path = `/vacations/${region.slug}`;
  const title = `נופש ב${region.label}`;
  const description = `מקומות נופש פעילים ב${region.label}, עם תמונות, פרטי חדרים, מתקנים ואפשרויות הזמנה.`;
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: title, path }])} />
    <StructuredData data={collectionSchema(title, description, path, listings.map((property) => ({ name: property.name, path: `/business?id=${property.slug}`, image: property.image })))} />
    <SearchExperience landing={{ path, title, description, breadcrumb: title, type: "הכל", area: region.label, listingSlugs: listings.map((property) => property.slug) }} />
  </>;
}

