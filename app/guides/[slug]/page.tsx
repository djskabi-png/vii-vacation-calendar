import type { Metadata } from "next";
import { MagazineArticleView } from "../article/client-page";
import { magazineArticles } from "../../data/magazine-data";
import { StructuredData } from "../../components/structured-data";
import { articleSchema, breadcrumbSchema } from "../../lib/seo";
import { managedMagazineArticles } from "../../lib/managed-public-content";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return magazineArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = (await managedMagazineArticles(magazineArticles)).find((item) => item.slug === slug); if (!article) notFound();
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/guides/${article.slug}` },
    openGraph: { type: "article", url: `/guides/${article.slug}/`, title: article.title, description: article.excerpt, images: [{ url: article.image, alt: article.imageAlt }] },
    twitter: { card: "summary_large_image", title: article.title, description: article.excerpt, images: [article.image] },
  };
}

export default async function MagazineArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articles = await managedMagazineArticles(magazineArticles);
  const article = articles.find((item) => item.slug === slug); if (!article) notFound();
  return <>
    <StructuredData data={articleSchema(article)} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "מגזין ומדריכים", path: "/guides/" },
      { name: article.title, path: `/guides/${article.slug}/` },
    ])} />
    <MagazineArticleView initialSlug={article.slug} readQuery={false} initialArticles={articles} />
  </>;
}
