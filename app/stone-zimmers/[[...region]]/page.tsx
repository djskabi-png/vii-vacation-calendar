import { AccommodationLandingRoute, accommodationLandingMetadata } from "../../components/accommodation-landing-route";

export async function generateMetadata({ params }: { params: Promise<{ region?: string[] }> }) {
  const { region } = await params;
  return accommodationLandingMetadata("stone-zimmers", region?.[0]);
}

export default async function StoneZimmersPage({ params, searchParams }: { params: Promise<{ region?: string[] }>; searchParams: import("../../components/accommodation-landing-route").AccommodationSearchParams }) {
  const { region } = await params;
  return <AccommodationLandingRoute categoryId="stone-zimmers" regionSlug={region?.[0]} searchParams={searchParams} />;
}
