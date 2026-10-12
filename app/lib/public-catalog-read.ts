import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import sergeyDetails from "../data/sergey-place-details.json" with { type: "json" };
import { supplierDisplayDescription } from "../data/supplier-display-text.ts";
import { readSupplierCatalogEntry, readSupplierCatalogState, readSupplierCatalogSummaries, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";

function bundled(world: SupplierCatalogWorld): unknown[] {
  if (world === "spa") return spa.sites;
  if (world === "rooms") return hourly.places;
  return sergey.places.filter((place) => place.world === world);
}

export async function publicCatalogSummaries<T>(world: SupplierCatalogWorld): Promise<T[]> {
  const db = await runtimeCatalogDatabase();
  if (!db) return publicSummaries(world, bundled(world)) as T[];
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) return publicSummaries(world, bundled(world)) as T[];
  const accepted = await readSupplierCatalogSummaries(db, world);
  if (!accepted) throw new Error("catalog_active_generation_missing");
  return publicSummaries(world, accepted.entries.map((entry) => entry.summary)) as T[];
}

function publicSummaries(world: SupplierCatalogWorld, entries: unknown[]): unknown[] {
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
