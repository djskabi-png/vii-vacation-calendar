import type { Metadata } from "next";
import EventPlacePage from "./client-page";
import { eventPlaces } from "../../data/site-data";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../lib/seo";

type Props = { searchParams: Promise<{ id?: string }> };

function resolvePlace(id?: string) {
  return eventPlaces.find((item) => item.slug === id) || eventPlaces[0];
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const place = resolvePlace((await searchParams).id);
  return {
    title: place.name,
    description: place.description,
    alternates: { canonical: `/events/place?id=${place.slug}` },
    openGraph: { type: "website", url: `/events/place?id=${place.slug}`, title: place.name, description: place.description, images: [{ url: place.image, alt: place.name }] },
    twitter: { card: "summary_large_image", title: place.name, description: place.description, images: [place.image] },
  };
}

export default async function Page({ searchParams }: Props) {
  const place = resolvePlace((await searchParams).id);
  return <>
    <StructuredData data={eventVenueSchema(place)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      { name: "מקומות לאירועים", path: "/events/search/" },
      { name: place.name, path: `/events/place?id=${place.slug}` },
    ])} />
    <EventPlacePage initialSlug={place.slug} />
  </>;
}
