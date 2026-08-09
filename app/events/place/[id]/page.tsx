import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EventPlacePage from "../client-page";
import { eventPlaceHref, eventPlaces } from "../../../data/site-data";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, eventVenueSchema } from "../../../lib/seo";

type Props = { params: Promise<{ id: string }> };

function resolvePlace(id: string) {
  const place = eventPlaces.find((item) => item.slug === id);
  if (!place) notFound();
  return place;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = resolvePlace((await params).id);
  return {
    title: place.name,
    description: place.description,
    alternates: { canonical: eventPlaceHref(place) },
    openGraph: { type: "website", url: eventPlaceHref(place), title: place.name, description: place.description, images: [{ url: place.image, alt: place.name }] },
    twitter: { card: "summary_large_image", title: place.name, description: place.description, images: [place.image] },
  };
}

export default async function Page({ params }: Props) {
  const place = resolvePlace((await params).id);
  if (place.sourcePropertySlug) redirect(eventPlaceHref(place));
  return <>
    <StructuredData data={eventVenueSchema(place)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      { name: "מקומות לאירועים", path: "/events/search/" },
      { name: place.name, path: eventPlaceHref(place) },
    ])} />
    <EventPlacePage initialSlug={place.slug} />
  </>;
}
