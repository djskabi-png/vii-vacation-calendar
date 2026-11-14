import type { MagazineArticle } from "../data/magazine-data";

export function isMagazineArticlePublicAt(item: MagazineArticle, now = new Date().toISOString()) {
  return !item.publicationManaged || !item.scheduledAt || item.scheduledAt <= now;
}

export function sortMagazineArticlesByPublication<T extends Pick<MagazineArticle, "publishedAt" | "scheduledAt" | "slug">>(items: readonly T[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.scheduledAt || left.publishedAt || "") || 0;
    const rightTime = Date.parse(right.scheduledAt || right.publishedAt || "") || 0;
    return rightTime - leftTime || left.slug.localeCompare(right.slug, "he");
  });
}
