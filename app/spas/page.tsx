import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { spaPlacesFromSites } from "../data/world-data";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import type { SpaPlusSite } from "../data/spaplus";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "בתי ספא וחבילות ספא",
  description: "משווים בין בתי ספא, חבילות וטיפולים לפי אזור, הרכב וסוג החוויה.",
  alternates: { canonical: "/spas" },
  openGraph: {
    type: "website",
    url: "/spas/",
    title: "בתי ספא בישראל",
    description: "בוחרים אזור, תאריך וסוג חוויה ומוצאים את הספא שמתאים לכם.",
  },
};

export default async function SpasPage() {
  const spaPlaces = spaPlacesFromSites(await publicCatalogSummaries<SpaPlusSite>("spa"));
  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "בתי ספא", path: "/spas/" },
    ])} />
    <StructuredData data={collectionSchema("בתי ספא וחבילות ספא", "בתי ספא וחבילות לפי אזור וסוג החוויה.", "/spas", spaPlaces.map((place) => ({ name: place.name, path: `/discover/place/${place.id}`, image: place.image })))} />
    <WorldLanding world="spa" title="בתי ספא בישראל" description="בוחרים אזור, תאריך וסוג חוויה ומוצאים את הספא שמתאים לכם." items={spaPlaces} searchMode="spa" />
  </>;
}
