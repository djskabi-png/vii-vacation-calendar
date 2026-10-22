import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "./client-page";
import { eventPlaceHref, type EventPlace } from "../../data/site-data";
import { supplierDisplayDescription } from "../../data/supplier-display-text";
import { publicCatalogDetail, publicCatalogSummaries } from "../../lib/public-catalog-read.ts";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../lib/seo";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../../data/supplier-legacy-links";
import { liveSupplierPlaceDetail, type SupplierPlaceDetail } from "../../data/supplier-place-detail";
import { eventBreadcrumbForLocation } from "../../data/world-search-landings";

type Props = { searchParams: Promise<{ id?: string }> };

async function resolvePlace(id?: string) {
  const mappedSlug = supplierLegacySlug(id, "events");
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  if (mappedSlug) redirect(`${prefix}/events/place/${mappedSlug}`);
  const unavailable = unavailableLegacySearchHref(id, "events");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const places = (await publicCatalogSummaries<EventPlace>("events"))
    .map((item) => ({ ...item, description: supplierDisplayDescription(item) }));
  const place = id ? places.find((item) => item.slug === id) : undefined;
  if (!place) notFound();
  return { place, places };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { place } = await resolvePlace((await searchParams).id);
  return {
    title: place.name,
    description: place.description,
    alternates: { canonical: eventPlaceHref(place) },
    openGraph: { type: "website", url: eventPlaceHref(place), title: place.name, description: place.description, images: [{ url: place.image, alt: place.name }] },
    twitter: { card: "summary_large_image", title: place.name, description: place.description, images: [place.image] },
  };
}

export default async function Page({ searchParams }: Props) {
  const { place, places } = await resolvePlace((await searchParams).id);
  if (place.sourcePropertySlug) redirect(eventPlaceHref(place));
  const supplierId = /^event-(\d+)$/.exec(place.slug)?.[1];
  const acceptedDetail = supplierId ? await publicCatalogDetail<SupplierPlaceDetail>("events", Number(supplierId)) : null;
  const supplierDetail = await liveSupplierPlaceDetail(place.slug, { fallback: acceptedDetail, listing: place });
  return <>
    <StructuredData data={eventVenueSchema(place)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      eventBreadcrumbForLocation(place.area, place.location),
      { name: place.name, path: eventPlaceHref(place) },
    ])} />
    <EventPlacePage initialSlug={place.slug} initialPlace={place} relatedPlaces={places} supplierDetail={supplierDetail} />
  </>;
}
