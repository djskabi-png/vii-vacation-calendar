import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ManagedSearchLanding as ManagedSearchLandingView, managedSearchPageMetadata } from "../../../components/managed-search-landing.tsx";
import { publishedOpportunityByPath } from "../../../lib/search-opportunities.ts";
import { searchWorldFromPublicSegment } from "../../../lib/search-page-url-policy.ts";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ world: string; slug: string }> };

async function resolvePage(params: Props["params"]) {
  const { world: segment, slug } = await params;
  const world = searchWorldFromPublicSegment(segment);
  if (!world) return null;
  const locale = (await headers()).get("x-vii-locale") || "he";
  return publishedOpportunityByPath(world, slug, locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await resolvePage(params);
  return page ? managedSearchPageMetadata(page) : { robots: { index: false, follow: false } };
}

export default async function ManagedSearchLanding({ params }: Props) {
  const page = await resolvePage(params);
  if (!page) notFound();
  return <ManagedSearchLandingView page={page} />;
}

