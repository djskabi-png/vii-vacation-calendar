import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "../../components/structured-data";
import { WorldLanding } from "../../components/world-landing";
import { providerProfiles } from "../../data/world-data";
import { getProviderCategory, providerCategoryHref, providerMatchesCategory, providerTopicCategories } from "../../data/provider-categories";
import { breadcrumbSchema, collectionSchema } from "../../lib/seo";

type ProviderCategoryPageProps = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return providerTopicCategories.map((category) => ({ category: category.id }));
}

export async function generateMetadata({ params }: ProviderCategoryPageProps): Promise<Metadata> {
  const category = getProviderCategory((await params).category);
  if (!category || category.id === "all") return {};
  const path = providerCategoryHref(category);
  return {
    title: category.metaTitle,
    description: category.metaDescription,
    alternates: { canonical: path },
    robots: { index: false, follow: true },
    openGraph: { type: "website", url: path, title: category.metaTitle, description: category.metaDescription },
  };
}

export default async function ProviderCategoryPage({ params }: ProviderCategoryPageProps) {
  const category = getProviderCategory((await params).category);
  if (!category || category.id === "all") notFound();
  const path = providerCategoryHref(category);
  const items = providerProfiles.filter((item) => providerMatchesCategory(item, category));
  const breadcrumbs = [{ name: "ראשי", path: "/" }, { name: "ספקים", path: "/providers" }, { name: category.label }];

  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "ספקים", path: "/providers" }, { name: category.label, path }])} />
    <StructuredData data={collectionSchema(category.title, category.description, path, items.map((item) => ({ name: item.name, path: `/discover/place/${item.id}`, image: item.image })))} />
    <WorldLanding world="providers" title={category.title} description={category.description} items={items} providerCategory={category.id} breadcrumbItems={breadcrumbs} />
  </>;
}
