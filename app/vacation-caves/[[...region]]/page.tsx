import { AccommodationLandingRoute, accommodationLandingMetadata } from "../../components/accommodation-landing-route";

export async function generateMetadata({ params }: { params: Promise<{ region?: string[] }> }) {
  const { region } = await params;
  return accommodationLandingMetadata("caves", region?.[0]);
}

export default async function VacationCavesPage({ params, searchParams }: { params: Promise<{ region?: string[] }>; searchParams: import("../../components/accommodation-landing-route").AccommodationSearchParams }) {
  const { region } = await params;
  return <AccommodationLandingRoute categoryId="caves" regionSlug={region?.[0]} searchParams={searchParams} />;
}
