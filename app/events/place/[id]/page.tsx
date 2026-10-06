import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "../client-page";
import { eventPlaceHref, eventPlaces } from "../../../data/site-data";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../../lib/seo";
import { ViewedItemBootstrap } from "../../../components/viewed-item-bootstrap";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../../../data/supplier-legacy-links";
import { liveSupplierPlaceDetail } from "../../../data/supplier-place-detail";

type Props = { params: Promise<{ id: string }> };

async function resolvePlace(id: string) {
  const mappedSlug = supplierLegacySlug(id, "events");
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  if (mappedSlug) redirect(`${prefix}/events/place/${mappedSlug}`);
  const unavailable = unavailableLegacySearchHref(id, "events");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const place = eventPlaces.find((item) => item.slug === id);
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

export default async function Page({ params }: Props) {
  const place = await resolvePlace((await params).id);
  if (place.sourcePropertySlug) redirect(eventPlaceHref(place));
  return <>
    <ViewedItemBootstrap id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים${place.capacityScope === "unit" ? " ביחידה הגדולה" : ""}`} />
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
