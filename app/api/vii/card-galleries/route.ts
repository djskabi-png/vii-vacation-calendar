import { publicCatalogSelectedSummaries } from "../../../lib/public-catalog-read.ts";
import { hourlyPlaces, hourlyPlacesFromCatalog, paidAttractions, providerProfiles, spaPlaces, spaPlacesFromSites } from "../../../data/world-data";
import { trails } from "../../../data/trail-data";
import { eventPlaces, properties } from "../../../data/site-data";
import type { SpaPlusSite } from "../../../data/spaplus";
import type hourlyCatalog from "../../../data/sergey-hourly-catalog.json";

type Card = { id?: string; slug?: string; image?: string; images?: string[] };
const worlds = new Set(["vacation", "events", "corporate", "spa", "hourly", "providers", "activities", "trails"]);
const noStore = { "Cache-Control": "no-store" };

// Resolve a visible gallery page or a bounded existence-validation batch.
// Return public identifiers and photo URLs only, never private library state,
// detail records, reviews or fresh availability.
export async function POST(request: Request) {
  const invalid = () => Response.json({ error: "invalid_items" }, { status: 400, headers: noStore });
  if (Number(request.headers.get("Content-Length")) > 16384) return invalid();
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let body = "", byteLength = 0;
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > 16384) { await reader.cancel(); return invalid(); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  }
  let items: Array<{ world: string; id: string }>;
  let includeGalleries = true;
  try {
    const value = JSON.parse(body);
    if (value.includeGalleries !== undefined && typeof value.includeGalleries !== "boolean") throw new Error("invalid_items");
    includeGalleries = value.includeGalleries !== false;
    const limit = includeGalleries ? 12 : 50;
    if (!Array.isArray(value.items) || value.items.length > limit || value.items.some((item: { world?: unknown; id?: unknown }) => !item || typeof item.world !== "string" || !worlds.has(item.world) || typeof item.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(item.id))) throw new Error("invalid_items");
    items = value.items;
  } catch { return Response.json({ error: "invalid_items" }, { status: 400, headers: noStore }); }
  const result: Record<string, string[]> = {};
  const existingKeys = new Set<string>();
  try {
    await Promise.all([...new Set(items.map(item => item.world))].map(async world => {
      const ids = items.filter(item => item.world === world).map(item => Number(item.id.split("-").at(-1))).filter(id => Number.isSafeInteger(id) && id > 0);
      let cards: Card[];
      if (world === "vacation" || world === "events") {
        const current = await publicCatalogSelectedSummaries<Card>(world === "vacation" ? "vacations" : "events", ids);
        const published = world === "vacation" ? properties.filter((card) => card.active !== false) : eventPlaces.filter((card) => card.active !== false);
        cards = [...published, ...current];
      }
      else if (world === "spa") cards = [...spaPlaces, ...spaPlacesFromSites(await publicCatalogSelectedSummaries<SpaPlusSite>("spa", ids))];
      else if (world === "hourly") cards = [...hourlyPlaces, ...hourlyPlacesFromCatalog(await publicCatalogSelectedSummaries<(typeof hourlyCatalog.places)[number]>("rooms", ids))];
      else if (world === "providers") cards = providerProfiles;
      else if (world === "activities") cards = paidAttractions;
      else if (world === "trails") cards = trails;
      else cards = [{ id: "corporate-experiences" }];
      const byId = new Map(cards.map(card => [card.slug || card.id, card]));
      for (const item of items.filter(item => item.world === world)) {
        const card = byId.get(item.id);
        const key = `${world}:${item.id}`;
        if (card) existingKeys.add(key);
        if (includeGalleries) result[key] = card ? [...new Set([card.image, ...(card.images || [])].filter((image): image is string => Boolean(image)))].slice(0, 10) : [];
      }
    }));
    return Response.json({ galleries: result, existingKeys: [...existingKeys] }, { headers: noStore });
  } catch { return Response.json({ error: "catalog_unavailable" }, { status: 503, headers: noStore }); }
}
