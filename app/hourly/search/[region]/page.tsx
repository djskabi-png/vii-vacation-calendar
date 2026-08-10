import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HourlyLanding } from "../../page";
import { hourlyPlaces } from "../../../data/world-data";
import { matchesSearchLocation } from "../../../data/search-taxonomy";
import { hourlySearchHref, searchLocationFromSlug } from "../../../data/world-search-landings";

type PageProps = { params: Promise<{ region: string }> };

function locationFor(region: string) {
  return searchLocationFromSlug("hourly", region);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region } = await params;
  const location = locationFor(region);
  if (!location) return {};
  const title = `חדרים לפי שעה ב${location}`;
  const description = `חדרים וסוויטות לשהייה קצרה ב${location}, עם סינון לפי מחיר ומאפייני המקום.`;
  const url = hourlySearchHref(location);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description },
  };
}

export default async function HourlyRegionPage({ params }: PageProps) {
  const { region } = await params;
  const location = locationFor(region);
  if (!location || !hourlyPlaces.some((place) => matchesSearchLocation(place, location))) notFound();
  return <HourlyLanding initialLocation={location} />;
}
