import GuidesPage from "./client-page";
import { magazineArticles } from "../data/magazine-data";
import { managedMagazineArticles } from "../lib/managed-public-content";
import { magazineCard } from "../lib/magazine-card";

export default async function Page() {
  const articles = await managedMagazineArticles(magazineArticles);
  return <GuidesPage initialArticles={articles.map(magazineCard)} />;
}
