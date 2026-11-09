import type { Metadata } from "next";
import TrailsPage from "../page";
import { nearbyPageContent } from "../../lib/nearby-page-content";
import { nearbyPageMetadata } from "../../lib/nearby-page-metadata";
const page=nearbyPageContent.trails;
export async function generateMetadata(): Promise<Metadata> { return nearbyPageMetadata(page.path, page.title, page.description); }
export default function NearbyPage(){return <TrailsPage nearbyLanding />;}
