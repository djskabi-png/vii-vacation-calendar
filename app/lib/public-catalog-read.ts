import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import sergeyDetails from "../data/sergey-place-details.json" with { type: "json" };
import acceptedRuntimeCatalog from "../data/accepted-runtime-catalog-state.json" with { type: "json" };
import { supplierDisplayDescription } from "../data/supplier-display-text.ts";
import { projectSpaViiSite } from "./spa-editorial-policy.ts";
import type { SpaPlusSite } from "../data/spaplus";
import { readSupplierCatalogDetails, readSupplierCatalogDetailSnapshot, readSupplierCatalogReviewDetails, readSupplierCatalogReviewPreviews, readSupplierCatalogState, readSupplierCatalogSummaries, readSupplierCatalogSelectedSummaries, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { readPublishedItems, type ContentType, type EditorialContent } from "./content-studio.ts";
import { managedVacationPriority } from "./vacation-priority.ts";
import { publicCatalogEntryAllowed } from "./public-catalog-policy.ts";

const catalogCache = new Map<SupplierCatalogWorld, { runId: string; expiresAt: number; items: Promise<unknown[]> }>();
const selectedCatalogCache = new Map<string, { expiresAt: number; items: Promise<unknown[]> }>();

function bundled(world: SupplierCatalogWorld): unknown[] {
  if (world === "spa") return spa.sites;
  if (world === "rooms") return hourly.places;
  const accepted = acceptedRuntimeCatalog.worlds[world];
  const activeIds = new Set(accepted.ids);
  const base = sergey.places.filter((place) => place.world === world && activeIds.has(place.supplierId));
  const identities = new Set(base.map((entry) => catalogIdentity(world, entry)));
  const additions = accepted.additions.filter((entry) => !identities.has(catalogIdentity(world, entry)));
  return [...base, ...additions];
}

/**
 * A bounded, build-local public snapshot for the first document only.
 *
 * Listing pages refresh from /api/catalog after hydration and business pages
 * still resolve the selected supplier from the accepted runtime generation.
 * Keeping discovery-only recommendations on this snapshot prevents a cold
 * Worker from reading and parsing every catalog row before it can send HTML.
 */
export async function bundledPublicCatalogSummaries<T>(world: SupplierCatalogWorld): Promise<T[]> {
  return await publicSummaries(world, bundled(world)) as T[];
}

export async function publicCatalogSummaries<T>(world: SupplierCatalogWorld): Promise<T[]> {
  const db = await runtimeCatalogDatabase();
  if (!db) return await publicSummaries(world, bundled(world)) as T[];
  // Editorial content is independent of supplier generation. Start both reads
  // together, without caching manual edits or binding hundreds of IDs to SQL.
  const overlays = readPublishedItems(db, contentTypeForWorld(world)).catch(() => []);
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) return withEditorialOverlays(world, await publicSummaries(world, bundled(world)), await overlays) as T[];
  const cached = catalogCache.get(world);
  if (cached?.runId === state.activeRunId && cached.expiresAt > Date.now()) return withEditorialOverlays(world, await cached.items, await overlays) as T[];
  const runId = state.activeRunId;
  const items = (async () => {
    const accepted = await readSupplierCatalogSummaries(db, world, state);
    if (!accepted) throw new Error("catalog_active_generation_missing");
    return publicSummaries(world, accepted.entries.map((entry) => entry.summary));
  })();
  catalogCache.set(world, { runId, expiresAt: Date.now() + 5 * 60_000, items });
  try {
    return withEditorialOverlays(world, await items, await overlays) as T[];
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

export async function publicCatalogSelectedSummaries<T>(world: SupplierCatalogWorld, supplierIds: readonly number[]): Promise<T[]> {
  const ids = [...new Set(supplierIds)].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 8);
  if (!ids.length) return [];
  const cacheKey = `${world}:${ids.slice().sort((a, b) => a - b).join(",")}`;
  const cached = selectedCatalogCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return await cached.items as T[];
  const fallbackEntries = bundled(world).filter(value => {
    const row = value as { id?: unknown; supplierId?: unknown };
    return ids.includes(Number(world === "spa" ? row.id : row.supplierId));
  });
  const items = (async () => {
    let entries = fallbackEntries;
    try {
      const db = await runtimeCatalogDatabase();
      const selected = db ? await readSupplierCatalogSelectedSummaries(db, world, ids) : null;
      entries = selected ?? fallbackEntries;
    } catch {
      // The bundled data is the last accepted generation. Keep public place
      // pages available if the runtime catalog is temporarily saturated.
      console.warn(`public_catalog_selected_fallback:${world}`);
    }
    // Card photos do not depend on text overlays. Keep the normal publication
    // projection (including spa review policy), without a full-world DB read.
    return await publicSummaries(world, entries);
  })();
  selectedCatalogCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, items });
  try {
    return await items as T[];
  } catch (error) {
    if (selectedCatalogCache.get(cacheKey)?.items === items) selectedCatalogCache.delete(cacheKey);
    throw error;
  }
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
  if (world === "vacations") {
    const selectedHighlights = content.attributes.highlights?.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5) || [];
    return { ...row, name: content.title, description: content.summary,
      curatedRank: managedVacationPriority(content.attributes.homeDealOrder),
      ...(content.attributes.accommodationType ? { type: content.attributes.accommodationType } : {}),
      ...(selectedHighlights.length ? { highlights: selectedHighlights.map((label) => ({ label, icon: "default" })), features: [...new Set([...selectedHighlights, ...(Array.isArray(row.features) ? row.features.filter((item): item is string => typeof item === "string") : [])])] } : {}),
      ...(content.attributes.cardNote ? { cardNote: content.attributes.cardNote } : {}) };
  }
  return { ...row, name: content.title, description: content.summary };
}

