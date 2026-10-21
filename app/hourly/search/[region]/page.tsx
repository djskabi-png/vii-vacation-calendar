import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HourlyLanding } from "../../page";
import { hourlySearchHref, searchLocationFromSlug } from "../../../data/world-search-landings";
import { publishedSearchPage } from "../../../lib/search-page-content.ts";

export const dynamic = "force-dynamic";

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
  const page = await publishedSearchPage(url);
  return {
    title: page?.title || title,
    description: page?.description || description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: page?.title || title, description: page?.description || description },
  };
}

export default async function HourlyRegionPage({ params }: PageProps) {
  const { region } = await params;
  const location = locationFor(region);
  if (!location) notFound();
  return <HourlyLanding initialLocation={location} />;
}
