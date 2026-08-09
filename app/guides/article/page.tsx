import type { Metadata } from "next";
import { magazineArticles } from "../../data/magazine-data";
import { notFound, redirect } from "next/navigation";

type Props = { searchParams: Promise<{ id?: string }> };

function resolveArticle(id?: string) {
  const article = id ? magazineArticles.find((entry) => entry.slug === id) : undefined;
  if (!article) notFound();
  return article;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const article = resolveArticle((await searchParams).id);
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/guides/${article.slug}` },
    openGraph: { title: article.title, description: article.excerpt, images: [{ url: article.image }] },
  };
}

export default async function Page({ searchParams }: Props) {
  const article = resolveArticle((await searchParams).id);
  redirect(`/guides/${article.slug}`);
}
