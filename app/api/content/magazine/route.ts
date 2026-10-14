import { magazineArticles } from "../../../data/magazine-data.ts";
import { managedMagazineArticles } from "../../../lib/managed-public-content.ts";

export async function GET() {
  try {
    const articles = await managedMagazineArticles(magazineArticles);
    return Response.json({ articles }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("VII managed magazine unavailable", error);
    return Response.json({ articles: magazineArticles }, { headers: { "Cache-Control": "public, max-age=30" } });
  }
}
