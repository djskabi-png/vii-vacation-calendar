import type { Metadata } from "next";
import { StructuredData } from "../../components/structured-data";
import { WorldLanding } from "../../components/world-landing";
import { providerProfiles } from "../../data/world-data";
import { nearbyPageContent, nearbyPageFaq } from "../../lib/nearby-page-content";
import { nearbyPageMetadata } from "../../lib/nearby-page-metadata";
import { managedDiscoveryItems } from "../../lib/managed-public-content";
import { breadcrumbSchema, collectionSchema, faqSchema } from "../../lib/seo";
import { hasVerifiedProviderServiceArea } from "../../lib/provider-service-areas";

const page = nearbyPageContent.providers;
export async function generateMetadata(): Promise<Metadata> { return nearbyPageMetadata(page.path, page.title, page.description); }

export default async function NearbyProvidersPage() {
  const providers = (await managedDiscoveryItems(providerProfiles, "providers")).filter((item) => hasVerifiedProviderServiceArea(item.serviceAreas));
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "ספקים", path: "/providers" }, { name: page.title, path: page.path }])} />
    <StructuredData data={collectionSchema(page.title, page.description, page.path, providers.map((item) => ({ name: item.name, path: `/discover/place/${item.id}`, image: item.image })))} />
    <WorldLanding world="providers" title={page.title} managedTitle={page.title} description={page.description} items={providers} providerCategory="all" breadcrumbItems={[{ name: "ראשי", path: "/" }, { name: "ספקים", path: "/providers" }, { name: page.title, path: page.path }]} managedBody={page.body} managedFaq={nearbyPageFaq("providers")} />
    <StructuredData data={faqSchema(nearbyPageFaq("providers"))} />
  </>;
}
