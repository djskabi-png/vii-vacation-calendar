import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { hourlyPlacesFromCatalog } from "../data/world-data";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import hourlyCatalog from "../data/sergey-hourly-catalog.json";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { matchesSearchLocation } from "../data/search-taxonomy";
import { hourlySearchHref } from "../data/world-search-landings";
import { publishedSearchPage } from "../lib/search-page-content.ts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await publishedSearchPage("/hourly");
  return { title: page?.title, description: page?.description, alternates: { canonical: "/hourly" }, openGraph: { type: "website", url: "/hourly", title: page?.title, description: page?.description } };
}

export async function HourlyLanding({ initialLocation }: { initialLocation?: string }) {
  const hourlyPlaces = hourlyPlacesFromCatalog(await publicCatalogSummaries<(typeof hourlyCatalog.places)[number]>("rooms"));
  const title = initialLocation ? `חדרים לפי שעה ב${initialLocation}` : "חדרים לפי שעה";
  const description = initialLocation
    ? `חדרים וסוויטות לשהייה קצרה ב${initialLocation}, עם סינון לפי מחיר ומאפייני המקום.`
    : "בוחרים אזור ומחייגים ישירות למקום, בלי להזמין לילה שלם.";
  const path = hourlySearchHref(initialLocation);
  const page = await publishedSearchPage(path);
  const displayTitle = page?.title || title;
  const displayDescription = page?.description || description;
  const matchingItems = initialLocation
    ? hourlyPlaces.filter((place) => matchesSearchLocation(place, initialLocation))
    : hourlyPlaces;

  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "חדרים לפי שעה", path: "/hourly/" },
      ...(initialLocation ? [{ name: displayTitle, path }] : []),
    ])} />
    <StructuredData data={collectionSchema(displayTitle, displayDescription, path, matchingItems.map((place) => ({ name: place.name, path: `/discover/place/${place.id}`, image: place.image })))} />
    <WorldLanding
      world="hourly"
      title={displayTitle}
      description={displayDescription}
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

