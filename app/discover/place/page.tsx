import type { Metadata } from "next";
import DiscoveryPlacePage from "./client-page";
import { discoveryItems } from "../../data/world-data";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, discoverySchema, worldBreadcrumb } from "../../lib/seo";

type Props = { searchParams: Promise<{ id?: string }> };

function resolveItem(id?: string) {
  return discoveryItems.find((item) => item.id === id) || discoveryItems[0];
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const item = resolveItem((await searchParams).id);
  const indexable = item.indexable === true || (item.indexable !== false && (item.world === "spa" || item.world === "hourly" || item.world === "activities"));
  return {
    title: item.name,
    description: item.description,
    alternates: { canonical: `/discover/place?id=${item.id}` },
    openGraph: item.image ? { title: item.name, description: item.description, images: [{ url: item.image }] } : undefined,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function Page({ searchParams }: Props) {
  const item = resolveItem((await searchParams).id);
  const indexable = item.indexable === true || (item.indexable !== false && (item.world === "spa" || item.world === "hourly" || item.world === "activities"));
  return <>
    {indexable ? <StructuredData data={discoverySchema(item)} /> : null}
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      worldBreadcrumb(item.world),
      { name: item.name, path: `/discover/place?id=${item.id}` },
    ])} />
    <DiscoveryPlacePage initialId={item.id} />
  </>;
}
