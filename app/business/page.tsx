import type { Metadata } from "next";
import BusinessPage from "./client-page";
import { properties } from "../data/site-data";

type Props = { searchParams: Promise<{ id?: string }> };

function resolveProperty(id?: string) {
  return properties.find((item) => item.slug === id) || properties[0];
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const property = resolveProperty((await searchParams).id);
  return {
    title: property.name,
    description: property.description,
    alternates: { canonical: `/business/?id=${property.slug}` },
    openGraph: { title: property.name, description: property.description, images: [{ url: property.image }] },
  };
}

export default async function Page({ searchParams }: Props) {
  const property = resolveProperty((await searchParams).id);
  return <BusinessPage initialSlug={property.slug} />;
}
