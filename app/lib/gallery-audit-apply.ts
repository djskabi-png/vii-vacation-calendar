import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import { GALLERY_AUDIT_PREFIX, downloadGalleryAuditJob, readGalleryAuditItem, readGalleryAuditJob, type AuditWorld } from "./gallery-api-audit-job.ts";
import { buildAcceptedGalleryContract, compareGalleryContracts, parseOrderedJson, type GalleryContract } from "./supplier-gallery-contract.ts";
import { patchGalleryMedia } from "./gallery-media-patch.ts";
import { proveSupplierMediaDetail } from "./supplier-detail-contract.ts";
import { runSupplierCatalogSync } from "./supplier-catalog-sync.ts";
import { readSupplierCatalog, type SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { archiveGalleryCandidate } from "./gallery-candidate-archive.ts";

type ApplyReceipt = { world: AuditWorld; jobId: string; runId: string; state: "reserved" | "accepted" | "not_accepted"; changed: number; skipped: number; verified: number; sourceWarnings?: Array<{ supplierId: number; issues: string[] }>; verificationIssues: Array<{ supplierId: number; issues: string[] }>; finishedAt?: string; errorCode?: string };
const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
// Gallery-only evidence follows the same 24-hour limit as Sergey media proofs.
// Prices, facilities and availability are never patched by this operation.
const MEDIA_EVIDENCE_MAX_AGE = 86_400_000;
// Empty source owners remain explicit audit warnings. They can accompany a
// healthy-owner update only when that owner is already empty in the baseline.
function projectionIssues(api: GalleryContract, actual: GalleryContract) {
  return compareGalleryContracts(api, actual).issues.filter(issue => !issue.startsWith("unverified_empty_owner_media:") && !issue.startsWith("unverified_quarantined_api_media:"));
}
const path = (id: string, world: AuditWorld) => `${GALLERY_AUDIT_PREFIX}${id}/apply/${world}.json`;
export async function readGalleryAuditApply(bucket: R2Bucket, jobId: string, world: AuditWorld) {
  const object = await bucket.get(path(jobId, world)); return object ? JSON.parse(await object.text()) as ApplyReceipt : null;
}
export async function applyGalleryAuditWorld({ db, bucket, jobId, world }: { db: D1Database; bucket: R2Bucket; jobId: string; world: AuditWorld }) {
  const previousReceipt = await readGalleryAuditApply(bucket, jobId, world);
  if (previousReceipt) return previousReceipt; // Reconcile an uncertain request; never blindly reapply it.
  const job = await readGalleryAuditJob(bucket, jobId);
  if (!job || job.state !== "complete" || job.completed !== job.total) throw new Error("gallery_audit_not_complete");
  const findings = (await downloadGalleryAuditJob(bucket, jobId)).trim().split("\n").slice(1).map(value => JSON.parse(value) as { world: AuditWorld; supplierId: number });
  const targets = findings.filter(value => value.world === world);
  if (!targets.length) throw new Error("gallery_audit_world_empty");
  const runId = `gallery-${jobId}-${world}`;
  const receipt: ApplyReceipt = { jobId, world, runId, state: "reserved", changed: 0, skipped: 0, verified: 0, verificationIssues: [] };
  const reserved = await bucket.put(path(jobId, world), JSON.stringify(receipt), { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: "application/json", cacheControl: "private, no-store" } });
  if (!reserved) { const winner = await readGalleryAuditApply(bucket, jobId, world); if (!winner) throw new Error("gallery_apply_reservation_uncertain"); return winner; }
  const checked: Array<{ supplierId: number; api: GalleryContract }> = [];
  try {
    const outcome = await runSupplierCatalogSync(db, { id: runId, world, source: "manual", baseline: [],
      fetchCandidate: async previous => {
        const wanted = new Set(targets.map(target => target.supplierId));
        const listingById = new Map<number, unknown>();
        if (world === "vacations" || world === "events") {
          const listObject = await bucket.get(`${GALLERY_AUDIT_PREFIX}${jobId}/context/${world}.json`);
          if (!listObject) throw new Error("gallery_source_snapshot_missing");
          const list = row(parseOrderedJson(await listObject.text()));
          for (const value of Array.isArray(list.places) ? list.places : []) listingById.set(Number(row(value).siteID), value);
        }
        const entries: SupplierCatalogEntry[] = [];
        for (let offset = 0; offset < previous.length; offset += 4) {
          const window = previous.slice(offset, offset + 4);
          const sourcePairs = await Promise.all(window.map(async current => [current, wanted.has(current.supplierId) ? await readGalleryAuditItem(bucket, jobId, world, current.supplierId) : null] as const));
          const sourceById = new Map(sourcePairs.map(([current, source]) => [current.supplierId, source]));
          const rawById = new Map<number, string>();
          if (world === "vacations" || world === "events") {
            await Promise.all(sourcePairs.map(async ([current, source]) => {
              if (!source?.api || !source.normalized || !source.acceptedContract || !source.normalizedContract || projectionIssues(source.api, source.normalizedContract).length) return;
              const expectedRawKey = `${GALLERY_AUDIT_PREFIX}${jobId}/raw/${world}-${current.supplierId}.json`;
              if (source.rawKey !== expectedRawKey) throw new Error("invalid_gallery_source_reference");
              const rawObject = await bucket.get(String(source.rawKey));
              if (!rawObject) throw new Error("gallery_source_snapshot_missing");
              rawById.set(current.supplierId, await rawObject.text());
            }));
          }
          for (const current of window) {
          // Keep one source record in memory, rather than holding accepted,
          // normalized and API copies for all 545 vacation places at once.
          const source = sourceById.get(current.supplierId);
          if (!source?.api || !source.normalized || !source.acceptedContract || !source.normalizedContract || projectionIssues(source.api, source.normalizedContract).length) { receipt.skipped++; entries.push(current); continue; }
          const contract = await buildAcceptedGalleryContract(world, current);
          if (JSON.stringify([contract.entities, contract.previewImageIds]) !== JSON.stringify([source.acceptedContract.entities, source.acceptedContract.previewImageIds])) throw new Error("gallery_baseline_changed");
          // A source can declare a new empty, incomplete unit. Keep that owner
          // unpublished and explicit in the receipt while repairing existing
          // owners. Never discard an API owner which has usable media.
          let expected: GalleryContract = source.api;
          let normalized = source.normalized as SupplierCatalogEntry;
          const currentKeys = new Set(contract.entities.map(owner => owner.entityKey));
          // The already accepted business owns its place gallery even when it
          // currently has no photos. Adding its API photos adds no new owner.
          currentKeys.add(`${world}:${current.supplierId}:place`);
          const sourceKeys = new Set(expected.entities.map(owner => owner.entityKey));
          if (contract.entities.some(owner => !sourceKeys.has(owner.entityKey))) { receipt.skipped++; entries.push(current); continue; }
          const extraOwners = expected.entities.filter(owner => !currentKeys.has(owner.entityKey));
          if (extraOwners.length) {
            if ((world !== "vacations" && world !== "events") || extraOwners.some(owner => owner.imageIds.length || !owner.entityKey.startsWith(`${world}:${current.supplierId}:room:`))) { receipt.skipped++; entries.push(current); continue; }
            const roomIds = new Set((Array.isArray(row(current.detail).rooms) ? row(current.detail).rooms as unknown[] : []).map(room => Number(row(room).id)));
            normalized = { ...normalized, detail: { ...row(normalized.detail), rooms: (Array.isArray(row(normalized.detail).rooms) ? row(normalized.detail).rooms as unknown[] : []).filter(room => roomIds.has(Number(row(room).id))) } };
            expected = { ...expected, entities: expected.entities.filter(owner => currentKeys.has(owner.entityKey)) };
            (receipt.sourceWarnings ||= []).push({ supplierId: current.supplierId, issues: extraOwners.map(owner => `unverified_unpublished_empty_api_owner:${owner.entityKey}`) });
          }
          if ((source.api as GalleryContract).entities.some(owner => !owner.imageIds.length && contract.entities.some(previous => previous.entityKey === owner.entityKey && previous.imageIds.length > 0))) { receipt.skipped++; entries.push(current); continue; }
          const currentRooms = Array.isArray(row(current.detail).rooms) ? row(current.detail).rooms as unknown[] : [];
          if ((world === "vacations" || world === "events") && currentRooms.length !== (Array.isArray(row(normalized.detail).rooms) ? (row(normalized.detail).rooms as unknown[]).length : -1)) { receipt.skipped++; entries.push(current); continue; }
          const next = patchGalleryMedia(world, current, normalized);
          const patched = await buildAcceptedGalleryContract(world, next);
          if (projectionIssues(expected, patched).length) { receipt.skipped++; entries.push(current); continue; }
          const warnings = compareGalleryContracts(expected, patched).issues.filter(issue => issue.startsWith("unverified_"));
          if (warnings.length) (receipt.sourceWarnings ||= []).push({ supplierId: current.supplierId, issues: [...new Set(warnings)] });
          if (world === "vacations" || world === "events") {
            const wire = rawById.get(current.supplierId);
            if (!wire) throw new Error("gallery_source_snapshot_missing");
            const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wire)))].map(x => x.toString(16).padStart(2, "0")).join("");
            if (sha !== source.finding?.sha256) throw new Error("gallery_source_checksum_changed");
            const listing = listingById.get(current.supplierId);
            const proof = await proveSupplierMediaDetail(parseOrderedJson(wire), listing, next, current, new Date());
            if (!proof) { receipt.skipped++; entries.push(current); continue; }
            next.detailProof = proof;
          } else if (Date.now() - Date.parse(String(source.fetchedAt)) > MEDIA_EVIDENCE_MAX_AGE || Date.parse(String(source.fetchedAt)) > Date.now() + 300_000 || !Number.isFinite(Date.parse(String(source.fetchedAt)))) throw new Error("gallery_evidence_expired");
          await archiveGalleryCandidate({ previous: current, candidate: next, bucket });
          entries.push(next); checked.push({ supplierId: current.supplierId, api: expected });
          if (JSON.stringify(current.summary) !== JSON.stringify(next.summary) || JSON.stringify(current.detail) !== JSON.stringify(next.detail)) receipt.changed++;
        }
        }
        return { entries, fetchedAt: new Date().toISOString() };
      },
    });
    receipt.state = outcome.status === "accepted" ? "accepted" : "not_accepted";
    if (outcome.status !== "accepted") receipt.errorCode = "errorCode" in outcome ? String(outcome.errorCode) : "catalog_lock_busy";
    else {
      // The catalog reader uses eight-row keyset pages. A query per checked
      // place would add 545 queries after an already staged full generation.
      const active = await readSupplierCatalog(db, world);
      const acceptedById = new Map(active?.entries.map(entry => [entry.supplierId, entry]));
      for (let offset = 0; offset < checked.length; offset += 8) {
        const results = await Promise.allSettled(checked.slice(offset, offset + 8).map(async item => {
          const accepted = acceptedById.get(item.supplierId);
          const issues = accepted ? projectionIssues(item.api, await buildAcceptedGalleryContract(world, accepted)) : ["accepted_entry_missing"];
          const comparison = { equal: issues.length === 0, issues };
          if (comparison.equal) receipt.verified++; else receipt.verificationIssues.push({ supplierId: item.supplierId, issues: comparison.issues });
        }));
        if (results.some(value => value.status === "rejected")) receipt.errorCode = "post_apply_verification_incomplete";
      }
    }
  } catch (cause) { receipt.state = "not_accepted"; receipt.errorCode = cause instanceof Error && /^[a-z_]{3,100}$/.test(cause.message) ? cause.message : "gallery_apply_failed"; }
  receipt.finishedAt = new Date().toISOString();
  const saved = await bucket.put(path(jobId, world), JSON.stringify(receipt), { onlyIf: { etagMatches: reserved.etag }, httpMetadata: { contentType: "application/json", cacheControl: "private, no-store" } });
  if (!saved) throw new Error("gallery_apply_receipt_uncertain");
  return receipt;
}
