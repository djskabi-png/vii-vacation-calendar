import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "../../../components/structured-data";
import { WorldLanding } from "../../../components/world-landing";
import { spaPlaces } from "../../../data/world-data";
import {
  spaItemMatchesSearch,
  spaSearchDescription,
  spaSearchHref,
  spaSearchStateFromSegments,
  spaSearchTitle,
} from "../../../data/spa-search-landings";
import { breadcrumbSchema, collectionSchema } from "../../../lib/seo";

type Props = { params: Promise<{ segments: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const state = spaSearchStateFromSegments((await params).segments);
  if (!state) return {};
  const path = spaSearchHref(state);
  const title = spaSearchTitle(state);
  const description = spaSearchDescription(state);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, title, description },
  };
}

export default async function SpaSearchLandingPage({ params }: Props) {
  const state = spaSearchStateFromSegments((await params).segments);
  if (!state) notFound();
  const path = spaSearchHref(state);
  const title = spaSearchTitle(state);
  const description = spaSearchDescription(state);
  const items = spaPlaces.filter((item) => spaItemMatchesSearch(item, state));
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
      initialSearchLocation={state.region?.label}
      initialSpaAudience={state.audience?.id}
      initialSpaFilters={state.features.map((entry) => entry.id)}
      breadcrumbItems={breadcrumbs}
      collectionTitle={`${items.length} בתי ספא מתאימים לחיפוש`}
    />
  </>;
}
