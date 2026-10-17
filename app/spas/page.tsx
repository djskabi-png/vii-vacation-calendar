import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { spaPlacesFromSites } from "../data/world-data";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import type { SpaPlusSite } from "../data/spaplus";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { publishedSearchPage } from "../lib/search-page-content.ts";
import { SpaPackageDeals } from "../components/spa-package-deals";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await publishedSearchPage("/spas");
  return { title: page?.title, description: page?.description, alternates: { canonical: "/spas" }, openGraph: { type: "website", url: "/spas", title: page?.title, description: page?.description } };
}

export default async function SpasPage() {
  const page = await publishedSearchPage("/spas");
  const spaPlaces = spaPlacesFromSites(await publicCatalogSummaries<SpaPlusSite>("spa"));
  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "בתי ספא", path: "/spas/" },
    ])} />
    <StructuredData data={collectionSchema(page?.title || "בתי ספא בישראל", page?.description || "בתי ספא וחבילות לפי אזור וסוג החוויה.", "/spas", spaPlaces.map((place) => ({ name: place.name, path: `/discover/place/${place.id}`, image: place.image })))} />
    <WorldLanding world="spa" title={page?.title || "בתי ספא בישראל"} description={page?.description || "בוחרים אזור, תאריך וסוג חוויה ומוצאים את הספא שמתאים לכם."} items={spaPlaces} searchMode="spa" beforeResults={<SpaPackageDeals sectionId="spa-world-package-deals" />} />
  </>;
}
