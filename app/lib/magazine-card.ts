import type { MagazineArticle } from "../data/magazine-data";

export type MagazineCard = Pick<MagazineArticle, "slug" | "title" | "category" | "excerpt" | "image" | "imageAlt" | "imageTitle" | "imageKind" | "readTime" | "dateLabel" | "tags" | "world" | "publishedLocales">;

// Discovery never ships the complete body of every article to the browser.
export function magazineCard(article: MagazineArticle): MagazineCard {
  const { slug, title, category, excerpt, image, imageAlt, imageTitle, imageKind, readTime, dateLabel, tags, world, publishedLocales } = article;
  return { slug, title, category, excerpt, image, imageAlt, imageTitle, imageKind, readTime, dateLabel, tags, world, publishedLocales };
}
