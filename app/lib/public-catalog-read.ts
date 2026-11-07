import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import { acceptedSergeySummaries, acceptedSergeyDetail } from "./accepted-bundled-catalog.ts";
import { supplierDisplayDescription } from "../data/supplier-display-text.ts";
import { projectSpaViiSite } from "./spa-editorial-policy.ts";
import type { SpaPlusSite } from "../data/spaplus";
import { readSupplierCatalogDetails, readSupplierCatalogEntry, readSupplierCatalogReviewDetails, readSupplierCatalogReviewPreviews, readSupplierCatalogState, readSupplierCatalogSummaries, readSupplierCatalogSelectedSummaries, readSupplierCatalogSelectedSummariesPinned, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { publicCatalogDatabase } from "./runtime-database.ts";
import { preparePublishedItemsRead, readPublishedItems, type ContentType, type EditorialContent } from "./content-studio.ts";
import { managedVacationPriority } from "./vacation-priority.ts";
import { publicCatalogEntryAllowed } from "./public-catalog-policy.ts";
import { localGalleryMediaUrl } from "./legacy-gallery-media.ts";
import { projectSergeyPublicCatalogValue } from "./sergey-public-catalog-projection.ts";
import { readOnceInServerRequest } from './server-request-reads.ts';
import type { D1Database } from '../../types/cloudflare-runtime';

const catalogCache = new Map<SupplierCatalogWorld, { runId: string; expiresAt: number; items: Promise<unknown[]> }>();
const selectedCatalogCache = new Map<string, { expiresAt: number; items: Promise<unknown[]> }>();

function bundled(world: SupplierCatalogWorld): unknown[] {
  if (world === "spa") return spa.sites;
  if (world === "rooms") return hourly.places;
  return acceptedSergeySummaries(world);
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
  return readOnceInServerRequest(`public-catalog-summaries:${world}`, () => loadPublicCatalogSummaries<T>(world));
}

async function loadPublicCatalogSummaries<T>(world: SupplierCatalogWorld): Promise<T[]> {
  const db = await runtimeCatalogDatabase();
  if (!db) return await publicSummaries(world, bundled(world)) as T[];
  // The pointer and editorial overlay are independent, bounded reads. Batch
  // them when the D1 adapter supports it, while retaining the old per-read
  // fallbacks so an overlay failure never hides the accepted catalog.
  const bootstrap = await readCatalogBootstrap(db, world);
  const overlays = bootstrap.overlays;
  let state = bootstrap.state;
  try {
    if (bootstrap.stateError) throw bootstrap.stateError;
  } catch {
    // The active-generation pointer is an optimization, not permission to
    // replace a complete accepted world with the global error surface. This
    // read can fail before the summary-row fallback below is reached, so keep
    // the immutable accepted build available at this boundary as well.
    console.warn(`public_catalog_state_fallback:${world}`);
    return withEditorialOverlays(world, await publicSummaries(world, bundled(world)), await overlays) as T[];
  }
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
    // An accepted generation pointer can briefly outlive its materialized
    // summary rows while the supplier refresh is being repaired. Public pages
    // must keep serving the last immutable accepted build instead of replacing
    // the whole world with the generic error surface.
    console.warn(`public_catalog_summaries_fallback:${world}`);
    return withEditorialOverlays(world, await publicSummaries(world, bundled(world)), await overlays) as T[];
  }
}

export async function readCatalogBootstrap(db: D1Database, world: SupplierCatalogWorld): Promise<{
  state: Awaited<ReturnType<typeof readSupplierCatalogState>>;
  overlays: Promise<{ key: string; content: EditorialContent }[]>;
  stateError?: unknown;
}> {
  const type = contentTypeForWorld(world);
  const now = new Date().toISOString();
  try {
    const overlayRead = preparePublishedItemsRead(db, type, "he", now);
    const stateStatement = db.prepare(`SELECT active_run_id AS activeRunId, active_count AS activeCount,
      accepted_at AS acceptedAt FROM supplier_catalog_state WHERE world = ?`).bind(world);
    const decodeOverlay = (result: { results: Array<{ entityKey: string; contentJson: string }> }) => overlayRead.decode(result);
    if (typeof db.batch !== "function") throw new Error("catalog_batch_unavailable");
    const [stateResult, overlayResult] = await db.batch([stateStatement, overlayRead.statement]);
    const state = (stateResult.results?.[0] || null) as Awaited<ReturnType<typeof readSupplierCatalogState>>;
    return { state, overlays: Promise.resolve(decodeOverlay(overlayResult as { results: Array<{ entityKey: string; contentJson: string }> })) };
  } catch (batchError) {
    // D1 batch is atomic at the adapter boundary. Re-run each read once so a
    // transient batch/overlay failure retains the established partial fallback.
    const overlays = readPublishedItems(db, type).catch(() => []);
    try {
      return { state: await readSupplierCatalogState(db, world), overlays };
    } catch (stateError) {
      return { state: null, stateError: stateError || batchError, overlays };
    }
  }
}

