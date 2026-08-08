import type { Metadata } from "next";
import { AccommodationLandingRoute, accommodationLandingMetadata } from "../../components/accommodation-landing-route";

type Props = { params: Promise<{ region?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  return accommodationLandingMetadata("vacation-apartments", region?.[0]);
}

export default async function VacationApartmentsPage({ params }: Props) {
  const { region } = await params;
  return <AccommodationLandingRoute categoryId="vacation-apartments" regionSlug={region?.[0]} />;
}
