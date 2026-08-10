import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventSearchPage from "../page";
import { eventPlaces } from "../../../data/site-data";
import { matchesSearchLocation } from "../../../data/search-taxonomy";
import { eventSearchHref, searchLocationFromSlug } from "../../../data/world-search-landings";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../../../lib/seo";

type PageProps = { params: Promise<{ region: string }> };

function locationFor(region: string) {
  return searchLocationFromSlug("events", region);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region } = await params;
  const location = locationFor(region);
  if (!location) return {};
  const title = `מקומות לאירועים ב${location}`;
  const description = `מקומות לאירועים ב${location}, עם סינון לפי סוג המקום, סוג האירוע וכמות המשתתפים.`;
  const url = eventSearchHref(location);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description },
  };
}

export default async function EventRegionPage({ params }: PageProps) {
  const { region } = await params;
  const location = locationFor(region);
  if (!location) notFound();
  const matching = eventPlaces.filter((place) => matchesSearchLocation(place, location));
  if (!matching.length) notFound();
  const title = `מקומות לאירועים ב${location}`;
  const description = `מקומות לאירועים ב${location}, עם סינון לפי סוג המקום, סוג האירוע וכמות המשתתפים.`;
  const path = eventSearchHref(location);
  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      { name: title, path },
    ])} />
    <StructuredData data={collectionSchema(title, description, path, matching.map((place) => ({ name: place.name, path: `/events/place/${place.slug}`, image: place.image })))} />
    <EventSearchPage initialArea={location} />
  </>;
}
