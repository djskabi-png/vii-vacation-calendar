import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "../../../components/structured-data";
import { WorldLanding } from "../../../components/world-landing";
import { spaPlacesFromSites } from "../../../data/world-data";
import type { SpaPlusSite } from "../../../data/spaplus";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import {
  spaItemMatchesSearch,
  spaSearchDescription,
  spaSearchHref,
  spaSearchStateFromSegments,
  spaSearchTitle,
} from "../../../data/spa-search-landings";
import { breadcrumbSchema, collectionSchema } from "../../../lib/seo";
import { approvedWorldLocation } from "../../../lib/world-location-pages.ts";
import { matchesSearchLocation } from "../../../data/search-taxonomy.ts";

type Props = { params: Promise<{ segments: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const segments = (await params).segments;
  const state = spaSearchStateFromSegments(segments);
  const locationPage = !state && segments.length === 1 ? await approvedWorldLocation("spa", segments[0]) : null;
  if (!state && !locationPage) return { robots: { index: false, follow: false } };
  if (locationPage) {
    const title = `ספא ב${locationPage.label}`;
    const description = `${title}, עם חבילות וטיפולים מאומתים, פרטי מקום ברורים ואפשרות להמשיך לבקשת הזמנה באתר.`;
    return { title, description, alternates: { canonical: locationPage.path }, openGraph: { type: "website", url: locationPage.path, title, description } };
  }
  const path = spaSearchHref(state!);
  const title = spaSearchTitle(state!);
  const description = spaSearchDescription(state!);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, title, description },
  };
}

export default async function SpaSearchLandingPage({ params }: Props) {
  const segments = (await params).segments;
  const state = spaSearchStateFromSegments(segments);
  const locationPage = !state && segments.length === 1 ? await approvedWorldLocation("spa", segments[0]) : null;
  if (!state && !locationPage) notFound();
  const spaPlaces = spaPlacesFromSites(await publicCatalogSummaries<SpaPlusSite>("spa"));
  const path = locationPage?.path || spaSearchHref(state!);
  const title = locationPage ? `ספא ב${locationPage.label}` : spaSearchTitle(state!);
  const description = locationPage ? `${title}, עם חבילות וטיפולים מאומתים, פרטי מקום ברורים ואפשרות להמשיך לבקשת הזמנה באתר.` : spaSearchDescription(state!);
  const items = locationPage ? spaPlaces.filter((item) => matchesSearchLocation(item, locationPage.label)) : spaPlaces.filter((item) => spaItemMatchesSearch(item, state!));
  const breadcrumbs = [
    { name: "ראשי", path: "/" },
    { name: "בתי ספא", path: "/spas" },
    { name: title },
  ];

  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, { name: title, path }])} />
    <StructuredData data={collectionSchema(title, description, path, items.map((item) => ({ name: item.name, path: `/discover/place/${item.id}`, image: item.image })))} />
    <WorldLanding
      world="spa"
      title={title}
      description={description}
      items={spaPlaces}
      searchMode="spa"
      initialSearchLocation={locationPage?.label || state!.region?.label}
      initialSpaAudience={state?.audience?.id}
      initialSpaFilters={state?.features.map((entry) => entry.id)}
      breadcrumbItems={breadcrumbs}
      collectionTitle={`${items.length} בתי ספא מתאימים לחיפוש`}
    />
  </>;
}
