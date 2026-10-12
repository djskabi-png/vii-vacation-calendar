import sergey from "../../data/sergey-public-catalog.json" with { type: "json" };
import sergeyDetails from "../../data/sergey-place-details.json" with { type: "json" };
import hourly from "../../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../../data/spaplus-catalog.json" with { type: "json" };
import { readSupplierCatalogEntry, readSupplierCatalogState, readSupplierCatalogSummaries, type SupplierCatalogWorld } from "../../lib/supplier-catalog-store.ts";
import type { D1Database } from "../../../types/cloudflare-runtime";
import { searchPlaceInventory } from "../../data/search-place-inventory.ts";

const noStore = { "Cache-Control": "no-store" };

function worldFrom(value: string | null): SupplierCatalogWorld | null {
  return value === "vacations" || value === "events" || value === "rooms" || value === "spa" ? value : null;
}

function bundledEntries(world: SupplierCatalogWorld) {
  if (world === "spa") return spa.sites.map((site) => ({ supplierId: site.id, summary: site }));
  if (world === "rooms") return hourly.places.map((place) => ({ supplierId: place.supplierId, summary: place }));
  return sergey.places.filter((place) => place.world === world)
    .map((place) => ({ supplierId: place.supplierId, summary: place }));
}

function bundledDetail(world: SupplierCatalogWorld, supplierId: number) {
  if (world !== "vacations" && world !== "events") return null;
  const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
  return (sergeyDetails.details as Record<string, unknown>)[slug] || null;
}

async function database(): Promise<D1Database | null> {
  try {
    const runtime = await import("cloudflare:workers");
    return (runtime.env as unknown as { DB?: D1Database }).DB || null;
  } catch {
    return null;
  }
}

export async function catalogResponse(request: Request, db: D1Database | null) {
  const url = new URL(request.url);
  const world = worldFrom(url.searchParams.get("world"));
  if (!world) return Response.json({ error: "invalid_world" }, { status: 400, headers: noStore });
  const view = url.searchParams.get("view");
  if (view !== null && view !== "lookup") return Response.json({ error: "invalid_view" }, { status: 400, headers: noStore });
  const rawId = url.searchParams.get("id");
  if (view === "lookup" && rawId !== null) return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  const supplierId = rawId === null ? null : Number(rawId);
  if (rawId !== null && (!Number.isSafeInteger(supplierId) || supplierId! < 1)) {
    return Response.json({ error: "invalid_id" }, { status: 400, headers: noStore });
  }

  if (db) {
    try {
      const state = await readSupplierCatalogState(db, world);
      if (state?.activeRunId) {
        if (supplierId !== null) {
          const entry = await readSupplierCatalogEntry(db, world, supplierId);
          if (!entry) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
          return Response.json({ world, source: "runtime", fetchedAt: entry.acceptedAt, entry }, { headers: noStore });
        }
        const catalog = await readSupplierCatalogSummaries(db, world);
        if (!catalog) throw new Error("catalog_active_generation_missing");
        if (view === "lookup") return Response.json({ world, source: "runtime", fetchedAt: catalog.acceptedAt,
          places: searchPlaceInventory(world === "vacations" ? "vacation" : world === "rooms" ? "hourly" : world,
            catalog.entries.map((entry) => entry.summary)) }, { headers: noStore });
        return Response.json({ world, source: "runtime", fetchedAt: catalog.acceptedAt, entries: catalog.entries }, { headers: noStore });
      }
    } catch (error) {
      console.error("VII runtime catalog unavailable", world, error);
      return Response.json({ error: "catalog_unavailable" }, { status: 503, headers: noStore });
    }
  }

  const fetchedAt = world === "spa" ? spa.generatedAt : world === "rooms" ? hourly.fetchedAt : sergey.fetchedAt;
  const entries = bundledEntries(world);
  if (view === "lookup") return Response.json({ world, source: "bundled-fallback", fetchedAt,
    places: searchPlaceInventory(world === "vacations" ? "vacation" : world === "rooms" ? "hourly" : world,
      entries.map((entry) => entry.summary)) }, { headers: noStore });
  if (supplierId !== null) {
    const entry = entries.find((item) => item.supplierId === supplierId);
    if (!entry) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json({ world, source: "bundled-fallback", fetchedAt,
      entry: { ...entry, detail: bundledDetail(world, supplierId) } }, { headers: noStore });
  }
  return Response.json({ world, source: "bundled-fallback", fetchedAt, entries }, { headers: noStore });
}

export async function GET(request: Request) {
  return catalogResponse(request, await database());
}
