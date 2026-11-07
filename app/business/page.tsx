import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import BusinessPage, { BusinessComplementarySections } from "./client-page";
import { getListingOfferings, propertyFaq, type BusinessWorld, type Property } from "../data/site-data";
import { supplierDisplayDescription } from "../data/supplier-display-text";
import { bundledPublicCatalogSummaries, publicCatalogDetail, publicCatalogSelectedSummaries } from "../lib/public-catalog-read.ts";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, faqSchema, lodgingSchema } from "../lib/seo";
import { vacationBreadcrumbTrailForProperty } from "../data/vacation-landings";
import { eventBreadcrumbsForLocation, hourlyBreadcrumbsForLocation } from "../data/world-search-landings";
import { spaBreadcrumbsForLocation } from "../data/spa-search-landings";
import { ViewedItemBootstrap } from "../components/viewed-item-bootstrap";
import { currentPeriodOffer } from "../data/last-minute-deals";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../data/supplier-legacy-links";
import { supplierPlaceDetail, type SupplierPlaceDetail } from "../data/supplier-place-detail";
import { nearbyTrails, trails } from "../data/trail-data";
import { discoveryItems, spaPlacesFromSites } from "../data/world-data";
import type { SpaPlusSite } from "../data/spaplus";
import { managedTrails, managedDiscoveryItems } from "../lib/managed-public-content";
import { nearbyRecommendations } from "../lib/nearby-recommendations";
import { serverPublicCopy } from "../i18n/server-public-copy";
import { localizedPath } from "../i18n/locale-routing";

type QueryValue = string | string[] | undefined;
type BusinessParams = { id?: QueryValue; mode?: QueryValue; dates?: QueryValue; from?: QueryValue; till?: QueryValue; guests?: QueryValue; rooms?: QueryValue; adults?: QueryValue; children?: QueryValue; infants?: QueryValue; roomID?: QueryValue; price?: QueryValue; illustrative?: QueryValue; source?: QueryValue; period?: QueryValue };
type Props = { searchParams: Promise<BusinessParams> };

function queryValue(value: QueryValue) {
  return Array.isArray(value) ? value.at(-1) : value;
}

function normalizedParams(params: BusinessParams) {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, queryValue(value)])) as Record<keyof BusinessParams, string | undefined>;
}

const loadProperties = cache(async () => {
  const properties = await bundledPublicCatalogSummaries<Property>("vacations");
  return properties.map((item) => ({ ...item, description: supplierDisplayDescription(item) }));
});

const resolveProperty = cache(async (id?: string) => {
  const slug = supplierLegacySlug(id, "vacations") || id;
  const supplierId = /^vacation-(\d+)$/.exec(slug || "")?.[1];
  if (supplierId) {
    const [property] = await publicCatalogSelectedSummaries<Property>("vacations", [Number(supplierId)]);
    if (property) return { ...property, description: supplierDisplayDescription(property) };
    // An authoritative empty selection means the supplier was removed from
    // the accepted generation. Do not resurrect it from the immutable bundle.
    return undefined;
  }
  const properties = await loadProperties();
  return id ? properties.find((item) => item.slug === slug) : properties[0];
});

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const property = await resolveProperty(queryValue((await searchParams).id));
  if (!property) return { title: "המקום אינו זמין", robots: { index: false, follow: false } };
  const { language, translate } = await serverPublicCopy();
  const name = translate(property.name);
  const description = translate(property.description);
  const canonical = localizedPath(`/business?id=${property.slug}`, language);
  return {
    title: name,
    description,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, title: name, description, images: [{ url: property.image, alt: name }] },
    twitter: { card: "summary_large_image", title: name, description, images: [property.image] },
    robots: property.demoOperations?.fictional ? { index: false, follow: false } : undefined,
  };
}

async function BusinessComplementaryContent({ property }: { property: Property }) {
  const fallbackAttractions = discoveryItems.filter((item) => item.world === "activities");
  const [trailInventory, spaSites, attractions] = await Promise.all([
    managedTrails(trails).catch(() => trails),
    bundledPublicCatalogSummaries<SpaPlusSite>("spa").catch(() => [] as SpaPlusSite[]),
    managedDiscoveryItems(fallbackAttractions, "attractions").catch(() => fallbackAttractions),
  ]);
  const complementaryInventory = nearbyRecommendations([...spaPlacesFromSites(spaSites), ...attractions], property, { key: (item) => `${item.world}:${item.id}`, limit: 6 }).items;
  const localTrails = nearbyTrails(property.area, property.location, 6, { inventory: trailInventory, lat: property.lat, lng: property.lng });
  const providers = discoveryItems.filter((item) => item.world === "providers" && item.image);
  const providerInventory = [...providers.filter((item) => item.id === "masu-home-wellness"), ...providers.filter((item) => item.id !== "masu-home-wellness")].slice(0, 6);
  return <BusinessComplementarySections property={{ name: property.name, area: property.area, location: property.location, lat: property.lat, lng: property.lng }} trailInventory={localTrails} complementaryInventory={complementaryInventory} providerInventory={providerInventory} />;
}

