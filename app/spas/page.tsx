import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { spaPlaces } from "../data/world-data";
import { StructuredData } from "../components/structured-data";
import { collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "בתי ספא וחבילות ספא",
  description: "משווים בין בתי ספא, חבילות וטיפולים לפי אזור, הרכב וסוג החוויה.",
  alternates: { canonical: "/spas" },
};

export default function SpasPage() {
  return <>
    <StructuredData data={collectionSchema("בתי ספא וחבילות ספא", "בתי ספא וחבילות לפי אזור וסוג החוויה.", "/spas", spaPlaces.map((place) => ({ name: place.name, path: `/discover/place?id=${place.id}`, image: place.image })))} />
    <WorldLanding world="spa" title="בתי ספא בישראל" description="בוחרים אזור, תאריך וסוג חוויה ומוצאים את הספא שמתאים לכם." items={spaPlaces} searchMode="spa" />
  </>;
}
