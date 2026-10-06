import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "./client-page";
import { eventPlaceHref, eventPlaces } from "../../data/site-data";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../lib/seo";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../../data/supplier-legacy-links";
import { liveSupplierPlaceDetail } from "../../data/supplier-place-detail";

type Props = { searchParams: Promise<{ id?: string }> };

async function resolvePlace(id?: string) {
  const mappedSlug = supplierLegacySlug(id, "events");
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  if (mappedSlug) redirect(`${prefix}/events/place/${mappedSlug}`);
  const unavailable = unavailableLegacySearchHref(id, "events");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const place = id ? eventPlaces.find((item) => item.slug === id) : undefined;
  if (!place) notFound();
  return place;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const place = await resolvePlace((await searchParams).id);
  return {
    title: place.name,
    description: place.description,
    alternates: { canonical: eventPlaceHref(place) },
    openGraph: { type: "website", url: eventPlaceHref(place), title: place.name, description: place.description, images: [{ url: place.image, alt: place.name }] },
    twitter: { card: "summary_large_image", title: place.name, description: place.description, images: [place.image] },
  };
}

export default async function Page({ searchParams }: Props) {
  const place = await resolvePlace((await searchParams).id);
  if (place.sourcePropertySlug) redirect(eventPlaceHref(place));
  return <>
    <StructuredData data={eventVenueSchema(place)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      { name: "מקומות לאירועים", path: "/events/search/" },
      { name: place.name, path: eventPlaceHref(place) },
    ])} />
    <EventPlacePage initialSlug={place.slug} supplierDetail={await liveSupplierPlaceDetail(place.slug)} />
  </>;
}
