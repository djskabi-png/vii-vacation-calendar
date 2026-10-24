import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { providerProfiles } from "../data/world-data";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { redirect } from "next/navigation";
import { getProviderCategory, providerCategoryHref } from "../data/provider-categories";
import { managedDiscoveryItems } from "../lib/managed-public-content";
import { serverLocalePath } from "../i18n/server-public-copy";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = await serverLocalePath("/providers");
  const title = "ספקים לחופשה ולאירוע במקום אחד";
  const description = "שפים פרטיים, תקליטנים, צילום, ברים, עיצוב ופעילויות שמגיעים עד מקום האירוח.";
  return { title, description, alternates: { canonical }, robots: { index: false, follow: true }, openGraph: { type: "website", url: canonical, title, description } };
}

type ProvidersPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const rawParams = await searchParams;
  const legacyCategory = typeof rawParams.category === "string" ? getProviderCategory(rawParams.category) : undefined;
  if (legacyCategory && legacyCategory.id !== "all") {
    const nextParams = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (key === "category" || typeof value !== "string" || !value) continue;
      nextParams.set(key, value);
    }
    redirect(await serverLocalePath(`${providerCategoryHref(legacyCategory)}${nextParams.size ? `?${nextParams}` : ""}`));
  }
  const providers = await managedDiscoveryItems(providerProfiles, "providers");
  return <>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "ספקים", path: "/providers" }])} />
    <StructuredData data={collectionSchema("ספקים לאירוח ולאירועים", "שפים, מוזיקה, צילום, עיצוב ופעילויות במקום אחד.", "/providers", providers.map((item) => ({ name: item.name, path: `/discover/place/${item.id}`, image: item.image })))} />
    <WorldLanding world="providers" title="ספקים לאירוח ולאירועים" description="שפים, מוזיקה, צילום, עיצוב ופעילויות במקום אחד." items={providers} providerCategory="all" />
  </>;
}
