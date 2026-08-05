import type { Metadata } from "next";
import ArticlePage from "./client-page";
import { getMagazineArticle } from "../../data/magazine-data";

type Props = { searchParams: Promise<{ id?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const article = getMagazineArticle((await searchParams).id);
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/guides/${article.slug}` },
    openGraph: { title: article.title, description: article.excerpt, images: [{ url: article.image }] },
  };
}

export default async function Page({ searchParams }: Props) {
  const article = getMagazineArticle((await searchParams).id);
  return <ArticlePage initialSlug={article.slug} />;
}
