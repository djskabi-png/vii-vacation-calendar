import type { Metadata } from "next";
import { MagazineArticleView } from "../article/client-page";
import { getMagazineArticle, magazineArticles } from "../../data/magazine-data";

export function generateStaticParams() {
  return magazineArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getMagazineArticle(slug);
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/guides/${article.slug}/` },
    openGraph: { title: article.title, description: article.excerpt, images: [{ url: article.image, alt: article.imageAlt }] },
  };
}

export default async function MagazineArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getMagazineArticle(slug);
  return <MagazineArticleView initialSlug={article.slug} readQuery={false} />;
}