function catalogIdentity(world: SupplierCatalogWorld, value: unknown) {
  const row = value as Record<string, unknown>;
  if (world === "spa") return String(Number(row.id) || "");
  if (world === "rooms") return typeof row.id === "string" ? row.id : String(Number(row.supplierId) || "");
  return String(Number(row.supplierId) || "");
}

export async function publicCatalogSelectedSummaries<T>(world: SupplierCatalogWorld, supplierIds: readonly number[]): Promise<T[]> {
  // A verified discovery rail can expose up to twenty cards. Callers such as
  // the gallery endpoint still enforce their own smaller request limit.
  const ids = [...new Set(supplierIds)].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 20);
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
      // A canonical place page must read the same accepted public catalog as
      // /api/catalog. The former runtime-only route could select a stale D1
      // summary while the official public API was already serving Aurora,
      // leaving labels and other supplier fields inconsistent on one page.
      const { database: db } = await publicCatalogDatabase();
      const selected = await readSupplierCatalogSelectedSummaries(db, world, ids);
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

/** Event result joins need current publication and editorial state. Keep this
 * separate from the small, cached gallery/preview reader. Oversized result
 * sets retain the caller's complete-generation fallback, never truncation. */
export async function publicEventResultSummaries<T>(supplierIds: readonly number[]): Promise<T[]> {
  const ids = [...new Set(supplierIds)].filter(id => Number.isSafeInteger(id) && id > 0);
  if (ids.length > 100) throw new Error("event_result_projection_limit");
  if (!ids.length) return [];
  const selectedIds = new Set(ids);
  const fallback = () => bundled("events").filter(value => selectedIds.has(Number((value as { supplierId?: unknown }).supplierId)));
  let entries: unknown[];
  let overlays: Promise<{ key: string; content: EditorialContent }[]> = Promise.resolve([]);
  try {
    const { database: db } = await publicCatalogDatabase();
    overlays = readPublishedItems(db, "events").catch(() => []);
    const state = await readSupplierCatalogState(db, "events");
    entries = state?.activeRunId
      ? await readSupplierCatalogSelectedSummariesPinned(db, "events", state.activeRunId, ids)
      : fallback();
  } catch {
    console.warn("public_event_results_fallback");
    entries = fallback();
  }
  return withEditorialOverlays("events", await publicSummaries("events", entries), await overlays) as T[];
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
    const place = projectSergeyPublicCatalogValue(value) as { description: string; name: string; location: string; area: string };
    return { ...place, description: supplierDisplayDescription(place) };
  });
}

export async function publicCatalogDetail<T>(world: "vacations" | "events", supplierId: number): Promise<T | null> {
  return readOnceInServerRequest(`public-catalog-detail:${world}:${supplierId}`, () => loadPublicCatalogDetail<T>(world, supplierId));
}

async function loadPublicCatalogDetail<T>(world: "vacations" | "events", supplierId: number): Promise<T | null> {
  let bundledPromise: Promise<T | null> | undefined;
  const loadBundle = () => bundledPromise ??= acceptedSergeyDetail<T>(world, supplierId);
  try {
    const { database: db } = await publicCatalogDatabase();
    const entry = await readSupplierCatalogEntry(db, world, supplierId);
    if (entry) {
      // A fully verified accepted refresh already owns every presentation field.
      // Do not parse the entire immutable multi-business gallery bundle first.
      if (hasCompleteAcceptedDetail(entry.detail)) return projectSergeyPublicCatalogValue(entry.detail) as T | null;
      const bundledDetail = await loadBundle();
      return projectSergeyPublicCatalogValue(mergeBundledDetail(entry.detail, bundledDetail)) as T | null;
    }
    const state = await readSupplierCatalogState(db, world);
    if (state?.activeRunId) return null;
  } catch {
    console.warn(`public_catalog_detail_fallback:${world}`);
  }
  const bundledDetail = await loadBundle();
  return projectSergeyPublicCatalogValue(bundledDetail);
}

