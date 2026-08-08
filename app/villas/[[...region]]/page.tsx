import type { Metadata } from "next";
import { AccommodationLandingRoute, accommodationLandingMetadata } from "../../components/accommodation-landing-route";

type Props = { params: Promise<{ region?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  return accommodationLandingMetadata("villas", region?.[0]);
}

export default async function VillasPage({ params }: Props) {
  const { region } = await params;
  return <AccommodationLandingRoute categoryId="villas" regionSlug={region?.[0]} />;
}
