import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscoveryPlacePage from "../client-page";
import { discoveryItems } from "../../../data/world-data";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, discoverySchema, faqSchema, worldBreadcrumb } from "../../../lib/seo";
import { ViewedItemBootstrap } from "../../../components/viewed-item-bootstrap";
import { getSpaDetails } from "../../../data/spa-details";
import { getProviderDetails } from "../../../data/provider-details";
import { getHourlyDetails } from "../../../data/hourly-details";
import { getActivityDetails } from "../../../data/activity-details";

type Props = { params: Promise<{ id: string }> };

function resolveItem(id: string) {
  const item = discoveryItems.find((entry) => entry.id === id);
  if (!item) notFound();
  return item;
}

function itemFaq(item: ReturnType<typeof resolveItem>) {
  if (item.world === "spa") return getSpaDetails(item.id).faq || [];
  if (item.world === "providers") return getProviderDetails(item.id)?.faq || [];
  if (item.world === "hourly") return getHourlyDetails(item).faq;
  if (item.world === "activities") return getActivityDetails(item).faq;
  return [];
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
    {itemFaq(item).length ? <StructuredData data={faqSchema(itemFaq(item))} /> : null}
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      worldBreadcrumb(item.world),
      { name: item.name, path: `/discover/place/${item.id}` },
    ])} />
    <DiscoveryPlacePage initialId={item.id} />
  </>;
}
