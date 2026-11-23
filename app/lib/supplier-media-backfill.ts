import type { R2Bucket } from "../../types/cloudflare-runtime";
import { collectSupplierMediaSources } from "./supplier-media-candidate-archive.ts";
import { SUPPLIER_MEDIA_OBJECT_PREFIX } from "./supplier-media-identity.ts";
import { archiveSupplierMedia } from "./supplier-media-store.ts";

const STATE_KEY = `${SUPPLIER_MEDIA_OBJECT_PREFIX}operations/spa-backfill.json`;
const READY_KEY = `${SUPPLIER_MEDIA_OBJECT_PREFIX}operations/spa-ready.json`;
export type SupplierMediaBackfillState = { version: 1; inventorySha256: string; total: number; cursor: number; status: "running" | "complete" | "blocked"; failures: Array<{ source: string; code: string }>; updatedAt: string };

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function readSupplierMediaBackfillState(bucket: R2Bucket): Promise<SupplierMediaBackfillState | null> {
  const object = await bucket.get(STATE_KEY);
  if (!object || object.size > 64_000) return null;
  try {
    const state = JSON.parse(await object.text()) as SupplierMediaBackfillState;
    return state.version === 1 && /^[a-f0-9]{64}$/.test(state.inventorySha256)
      && Number.isSafeInteger(state.total) && Number.isSafeInteger(state.cursor)
      && ["running", "complete", "blocked"].includes(state.status) && Array.isArray(state.failures) ? state : null;
  } catch { return null; }
}

async function writeState(bucket: R2Bucket, state: SupplierMediaBackfillState) {
  await bucket.put(STATE_KEY, JSON.stringify(state), { httpMetadata: { contentType: "application/json" }, customMetadata: { inventorySha256: state.inventorySha256, status: state.status } });
}

export async function runSupplierMediaBackfill(entries: unknown, bucket: R2Bucket, input: { fetchImpl?: typeof fetch; limit?: number; retryBlocked?: boolean } = {}) {
  const sources = [...collectSupplierMediaSources({ summary: { rooms: entries } })].sort();
  const inventorySha256 = await digest(sources.join("\n"));
  const existing = await readSupplierMediaBackfillState(bucket);
  let state: SupplierMediaBackfillState = existing && existing.inventorySha256 === inventorySha256
    ? existing
    : { version: 1, inventorySha256, total: sources.length, cursor: 0, status: "running", failures: [], updatedAt: new Date().toISOString() };
  if (state.status === "complete") return state;
  if (state.status === "blocked" && !input.retryBlocked) return state;
  if (state.status === "blocked") state = { ...state, status: "running" };
  const limit = Math.max(1, Math.min(32, input.limit || 20));
  const retrySources = state.cursor >= sources.length && state.failures.length
    ? state.failures.map((failure) => failure.source)
    : null;
  const end = retrySources ? state.cursor : Math.min(sources.length, state.cursor + limit);
  const selected = (retrySources || sources.slice(state.cursor, end)).slice(0, limit);
  const failures: SupplierMediaBackfillState["failures"] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < selected.length) {
      const source = selected[cursor++];
      try { await archiveSupplierMedia(source, bucket, input.fetchImpl); }
      catch (error) { failures.push({ source, code: error instanceof Error && /^[a-z0-9_]{3,100}$/.test(error.message) ? error.message : "supplier_media_backfill_failed" }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, selected.length || 1) }, worker));
  const attempted = new Set(selected);
  const retainedFailures = state.failures.filter((failure) => !attempted.has(failure.source));
  const nextFailures = [...retainedFailures, ...failures];
  const nextCursor = retrySources ? state.cursor : end;
  state = {
    ...state,
    cursor: nextCursor,
    status: nextCursor < sources.length ? "running" : nextFailures.length ? "blocked" : "complete",
    failures: nextFailures,
    updatedAt: new Date().toISOString(),
  };
  await writeState(bucket, state);
  if (state.status === "complete") await bucket.put(READY_KEY, JSON.stringify({ version: 1, inventorySha256, total: sources.length, completedAt: state.updatedAt }), {
    httpMetadata: { contentType: "application/json" }, customMetadata: { inventorySha256, total: String(sources.length) },
  });
  return state;
}

export const supplierMediaBackfillStateKey = STATE_KEY;
export const supplierMediaReadyKey = READY_KEY;

