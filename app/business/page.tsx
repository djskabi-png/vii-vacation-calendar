import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BusinessPage from "./client-page";
import { getListingOfferings, properties, propertyFaq, type BusinessWorld } from "../data/site-data";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, faqSchema, lodgingSchema } from "../lib/seo";

type Props = { searchParams: Promise<{ id?: string; mode?: string }> };

function resolveProperty(id?: string) {
  if (!id) return properties[0];
  return properties.find((item) => item.slug === id);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const property = resolveProperty((await searchParams).id);
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
  const params = await searchParams;
  const property = resolveProperty(params.id);
  if (!property) notFound();
  const requestedWorld = params.mode as BusinessWorld | undefined;
  const initialWorld: BusinessWorld = getListingOfferings(property).some((offering) => offering.world === requestedWorld)
    ? requestedWorld as BusinessWorld
    : getListingOfferings(property)[0].world;
  return <>
    <StructuredData data={lodgingSchema(property)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: property.area, path: `/search?location=${encodeURIComponent(property.area)}` },
      { name: property.name, path: `/business?id=${property.slug}` },
    ])} />
    <StructuredData data={faqSchema(propertyFaq)} />
    <BusinessPage initialSlug={property.slug} initialWorld={initialWorld} />
  </>;
}
