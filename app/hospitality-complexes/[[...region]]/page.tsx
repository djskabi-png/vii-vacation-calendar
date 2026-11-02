import { AccommodationLandingRoute, accommodationLandingMetadata } from "../../components/accommodation-landing-route";

export async function generateMetadata({ params }: { params: Promise<{ region?: string[] }> }) {
  const { region } = await params;
  return accommodationLandingMetadata("hospitality-complexes", region?.[0]);
}

export default async function HospitalityComplexesPage({ params }: { params: Promise<{ region?: string[] }> }) {
  const { region } = await params;
  return <AccommodationLandingRoute categoryId="hospitality-complexes" regionSlug={region?.[0]} />;
}
