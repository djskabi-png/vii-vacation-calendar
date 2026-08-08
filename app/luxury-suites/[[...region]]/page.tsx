import type { Metadata } from "next";
import { AccommodationLandingRoute, accommodationLandingMetadata } from "../../components/accommodation-landing-route";

type Props = { params: Promise<{ region?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  return accommodationLandingMetadata("luxury-suites", region?.[0]);
}

export default async function LuxurySuitesPage({ params }: Props) {
  const { region } = await params;
  return <AccommodationLandingRoute categoryId="luxury-suites" regionSlug={region?.[0]} />;
}
