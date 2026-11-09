import type { Metadata } from "next";
import AttractionsPage from "../page";
import { nearbyPageContent } from "../../lib/nearby-page-content";
import { nearbyPageMetadata } from "../../lib/nearby-page-metadata";
const page=nearbyPageContent.attractions;
export async function generateMetadata(): Promise<Metadata> { return nearbyPageMetadata(page.path, page.title, page.description); }
export default function NearbyPage(){return <AttractionsPage nearbyLanding />;}
