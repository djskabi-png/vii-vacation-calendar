import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "../client-page";
import { eventPlaceHref, type EventPlace } from "../../../data/site-data";
import { publicCatalogDetail, publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../../lib/seo";
import { ViewedItemBootstrap } from "../../../components/viewed-item-bootstrap";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../../../data/supplier-legacy-links";
import { liveSupplierPlaceDetail, type SupplierPlaceDetail } from "../../../data/supplier-place-detail";
import { validDate } from "../../../lib/vii-live-search";
import { eventBreadcrumbForLocation } from "../../../data/world-search-landings";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; guests?: string }> };

async function resolvePlace(id: string) {
  const mappedSlug = supplierLegacySlug(id, "events");
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  if (mappedSlug) redirect(`${prefix}/events/place/${mappedSlug}`);
  const unavailable = unavailableLegacySearchHref(id, "events");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const place = (await publicCatalogSummaries<EventPlace>("events")).find((item) => item.slug === id);
  if (!place) notFound();
  return place;
}

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
  const place = await resolvePlace((await params).id);
  const selection = await searchParams;
  const datedEvent = validDate(selection.from) && /^\d+$/.test(selection.guests || "")
    && Number(selection.guests) > 0 && Number(selection.guests) <= 1000;
  // Preserve the existing canonical business redirect for undated visits.
  // Dated event visits must recheck the event supplier, not a vacation quote.
  if (place.sourcePropertySlug && !datedEvent) redirect(eventPlaceHref(place));
  const places = await publicCatalogSummaries<EventPlace>("events");
  const supplierId = /^event-(\d+)$/.exec(place.slug)?.[1];
  const acceptedDetail = supplierId ? await publicCatalogDetail<SupplierPlaceDetail>("events", Number(supplierId)) : null;
  return <>
    <ViewedItemBootstrap id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים${place.capacityScope === "unit" ? " ביחידה הגדולה" : ""}`} />
    <StructuredData data={eventVenueSchema(place)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      eventBreadcrumbForLocation(place.area, place.location),
      { name: place.name, path: eventPlaceHref(place) },
    ])} />
    <EventPlacePage initialSlug={place.slug} initialPlace={place} relatedPlaces={places}
      supplierDetail={await liveSupplierPlaceDetail(place.slug, { fallback: acceptedDetail, listing: place })} />
  </>;
}