function withEditorialOverlays(world: SupplierCatalogWorld, entries: unknown[], published: { key: string; content: EditorialContent }[]) {
    const overlays = new Map(published.map((entry) => [entry.key, entry.content]));
    return entries.map((entry) => {
      const content = overlays.get(catalogIdentity(world, entry));
      return content ? applyEditorial(world, entry, content) : entry;
    });
}

async function publicSummaries(world: SupplierCatalogWorld, entries: unknown[]): Promise<unknown[]> {
  const publicEntries = entries.filter(publicCatalogEntryAllowed);
  if (world === "spa") return Promise.all(publicEntries.map((site) => projectSpaViiSite(site as SpaPlusSite)));
  if (world !== "vacations" && world !== "events") return publicEntries;
  return publicEntries.map((value) => {
    const place = value as { description: string; name: string; location: string; area: string };
    return { ...place, description: supplierDisplayDescription(place) };
  });
}

export async function publicCatalogDetail<T>(world: "vacations" | "events", supplierId: number): Promise<T | null> {
  const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
  const bundledDetail = (sergeyDetails.details as unknown as Record<string, T>)[slug] || null;
  try {
    const db = await runtimeCatalogDatabase();
    if (!db) return bundledDetail;
    const snapshot = await readSupplierCatalogDetailSnapshot(db, world, supplierId);
    if (!snapshot?.activeRunId) return bundledDetail;
    return mergeBundledDetail(snapshot.detail, bundledDetail) as T | null;
  } catch {
    console.warn(`public_catalog_detail_fallback:${world}`);
    return bundledDetail;
  }
}

function nonEmptyArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) && value.length ? value : undefined;
}

/**
 * Accepted runtime rows can predate a newly supported public field. Keep the
 * accepted row authoritative, but hydrate missing presentation contracts from
 * the matching immutable bundled snapshot until that supplier is refreshed.
 * This avoids showing a generic gallery merely because an older accepted row
 * has not reached its bounded refresh window yet.
 */