/** Same contract used by mergeBundledDetail, including intentional empty arrays. */
export function hasCompleteAcceptedDetail(value: unknown, now = Date.now()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const stamp = (value as Record<string, unknown>)._viiCatalog;
  if (!stamp || typeof stamp !== "object" || Array.isArray(stamp)) return false;
  const refresh = stamp as Record<string, unknown>;
  const checked = typeof refresh.checkedAt === "string" ? Date.parse(refresh.checkedAt) : NaN;
  const attempted = typeof refresh.attemptedAt === "string" ? Date.parse(refresh.attemptedAt) : NaN;
  return Number.isFinite(checked) && checked > 0 && checked <= now && Number.isFinite(attempted) && attempted >= checked && attempted <= now;
}

function nonEmptyArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) && value.length ? value : undefined;
}

function galleryGroupTitle(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const title = (value as Record<string, unknown>).title;
  return typeof title === "string" ? title.trim().replace(/\s+/g, " ") : "";
}

function normalizedMediaArray(value: unknown) {
  const source = nonEmptyArray(value);
  if (!source) return undefined;
  const normalized = source.map(localGalleryMediaUrl).filter((image): image is string => Boolean(image));
  return normalized.length ? [...new Set(normalized)] : undefined;
}

function normalizedGalleryGroups(value: unknown): unknown[] | undefined {
  const groups = nonEmptyArray(value);
  if (!groups) return undefined;
  const normalized = groups.flatMap((group) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) return [];
    const images = normalizedMediaArray((group as Record<string, unknown>).images);
    return images?.length ? [{ ...(group as Record<string, unknown>), images }] : [];
  });
  return normalized.length ? normalized : undefined;
}

function isGeneralGalleryTitle(title: string) {
  const normalized = title.toLocaleLowerCase("he-IL");
  return normalized === "גלריה כללית" || normalized === "general gallery" || normalized === "general";
}

function mergedGalleryGroups(acceptedValue: unknown, bundledValue: unknown, acceptedImagesValue?: unknown): unknown[] | undefined {
  const accepted = normalizedGalleryGroups(acceptedValue) || [];
  const bundled = normalizedGalleryGroups(bundledValue) || [];
  if (!accepted.length) {
    const acceptedImages = normalizedMediaArray(acceptedImagesValue) || [];
    if (!acceptedImages.length) return bundled.length ? bundled : undefined;
    const acceptedOrder = new Map(acceptedImages.map((image, index) => [image, index]));
    const hydrated = bundled.flatMap((group) => {
      const record = group as Record<string, unknown>;
      const title = galleryGroupTitle(group);
      const images = (normalizedMediaArray(record.images) || []).filter((image) => acceptedOrder.has(image));
      if (isGeneralGalleryTitle(title)) images.sort((left, right) => (acceptedOrder.get(left) || 0) - (acceptedOrder.get(right) || 0));
      return images.length ? [{ ...record, images }] : [];
    });
    return hydrated.length ? hydrated : undefined;
  }
  if (!bundled.length) return accepted;
  const bundledByTitle = new Map<string, unknown>(bundled.map((group): [string, unknown] => [galleryGroupTitle(group), group]).filter(([title]) => Boolean(title)));
  const acceptedTitles = new Set(accepted.map(galleryGroupTitle).filter(Boolean));
  // Keep runtime rows authoritative for a matching supplier title, but append
  // newly supported supplier-defined groups from the immutable accepted build.
  // This is a union by the supplier's title, never a generic regrouping.
  return [
    ...accepted.map((group) => bundledByTitle.get(galleryGroupTitle(group)) && !nonEmptyArray((group as Record<string, unknown>).images)
      ? { ...(bundledByTitle.get(galleryGroupTitle(group)) as Record<string, unknown>), ...(group as Record<string, unknown>) }
      : group),
    ...bundled.filter((group) => !acceptedTitles.has(galleryGroupTitle(group))),
  ];
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
  if (hasCompleteAcceptedDetail(acceptedValue)) return acceptedValue;
  const refresh = accepted._viiCatalog && typeof accepted._viiCatalog === "object" && !Array.isArray(accepted._viiCatalog) ? accepted._viiCatalog as Record<string, unknown> : {};
  const attempted = typeof refresh.attemptedAt === "string" ? Date.parse(refresh.attemptedAt) : NaN;
  const now = Date.now();
  const mediaChecked=typeof refresh.mediaCheckedAt==='string'?Date.parse(refresh.mediaCheckedAt):NaN;
  const authoritativeMedia=Number.isFinite(mediaChecked)&&mediaChecked>0&&mediaChecked<=now&&Number.isFinite(attempted)&&attempted>=mediaChecked&&attempted<=now;
  const acceptedRooms = Array.isArray(accepted.rooms) ? accepted.rooms as Record<string, unknown>[] : [];
  const bundledRooms = Array.isArray(bundled.rooms) ? bundled.rooms as Record<string, unknown>[] : [];
  const rooms = acceptedRooms.map((room) => {
    const fallback = bundledRooms.find((candidate) => Number(candidate.id) > 0 && Number(candidate.id) === Number(room.id));
    if (!fallback) return room;
    return {
      ...fallback,
      ...room,
      images: authoritativeMedia ? room.images : normalizedMediaArray(room.images) || normalizedMediaArray(fallback.images) || [],
      ...(authoritativeMedia ? {galleryGroups:room.galleryGroups} : {}),
      featureGroups: nonEmptyArray(room.featureGroups) || fallback.featureGroups || [],
      features: nonEmptyArray(room.features) || fallback.features || [],
    };
  });
  const merged: Record<string, unknown> = {
    ...bundled,
    ...accepted,
  };
  merged.images = authoritativeMedia ? accepted.images : normalizedMediaArray(accepted.images) || normalizedMediaArray(bundled.images) || [];
  const galleryGroups = authoritativeMedia ? accepted.galleryGroups : mergedGalleryGroups(accepted.galleryGroups, bundled.galleryGroups, accepted.images);
  const featureGroups = nonEmptyArray(accepted.featureGroups) || nonEmptyArray(bundled.featureGroups);
  const features = nonEmptyArray(accepted.features) || nonEmptyArray(bundled.features);
  if (authoritativeMedia || galleryGroups) merged.galleryGroups = galleryGroups;
  if (featureGroups) merged.featureGroups = featureGroups;
  if (features) merged.features = features;
  if (authoritativeMedia || rooms.length || bundledRooms.length) merged.rooms = authoritativeMedia ? rooms : rooms.length ? rooms : bundledRooms;
  return merged;
}

