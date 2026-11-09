import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";
import type { Metadata } from "next";
import { SearchExperience } from "../../search/page";
import { NearbyRouteActivation } from "../../components/nearby-route-activation";
import { nearbyPageContent, nearbyPageFaq } from "../../lib/nearby-page-content";
const page=nearbyPageContent.vacation;
export const dynamic="force-dynamic";
export const metadata: Metadata = { title:page.title,description:page.description,alternates:{canonical:page.path},openGraph:{type:"website",url:page.path,title:page.title,description:page.description} };
export default function NearbyVacationsPage() { return <><StructuredData data={breadcrumbSchema([{name:"ראשי",path:"/"},{name:"נופש",path:"/vacations"},{name:page.title,path:page.path}])} /><SearchExperience embedded beforeResults={<NearbyRouteActivation />} landing={{path:page.path,title:page.title,description:page.description,breadcrumb:page.title,type:"הכל",guideTitle:"חופשה קרובה שמתאימה לכם",guideParagraphs:[page.body],faqs:nearbyPageFaq("vacation"),relatedLinks:[{label:"נופש בצפון",href:"/vacations/north"},{label:"נופש בדרום",href:"/vacations/south-negev"}]}} /></>; }
