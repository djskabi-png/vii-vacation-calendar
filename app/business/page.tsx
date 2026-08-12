import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BusinessPage from "./client-page";
import { getListingOfferings, properties, propertyFaq, type BusinessWorld } from "../data/site-data";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, faqSchema, lodgingSchema } from "../lib/seo";
import { vacationBreadcrumbForLocation } from "../data/vacation-landings";

type QueryValue = string | string[] | undefined;
type BusinessParams = { id?: QueryValue; mode?: QueryValue; dates?: QueryValue; from?: QueryValue; till?: QueryValue; guests?: QueryValue; rooms?: QueryValue; price?: QueryValue; illustrative?: QueryValue; source?: QueryValue };
type Props = { searchParams: Promise<BusinessParams> };

function queryValue(value: QueryValue) {
  return Array.isArray(value) ? value.at(-1) : value;
}

function normalizedParams(params: BusinessParams) {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, queryValue(value)])) as Record<keyof BusinessParams, string | undefined>;
}

function resolveProperty(id?: string) {
  if (!id) return properties[0];
  return properties.find((item) => item.slug === id);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const property = resolveProperty(queryValue((await searchParams).id));
  if (!property) return { title: "המקום אינו זמין", robots: { index: false, follow: false } };
  return {
    title: property.name,
    description: property.description,
    alternates: { canonical: `/business?id=${property.slug}` },
    openGraph: { type: "website", url: `/business?id=${property.slug}`, title: property.name, description: property.description, images: [{ url: property.image, alt: property.name }] },
    twitter: { card: "summary_large_image", title: property.name, description: property.description, images: [property.image] },
  };
}

export default async function Page({ searchParams }: Props) {
  const params = normalizedParams(await searchParams);
  const property = resolveProperty(params.id);
  if (!property) notFound();
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
        : [{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, vacationArea];
  return <>
    <StructuredData data={lodgingSchema(property)} />
    <StructuredData data={breadcrumbSchema([
      ...hierarchy,
      { name: property.name, path: `/business?id=${property.slug}` },
    ])} />
    <StructuredData data={faqSchema(propertyFaq)} />
    <BusinessPage initialSlug={property.slug} initialWorld={initialWorld} initialDates={params.dates} initialFrom={params.from} initialTill={params.till} initialGuests={params.guests} initialRooms={params.rooms} initialPrice={params.price} initialIllustrative={params.illustrative === "1"} initialSource={params.source} />
  </>;
}