export async function publicCatalogReviewPreviews<T>(world: "vacations" | "events", supplierIds: readonly number[]): Promise<Map<number, T | null>> {
  const ids = [...new Set(supplierIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return new Map();
  const db = await runtimeCatalogDatabase();
  const snapshot = db ? await readSupplierCatalogReviewPreviews(db, world, ids) : null;
  if (snapshot) return new Map(ids.map((id) => [id, (snapshot.previews.get(id) as T | undefined) || null]));
  const entries = await Promise.all(ids.map(async (id) => {
    const detail = await acceptedSergeyDetail<{ reviews?: { text?: string }[] }>(world, id);
    const review = detail?.reviews?.find((entry) => typeof entry.text === "string" && entry.text.trim().length >= 30);
    return [id, detail ? { reviews: review ? [review] : [] } as T : null] as [number, T | null];
  }));
  return new Map<number, T | null>(entries.map((entry): [number, T | null] => [entry[0], entry[1]]));
}

export async function publicCatalogDetails<T>(world: "vacations" | "events", supplierIds: readonly number[]): Promise<Map<number, T | null>> {
  return catalogDetails<T>(world, supplierIds, false);
}

export async function publicCatalogReviewDetails<T>(world: "vacations" | "events", supplierIds: readonly number[]): Promise<Map<number, T | null>> {
  return catalogDetails<T>(world, supplierIds, true);
}

async function catalogDetails<T>(world: "vacations" | "events", supplierIds: readonly number[], reviewsOnly: boolean): Promise<Map<number, T | null>> {
  const ids = [...new Set(supplierIds)].filter((supplierId) => Number.isSafeInteger(supplierId) && supplierId > 0);
  const fallbackEntries = await Promise.all(ids.map(async (supplierId) =>
    [supplierId, await acceptedSergeyDetail<T>(world, supplierId)] as const));
  const fallback = new Map(fallbackEntries);
  try {
    const db = await runtimeCatalogDatabase();
    if (!db) return fallback;
    const state = await readSupplierCatalogState(db, world);
    if (!state?.activeRunId) return fallback;
    const details = await (reviewsOnly ? readSupplierCatalogReviewDetails(db, world, ids) : readSupplierCatalogDetails(db, world, ids));
    return new Map(ids.map((supplierId) => [supplierId, (details.get(supplierId) as T | null) || null]));
  } catch {
    // Detail enrichment is presentation data, not publication authority. The
    // immutable accepted build must remain usable when the runtime snapshot
    // store is temporarily unavailable, just like the single-detail route.
    console.warn(`public_catalog_details_fallback:${world}`);
    return fallback;
  }
}
