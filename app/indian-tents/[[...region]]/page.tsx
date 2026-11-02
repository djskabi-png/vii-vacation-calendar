import { AccommodationLandingRoute, accommodationLandingMetadata } from "../../components/accommodation-landing-route";

export async function generateMetadata({ params }: { params: Promise<{ region?: string[] }> }) {
  const { region } = await params;
  return accommodationLandingMetadata("indian-tents", region?.[0]);
}

export default async function IndianTentsPage({ params }: { params: Promise<{ region?: string[] }> }) {
  const { region } = await params;
  return <AccommodationLandingRoute categoryId="indian-tents" regionSlug={region?.[0]} />;
}
