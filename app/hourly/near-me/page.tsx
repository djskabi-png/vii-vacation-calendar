import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";
import type { Metadata } from "next";
import { WorldLanding } from "../../components/world-landing";
import { NearbyRouteActivation } from "../../components/nearby-route-activation";
import { hourlyPlacesFromCatalog } from "../../data/world-data";
import { publicCatalogSummaries } from "../../lib/public-catalog-read";
import { nearbyPageContent, nearbyPageFaq } from "../../lib/nearby-page-content";
const page = nearbyPageContent.hourly;
export const metadata: Metadata = { title: page.title, description: page.description, alternates: { canonical: page.path }, openGraph: { type:"website",url:page.path,title:page.title,description:page.description } };
export default async function NearbyHourlyPage() {
 type Place = Parameters<typeof hourlyPlacesFromCatalog>[0][number];
 const items=hourlyPlacesFromCatalog(await publicCatalogSummaries<Place>("rooms"));
 return <><StructuredData data={breadcrumbSchema([{name:"ראשי",path:"/"},{name:"חדרים לפי שעה",path:"/hourly"},{name:page.title,path:page.path}])} /><WorldLanding world="hourly" title={page.title} managedTitle={page.title} description={page.description} items={items} searchMode="hourly" breadcrumbItems={[{ name:"ראשי",path:"/" },{ name:"חדרים לפי שעה",path:"/hourly" },{ name:page.title,path:page.path }]} beforeResults={<NearbyRouteActivation />} managedBody={page.body} managedFaq={nearbyPageFaq("hourly")} /></>;
}
