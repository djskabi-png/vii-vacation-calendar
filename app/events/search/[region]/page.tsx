import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventSearchPage from "../page";
import type { EventPlace } from "../../../data/site-data";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { matchesSearchLocation } from "../../../data/search-taxonomy";
import { eventSearchHref, searchLocationFromSlug } from "../../../data/world-search-landings";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../../../lib/seo";
import { publishedSearchPage } from "../../../lib/search-page-content.ts";
import { completeNearbyResults, nearbySearchRecommendations } from "../../../lib/nearby-recommendations.ts";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ region: string }> };

function locationFor(region: string) {
  return searchLocationFromSlug("events", region);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region } = await params;
  const location = locationFor(region);
  if (!location) return {};
  const title = `מקומות לאירועים ב${location}`;
  const description = `מקומות לאירועים ב${location}, עם תמונות, מתקנים ופנייה ישירה למקום.`;
  const url = eventSearchHref(location);
  const page = await publishedSearchPage(url);
  return {
    title: page?.title || title,
    description: page?.description || description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: page?.title || title, description: page?.description || description },
  };
}

export default async function EventRegionPage({ params }: PageProps) {
  const { region } = await params;
  const location = locationFor(region);
  if (!location) notFound();
  const places = await publicCatalogSummaries<EventPlace>("events");
  const matching = places.filter((place) => matchesSearchLocation(place, location));
  const represented = completeNearbyResults(matching, nearbySearchRecommendations(places, location, [], {
    key: (place) => place.slug,
    origin: { location, area: location },
  }), (place) => place.slug);
  const title = `מקומות לאירועים ב${location}`;
  const description = `מקומות לאירועים ב${location}, עם תמונות, מתקנים ופנייה ישירה למקום.`;
  const path = eventSearchHref(location);
  const page = await publishedSearchPage(path);
  const displayTitle = page?.title || title;
  const displayDescription = page?.description || description;
  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      { name: displayTitle, path },
    ])} />
    <StructuredData data={collectionSchema(displayTitle, displayDescription, path, represented.map((place) => ({ name: place.name, path: `/events/place/${place.slug}`, image: place.image })))} />
    <EventSearchPage initialArea={location} landingTitle={displayTitle} landingDescription={displayDescription} />
  </>;
}
