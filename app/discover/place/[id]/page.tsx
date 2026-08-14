import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscoveryPlacePage from "../client-page";
import { discoveryItems } from "../../../data/world-data";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, discoverySchema, worldBreadcrumb } from "../../../lib/seo";
import { ViewedItemBootstrap } from "../../../components/viewed-item-bootstrap";

type Props = { params: Promise<{ id: string }> };

function resolveItem(id: string) {
  const item = discoveryItems.find((entry) => entry.id === id);
  if (!item) notFound();
  return item;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = resolveItem((await params).id);
  const indexable = item.indexable === true || (item.indexable !== false && (item.world === "spa" || item.world === "hourly" || item.world === "activities"));
  return {
    title: item.name,
    description: item.description,
    alternates: { canonical: `/discover/place/${item.id}` },
    openGraph: item.image ? { title: item.name, description: item.description, images: [{ url: item.image }] } : undefined,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function Page({ params }: Props) {
  const item = resolveItem((await params).id);
  const indexable = item.indexable === true || (item.indexable !== false && (item.world === "spa" || item.world === "hourly" || item.world === "activities"));
  return <>
    <ViewedItemBootstrap id={item.id} world={item.world} name={item.name} location={`${item.location}, ${item.area}`} image={item.image} href={`/discover/place/${item.id}`} meta={item.priceLabel || item.duration} />
    {indexable ? <StructuredData data={discoverySchema(item)} /> : null}
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      worldBreadcrumb(item.world),
      { name: item.name, path: `/discover/place/${item.id}` },
    ])} />
    <DiscoveryPlacePage initialId={item.id} />
  </>;
}
