import type { Metadata } from "next";
import AttractionsPage from "../page";
import { nearbyPageContent } from "../../lib/nearby-page-content";
const page=nearbyPageContent.attractions;
export const metadata:Metadata={title:page.title,description:page.description,alternates:{canonical:page.path},openGraph:{type:"website",url:page.path,title:page.title,description:page.description}};
export default function NearbyPage(){return <AttractionsPage nearbyLanding />;}
