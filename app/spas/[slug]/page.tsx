import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "../../components/structured-data";
import { WorldLanding } from "../../components/world-landing";
import { spaPlacesFromSites } from "../../data/world-data";
import type { SpaPlusSite } from "../../data/spaplus";
import { publicCatalogSummaries } from "../../lib/public-catalog-read.ts";
import { getSpaLanding, spaItemMatches, spaLandingHref, spaLandings } from "../../data/spa-landings";
import { breadcrumbSchema, collectionSchema } from "../../lib/seo";
import { publishedSearchPage } from "../../lib/search-page-content.ts";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return spaLandings.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const landing = getSpaLanding((await params).slug);
  if (!landing) return {};
  const path = spaLandingHref(landing);
  const page = await publishedSearchPage(path);
  return { title: page?.title || landing.title, description: page?.description || landing.description, alternates: { canonical: path }, openGraph: { type: "website", url: path, title: page?.title || landing.title, description: page?.description || landing.description } };
}

export default async function SpaLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const landing = getSpaLanding((await params).slug);
  if (!landing) notFound();
  const spaPlaces = spaPlacesFromSites(await publicCatalogSummaries<SpaPlusSite>("spa"));
  const path = spaLandingHref(landing);
  const page = await publishedSearchPage(path);
  const title = page?.title || landing.title;
  const description = page?.description || landing.description;
  const items = spaPlaces.filter((item) => spaItemMatches(item, landing));
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, { name: title, path }])} />
    <StructuredData data={collectionSchema(title, description, path, items.map((item) => ({ name: item.name, path: `/discover/place/${item.id}`, image: item.image })))} />
    <WorldLanding world="spa" title={title} description={description} items={spaPlaces} searchMode="spa" activeSpaFilter={landing.id} initialSpaFilters={[landing.id]} breadcrumbItems={[{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, { name: title }]} collectionTitle={`${title}, ${items.length} מקומות מתאימים`} />
  </>;
}

