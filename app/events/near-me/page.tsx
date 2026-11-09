import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";
import type { Metadata } from "next";
import EventSearchPage from "../search/page";
import { NearbyRouteActivation } from "../../components/nearby-route-activation";
import { nearbyPageContent, nearbyPageFaq } from "../../lib/nearby-page-content";
const page=nearbyPageContent.events;
export const metadata: Metadata = { title:page.title,description:page.description,alternates:{canonical:page.path},openGraph:{type:"website",url:page.path,title:page.title,description:page.description} };
export default function NearbyEventsPage() { return <><StructuredData data={breadcrumbSchema([{name:"ראשי",path:"/"},{name:"אירועים",path:"/events"},{name:page.title,path:page.path}])} /><EventSearchPage initialArea="הכל" landingTitle={page.title} landingDescription={page.description} managedPath={page.path} managedBody={page.body} managedFaq={nearbyPageFaq("events")} beforeResults={<NearbyRouteActivation />} /></>; }
