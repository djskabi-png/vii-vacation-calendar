import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { VacationLandingRoute } from "../../../components/vacation-landing-route.tsx";
import { approvedWorldLocation } from "../../../lib/world-location-pages.ts";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ location: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const approved = await approvedWorldLocation("vacation", (await params).location);
  if (!approved) return { robots: { index: false, follow: false } };
  const title = `נופש ב${approved.label}`;
  const description = `${title}, מקומות אירוח פעילים עם תמונות, מתקנים, אפשרויות הזמנה ופרטי קשר.`;
  return { title, description, alternates: { canonical: approved.path }, openGraph: { type: "website", url: approved.path, title, description } };
}

export default async function VacationLocationPage({ params }: Props) {
  const requestedLocation = (await params).location;
  // v768 briefly generated this opaque slug for the quick destination "דרום".
  // Preserve existing browser history and shared links by moving it to the
  // stable, human-readable regional landing instead of leaving a false 404.
  if (requestedLocation === "city-drvm-1vh8x") permanentRedirect("/vacations/south-negev");
  const approved = await approvedWorldLocation("vacation", requestedLocation);
  if (!approved) notFound();
  return <VacationLandingRoute regionSlug={approved.slug} locationOverride={approved.label} />;
}
