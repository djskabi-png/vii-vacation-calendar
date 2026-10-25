import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "./client-page";
import { eventPlaceHref, type EventPlace } from "../../data/site-data";
import { supplierDisplayDescription } from "../../data/supplier-display-text";
import { publicCatalogDetail, publicCatalogSelectedSummaries, publicCatalogSummaries } from "../../lib/public-catalog-read.ts";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../lib/seo";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../../data/supplier-legacy-links";
import type { SupplierPlaceDetail } from "../../data/supplier-place-detail";
import { eventBreadcrumbsForLocation } from "../../data/world-search-landings";
import { providerProfiles } from "../../data/world-data";
import { nearbyRecommendations } from "../../lib/nearby-recommendations";
import { serverLocalePath, serverPublicCopy } from "../../i18n/server-public-copy";
import { localizedEventPlace } from "../../i18n/localized-event-place";

type Props = { searchParams: Promise<{ id?: string }> };

const loadPlaces = cache(async () => (await publicCatalogSummaries<EventPlace>("events"))
  .map((item) => ({ ...item, description: supplierDisplayDescription(item) })));

const resolvePlace = cache(async (id?: string) => {
  const mappedSlug = supplierLegacySlug(id, "events");
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  if (mappedSlug) redirect(`${prefix}/events/place/${mappedSlug}`);
  const unavailable = unavailableLegacySearchHref(id, "events");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const supplierId = /^event-(\d+)$/.exec(id || "")?.[1];
  const [selected] = supplierId
    ? await publicCatalogSelectedSummaries<EventPlace>("events", [Number(supplierId)])
    : [];
  const place = selected ? { ...selected, description: supplierDisplayDescription(selected) }
    : id ? (await loadPlaces()).find((item) => item.slug === id) : undefined;
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
  const [place, places, acceptedDetail] = await Promise.all([
    resolvePlace(id),
    loadPlaces(),
    supplierId ? publicCatalogDetail<SupplierPlaceDetail>("events", Number(supplierId)) : null,
  ]);
  if (place.sourcePropertySlug) redirect(eventPlaceHref(place));
  const supplierDetail = acceptedDetail || undefined;
  const relatedPlaces = nearbyRecommendations(places, place, { key: (entry) => entry.slug, exclude: place.slug, limit: 3 }).items;
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
    <EventPlacePage initialSlug={place.slug} initialPlace={place} relatedPlaces={relatedPlaces} providerInventory={providerProfiles} supplierDetail={supplierDetail} />
  </>;
}
