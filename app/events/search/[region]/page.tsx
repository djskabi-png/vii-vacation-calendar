import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EventSearchPage from "../page";
import type { EventPlace } from "../../../data/site-data";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { matchesSearchLocation } from "../../../data/search-taxonomy";
import { eventSearchHref } from "../../../data/world-search-landings";
import { approvedWorldLocation } from "../../../lib/world-location-pages.ts";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../../../lib/seo";
import { publishedSearchPage } from "../../../lib/search-page-content.ts";
import { completePlaceSearchResults, nearbySearchRecommendations } from "../../../lib/nearby-recommendations.ts";
import { normalizeEventVenueType } from "../../../lib/event-search-taxonomy.ts";
import { eventCombinationHref, eventTypeSlugs } from "../../../data/world-search-landings.ts";
import { canonicalLegacyEventSearchPath } from '../../../lib/legacy-event-intent-index.ts';
import { headers } from 'next/headers';
import { localizedPath } from '../../../i18n/locale-routing.ts';

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ region: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region } = await params;
  const location = (await approvedWorldLocation("events", region))?.label;
  if (!location) return { robots: { index: false, follow: false } };
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

export default async function EventRegionPage({ params, searchParams }: PageProps) {
  const { region } = await params;
  const location = (await approvedWorldLocation("events", region))?.label;
  if (!location) notFound();
  const query = await searchParams;
  const rawType = typeof query?.type === "string" ? query.type : undefined;
  const canonicalType = normalizeEventVenueType(rawType || "");
  const intent = Object.fromEntries(['type', 'features', 'eventType', 'accessible', 'noise'].flatMap(key => typeof query?.[key] === 'string' ? [[key, query[key] as string]] : []));
  // The established region page is already a canonical, crawlable destination.
  // Only a real additional semantic filter can resolve to a legacy combination.
  const legacyTarget = Object.entries(intent).some(([, value]) => value && !['הכל', 'כל הארץ', '0'].includes(value))
    ? canonicalLegacyEventSearchPath({ location, ...intent }) : null;
  if (legacyTarget || rawType && eventTypeSlugs[canonicalType]) {
    const target = legacyTarget || eventCombinationHref(location, canonicalType);
    const preserved = new URLSearchParams();
    for (const [key, value] of Object.entries(query || {})) if (key !== "type" && !(legacyTarget && ['location', 'features', 'eventType', 'accessible', 'noise'].includes(key))) {
      if (Array.isArray(value)) value.forEach(item => preserved.append(key, item));
      else if (typeof value === 'string') preserved.set(key, value);
    }
    const suffix = preserved.toString();
    const locale = (await headers()).get('x-vii-locale') || 'he';
    redirect(localizedPath(suffix ? `${target}?${suffix}` : target, ['he', 'en', 'ru', 'fr'].includes(locale) ? locale as 'he' | 'en' | 'ru' | 'fr' : 'he'));
  }
  const places = await publicCatalogSummaries<EventPlace>("events");
  const matching = places.filter((place) => matchesSearchLocation(place, location));
  const represented = completePlaceSearchResults(matching, nearbySearchRecommendations(places, location, [], {
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
