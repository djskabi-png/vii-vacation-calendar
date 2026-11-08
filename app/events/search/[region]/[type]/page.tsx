import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import EventSearchPage from "../../page";
import { approvedWorldLocation } from "../../../../lib/world-location-pages.ts";
import { normalizeEventVenueType, eventVenueTypeOrder } from "../../../../lib/event-search-taxonomy.ts";
import { eventCombinationHref } from "../../../../data/world-search-landings.ts";
import { publicCatalogSummaries } from '../../../../lib/public-catalog-read.ts';
import { PublishedCatalogSeed } from '../../../../lib/published-catalog-seed';
import type { EventPlace } from '../../../../data/site-data';
import { publishedSearchPage } from '../../../../lib/search-page-content.ts';
import { canonicalLegacyEventSearchPath } from '../../../../lib/legacy-event-intent-index.ts';
import { matchesEventVenueType, matchesEventSearchLocation } from '../../../../lib/event-search-taxonomy.ts';
import { headers } from 'next/headers';
import { localizedPath } from '../../../../i18n/locale-routing.ts';

type Props = { params: Promise<{ region: string; type: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
const slugs: Record<string, string> = { lofts: "לופטים", villas: "וילות", "event-complexes": "מתחמי אירועים", "hospitality-complexes": "מתחמי אירוח", "summer-complexes": "מתחמי קיץ", "karaoke-rooms": "חדרי קריוקי" };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, type } = await params; const location = region === 'israel' ? 'כל הארץ' : (await approvedWorldLocation("events", region))?.label; const venue = slugs[type];
  if (!location || !venue || !eventVenueTypeOrder.includes(venue as never)) return { robots: { index: false, follow: false } };
  const hasInventory = (await publicCatalogSummaries<EventPlace>('events')).some(place => matchesEventSearchLocation(place, location) && matchesEventVenueType(place, venue));
  const canonical = canonicalLegacyEventSearchPath({ location, type: venue }) || eventCombinationHref(location, venue); const title = `${venue} לאירועים ב${location}`; return { title, description: `${title}, עם תמונות, מתקנים ופנייה ישירה למקום.`, ...(!hasInventory ? { robots: { index: false, follow: true } } : {}), alternates: { canonical }, openGraph: { type: "website", url: canonical, title, description: `${title}, עם תמונות, מתקנים ופנייה ישירה למקום.` } };
}
export default async function EventCombinationPage({ params, searchParams }: Props) {
  const { region, type } = await params; const location = region === 'israel' ? 'כל הארץ' : (await approvedWorldLocation("events", region))?.label; const venue = slugs[type];
  if (!location || !venue || normalizeEventVenueType(venue) === "הכל") notFound();
  const legacyPath = canonicalLegacyEventSearchPath({ location, type: venue });
  if (legacyPath) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams || {})) {
      if (Array.isArray(value)) value.forEach(item => query.append(key, item));
      else if (value !== undefined) query.set(key, value);
    }
    const locale = (await headers()).get('x-vii-locale') || 'he';
    permanentRedirect(localizedPath(legacyPath + (query.size ? `?${query}` : ''), ['he', 'en', 'ru', 'fr'].includes(locale) ? locale as 'he' | 'en' | 'ru' | 'fr' : 'he'));
  }
  const path = eventCombinationHref(location, venue);
  const [places, editorial] = await Promise.all([publicCatalogSummaries<EventPlace>('events'), publishedSearchPage(path)]);
  return <PublishedCatalogSeed world="events" entries={places} complete={true}><EventSearchPage initialArea={location} initialSearchParams={{ location: location === 'כל הארץ' ? 'הכל' : location, type: normalizeEventVenueType(venue) }} managedPath={path} landingTitle={editorial?.title} landingDescription={editorial?.description} /></PublishedCatalogSeed>;
}
