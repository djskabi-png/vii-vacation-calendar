import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ManagedSearchLanding, managedSearchPageMetadata } from "../../components/managed-search-landing.tsx";
import { publishedOpportunityBySlug } from "../../lib/search-opportunities.ts";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await publishedOpportunityBySlug(slug);
  return page ? managedSearchPageMetadata(page) : { robots: { index: false, follow: false } };
}

export default async function LegacyManagedSearchLanding({ params }: Props) {
  const { slug } = await params;
  const page = await publishedOpportunityBySlug(slug);
  if (!page) notFound();
  if (page.canonicalPath !== `/find/${slug}`) permanentRedirect(page.canonicalPath);
  return <ManagedSearchLanding page={page} />;
}
