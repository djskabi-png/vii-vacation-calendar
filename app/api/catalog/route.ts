import sergey from "../../data/sergey-public-catalog.json" with { type: "json" };
import sergeyDetails from "../../data/sergey-place-details.json" with { type: "json" };
import hourly from "../../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../../data/spaplus-catalog.json" with { type: "json" };
import { readSupplierCatalogEntry, readSupplierCatalogState, readSupplierCatalogSummaries, type SupplierCatalogWorld } from "../../lib/supplier-catalog-store.ts";
import type { D1Database } from "../../../types/cloudflare-runtime";
import { searchPlaceInventory } from "../../data/search-place-inventory.ts";
import { projectSpaCatalogEntries } from "../../lib/spa-editorial-policy.ts";
import type { SupplierCatalogEntry } from "../../lib/supplier-catalog-store.ts";
import { publicVacationSearchProperties } from "../../lib/public-vacation-search.ts";
import { publicEventSearchPlaces } from "../../lib/public-event-search.ts";
import type { EventPlace, Property } from "../../data/site-data.ts";
import { safeHourlyDescription } from "../../lib/hourly-description.ts";
import { readPublishedItems } from "../../lib/content-studio.ts";
import { managedVacationPriority } from "../../lib/vacation-priority.ts";
import { runtimeDatabase } from "../../lib/runtime-database.ts";
import { publicCatalogEntryAllowed } from "../../lib/public-catalog-policy.ts";

const noStore = { "Cache-Control": "no-store" };
const publicCatalogCache = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300" };

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

function publicEntryAllowed(world: SupplierCatalogWorld, entry: { summary: unknown }) {
  // Spa has its own strict public projection below. It must see malformed rows
  // so the complete response fails closed instead of silently hiding them.
  return world === "spa" || publicCatalogEntryAllowed(entry.summary);
}

function projectHourlyEntry<T extends { supplierId: number; summary: { id?: string; description?: string | null } }>(entry: T): T {
  if (entry.summary.id !== "hourly-1181") return entry;
  return { ...entry, summary: { ...entry.summary, description: safeHourlyDescription({ id: entry.summary.id, description: entry.summary.description }) } };
}

async function vacationSearchPriority(db: D1Database | null) {
  if (!db) return new Map<number, number>();
  try {
    const items = await readPublishedItems(db, "vacation", "he");
    return new Map(items.flatMap(item => {
      const rank = managedVacationPriority(item.content.attributes.homeDealOrder);
      const id = Number(item.key);
      return rank !== undefined && Number.isSafeInteger(id) && id > 0 ? [[id, rank] as [number, number]] : [];
    }));
  } catch { return new Map<number, number>(); }
}

function withVacationSearchPriority<T extends { supplierId: number; summary: Property }>(entries: T[], priorities: ReadonlyMap<number, number>) {
  return entries.map(entry => {
    const rank = priorities.get(entry.supplierId);
    return { ...entry, summary: { ...entry.summary, curatedRank: rank } };
  });
}

async function database(): Promise<D1Database | null> {
  try {
    return await runtimeDatabase() || null;
  } catch {
    return null;
  }
}

