import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { hourlyPlaces } from "../data/world-data";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "חדרים לפי שעה",
  description: "חדרים וסוויטות לשהייה קצרה לפי אזור, מחיר וסוג האירוח.",
  alternates: { canonical: "/hourly" },
  openGraph: {
    type: "website",
    url: "/hourly/",
    title: "חדרים לפי שעה בישראל",
    description: "בוחרים אזור ומחייגים ישירות למקום, בלי להזמין לילה שלם.",
  },
};

export default function HourlyPage() {
  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "חדרים לפי שעה", path: "/hourly/" },
    ])} />
    <StructuredData data={collectionSchema("חדרים לפי שעה", "חדרים וסוויטות לשהייה קצרה לפי אזור וסוג האירוח.", "/hourly", hourlyPlaces.map((place) => ({ name: place.name, path: `/discover/place?id=${place.id}`, image: place.image })))} />
    <WorldLanding world="hourly" title="חדרים לפי שעה" description="בוחרים אזור ומחייגים ישירות למקום, בלי להזמין לילה שלם." items={hourlyPlaces} searchMode="hourly" />
  </>;
}
