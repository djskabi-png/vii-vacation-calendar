import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  const approved = await approvedWorldLocation("vacation", (await params).location);
  if (!approved) notFound();
  return <VacationLandingRoute regionSlug={approved.slug} locationOverride={approved.label} />;
}
