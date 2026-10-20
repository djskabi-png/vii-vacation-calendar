import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import BusinessPage from "./client-page";
import { getListingOfferings, propertyFaq, type BusinessWorld, type Property } from "../data/site-data";
import { supplierDisplayDescription } from "../data/supplier-display-text";
import { publicCatalogDetail, publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, faqSchema, lodgingSchema } from "../lib/seo";
import { vacationBreadcrumbForLocation } from "../data/vacation-landings";
import { ViewedItemBootstrap } from "../components/viewed-item-bootstrap";
import { currentPeriodOffer } from "../data/last-minute-deals";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../data/supplier-legacy-links";
import { liveSupplierPlaceDetail, type SupplierPlaceDetail } from "../data/supplier-place-detail";
import { trails } from "../data/trail-data";
import { discoveryItems, spaPlacesFromSites } from "../data/world-data";
import type { SpaPlusSite } from "../data/spaplus";
import { managedTrails, managedDiscoveryItems } from "../lib/managed-public-content";
import { nearbyRecommendations } from "../lib/nearby-recommendations";
import { serverPublicCopy } from "../i18n/server-public-copy";

type QueryValue = string | string[] | undefined;
type BusinessParams = { id?: QueryValue; mode?: QueryValue; dates?: QueryValue; from?: QueryValue; till?: QueryValue; guests?: QueryValue; rooms?: QueryValue; adults?: QueryValue; children?: QueryValue; infants?: QueryValue; price?: QueryValue; illustrative?: QueryValue; source?: QueryValue; period?: QueryValue };
type Props = { searchParams: Promise<BusinessParams> };

function queryValue(value: QueryValue) {
  return Array.isArray(value) ? value.at(-1) : value;
}

function normalizedParams(params: BusinessParams) {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, queryValue(value)])) as Record<keyof BusinessParams, string | undefined>;
}

async function resolveProperty(id?: string) {
  const properties = (await publicCatalogSummaries<Property>("vacations"))
    .map((item) => ({ ...item, description: supplierDisplayDescription(item) }));
  const property = id ? properties.find((item) => item.slug === (supplierLegacySlug(id, "vacations") || id)) : properties[0];
  return { property, properties };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { property } = await resolveProperty(queryValue((await searchParams).id));
  if (!property) return { title: "המקום אינו זמין", robots: { index: false, follow: false } };
  const { translate } = await serverPublicCopy();
  const name = translate(property.name);
  const description = translate(property.description);
  return {
    title: name,
    description,
    alternates: { canonical: `/business?id=${property.slug}` },
    openGraph: { type: "website", url: `/business?id=${property.slug}`, title: name, description, images: [{ url: property.image, alt: name }] },
    twitter: { card: "summary_large_image", title: name, description, images: [property.image] },
    robots: property.demoOperations?.fictional ? { index: false, follow: false } : undefined,
  };
}