export async function catalogResponse(request: Request, db: D1Database | null) {
  const url = new URL(request.url);
  const world = worldFrom(url.searchParams.get("world"));
  if (!world) return Response.json({ error: "invalid_world" }, { status: 400, headers: noStore });
  const view = url.searchParams.get("view");
  if (view !== null && view !== "lookup" && view !== "search") return Response.json({ error: "invalid_view" }, { status: 400, headers: noStore });
  const rawId = url.searchParams.get("id");
  if ((view === "lookup" || view === "search") && rawId !== null) return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  if (view === "search" && world !== "vacations" && world !== "events") return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
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
          if (!entry || !publicEntryAllowed(world, entry)) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
          const publicEntry = world === "spa" ? (await projectSpaCatalogEntries([entry]))[0] : world === "rooms" ? projectHourlyEntry(entry) : entry;
          return Response.json({ world, source: "runtime", fetchedAt: entry.acceptedAt, entry: publicEntry }, { headers: publicCatalogCache });
        }
        const catalog = await readSupplierCatalogSummaries(db, world);
        if (!catalog) throw new Error("catalog_active_generation_missing");
        const publicEntries = catalog.entries.filter((entry) => publicEntryAllowed(world, entry));
        const entries = world === "spa" ? await projectSpaCatalogEntries(publicEntries) : world === "rooms" ? publicEntries.map((entry) => projectHourlyEntry(entry as { supplierId: number; summary: { id?: string; description?: string | null } })) : publicEntries;
        if (view === "lookup") return Response.json({ world, source: "runtime", fetchedAt: catalog.acceptedAt,
          places: searchPlaceInventory(world === "vacations" ? "vacation" : world === "rooms" ? "hourly" : world,
            entries.map((entry) => entry.summary)) }, { headers: publicCatalogCache });
        if (view === "search") {
          if (world === "events") return Response.json({ world, source: "runtime", fetchedAt: catalog.acceptedAt,
            entries: publicEventSearchPlaces(entries.map((entry) => entry.summary) as EventPlace[], 1).map((summary, index) => ({ ...entries[index], summary })) }, { headers: publicCatalogCache });
          const prioritized = withVacationSearchPriority(entries as { supplierId: number; summary: Property }[], await vacationSearchPriority(db));
          return Response.json({ world, source: "runtime", fetchedAt: catalog.acceptedAt,
            entries: publicVacationSearchProperties(prioritized.map((entry) => entry.summary)).map((summary, index) => ({ ...prioritized[index], summary })) }, { headers: publicCatalogCache });
        }
        return Response.json({ world, source: "runtime", fetchedAt: catalog.acceptedAt, entries }, { headers: publicCatalogCache });
      }
    } catch (error) {
      console.error("VII runtime catalog unavailable", world);
      return Response.json({ error: "catalog_unavailable" }, { status: 503, headers: noStore });
    }
  }

  const fetchedAt = world === "spa" ? spa.generatedAt : world === "rooms" ? hourly.fetchedAt : sergey.fetchedAt;
  const rawEntries = bundledEntries(world).filter((entry) => publicEntryAllowed(world, entry));
  let entries: typeof rawEntries;
  try { entries = world === "spa" ? await projectSpaCatalogEntries(rawEntries as SupplierCatalogEntry[]) as typeof rawEntries : world === "rooms" ? rawEntries.map((entry) => projectHourlyEntry(entry as { supplierId: number; summary: { id?: string; description?: string | null } })) as typeof rawEntries : rawEntries; }
  catch { return Response.json({ error: "catalog_unavailable" }, { status: 503, headers: noStore }); }
  if (view === "lookup") return Response.json({ world, source: "bundled-fallback", fetchedAt,
    places: searchPlaceInventory(world === "vacations" ? "vacation" : world === "rooms" ? "hourly" : world,
      entries.map((entry) => entry.summary)) }, { headers: publicCatalogCache });
  if (view === "search") {
    if (world === "events") return Response.json({ world, source: "bundled-fallback", fetchedAt,
      entries: publicEventSearchPlaces(entries.map((entry) => entry.summary) as EventPlace[], 1).map((summary, index) => ({ ...entries[index], summary })) }, { headers: publicCatalogCache });
    const prioritized = withVacationSearchPriority(entries as { supplierId: number; summary: Property }[], await vacationSearchPriority(db));
    return Response.json({ world, source: "bundled-fallback", fetchedAt,
      entries: publicVacationSearchProperties(prioritized.map((entry) => entry.summary)).map((summary, index) => ({ ...prioritized[index], summary })) }, { headers: publicCatalogCache });
  }
  if (supplierId !== null) {
    const entry = entries.find((item) => item.supplierId === supplierId);
    if (!entry) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json({ world, source: "bundled-fallback", fetchedAt,
      entry: { ...entry, detail: bundledDetail(world, supplierId) } }, { headers: publicCatalogCache });
  }
  return Response.json({ world, source: "bundled-fallback", fetchedAt, entries }, { headers: publicCatalogCache });
}

export async function GET(request: Request) {
  return catalogResponse(request, await database());
}
