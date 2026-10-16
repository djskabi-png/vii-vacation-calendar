import { publicCatalogSelectedSummaries } from "../../../lib/public-catalog-read.ts";
import { hourlyPlacesFromCatalog, paidAttractions, providerProfiles, spaPlacesFromSites } from "../../../data/world-data";
import type { SpaPlusSite } from "../../../data/spaplus";
import type hourlyCatalog from "../../../data/sergey-hourly-catalog.json";

type Card = { id?: string; slug?: string; image?: string; images?: string[] };
const worlds = new Set(["vacation", "events", "spa", "hourly", "providers", "activities"]);
const noStore = { "Cache-Control": "no-store" };

// Resolve at most one visible library page. Return public photo URLs only,
// never detail records, private favorites, reviews or fresh availability.
export async function POST(request: Request) {
  const invalid = () => Response.json({ error: "invalid_items" }, { status: 400, headers: noStore });
  if (Number(request.headers.get("Content-Length")) > 4096) return invalid();
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let body = "", byteLength = 0;
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > 4096) { await reader.cancel(); return invalid(); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  }
  let items: Array<{ world: string; id: string }>;
  try {
    const value = JSON.parse(body);
    if (!Array.isArray(value.items) || value.items.length > 8 || value.items.some((item: { world?: unknown; id?: unknown }) => !item || typeof item.world !== "string" || !worlds.has(item.world) || typeof item.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(item.id))) throw new Error("invalid_items");
    items = value.items;
  } catch { return Response.json({ error: "invalid_items" }, { status: 400, headers: noStore }); }
  const result: Record<string, string[]> = {};
  try {
    await Promise.all([...new Set(items.map(item => item.world))].map(async world => {
      const ids = items.filter(item => item.world === world).map(item => Number(item.id.split("-").at(-1))).filter(id => Number.isSafeInteger(id) && id > 0);
      let cards: Card[];
      if (world === "vacation" || world === "events") cards = await publicCatalogSelectedSummaries<Card>(world === "vacation" ? "vacations" : "events", ids);
      else if (world === "spa") cards = spaPlacesFromSites(await publicCatalogSelectedSummaries<SpaPlusSite>("spa", ids));
      else if (world === "hourly") cards = hourlyPlacesFromCatalog(await publicCatalogSelectedSummaries<(typeof hourlyCatalog.places)[number]>("rooms", ids));
      else cards = world === "providers" ? providerProfiles : paidAttractions;
      const byId = new Map(cards.map(card => [card.slug || card.id, card]));
      for (const item of items.filter(item => item.world === world)) {
        const card = byId.get(item.id);
        result[`${world}:${item.id}`] = card ? [...new Set([card.image, ...(card.images || [])].filter((image): image is string => Boolean(image)))].slice(0, 10) : [];
      }
    }));
    return Response.json({ galleries: result }, { headers: noStore });
  } catch { return Response.json({ error: "catalog_unavailable" }, { status: 503, headers: noStore }); }
}
