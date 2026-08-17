import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { hourlyPlaces } from "../data/world-data";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { matchesSearchLocation } from "../data/search-taxonomy";
import { hourlySearchHref } from "../data/world-search-landings";

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

export function HourlyLanding({ initialLocation }: { initialLocation?: string }) {
  const title = initialLocation ? `חדרים לפי שעה ב${initialLocation}` : "חדרים לפי שעה";
  const description = initialLocation
    ? `חדרים וסוויטות לשהייה קצרה ב${initialLocation}, עם סינון לפי מחיר ומאפייני המקום.`
    : "בוחרים אזור ומחייגים ישירות למקום, בלי להזמין לילה שלם.";
  const path = hourlySearchHref(initialLocation);
  const matchingItems = initialLocation
    ? hourlyPlaces.filter((place) => matchesSearchLocation(place, initialLocation))
    : hourlyPlaces;

  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "חדרים לפי שעה", path: "/hourly/" },
      ...(initialLocation ? [{ name: title, path }] : []),
    ])} />
    <StructuredData data={collectionSchema(title, description, path, matchingItems.map((place) => ({ name: place.name, path: `/discover/place/${place.id}`, image: place.image })))} />
    <WorldLanding
      world="hourly"
      title={title}
      description={description}
      items={hourlyPlaces}
      searchMode="hourly"
      initialSearchLocation={initialLocation}
      collectionTitle={initialLocation ? `חדרים וסוויטות לפי שעה ב${initialLocation}` : "חדרים וסוויטות לפי שעה בישראל"}
    />
  </>;
}

export default function HourlyPage() {
  return <HourlyLanding />;
}
