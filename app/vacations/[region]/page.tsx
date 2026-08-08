import type { Metadata } from "next";
import { VacationLandingRoute, vacationLandingMetadata } from "../../components/vacation-landing-route";

type Props = { params: Promise<{ region: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  return vacationLandingMetadata(region);
}

export default async function VacationRegionPage({ params }: Props) {
  const { region } = await params;
  return <VacationLandingRoute regionSlug={region} />;
}