export function mergeBundledDetail(acceptedValue: unknown, bundledValue: unknown): unknown {
  // Once a generation is accepted, a missing entity is an authoritative
  // removal. Never resurrect it from the bundled snapshot. The bundle may
  // only hydrate presentation fields on an accepted object.
  if (acceptedValue == null) return null;
  if (typeof acceptedValue !== "object" || Array.isArray(acceptedValue)) return acceptedValue;
  if (!bundledValue || typeof bundledValue !== "object" || Array.isArray(bundledValue)) return acceptedValue;
  const accepted = acceptedValue as Record<string, unknown>;
  const bundled = bundledValue as Record<string, unknown>;
  const acceptedRooms = Array.isArray(accepted.rooms) ? accepted.rooms as Record<string, unknown>[] : [];
  const bundledRooms = Array.isArray(bundled.rooms) ? bundled.rooms as Record<string, unknown>[] : [];
  const rooms = acceptedRooms.map((room, index) => {
    const fallback = bundledRooms.find((candidate) => Number(candidate.id) > 0 && Number(candidate.id) === Number(room.id))
      || bundledRooms.find((candidate) => typeof candidate.name === "string" && candidate.name === room.name)
      || bundledRooms[index];
    if (!fallback) return room;
    return {
      ...fallback,
      ...room,
      images: nonEmptyArray(room.images) || fallback.images || [],
      featureGroups: nonEmptyArray(room.featureGroups) || fallback.featureGroups || [],
      features: nonEmptyArray(room.features) || fallback.features || [],
    };
  });
  const merged: Record<string, unknown> = {
    ...bundled,
    ...accepted,
  };
  const galleryGroups = nonEmptyArray(accepted.galleryGroups) || nonEmptyArray(bundled.galleryGroups);
  const featureGroups = nonEmptyArray(accepted.featureGroups) || nonEmptyArray(bundled.featureGroups);
  const features = nonEmptyArray(accepted.features) || nonEmptyArray(bundled.features);
  if (galleryGroups) merged.galleryGroups = galleryGroups;
  if (featureGroups) merged.featureGroups = featureGroups;
  if (features) merged.features = features;
  if (rooms.length || bundledRooms.length) merged.rooms = rooms.length ? rooms : bundledRooms;
  return merged;
}

export async function publicCatalogReviewPreviews<T>(world: "vacations" | "events", supplierIds: readonly number[]): Promise<Map<number, T | null>> {
  const ids = [...new Set(supplierIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return new Map();
  const db = await runtimeCatalogDatabase();
  const snapshot = db ? await readSupplierCatalogReviewPreviews(db, world, ids) : null;
  if (snapshot) return new Map(ids.map((id) => [id, (snapshot.previews.get(id) as T | undefined) || null]));
  return new Map(ids.map((id) => {
    const slug = `${world === "vacations" ? "vacation" : "event"}-${id}`;
    const detail = (sergeyDetails.details as unknown as Record<string, { reviews?: { text?: string }[] }>)[slug];
    const review = detail?.reviews?.find((entry) => typeof entry.text === "string" && entry.text.trim().length >= 30);
    return [id, detail ? { reviews: review ? [review] : [] } as T : null];
  }));
}

export async function publicCatalogDetails<T>(world: "vacations" | "events", supplierIds: readonly number[]): Promise<Map<number, T | null>> {
  return catalogDetails<T>(world, supplierIds, false);
}

export async function publicCatalogReviewDetails<T>(world: "vacations" | "events", supplierIds: readonly number[]): Promise<Map<number, T | null>> {
  return catalogDetails<T>(world, supplierIds, true);
}

async function catalogDetails<T>(world: "vacations" | "events", supplierIds: readonly number[], reviewsOnly: boolean): Promise<Map<number, T | null>> {
  const ids = [...new Set(supplierIds)].filter((supplierId) => Number.isSafeInteger(supplierId) && supplierId > 0);
  const fallback = new Map(ids.map((supplierId) => {
    const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
    return [supplierId, ((sergeyDetails.details as unknown as Record<string, T>)[slug] || null) as T | null];
  }));
  const db = await runtimeCatalogDatabase();
  if (!db) return fallback;
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) return fallback;
  const details = await (reviewsOnly ? readSupplierCatalogReviewDetails(db, world, ids) : readSupplierCatalogDetails(db, world, ids));
  return new Map(ids.map((supplierId) => [supplierId, (details.get(supplierId) as T | null) || null]));
}
