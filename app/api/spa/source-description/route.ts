import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import type { SpaPlusSite } from "../../../data/spaplus";

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "invalid_site" }, { status: 400 });
  try {
    const sites = await publicCatalogSummaries<SpaPlusSite>("spa");
    const site = sites.find((entry) => entry.id === id);
    if (!site) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ about: site.about, editorial: "vii" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
