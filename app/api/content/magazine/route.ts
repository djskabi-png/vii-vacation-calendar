import { magazineArticles } from "../../../data/magazine-data.ts";
import { managedMagazineArticles } from "../../../lib/managed-public-content.ts";
import { magazineCard } from "../../../lib/magazine-card.ts";

export async function GET() {
  try {
    const articles = await managedMagazineArticles(magazineArticles);
    return Response.json({ articles: articles.map(magazineCard) }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("VII managed magazine unavailable", error);
    return Response.json({ articles: magazineArticles.map(magazineCard) }, { headers: { "Cache-Control": "public, max-age=30" } });
  }
}
