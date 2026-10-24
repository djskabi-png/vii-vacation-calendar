import type { Metadata } from "next";
import { MagazineArticleView } from "../article/client-page";
import { magazineArticles } from "../../data/magazine-data";
import { StructuredData } from "../../components/structured-data";
import { articleSchema, breadcrumbSchema } from "../../lib/seo";
import { managedMagazineArticles } from "../../lib/managed-public-content";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { serverLocalePath, serverPublicCopy } from "../../i18n/server-public-copy";

export function generateStaticParams() {
  return magazineArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = (await managedMagazineArticles(magazineArticles)).find((item) => item.slug === slug); if (!article) notFound();
  const locale = (await headers()).get("x-vii-locale") || "he";
  const localeApproved = !article.publishedLocales || article.publishedLocales.includes(locale);
  const canonical = await serverLocalePath(`/guides/${article.slug}`);
  const { translate } = await serverPublicCopy();
  const title = translate(article.metaTitle || article.title);
  const description = translate(article.metaDescription || article.excerpt);
  const socialTitle = translate(article.title);
  const socialDescription = translate(article.excerpt);
  return {
    title,
    description,
    alternates: { canonical },
    robots: localeApproved && article.indexable !== false ? { index: true, follow: true, "max-image-preview": "large" } : { index: false, follow: true },
    openGraph: { type: "article", url: canonical, title: socialTitle, description: socialDescription, images: [{ url: article.image, alt: translate(article.imageAlt) }] },
    twitter: { card: "summary_large_image", title: socialTitle, description: socialDescription, images: [article.image] },
  };
}

export default async function MagazineArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articles = await managedMagazineArticles(magazineArticles);
  const article = articles.find((item) => item.slug === slug); if (!article) notFound();
  const canonical = await serverLocalePath(`/guides/${article.slug}`);
  const { language, translate } = await serverPublicCopy();
  return <>
    <StructuredData data={articleSchema(article, canonical, language, translate)} />
    <StructuredData data={breadcrumbSchema([
      { name: translate("ראשי"), path: await serverLocalePath("/") },
      { name: translate("מגזין ומדריכים"), path: await serverLocalePath("/guides") },
      { name: translate(article.title), path: canonical },
    ])} />
    <MagazineArticleView initialSlug={article.slug} readQuery={false} initialArticles={[article, ...articles.filter((item) => item.slug !== article.slug).sort((a,b) => Number(b.world === article.world) - Number(a.world === article.world)).slice(0,3).map((item) => ({ ...item, intro: "", takeaway: "", sections: [], checklist: [], faqs: [], sourceLinks: [] }))]} />
  </>;
}
