import type { Metadata } from "next";
import EventPlacePage from "./client-page";
import { eventPlaces } from "../../data/site-data";

type Props = { searchParams: Promise<{ id?: string }> };

function resolvePlace(id?: string) {
  return eventPlaces.find((item) => item.slug === id) || eventPlaces[0];
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const place = resolvePlace((await searchParams).id);
  return {
    title: place.name,
    description: place.description,
    alternates: { canonical: `/events/place/?id=${place.slug}` },
    openGraph: { title: place.name, description: place.description, images: [{ url: place.image }] },
  };
}

export default async function Page({ searchParams }: Props) {
  const place = resolvePlace((await searchParams).id);
  return <EventPlacePage initialSlug={place.slug} />;
}
