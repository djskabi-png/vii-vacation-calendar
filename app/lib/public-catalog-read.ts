import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import sergeyDetails from "../data/sergey-place-details.json" with { type: "json" };
import { supplierDisplayDescription } from "../data/supplier-display-text.ts";
import { projectSpaViiSite } from "./spa-editorial-policy.ts";
import type { SpaPlusSite } from "../data/spaplus";
import { readSupplierCatalogEntry, readSupplierCatalogState, readSupplierCatalogSummaries, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";

const catalogCache = new Map<SupplierCatalogWorld, { runId: string; expiresAt: number; items: Promise<unknown[]> }>();

function bundled(world: SupplierCatalogWorld): unknown[] {
  if (world === "spa") return spa.sites;
  if (world === "rooms") return hourly.places;
  return sergey.places.filter((place) => place.world === world);
}

export async function publicCatalogSummaries<T>(world: SupplierCatalogWorld): Promise<T[]> {
  const db = await runtimeCatalogDatabase();
  if (!db) return await publicSummaries(world, bundled(world)) as T[];
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) return await publicSummaries(world, bundled(world)) as T[];
  const cached = catalogCache.get(world);
  if (cached?.runId === state.activeRunId && cached.expiresAt > Date.now()) return await cached.items as T[];
  const runId = state.activeRunId;
  const items = (async () => {
    const accepted = await readSupplierCatalogSummaries(db, world);
    if (!accepted) throw new Error("catalog_active_generation_missing");
    return publicSummaries(world, accepted.entries.map((entry) => entry.summary));
  })();
  catalogCache.set(world, { runId, expiresAt: Date.now() + 5 * 60_000, items });
  try {
    return await items as T[];
  } catch (error) {
    if (catalogCache.get(world)?.items === items) catalogCache.delete(world);
    throw error;
  }
}

async function publicSummaries(world: SupplierCatalogWorld, entries: unknown[]): Promise<unknown[]> {
  if (world === "spa") return Promise.all(entries.map((site) => projectSpaViiSite(site as SpaPlusSite)));
  if (world !== "vacations" && world !== "events") return entries;
  return entries.map((value) => {
    const place = value as { description: string; name: string; location: string; area: string };
    return { ...place, description: supplierDisplayDescription(place) };
  });
}

export async function publicCatalogDetail<T>(world: "vacations" | "events", supplierId: number): Promise<T | null> {
  const db = await runtimeCatalogDatabase();
  const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
  const bundledDetail = (sergeyDetails.details as unknown as Record<string, T>)[slug] || null;
  if (!db) return bundledDetail;
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) return bundledDetail;
  const entry = await readSupplierCatalogEntry(db, world, supplierId);
  return (entry?.detail as T | null) || null;
}
