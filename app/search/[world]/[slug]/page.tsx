import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { ManagedSearchLanding as ManagedSearchLandingView, managedSearchPageMetadata } from "../../../components/managed-search-landing.tsx";
import { publishedOpportunityByPath } from "../../../lib/search-opportunities.ts";
import { searchWorldFromPublicSegment } from "../../../lib/search-page-url-policy.ts";
import { decodeLegacyFaq, legacyLandingEditorial, legacySocialMetadata, promotedLegacyTarget } from "../../../lib/legacy-landing-editorial.ts";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ world: string; slug: string }> };

async function resolvePage(params: Props["params"]) {
  const { world: segment, slug } = await params;
  const world = searchWorldFromPublicSegment(segment);
  if (!world) return null;
  const locale = (await headers()).get("x-vii-locale") || "he";
  const page = await publishedOpportunityByPath(world, slug, locale);
  if (!page) return null;
  const target = promotedLegacyTarget(page.canonicalPath);
  if (target) permanentRedirect(locale === "he" ? target : `/${locale}${target}`);
  const editorial = await legacyLandingEditorial(page.canonicalPath, locale);
  const content = editorial?.content;
  return { page: content ? { ...page, h1: content.title, metaTitle: content.metaTitle, metaDescription: content.metaDescription,
    body: content.body, summary: content.summary, faq: decodeLegacyFaq(content.attributes.legacyFaq) || [], robotsIndex: content.indexable } : page,
    tags: editorial?.tags };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await resolvePage(params);
  if (!resolved) return { robots: { index: false, follow: false } };
  const { page, tags } = resolved;
  const basic = managedSearchPageMetadata(page);
  return tags ? { ...basic, robots: { index: page.robotsIndex, follow: true }, ...legacySocialMetadata(tags, page.canonicalPath, page.metaTitle, page.metaDescription) } : basic;
}

export default async function ManagedSearchLanding({ params }: Props) {
  const resolved = await resolvePage(params);
  if (!resolved) notFound();
  return <ManagedSearchLandingView page={resolved.page} />;
}

