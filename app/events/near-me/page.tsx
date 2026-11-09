import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, faqSchema } from "../../lib/seo";
import type { Metadata } from "next";
import EventSearchPage from "../search/page";
import { NearbyRouteActivation } from "../../components/nearby-route-activation";
import { nearbyPageContent, nearbyPageFaq } from "../../lib/nearby-page-content";
import { nearbyPageMetadata } from "../../lib/nearby-page-metadata";
const page=nearbyPageContent.events;
export async function generateMetadata(): Promise<Metadata> { return nearbyPageMetadata(page.path, page.title, page.description); }
export default function NearbyEventsPage() { return <><StructuredData data={breadcrumbSchema([{name:"ראשי",path:"/"},{name:"אירועים",path:"/events"},{name:page.title,path:page.path}])} /><StructuredData data={faqSchema(nearbyPageFaq("events"))} /><EventSearchPage initialArea="הכל" landingTitle={page.title} landingDescription={page.description} managedPath={page.path} managedBody={page.body} managedFaq={nearbyPageFaq("events")} beforeResults={<NearbyRouteActivation />} /></>; }
