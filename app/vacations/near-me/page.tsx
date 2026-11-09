import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, faqSchema } from "../../lib/seo";
import type { Metadata } from "next";
import { SearchExperience } from "../../search/page";
import { NearbyRouteActivation } from "../../components/nearby-route-activation";
import { nearbyPageContent, nearbyPageFaq } from "../../lib/nearby-page-content";
import { nearbyPageMetadata } from "../../lib/nearby-page-metadata";
const page=nearbyPageContent.vacation;
export const dynamic="force-dynamic";
export async function generateMetadata(): Promise<Metadata> { return nearbyPageMetadata(page.path, page.title, page.description); }
export default function NearbyVacationsPage() { return <><StructuredData data={breadcrumbSchema([{name:"ראשי",path:"/"},{name:"נופש",path:"/vacations"},{name:page.title,path:page.path}])} /><StructuredData data={faqSchema(nearbyPageFaq("vacation"))} /><SearchExperience embedded beforeResults={<NearbyRouteActivation />} landing={{path:page.path,title:page.title,description:page.description,breadcrumb:page.title,type:"הכל",guideTitle:"חופשה קרובה שמתאימה לכם",guideParagraphs:[page.body],faqs:nearbyPageFaq("vacation"),relatedLinks:[{label:"נופש בצפון",href:"/vacations/north"},{label:"נופש בדרום",href:"/vacations/south-negev"}]}} /></>; }
