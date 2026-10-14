import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import sergeyDetails from "../data/sergey-place-details.json" with { type: "json" };
import { supplierDisplayDescription } from "../data/supplier-display-text.ts";
import { projectSpaViiSite } from "./spa-editorial-policy.ts";
import type { SpaPlusSite } from "../data/spaplus";
import { readSupplierCatalogDetails, readSupplierCatalogEntry, readSupplierCatalogState, readSupplierCatalogSummaries, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { readPublishedContentBatch, type ContentType, type EditorialContent } from "./content-studio.ts";

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
  if (!state?.activeRunId) return await withEditorialOverlays(db, world, await publicSummaries(world, bundled(world))) as T[];
  const cached = catalogCache.get(world);
  if (cached?.runId === state.activeRunId && cached.expiresAt > Date.now()) return await withEditorialOverlays(db, world, await cached.items) as T[];
  const runId = state.activeRunId;
  const items = (async () => {
    const accepted = await readSupplierCatalogSummaries(db, world);
    if (!accepted) throw new Error("catalog_active_generation_missing");
    return publicSummaries(world, accepted.entries.map((entry) => entry.summary));
  })();
  catalogCache.set(world, { runId, expiresAt: Date.now() + 5 * 60_000, items });
  try {
    return await withEditorialOverlays(db, world, await items) as T[];
  } catch (error) {
    if (catalogCache.get(world)?.items === items) catalogCache.delete(world);
    throw error;
  }
}

function catalogIdentity(world: SupplierCatalogWorld, value: unknown) {
  const row = value as Record<string, unknown>;
  if (world === "spa") return String(Number(row.id) || "");
  if (world === "rooms") return typeof row.id === "string" ? row.id : String(Number(row.supplierId) || "");
  return String(Number(row.supplierId) || "");
}

function contentTypeForWorld(world: SupplierCatalogWorld): ContentType {
  if (world === "vacations") return "vacation";
  if (world === "rooms") return "hourly";
  return world;
}

function applyEditorial(world: SupplierCatalogWorld, value: unknown, content: EditorialContent) {
  const row = value as Record<string, unknown>;
  if (world === "spa") return { ...row, title: content.title, shortDescription: content.summary,
    ...(content.body ? { about: content.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) } : {}) };
  return { ...row, name: content.title, description: content.summary };
}

async function withEditorialOverlays(db: NonNullable<Awaited<ReturnType<typeof runtimeCatalogDatabase>>>, world: SupplierCatalogWorld, entries: unknown[]) {
  try {
    const keys = entries.map((entry) => catalogIdentity(world, entry)).filter(Boolean);
    const overlays = await readPublishedContentBatch(db, contentTypeForWorld(world), keys);
    return entries.map((entry) => {
      const content = overlays.get(catalogIdentity(world, entry));
      return content ? applyEditorial(world, entry, content) : entry;
    });
  } catch { return entries; }
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

export async function publicCatalogDetails<T>(world: "vacations" | "events", supplierIds: readonly number[]): Promise<Map<number, T | null>> {
  const ids = [...new Set(supplierIds)].filter((supplierId) => Number.isSafeInteger(supplierId) && supplierId > 0);
  const fallback = new Map(ids.map((supplierId) => {
    const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
    return [supplierId, ((sergeyDetails.details as unknown as Record<string, T>)[slug] || null) as T | null];
  }));
  const db = await runtimeCatalogDatabase();
  if (!db) return fallback;
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) return fallback;
  const details = await readSupplierCatalogDetails(db, world, ids);
  return new Map(ids.map((supplierId) => [supplierId, (details.get(supplierId) as T | null) || null]));
}
