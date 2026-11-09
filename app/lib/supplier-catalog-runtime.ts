import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import { createSergeyPublicCatalogClient } from "./sergey-public-catalog-client.ts";
import { createSergeyRoomsCatalogClient } from "./sergey-rooms-catalog-client.ts";
import { createSpaPlusCatalogClient } from "./spaplus-catalog-client.ts";
import { runSupplierCatalogSync } from "./supplier-catalog-sync.ts";
import { validateSpaEditorialCandidate } from "./spa-editorial-policy.ts";
import { readSupplierCatalog, type SupplierCatalogEntry, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { catalogInventoryDiagnostics, sanitizeCatalogDiagnostics } from "./supplier-catalog-diagnostics.ts";
import { legacyGalleryFilename } from "./legacy-gallery-media.ts";
import {validSupplierDetailProof} from './supplier-detail-contract.ts';
import { compareSupplierCatalogEntries, catalogContentIntegrityIssues, catalogRemovalWithinGuard } from "./supplier-catalog-sync.ts";
import { archiveGalleryCandidate } from "./gallery-candidate-archive.ts";

export const catalogWorlds: SupplierCatalogWorld[] = ["vacations", "events", "rooms", "spa"];

export function isCatalogWorld(value: unknown): value is SupplierCatalogWorld {
  return typeof value === "string" && catalogWorlds.includes(value as SupplierCatalogWorld);
}

export function supplierDetailRefreshLimit(world: SupplierCatalogWorld, source: "manual" | "scheduled" | "retry") {
  // Vacation details are the largest supplier payload. Both manual and
  // scheduled pulls use a small rotating subset after the observed manual
  // memory failure; every unrefreshed detail remains in the accepted snapshot.
  return world === "vacations" ? 4 : undefined;
}

export async function bundledCatalogBaseline(world: SupplierCatalogWorld): Promise<SupplierCatalogEntry[]> {
  if (world === "spa") return (await import('./catalog-baseline-spa.ts')).entries();
  if (world === "rooms") return (await import('./catalog-baseline-rooms.ts')).entries();
  return (await import('./catalog-baseline-sergey.ts')).entries(world);
}

async function secret(name: "SERGEY_VII_API_TOKEN" | "SPAPLUS_VII_API_KEY") {
  try {
    const runtime = await import("cloudflare:workers");
    const value = (runtime.env as unknown as Record<string, string | undefined>)[name];
    if (value) return value;
  } catch { /* Local tests have no Cloudflare bindings. */ }
  return process.env[name] || "";
}

export async function syncSupplierCatalogWorld(db: D1Database, world: SupplierCatalogWorld,
  source: "manual" | "scheduled" | "retry", options?: { fetchImpl?: typeof fetch; now?: () => Date; runId?: string; detailSupplierId?:number; mediaArchive?: { bucket: R2Bucket; fetchImpl?: typeof fetch } }) {
  const target=options?.detailSupplierId;
  if(target!==undefined&&(source!=='manual'||(world!=='vacations'&&world!=='events')||!Number.isSafeInteger(target)||target<1))throw new Error('invalid_supplier_refresh');
  const apiKey = await secret(world === "spa" ? "SPAPLUS_VII_API_KEY" : "SERGEY_VII_API_TOKEN");
  const client = world === "spa"
    ? createSpaPlusCatalogClient({ apiKey, fetchImpl: options?.fetchImpl })
    : world === "rooms"
      ? createSergeyRoomsCatalogClient({ apiKey, fetchImpl: options?.fetchImpl })
      : createSergeyPublicCatalogClient({ apiKey, fetchImpl: options?.fetchImpl,
        detailRefreshLimit: supplierDetailRefreshLimit(world, source),forceDetailRefresh:source==='manual',
        ...(target!==undefined?{inspectionSupplierId:target,retainUnprovedDetails:false,onlyInspectedDetail:true}:{}),now:options?.now });
  let archivePrevious: SupplierCatalogEntry[] = [];
  return runSupplierCatalogSync(db, {
    id: options?.runId || crypto.randomUUID(), world, source,
    baseline: [], loadBaseline: () => bundledCatalogBaseline(world),
    validateCandidate: async entries => {
      if (world === "spa") await validateSpaEditorialCandidate(entries);
      let archive = options?.mediaArchive;
      if (!archive) try {
        const runtime = await import("cloudflare:workers");
        const bucket = (runtime.env as unknown as { UPLOADS?: R2Bucket }).UPLOADS;
        if (bucket) archive = { bucket };
      } catch { /* Explicit fetch fixtures have no production bindings. */ }
      if (!archive) {
        if (!options?.fetchImpl) throw new Error("gallery_archive_storage_unavailable");
        return;
      }
      await archiveGalleryCandidate({ previous: { detail: { rooms: archivePrevious } }, candidate: { detail: { rooms: entries } }, bucket: archive.bucket, fetchImpl: archive.fetchImpl });
    },
    fetchCandidate: async (previous) => {
      archivePrevious = previous;
      if(world!=="vacations"&&world!=="events")return (client as ReturnType<typeof createSpaPlusCatalogClient> | ReturnType<typeof createSergeyRoomsCatalogClient>).fetchCandidate();
      const candidate=await (client as ReturnType<typeof createSergeyPublicCatalogClient>).fetchCandidate(world,previous);
      if(target===undefined)return candidate;
      const replacement=candidate.entries.find(entry=>entry.supplierId===target);
      if(!replacement)throw new Error('invalid_supplier_refresh');
      if(!await validSupplierDetailProof(replacement.detailProof,replacement,options?.now?.()||new Date(),previous.find(entry=>entry.supplierId===target)))throw new Error('catalog_content_requires_review');
      return {...candidate,sourceInventory:undefined,entries:previous.map(entry=>entry.supplierId===target?replacement:entry)};
    },
    now: options?.now,
  });
}

/** Read-only provider comparison. It deliberately never stages or accepts a candidate. */
export async function inspectSupplierCatalogWorld(db: D1Database, world: Extract<SupplierCatalogWorld, "vacations" | "events">,
  options?: { fetchImpl?: typeof fetch; now?: () => Date; apiKey?: string; supplierId?:number }) {
  const accepted = await readSupplierCatalog(db, world);
  if (!accepted?.entries.length) throw new Error("missing_catalog_baseline");
  const previous = accepted.entries;
  if(options?.supplierId!==undefined&&!previous.some(entry=>entry.supplierId===options.supplierId))throw new Error('invalid_supplier_inspection');
  const apiKey = options?.apiKey || await secret("SERGEY_VII_API_TOKEN");
  const client = createSergeyPublicCatalogClient({ apiKey, fetchImpl: options?.fetchImpl,
    now: options?.now, detailRefreshLimit: supplierDetailRefreshLimit(world, "scheduled"),retainUnprovedDetails:false,inspectionSupplierId:options?.supplierId });
  const candidate = await client.fetchCandidate(world, previous);
  const diff = compareSupplierCatalogEntries(world, previous, candidate.entries);
  const childCount = (entries: SupplierCatalogEntry[]) => entries.reduce((total, entry) => {
    const detail = entry.detail && typeof entry.detail === "object" ? entry.detail as Record<string, unknown> : {};
    const rows = Array.isArray(detail.rooms) ? detail.rooms : [];
    return total + rows.length;
  }, 0);
  const authoritativeDetails = new Set<number>();
  const previousById = new Map(previous.map(entry => [entry.supplierId, entry]));
  for(const entry of candidate.entries)if(await validSupplierDetailProof(entry.detailProof,entry,options?.now?.()||new Date(),previousById.get(entry.supplierId)))authoritativeDetails.add(entry.supplierId);
  const contentIssues = catalogContentIntegrityIssues(world, previous, candidate.entries).filter(issue=>!authoritativeDetails.has(issue.supplierId));
  const imageIssueIds = new Set(contentIssues.filter((issue) => issue.path === "detail.images").map((issue) => issue.supplierId));
  const nextById = new Map(candidate.entries.map((entry) => [entry.supplierId, entry]));
  const missingMediaEvidence = previous.flatMap((old) => {
    const next = nextById.get(old.supplierId);
    if (!next || !imageIssueIds.has(old.supplierId)) return [];
    const oldDetail = old.detail && typeof old.detail === "object" ? old.detail as Record<string, unknown> : {};
    const nextDetail = next.detail && typeof next.detail === "object" ? next.detail as Record<string, unknown> : {};
    const oldImages = Array.isArray(oldDetail.images) ? oldDetail.images : [];
    const nextImages = Array.isArray(nextDetail.images) ? nextDetail.images : [];
    const nextNames = new Set(nextImages.map(legacyGalleryFilename).filter(Boolean));
    const removed = oldImages.map(legacyGalleryFilename).filter((name): name is string => Boolean(name) && !nextNames.has(name));
    const unique = [...new Set(removed)];
    return unique.length ? [{ supplierId: old.supplierId, oldImageCount: oldImages.length, newImageCount: nextImages.length,
      removedTrustedFilenames: unique.slice(0, 10), removedTrustedFilenamesTruncated: unique.length > 10 }] : [];
  });
  return { world, fetchedAt: candidate.fetchedAt, sourceInventory: candidate.sourceInventory, authoritativeDetailIds:[...authoritativeDetails],deferredDetailIds:candidate.deferredDetailIds,deferredDetailIdsTruncated:candidate.deferredDetailIdsTruncated,detailProofIssues:candidate.detailProofIssues, diff: {
    before: diff.before, candidate: diff.after, added: diff.added, changed: diff.changed,
    removed: diff.removed.slice(0, 100), removedTruncated: diff.removed.length > 100,
    removedChildren: diff.removedChildren.slice(0, 100), removedChildrenTruncated: diff.removedChildren.length > 100,
    removalWithinGuard: catalogRemovalWithinGuard(diff.before, diff.removed.length,
      childCount(previous), diff.removedChildren.length),
  }, contentIssues: contentIssues.slice(0, 100), contentIssuesTruncated: contentIssues.length >= 100,
    missingMediaEvidence: missingMediaEvidence.slice(0, 10), missingMediaEvidenceTotal: missingMediaEvidence.length,
    missingMediaEvidenceTruncated: missingMediaEvidence.length > 10,
    diagnostics: sanitizeCatalogDiagnostics(catalogInventoryDiagnostics(world, previous, candidate.entries, diff.changed)) };
}
