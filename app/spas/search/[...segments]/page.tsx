import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { StructuredData } from "../../../components/structured-data";
import { WorldLanding } from "../../../components/world-landing";
import { spaPlacesFromSites } from "../../../data/world-data";
import type { SpaPlusSite } from "../../../data/spaplus";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import {
  spaItemMatchesSearch,
  spaQueryWithoutRedundantLocation,
  spaSearchDescription,
  spaSearchHref,
  spaSearchStateFromSegments,
  spaSearchTitle,
} from "../../../data/spa-search-landings";
import { breadcrumbSchema, collectionSchema } from "../../../lib/seo";
import { approvedWorldLocation } from "../../../lib/world-location-pages.ts";
import { matchesSearchLocation } from "../../../data/search-taxonomy.ts";
import { publishedSearchPage } from "../../../lib/search-page-content.ts";
import { publicSearchContent } from "../../../lib/public-search-page-snapshot.ts";
import { serverLocalePath, serverPublicCopy } from "../../../i18n/server-public-copy";

type Props = { params: Promise<{ segments: string[] }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const segments = (await params).segments;
  const city = !spaSearchStateFromSegments(segments) && segments.length > 1 ? await approvedWorldLocation("spa", segments[0]) : null;
  const state = spaSearchStateFromSegments(segments, city || undefined);
  const locationPage = !state && segments.length === 1 ? await approvedWorldLocation("spa", segments[0]) : null;
  if (!state && !locationPage) return { robots: { index: false, follow: false } };
  if (locationPage) {
    const title = `ספא ב${locationPage.label}`;
    const description = `${title}, עם חבילות וטיפולים מאומתים, פרטי מקום ברורים ואפשרות להמשיך לבקשת הזמנה באתר.`;
    return { title, description, alternates: { canonical: locationPage.path }, openGraph: { type: "website", url: locationPage.path, title, description } };
  }
  const path = spaSearchHref(state!);
  const [page, editorial, canonical, { language, translate }] = await Promise.all([publishedSearchPage(path), publicSearchContent(path), serverLocalePath(path), serverPublicCopy()]);
  const managedTitle = editorial?.metaTitle || page?.title;
  const managedDescription = editorial?.metaDescription || page?.description;
  const title = managedTitle ? translate(managedTitle) : spaSearchTitle(state!, language);
  const description = managedDescription ? translate(managedDescription) : spaSearchDescription(state!, language);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description },
  };
}

export default async function SpaSearchLandingPage({ params, searchParams }: Props) {
  const segments = (await params).segments;
  const query = await searchParams;
  const city = !spaSearchStateFromSegments(segments) && segments.length > 1 ? await approvedWorldLocation("spa", segments[0]) : null;
  const state = spaSearchStateFromSegments(segments, city || undefined);
  const locationPage = !state && segments.length === 1 ? await approvedWorldLocation("spa", segments[0]) : null;
  if (!state && !locationPage) notFound();
  const path = locationPage?.path || spaSearchHref(state!);
  const cleanQuery = spaQueryWithoutRedundantLocation(state?.region || locationPage || undefined, query);
  if (cleanQuery) permanentRedirect(await serverLocalePath(path + (cleanQuery.size ? `?${cleanQuery}` : "")));
  const [sites, page, editorial] = await Promise.all([publicCatalogSummaries<SpaPlusSite>("spa"), publishedSearchPage(path), publicSearchContent(path)]);
  const spaPlaces = spaPlacesFromSites(sites);
  const title = editorial?.h1 || page?.title || (locationPage ? `ספא ב${locationPage.label}` : spaSearchTitle(state!));
  const description = editorial?.summary || page?.description || (locationPage ? `${title}, עם חבילות וטיפולים מאומתים, פרטי מקום ברורים ואפשרות להמשיך לבקשת הזמנה באתר.` : spaSearchDescription(state!));
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
      managedTitle={page?.title}
      managedBody={editorial?.body}
      managedFaq={editorial?.faq}
      hidePopularSearches={Boolean(state?.audience || state?.features.length) || Object.entries(query || {}).some(([key, value]) => key !== "location" && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0))}
    />
  </>;
}
