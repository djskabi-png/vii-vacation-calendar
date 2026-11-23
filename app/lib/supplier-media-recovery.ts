import spa from "../data/spaplus-catalog.json" with { type: "json" };
import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import { collectSupplierMediaSources } from "./supplier-media-candidate-archive.ts";
import { localSupplierMediaUrl, supplierMediaSourceFromToken } from "./supplier-media-identity.ts";
import { archiveSupplierMedia } from "./supplier-media-store.ts";

const bundledSources = collectSupplierMediaSources({ summary: { rooms: spa.sites } });
const authorization = new WeakMap<D1Database, Map<string, { allowed: boolean; until: number }>>();

export async function catalogReferencesSupplierMedia(db: D1Database | undefined, token: string, now = Date.now()) {
  const source = supplierMediaSourceFromToken(token);
  if (!source) return false;
  if (bundledSources.has(source)) return true;
  if (!db) return false;
  let cache = authorization.get(db);
  if (!cache) { cache = new Map(); authorization.set(db, cache); }
  const hit = cache.get(token);
  if (hit && hit.until > now) return hit.allowed;
  const local = localSupplierMediaUrl(source) || "";
  const rows = await db.prepare(`SELECT e.summary_json AS summaryJson, e.detail_json AS detailJson
    FROM supplier_catalog_entries e JOIN supplier_catalog_state s
      ON s.world=e.world AND s.active_run_id=e.run_id
    WHERE e.world='spa' AND (INSTR(e.summary_json, ?) > 0 OR INSTR(e.summary_json, ?) > 0
      OR INSTR(e.detail_json, ?) > 0 OR INSTR(e.detail_json, ?) > 0) LIMIT 1`)
    .bind(source, local, source, local).all<{ summaryJson: string; detailJson: string | null }>();
  const allowed = Boolean(rows.results?.length);
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(token, { allowed, until: now + (allowed ? 300_000 : 10_000) });
  return allowed;
}

/** Emergency first-read recovery. Scheduled backfill remains the primary path. */
export async function recoverSupplierMedia(token: string, env: { DB?: D1Database; UPLOADS: R2Bucket }, fetchImpl: typeof fetch = fetch) {
  const source = supplierMediaSourceFromToken(token);
  if (!source || !await catalogReferencesSupplierMedia(env.DB, token)) return false;
  await archiveSupplierMedia(source, env.UPLOADS, fetchImpl);
  return true;
}

