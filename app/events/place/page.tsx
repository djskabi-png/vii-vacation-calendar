import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "./client-page";
import { EventRelatedSlot } from "./related-slot";
import { eventPlaceHref, eventPlaces as bundledEventPlaces, type EventPlace } from "../../data/site-data";
import { supplierDisplayDescription } from "../../data/supplier-display-text";
import { bundledPublicCatalogSelectedSummaries } from "../../lib/public-catalog-read.ts";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../lib/seo";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../../data/supplier-legacy-links";
import { eventBreadcrumbsForLocation } from "../../data/world-search-landings";
import { providerProfiles } from "../../data/world-data";
import { nearbyRecommendations } from "../../lib/nearby-recommendations";
import { serverLocalePath, serverPublicCopy } from "../../i18n/server-public-copy";
import { localizedEventPlace } from "../../i18n/localized-event-place";

type Props = { searchParams: Promise<{ id?: string }> };

const bundledPlaces = bundledEventPlaces
  .map((item) => ({ ...item, description: supplierDisplayDescription(item) }));

const resolvePlace = cache(async (id?: string) => {
  const mappedSlug = supplierLegacySlug(id, "events");
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  if (mappedSlug) redirect(`${prefix}/events/place/${mappedSlug}`);
  const unavailable = unavailableLegacySearchHref(id, "events");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const supplierId = /^event-(\d+)$/.exec(id || "")?.[1];
  const [selected] = supplierId
    ? await bundledPublicCatalogSelectedSummaries<EventPlace>("events", [Number(supplierId)])
    : [];
  const place = selected ? { ...selected, description: supplierDisplayDescription(selected) }
    : supplierId ? undefined : id ? bundledPlaces.find((item) => item.slug === id) : undefined;
  if (!place) notFound();
  return place;
});

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const place = await resolvePlace((await searchParams).id);
  const canonical = await serverLocalePath(eventPlaceHref(place));
  const { language, translate } = await serverPublicCopy();
  const localized = localizedEventPlace(place, language, translate);
  const title = localized.name;
  const description = localized.description;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description, images: [{ url: place.image, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [place.image] },
  };
}

export default async function Page({ searchParams }: Props) {
  const id = (await searchParams).id;
  const supplierId = /^event-(\d+)$/.exec(id || "")?.[1];
  const place = await resolvePlace(id);
  if (place.sourcePropertySlug) redirect(eventPlaceHref(place));
  const supplierDetailUrl = supplierId ? `/api/vii/place-detail?world=events&id=${supplierId}` : undefined;
  const relatedContent = <Suspense fallback={null}><EventRelatedContent place={place} /></Suspense>;
  const { language, translate } = await serverPublicCopy();
  const localized = localizedEventPlace(place, language, translate);
  return <>
    <StructuredData data={eventVenueSchema(localized)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      ...eventBreadcrumbsForLocation(place.area, place.location),
      { name: localized.name, path: eventPlaceHref(place) },
    ])} />
    <EventPlacePage initialSlug={place.slug} initialPlace={place} relatedContent={relatedContent} providerInventory={providerProfiles} supplierDetailUrl={supplierDetailUrl} />
  </>;
}

async function EventRelatedContent({ place }: { place: EventPlace }) {
  const places = bundledPlaces.map((entry) => entry.slug === place.slug ? place : entry);
  return <EventRelatedSlot place={place} places={places} />;
}
