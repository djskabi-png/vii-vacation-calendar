import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "../../components/structured-data";
import { WorldLanding } from "../../components/world-landing";
import { spaPlaces } from "../../data/world-data";
import { getSpaLanding, spaItemMatches, spaLandingHref, spaLandings } from "../../data/spa-landings";
import { breadcrumbSchema, collectionSchema } from "../../lib/seo";

export function generateStaticParams() {
  return spaLandings.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const landing = getSpaLanding((await params).slug);
  if (!landing) return {};
  const path = spaLandingHref(landing);
  return { title: landing.title, description: landing.description, alternates: { canonical: path }, openGraph: { type: "website", url: path, title: landing.title, description: landing.description } };
}

export default async function SpaLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const landing = getSpaLanding((await params).slug);
  if (!landing) notFound();
  const path = spaLandingHref(landing);
  const items = spaPlaces.filter((item) => spaItemMatches(item, landing));
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, { name: landing.title, path }])} />
    <StructuredData data={collectionSchema(landing.title, landing.description, path, items.map((item) => ({ name: item.name, path: `/discover/place/${item.id}`, image: item.image })))} />
    <WorldLanding world="spa" title={landing.title} description={landing.description} items={items} searchMode="spa" activeSpaFilter={landing.id} breadcrumbItems={[{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, { name: landing.title }]} collectionTitle={`${landing.title}, ${items.length} מקומות מתאימים`} />
  </>;
}