export default async function Page({ searchParams }: Props) {
  const params = normalizedParams(await searchParams);
  const mappedSlug = supplierLegacySlug(params.id, "vacations");
  if (mappedSlug) {
    const query = new URLSearchParams({ id: mappedSlug });
    for (const key of ["from", "till", "guests", "roomID"] as const) if (params[key]) query.set(key, params[key]!);
    const locale = (await headers()).get("x-vii-locale");
    redirect(`${locale && locale !== "he" ? `/${locale}` : ""}/business?${query}`);
  }
  const unavailable = unavailableLegacySearchHref(params.id, "vacations");
  if (unavailable) {
    const url = new URL(unavailable, "https://vii.spaplus.co");
    for (const key of ["from", "till", "guests", "roomID"] as const) if (params[key]) url.searchParams.set(key, params[key]!);
    const locale = (await headers()).get("x-vii-locale");
    redirect(`${locale && locale !== "he" ? `/${locale}` : ""}${url.pathname}${url.search}`);
  }
  const supplierId = /^vacation-(\d+)$/.exec(params.id || "")?.[1];
  const [property, properties, acceptedDetail] = await Promise.all([
    resolveProperty(params.id),
    loadProperties(),
    supplierId ? publicCatalogDetail<SupplierPlaceDetail>("vacations", Number(supplierId)) : null,
  ]);
  if (!property) notFound();
  // Public pages render from the accepted platform snapshot. Supplier refreshes
  // belong to the ingestion pipeline and must never sit on the visitor's
  // critical path or turn a slow upstream API into a slow business page.
  const agreementDetail = supplierPlaceDetail(property.slug);
  const supplierDetail = acceptedDetail
    ? { ...acceptedDetail, policy: { ...acceptedDetail.policy, ...(agreementDetail?.policy.cancellationTerms ? { cancellationTerms: agreementDetail.policy.cancellationTerms } : {}) } }
    : agreementDetail;
  const relatedProperties = nearbyRecommendations(properties, property, { key: (item) => item.slug, exclude: property.slug, limit: 3 }).items;
  // The accepted detail already owns the full galleries, room data and features.
  // Avoid serializing the same large media arrays twice into the business-page RSC payload.
  const initialProperty = supplierDetail ? { ...property, images: property.images.slice(0, 1), galleryGroups: undefined, roomOptions: undefined, featureGroups: undefined } : property;
  const currentOffer = property.capacityScope === "unit" ? undefined : currentPeriodOffer(property.slug, params.period);
  const selectedDatesHaveLivePrice = Boolean(params.from && params.till && Number(params.price) > 0);
  const resolvedPropertyFaq = propertyFaq.map((item, index) => index === 0 && selectedDatesHaveLivePrice
    ? { question: item.question, answer: "הזמינות והמחיר נבדקו לתאריכים ולהרכב שבחרתם, אך המקום אינו נשמר עד להשלמת ההזמנה וקבלת האישור שמוצג בסיום התהליך." }
    : item);
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
  const vacationTrail = vacationBreadcrumbTrailForProperty(property, properties);
  const hierarchy = primaryWorld === "events"
    ? [{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, ...eventBreadcrumbsForLocation(property.area, property.location)]
    : primaryWorld === "spa"
      ? [{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, ...spaBreadcrumbsForLocation(property.area, property.location)]
      : primaryWorld === "hourly"
        ? [{ name: "ראשי", path: "/" }, { name: "חדרים לפי שעה", path: "/hourly" }, ...hourlyBreadcrumbsForLocation(property.area, property.location)]
        : [...vacationTrail, { name: property.name, path: `/business?id=${property.slug}` }];
  return <>
    <ViewedItemBootstrap id={property.slug} world={initialWorld} name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={`/business?id=${property.slug}${initialWorld === primaryWorld ? "" : `&mode=${initialWorld}`}`} meta={property.guests > 0 ? `${property.type} · עד ${property.guests} אורחים${property.capacityScope === "unit" ? " ביחידה הגדולה" : ""}` : property.type} />
    {!property.demoOperations?.fictional ? <StructuredData data={lodgingSchema(property)} /> : null}
    <StructuredData data={breadcrumbSchema([
      ...hierarchy,
      { name: property.name, path: `/business?id=${property.slug}` },
    ])} />
    <StructuredData data={faqSchema(resolvedPropertyFaq)} />
    <BusinessPage initialSlug={property.slug} initialProperty={initialProperty} relatedProperties={relatedProperties} complementaryContent={<Suspense fallback={<section className="section property-complements" aria-busy="true" />}><BusinessComplementaryContent property={property} /></Suspense>} faqItems={resolvedPropertyFaq} supplierDetail={supplierDetail} initialWorld={initialWorld} initialDates={params.dates} initialFrom={params.from} initialTill={params.till} initialGuests={params.guests} initialRooms={params.rooms} initialChildren={params.children} initialInfants={params.infants} initialRoomID={params.roomID} initialPrice={params.price} initialIllustrative={params.illustrative === "1"} initialSource={params.source} initialPeriod={params.period} />
  </>;
}
