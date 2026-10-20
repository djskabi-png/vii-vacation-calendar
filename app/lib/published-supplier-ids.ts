import catalog from "../data/sergey-public-catalog.json" with { type: "json" };
import type { D1Database } from "../../types/cloudflare-runtime";
import { readSupplierCatalogState, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { runtimeDatabase } from "./runtime-database.ts";

const bundled = {
  vacations: new Set(catalog.places.filter((place) => place.world === "vacations").map((place) => place.supplierId)),
  events: new Set(catalog.places.filter((place) => place.world === "events").map((place) => place.supplierId)),
};

export async function runtimeCatalogDatabase(): Promise<D1Database | null> {
  try {
    return await runtimeDatabase() || null;
  } catch { return null; }
}

export async function publishedSupplierIds(world: Extract<SupplierCatalogWorld, "vacations" | "events">,
  database?: D1Database | null): Promise<ReadonlySet<number>> {
  const db = database === undefined ? await runtimeCatalogDatabase() : database;
  if (!db) return bundled[world];
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) return bundled[world];
  const rows = await db.prepare(`SELECT supplier_id AS supplierId FROM supplier_catalog_entries
    WHERE run_id = ? AND world = ? ORDER BY supplier_id`)
    .bind(state.activeRunId, world).all<{ supplierId: number }>();
  if (rows.results.length !== state.activeCount) throw new Error("catalog_active_generation_incomplete");
  return new Set(rows.results.map((row) => row.supplierId));
}
