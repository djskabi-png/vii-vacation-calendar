import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "../client-page";
import { eventPlaceHref, type EventPlace } from "../../../data/site-data";
import { publicCatalogDetail, publicCatalogSelectedSummaries, publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../../lib/seo";
import { ViewedItemBootstrap } from "../../../components/viewed-item-bootstrap";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../../../data/supplier-legacy-links";
import type { SupplierPlaceDetail } from "../../../data/supplier-place-detail";
import { validDate } from "../../../lib/vii-live-search";
import { eventBreadcrumbsForLocation } from "../../../data/world-search-landings";
import { providerProfiles } from "../../../data/world-data";
import { nearbyRecommendations } from "../../../lib/nearby-recommendations";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; guests?: string }> };

const loadPlaces = cache(async () => publicCatalogSummaries<EventPlace>("events"));

const resolvePlace = cache(async (id: string) => {
  const mappedSlug = supplierLegacySlug(id, "events");
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  if (mappedSlug) redirect(`${prefix}/events/place/${mappedSlug}`);
  const unavailable = unavailableLegacySearchHref(id, "events");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const supplierId = /^event-(\d+)$/.exec(id)?.[1];
  const [selected] = supplierId
    ? await publicCatalogSelectedSummaries<EventPlace>("events", [Number(supplierId)])
    : [];
  const place = selected || (await loadPlaces()).find((item) => item.slug === id);
  if (!place) notFound();
  return place;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await resolvePlace((await params).id);
  return {
    title: place.name,
    description: place.description,
    alternates: { canonical: eventPlaceHref(place) },
    openGraph: { type: "website", url: eventPlaceHref(place), title: place.name, description: place.description, images: [{ url: place.image, alt: place.name }] },
    twitter: { card: "summary_large_image", title: place.name, description: place.description, images: [place.image] },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const id = (await params).id;
  const supplierId = /^event-(\d+)$/.exec(id)?.[1];
  const [place, places, acceptedDetail] = await Promise.all([
    resolvePlace(id),
    loadPlaces(),
    supplierId ? publicCatalogDetail<SupplierPlaceDetail>("events", Number(supplierId)) : null,
  ]);
  const selection = await searchParams;
  const datedEvent = validDate(selection.from) && /^\d+$/.test(selection.guests || "")
    && Number(selection.guests) > 0 && Number(selection.guests) <= 1000;
  // Preserve the existing canonical business redirect for undated visits.
  // Dated event visits must recheck the event supplier, not a vacation quote.
  if (place.sourcePropertySlug && !datedEvent) redirect(eventPlaceHref(place));
  const relatedPlaces = nearbyRecommendations(places, place, { key: (entry) => entry.slug, exclude: place.slug, limit: 3 }).items;
  return <>
    <ViewedItemBootstrap id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים${place.capacityScope === "unit" ? " ביחידה הגדולה" : ""}`} />
    <StructuredData data={eventVenueSchema(place)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      ...eventBreadcrumbsForLocation(place.area, place.location),
      { name: place.name, path: eventPlaceHref(place) },
    ])} />
    <EventPlacePage initialSlug={place.slug} initialPlace={place} relatedPlaces={relatedPlaces} providerInventory={providerProfiles}
      supplierDetail={acceptedDetail || undefined} />
  </>;
}
