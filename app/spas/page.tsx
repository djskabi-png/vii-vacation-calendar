import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { spaPlacesFromSites } from "../data/world-data";
import { bundledPublicCatalogSummaries } from "../lib/public-catalog-read.ts";
import type { SpaPlusSite } from "../data/spaplus";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { publishedSearchPage } from "../lib/search-page-content.ts";
import { SpaPackageDeals } from "../components/spa-package-deals";
import { serverLocalePath, serverPublicCopy } from "../i18n/server-public-copy";
import { permanentRedirect } from "next/navigation";
import { approvedWorldLocationForLabel } from "../lib/world-location-pages.ts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await publishedSearchPage("/spas");
  const canonical = await serverLocalePath("/spas");
  const { translate } = await serverPublicCopy();
  const title = page?.title ? translate(page.title) : undefined;
  const description = page?.description ? translate(page.description) : undefined;
  return { title, description, alternates: { canonical }, openGraph: { type: "website", url: canonical, title, description } };
}

export default async function SpasPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedLocation = typeof params?.location === "string" ? params.location : null;
  if (requestedLocation) {
    const approved = await approvedWorldLocationForLabel("spa", requestedLocation);
    if (approved) {
      const query = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (key === "location" || value === undefined) return;
        if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
        else query.set(key, value);
      });
      permanentRedirect(`${approved.path}${query.size ? `?${query}` : ""}`);
    }
  }
  const page = await publishedSearchPage("/spas");
  const { translate } = await serverPublicCopy();
  const spaPlaces = spaPlacesFromSites(await bundledPublicCatalogSummaries<SpaPlusSite>("spa"));
  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "בתי ספא", path: "/spas/" },
    ])} />
    <StructuredData data={collectionSchema(page?.title || "בתי ספא בישראל", page?.description || "בתי ספא וחבילות לפי אזור וסוג החוויה.", "/spas", spaPlaces.map((place) => ({ name: place.name, path: `/discover/place/${place.id}`, image: place.image })))} />
    <WorldLanding world="spa" title={translate(page?.title || "בתי ספא בישראל")} description={translate(page?.description || "בוחרים אזור, תאריך וסוג חוויה ומוצאים את הספא שמתאים לכם.")} items={spaPlaces} searchMode="spa" beforeResults={<SpaPackageDeals sectionId="spa-world-package-deals" />} />
  </>;
}