export default async function Page({ searchParams }: Props) {
  const params = normalizedParams(await searchParams);
  const mappedSlug = supplierLegacySlug(params.id, "vacations");
  if (mappedSlug) {
    const query = new URLSearchParams({ id: mappedSlug });
    for (const key of ["from", "till", "guests"] as const) if (params[key]) query.set(key, params[key]!);
    const locale = (await headers()).get("x-vii-locale");
    redirect(`${locale && locale !== "he" ? `/${locale}` : ""}/business?${query}`);
  }
  const unavailable = unavailableLegacySearchHref(params.id, "vacations");
  if (unavailable) {
    const url = new URL(unavailable, "https://vii.spaplus.co");
    for (const key of ["from", "till", "guests"] as const) if (params[key]) url.searchParams.set(key, params[key]!);
    const locale = (await headers()).get("x-vii-locale");
    redirect(`${locale && locale !== "he" ? `/${locale}` : ""}${url.pathname}${url.search}`);
  }
  const { property, properties } = await resolveProperty(params.id);
  if (!property) notFound();
  const recommendations = Promise.all([
    managedTrails(trails), publicCatalogSummaries<SpaPlusSite>("spa").catch(() => {
      console.warn("nearby_spa_catalog_unavailable");
      return [] as SpaPlusSite[];
    }),
    managedDiscoveryItems(discoveryItems.filter((item) => item.world === "activities"), "attractions"),
  ]);
  const supplierId = /^vacation-(\d+)$/.exec(property.slug)?.[1];
  const acceptedDetail = supplierId ? await publicCatalogDetail<SupplierPlaceDetail>("vacations", Number(supplierId)) : null;
  const supplierDetail = await liveSupplierPlaceDetail(property.slug, { fallback: acceptedDetail, listing: property });
  const [trailInventory, spaSites, attractions] = await recommendations;
  const complementaryInventory = [...spaPlacesFromSites(spaSites), ...attractions];
  const relatedProperties = nearbyRecommendations(properties, property, { key: (item) => item.slug, exclude: property.slug, limit: 3 }).items;
  const currentOffer = property.capacityScope === "unit" ? undefined : currentPeriodOffer(property.slug, params.period);
  if (currentOffer && (params.from !== currentOffer.from || params.till !== currentOffer.till || Number(params.price) !== currentOffer.nightlyPrice)) {
    const locale = (await headers()).get("x-vii-locale");
    const prefix = locale && locale !== "he" ? `/${locale}` : "";
    const canonical = new URLSearchParams({
      id: property.slug,
      period: params.period!,
      from: currentOffer.from,
      till: currentOffer.till,
      guests: String(Math.max(1, Number(params.guests) || 2)),
      price: String(currentOffer.nightlyPrice),
      source: params.source || "last-minute",
    });
    redirect(`${prefix}/business?${canonical.toString()}`);
  }
  const requestedWorld = params.mode as BusinessWorld | undefined;
  const initialWorld: BusinessWorld = getListingOfferings(property).some((offering) => offering.world === requestedWorld)
    ? requestedWorld as BusinessWorld
    : getListingOfferings(property)[0].world;
  const primaryWorld = getListingOfferings(property)[0].world;
  const vacationArea = vacationBreadcrumbForLocation(property.area);
  const hierarchy = primaryWorld === "events"
    ? [{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, { name: "מקומות לאירועים", path: "/events/search" }]
    : primaryWorld === "spa"
      ? [{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }]
      : primaryWorld === "hourly"
        ? [{ name: "ראשי", path: "/" }, { name: "חדרים לפי שעה", path: "/hourly" }]
        : [{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, vacationArea,
          ...(property.location && property.location !== property.area ? [{ name: `נופש ב${property.location}`, path: `/search?location=${encodeURIComponent(property.location)}` }] : [])];
  return <>
    <ViewedItemBootstrap id={property.slug} world={initialWorld} name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={`/business?id=${property.slug}${initialWorld === primaryWorld ? "" : `&mode=${initialWorld}`}`} meta={property.guests > 0 ? `${property.type} · עד ${property.guests} אורחים${property.capacityScope === "unit" ? " ביחידה הגדולה" : ""}` : property.type} />
    {!property.demoOperations?.fictional ? <StructuredData data={lodgingSchema(property)} /> : null}
    <StructuredData data={breadcrumbSchema([
      ...hierarchy,
      { name: property.name, path: `/business?id=${property.slug}` },
    ])} />
    <StructuredData data={faqSchema(propertyFaq)} />
    <BusinessPage initialSlug={property.slug} initialProperty={property} relatedProperties={relatedProperties} trailInventory={trailInventory} complementaryInventory={complementaryInventory} supplierDetail={supplierDetail} initialWorld={initialWorld} initialDates={params.dates} initialFrom={params.from} initialTill={params.till} initialGuests={params.guests} initialRooms={params.rooms} initialChildren={params.children} initialInfants={params.infants} initialPrice={params.price} initialIllustrative={params.illustrative === "1"} initialSource={params.source} initialPeriod={params.period} />
  </>;
}
