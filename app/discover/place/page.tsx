import type { Metadata } from "next";
import DiscoveryPlacePage from "./client-page";
import { discoveryItems } from "../../data/world-data";

type Props = { searchParams: Promise<{ id?: string }> };

function resolveItem(id?: string) {
  return discoveryItems.find((item) => item.id === id) || discoveryItems[0];
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const item = resolveItem((await searchParams).id);
  return {
    title: item.name,
    description: item.description,
    alternates: { canonical: `/discover/place/?id=${item.id}` },
    openGraph: item.image ? { title: item.name, description: item.description, images: [{ url: item.image }] } : undefined,
  };
}

export default async function Page({ searchParams }: Props) {
  const item = resolveItem((await searchParams).id);
  return <DiscoveryPlacePage initialId={item.id} />;
}
