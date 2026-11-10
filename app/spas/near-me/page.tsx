import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";
import type { Metadata } from "next";
import { WorldLanding } from "../../components/world-landing";
import { NearbyRouteActivation } from "../../components/nearby-route-activation";
import { spaPlacesFromSites } from "../../data/world-data";
import type { SpaPlusSite } from "../../data/spaplus";
import { publicCatalogSummaries } from "../../lib/public-catalog-read";
import { nearbyPageContent, nearbyPageFaq } from "../../lib/nearby-page-content";
import { nearbyPageMetadata } from "../../lib/nearby-page-metadata";
const page = nearbyPageContent.spa;
export async function generateMetadata(): Promise<Metadata> { return nearbyPageMetadata(page.path, page.title, page.description); }
export default async function NearbySpaPage() {
 const items = spaPlacesFromSites(await publicCatalogSummaries<SpaPlusSite>("spa"));
 return <><StructuredData data={breadcrumbSchema([{name:"ראשי",path:"/"},{name:"בתי ספא",path:"/spas"},{name:page.title,path:page.path}])} /><WorldLanding world="spa" title={page.title} managedTitle={page.title} description={page.description} items={items} searchMode="spa" breadcrumbItems={[{ name:"ראשי",path:"/" },{ name:"בתי ספא",path:"/spas" },{ name:page.title,path:page.path }]} collectionTitle="בתי ספא לבחירה" beforeResults={<NearbyRouteActivation />} managedBody={page.body} managedFaq={nearbyPageFaq("spa")} hidePopularSearches /></>;
}
