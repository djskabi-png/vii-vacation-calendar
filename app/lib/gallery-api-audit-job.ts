import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import { readSupplierCatalogEntry, readSupplierCatalogInventory, type SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { createSergeyPublicCatalogClient } from "./sergey-public-catalog-client.ts";
import { createSergeyRoomsCatalogClient } from "./sergey-rooms-catalog-client.ts";
import { normalizeSpaPlusCatalog } from "./spaplus-catalog-client.ts";
import { buildAcceptedGalleryContract, buildApiGalleryContract, compareGalleryContracts, parseOrderedJson, stringifyOrderedJson, type GalleryContract } from "./supplier-gallery-contract.ts";

export type AuditWorld = GalleryContract["world"];
export type GalleryAuditJobSummary = {
  jobId: string; state: "starting" | "running" | "complete" | "deadline" | "error";
  total: number; completed: number; matched: number; mismatched: number; unverified: number;
  cursor: number; deadline: string; errors: number; sourceIssues: string[];
  worldCounts: Record<AuditWorld, number>;
  sourceRetryUsed?: boolean;
};
type Target = { world: AuditWorld; supplierId: number };
type Finding = Target & { status: "match" | "mismatch" | "unverified"; issues: string[]; recordKey: string; sha256?: string };
type Job = Omit<GalleryAuditJobSummary, "completed" | "matched" | "mismatched" | "unverified" | "errors"> & {
  inventory: Target[]; results: Finding[]; createdAt: string; contextsReady: boolean;
  lease?: { owner: string; until: string };
};
type ProviderEnv = { SERGEY_VII_API_TOKEN?: string; SPAPLUS_VII_API_KEY?: string };
type Options = { db: D1Database; bucket: R2Bucket; now?: () => number };
const worlds: AuditWorld[] = ["vacations", "events", "rooms", "spa"];
const root = "https://bizonline.co.il/api/ai/vii";
const paths = ["/locations", "/vacations", "/vacations/types", "/events", "/events/types", "/rooms", "/rooms/locations", "/rooms/types", "spa"];
export const GALLERY_AUDIT_PREFIX = "vii-gallery-audit/v1/";
const metadata = { contentType: "application/json", cacheControl: "private, no-store" };
const PROVIDER_BODY_MAX = 16_000_000;
const key = (id: string, suffix = "job.json") => `${GALLERY_AUDIT_PREFIX}${id}/${suffix}`;
const contextKey = (id: string, path: string) => key(id, `context/${path === "spa" ? "spa" : path.slice(1).replaceAll("/", "-")}.json`);
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const idNumber = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : typeof v === "string" && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : null;
const message = (e: unknown) => e instanceof Error && /^[a-z_0-9:.-]{3,150}$/.test(e.message) ? e.message : "audit_operation_failed";

async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function immutable(bucket: R2Bucket, name: string, value: string) {
  return bucket.put(name, value, { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: metadata, customMetadata: { sha256: await digest(value) } });
}
async function read(bucket: R2Bucket, id: string) {
  const object = await bucket.get(key(id));
  return object ? { value: JSON.parse(await object.text()) as Job, etag: object.etag } : null;
}
function summary(j: Job): GalleryAuditJobSummary {
  const rows = j.results;
  return { jobId: j.jobId, state: j.state, total: j.total, cursor: j.cursor, deadline: j.deadline,
    completed: rows.length, matched: rows.filter(x => x.status === "match").length,
    mismatched: rows.filter(x => x.status === "mismatch").length,
    unverified: rows.filter(x => x.status === "unverified").length,
    errors: rows.filter(x => x.status === "unverified").length, sourceIssues: j.sourceIssues, worldCounts: j.worldCounts,
    ...(j.sourceRetryUsed ? { sourceRetryUsed: true } : {}) };
}
export async function readGalleryAuditJob(bucket: R2Bucket, id: string) {
  const stored = await read(bucket, id); return stored ? summary(stored.value) : null;
}
export async function createGalleryAuditJob({ db, bucket, jobId = crypto.randomUUID(), now = Date.now }: Options & { jobId?: string }) {
  const previous = await read(bucket, jobId); if (previous) return summary(previous.value);
  const inventory: Target[] = [];
  const worldCounts = { vacations: 0, events: 0, rooms: 0, spa: 0 };
  for (const world of worlds) {
    const current = await readSupplierCatalogInventory(db, world);
    if (!current || !current.entries.length) throw new Error(`missing_world_inventory:${world}`);
    const ids = current.entries.map(x => idNumber(x.supplierId));
    if (ids.some(x => !x) || new Set(ids).size !== ids.length) throw new Error(`invalid_world_inventory:${world}`);
    for (const id of ids) inventory.push({ world, supplierId: id! });
    worldCounts[world] = ids.length;
  }
  const time = now();
  const job: Job = { jobId, state: "starting", total: inventory.length, cursor: 0, deadline: new Date(time + 3_600_000).toISOString(),
    sourceIssues: [], worldCounts, inventory, results: [], createdAt: new Date(time).toISOString(), contextsReady: false };
  await immutable(bucket, key(jobId), JSON.stringify(job));
  const saved = await read(bucket, jobId);
  if (!saved) throw new Error("audit_reservation_unresolved");
  return summary(saved.value);
}

export async function fetchGalleryAuditSource(url: string, headers: Record<string, string>, fetchImpl: typeof fetch = fetch, timeoutMs = 15_000) {
  if (timeoutMs !== 15_000 && timeoutMs !== 30_000) throw new Error("provider_timeout_limit");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetchImpl(url, { headers, signal: controller.signal, redirect: "manual", cache: "no-store" });
    if (response.status >= 300 && response.status < 400) throw new Error("provider_redirect");
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    if (Number(response.headers.get("content-length")) > PROVIDER_BODY_MAX) throw new Error("provider_body_too_large");
    if (!response.body) throw new Error("provider_empty");
    reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength;
      if (bytes > PROVIDER_BODY_MAX) throw new Error("provider_body_too_large"); chunks.push(chunk.value); }
    const all = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
    const wire = new TextDecoder("utf-8", { fatal: true }).decode(all);
    if (!wire.trim()) throw new Error("provider_empty"); parseOrderedJson(wire); return wire;
  } catch (cause) { if (controller.signal.aborted) throw new Error("provider_timeout"); throw cause; }
  finally { clearTimeout(timer); await reader?.cancel().catch(() => {}); }
}
async function provider(path: string, env: ProviderEnv, fetchImpl: typeof fetch) {
  if (path === "spa") {
    if (!env.SPAPLUS_VII_API_KEY?.trim()) throw new Error("spa_key_missing");
    const url = new URL("https://www.spaplus.co.il/vii/"); url.searchParams.set("key", env.SPAPLUS_VII_API_KEY); url.searchParams.set("action", "sites");
    // Match the existing SPA catalog client: this full provider response has
    // taken 21 seconds in production. Other provider reads retain 15 seconds.
    return fetchGalleryAuditSource(url.href, { Accept: "application/json" }, fetchImpl, 30_000);
  }
  if (!env.SERGEY_VII_API_TOKEN?.trim()) throw new Error("supplier_key_missing");
  return fetchGalleryAuditSource(root + path, { Accept: "application/json", Authorization: `Bearer ${env.SERGEY_VII_API_TOKEN}` }, fetchImpl);
}
async function loadContexts(job: Job, bucket: R2Bucket, env: ProviderEnv, fetchImpl: typeof fetch, requiredWorlds: AuditWorld[] = worlds) {
  // The first pass freezes the complete provider inventory. Resumed passes only
  // need the worlds represented by their current batch.
  const required = new Set(job.contextsReady ? requiredWorlds : worlds);
  const requiredPaths = new Set<string>();
  for (const world of required) {
    if (world === "spa") requiredPaths.add("spa");
    else if (world === "rooms") ["/rooms", "/rooms/locations", "/rooms/types"].forEach(path => requiredPaths.add(path));
    else ["/locations", `/${world}`, `/${world}/types`].forEach(path => requiredPaths.add(path));
  }
  const texts = new Map<string, string>();
  for (const path of paths.filter(path => requiredPaths.has(path))) {
    const fetched = await Promise.allSettled([ (async () => {
      const name = contextKey(job.jobId, path); const old = await bucket.get(name);
      if (old) { texts.set(path, await old.text()); return; }
      // Reserve a single attempt. A killed worker cannot silently restart an
      // uncertain provider operation; the job then needs an explicit review.
      const retry = path === "spa" && job.sourceRetryUsed;
      if (!await immutable(bucket, name + (retry ? ".attempt-2" : ".attempt"), JSON.stringify({ at: new Date().toISOString() }))) throw new Error("context_fetch_uncertain");
      try {
        const wire = await provider(path, env, fetchImpl); await immutable(bucket, name, wire); texts.set(path, wire);
      } catch (cause) {
        const context = path === "spa" ? "spa" : path.slice(1).replaceAll("/", "_");
        const code = message(cause);
        await immutable(bucket, name + (retry ? ".error-2" : ".error"), JSON.stringify({ context, code, at: new Date().toISOString() }));
        throw new Error(`provider_context:${context}:${code}`);
      }
    })() ]);
    const failure = fetched.find((item): item is PromiseRejectedResult => item.status === "rejected");
    if (failure) throw failure.reason;
  }
  const active = new Map<AuditWorld, Set<number>>();
  const parsed = new Map<string, Record<string, unknown>>();
  for (const [path, text] of texts) parsed.set(path, record(parseOrderedJson(text)));
  for (const world of required) {
    const body = parsed.get(world === "spa" ? "spa" : `/${world}`)!;
    const ids = world === "spa" ? Object.entries(record(body.sites)).map(([key, value]) => {
      if (body.status !== "ok" || idNumber(record(value).siteid) !== idNumber(key)) throw new Error("invalid_spa_source_inventory"); return idNumber(key);
    }) : (Array.isArray(body.places) ? body.places : []).filter(x => record(x).active === true).map(x => idNumber(record(x).siteID));
    if (!ids.length || ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error(`invalid_source_inventory:${world}`);
    active.set(world, new Set(ids as number[]));
  }
  if (!job.contextsReady) {
    for (const target of job.inventory) if (!active.get(target.world)!.has(target.supplierId)) job.sourceIssues.push(`accepted_not_active:${target.world}:${target.supplierId}`);
    for (const world of worlds) for (const supplierId of active.get(world)!) {
      if (!job.inventory.some(x => x.world === world && x.supplierId === supplierId)) {
        job.inventory.push({ world, supplierId }); job.worldCounts[world]++; job.sourceIssues.push(`api_not_accepted:${world}:${supplierId}`);
      }
    }
    job.total = job.inventory.length; job.contextsReady = true;
  }
  return { texts, parsed, active };
}
async function auditTarget(target: Target, job: Job, options: Options & { env: ProviderEnv; fetchImpl: typeof fetch }, contexts: Awaited<ReturnType<typeof loadContexts>>) {
  const { db, bucket, env, fetchImpl } = options; const { world, supplierId } = target;
  const recordKey = key(job.jobId, `items/${world}-${supplierId}.json`); const prior = await bucket.get(recordKey);
  if (prior) return JSON.parse(await prior.text()).finding as Finding;
  let finding: Finding = { ...target, status: "unverified", issues: [], recordKey }; let evidence: Record<string, unknown> = {};
  try {
    if (!contexts.active.get(world)!.has(supplierId)) throw new Error("supplier_not_active_in_source");
    const accepted = await readSupplierCatalogEntry(db, world, supplierId);
    const attempt = key(job.jobId, `attempts/${world}-${supplierId}.json`);
    let wire: string; let rawKey: string;
    if (world === "spa") { wire = contexts.texts.get("spa")!; rawKey = contextKey(job.jobId, "spa"); }
    else {
      rawKey = key(job.jobId, `raw/${world}-${supplierId}.json`); const saved = await bucket.get(rawKey);
      if (saved) wire = await saved.text();
      else { if (!await immutable(bucket, attempt, JSON.stringify({ at: new Date().toISOString() }))) throw new Error("source_fetch_uncertain");
        wire = await provider(`/${world}/${supplierId}`, env, fetchImpl); await immutable(bucket, rawKey, wire); }
    }
    const parsed = record(parseOrderedJson(wire)); const raw = world === "spa" ? record(record(parsed.sites)[String(supplierId)]) : parsed;
    if (world === "spa" ? idNumber(raw.siteid) !== supplierId : idNumber(raw.id) !== supplierId || raw.active !== true || !Object.hasOwn(raw, "galleries") || !Array.isArray(raw.rooms)) throw new Error("incomplete_or_foreign_gallery_source");
    const sourceList = world === "vacations" || world === "events" ? contexts.parsed.get(`/${world}`) || null : null;
    const listPlace = Array.isArray(sourceList?.places) ? sourceList.places.find(value => idNumber(record(value).siteID) === supplierId) : null;
    const api = await buildApiGalleryContract(world, supplierId, listPlace ? { ...raw, representative_galleries: record(listPlace).galleries } : raw, wire); let normalized: SupplierCatalogEntry | undefined;
    if (world === "spa") {
      const site = record(record(parsed).sites)?.[String(supplierId)];
      normalized = normalizeSpaPlusCatalog({ status: record(parsed).status, sites: { [String(supplierId)]: site } }).find(x => x.supplierId === supplierId);
    }
    else {
      const cachedFetch: typeof fetch = async input => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const path = url.pathname.slice(new URL(root).pathname.length);
        if (url.origin !== new URL(root).origin) throw new Error("foreign_normalizer_request");
        let body = path === `/${world}/${supplierId}` ? wire : contexts.texts.get(path);
        if (!body) throw new Error("unexpected_normalizer_request");
        if (path === `/${world}`) { const list = contexts.parsed.get(path) || record(parseOrderedJson(body));
          body = stringifyOrderedJson({ ...list, places: (list.places as unknown[]).filter(x => idNumber(record(x).siteID) === supplierId) }); }
        return new Response(body, { headers: { "Content-Type": "application/json" } });
      };
      normalized = world === "rooms" ? (await createSergeyRoomsCatalogClient({ apiKey: "private-audit-context", fetchImpl: cachedFetch }).fetchCandidate()).entries[0]
        : (await createSergeyPublicCatalogClient({ apiKey: "private-audit-context", fetchImpl: cachedFetch, inspectionSupplierId: supplierId,
          onlyInspectedDetail: true, forceDetailRefresh: true, retainUnprovedDetails: false }).fetchCandidate(world, [accepted || { supplierId, summary: {} }])).entries.find(x => x.supplierId === supplierId);
    }
    if (!normalized) throw new Error("normalization_not_proven");
    const normalizedContract = await buildAcceptedGalleryContract(world, normalized); const projection = compareGalleryContracts(api, normalizedContract);
    const acceptedContract = accepted ? await buildAcceptedGalleryContract(world, accepted) : null;
    const comparison = acceptedContract ? compareGalleryContracts(api, acceptedContract) : { equal: false, issues: ["accepted_entry_missing"] };
    const issues = [...comparison.issues, ...projection.issues.map(code => `normalization:${code}`), ...(api.excludedImageIds || []).map(filename => `unverified_quarantined_api_media:${filename}`)];
    finding = { ...finding, sha256: await digest(wire), status: !accepted || !api.entities.length || !acceptedContract?.entities.length || !projection.equal || issues.some(x => x.includes("unverified")) ? "unverified" : comparison.equal ? "match" : "mismatch", issues };
    evidence = { rawKey, endpoint: world === "spa" ? "https://www.spaplus.co.il/vii/?action=sites" : `${root}/${world}/${supplierId}`,
      fetchedAt: new Date().toISOString(), api, normalizedContract, acceptedContract, normalized, accepted };
  } catch (cause) { finding.issues = [message(cause)]; }
  await immutable(bucket, recordKey, JSON.stringify({ schemaVersion: 1, finding, ...evidence }));
  const saved = await bucket.get(recordKey); if (!saved) throw new Error("audit_item_save_unresolved"); return JSON.parse(await saved.text()).finding as Finding;
}

export async function stepGalleryAuditJob(options: Options & { jobId: string; env: ProviderEnv; batchSize?: number; fetchImpl?: typeof fetch }) {
  const { bucket, jobId, now = Date.now, fetchImpl = fetch } = options;
  const stored = await read(bucket, jobId); if (!stored) throw new Error("gallery_audit_job_not_found"); const job = stored.value;
  if (["complete", "deadline", "error"].includes(job.state)) return summary(job);
  if (job.lease && Date.parse(job.lease.until) > now()) throw new Error("audit_step_in_progress");
  job.lease = { owner: crypto.randomUUID(), until: new Date(now() + 120_000).toISOString() };
  let revision = await bucket.put(key(jobId), JSON.stringify(job), { onlyIf: { etagMatches: stored.etag }, httpMetadata: metadata });
  if (!revision) throw new Error("audit_step_in_progress");
  async function checkpoint() {
    const next = await bucket.put(key(jobId), JSON.stringify(job), { onlyIf: { etagMatches: revision!.etag }, httpMetadata: metadata });
    if (!next) throw new Error("audit_checkpoint_conflict"); revision = next;
  }
  try {
    if (now() >= Date.parse(job.deadline)) job.state = "deadline";
    else {
      const initialPass = !job.contextsReady;
      const initialContexts = initialPass ? await loadContexts(job, bucket, options.env, fetchImpl, worlds) : null;
      const firstTarget = job.inventory[job.cursor];
      const count = options.batchSize === undefined
        ? (firstTarget?.world === "spa" ? 2 : 4)
        : Math.max(1, Math.min(4, Math.floor(options.batchSize)));
      const targets = job.inventory.slice(job.cursor, job.cursor + count);
      const contexts = initialContexts || await loadContexts(job, bucket, options.env, fetchImpl, [...new Set(targets.map(target => target.world))]);
      job.state = "running"; await checkpoint();
      const findings = await Promise.allSettled(targets.map(target => auditTarget(target, job, { ...options, fetchImpl }, contexts)));
      const failure = findings.find((item): item is PromiseRejectedResult => item.status === "rejected");
      if (failure) throw failure.reason;
      for (const finding of findings) if (finding.status === "fulfilled") { job.results.push(finding.value); job.cursor++; }
      if (job.cursor === job.total) job.state = "complete"; else if (now() >= Date.parse(job.deadline)) job.state = "deadline";
    }
  } catch (cause) { if (message(cause) === "audit_checkpoint_conflict") throw cause; job.state = "error"; job.sourceIssues.push(message(cause)); }
  delete job.lease; await checkpoint(); return summary(job);
}
export async function downloadGalleryAuditJob(bucket: R2Bucket, id: string) {
  const stored = await read(bucket, id); if (!stored) throw new Error("gallery_audit_job_not_found");
  return JSON.stringify({ type: "manifest", ...summary(stored.value) }) + "\n" + stored.value.results.map(x => JSON.stringify(x)).join("\n") + "\n";
}
export async function readGalleryAuditItem(bucket: R2Bucket, id: string, world: AuditWorld, supplierId: number) {
  const item = await bucket.get(key(id, `items/${world}-${supplierId}.json`)); return item ? JSON.parse(await item.text()) : null;
}
/** Private, hash-checked source export. Uses the captured API response only. */
export async function readGalleryAuditSource(bucket: R2Bucket, id: string, world: AuditWorld, supplierId: number) {
  const item = await readGalleryAuditItem(bucket, id, world, supplierId);
  if (!item) return null;
  const expectedKey = world === "spa" ? contextKey(id, "spa") : key(id, `raw/${world}-${supplierId}.json`);
  if (item.rawKey !== expectedKey || !item.finding?.sha256) throw new Error("invalid_audit_source_reference");
  const object = await bucket.get(expectedKey); if (!object) throw new Error("audit_source_missing");
  const wire = await object.text(); if (await digest(wire) !== item.finding.sha256) throw new Error("audit_source_hash_mismatch");
  return wire;
}
/** Explicit operator recovery after the documented SPA deadline changed.
 * Preserves successful contexts and the original deadline; never repeats an
 * uncertain fetch, deletes evidence, or permits a third supplier attempt. */
export async function retryGalleryAuditSources({ bucket, jobId, now = Date.now }: Options & { jobId: string }) {
  const stored = await read(bucket, jobId); if (!stored) throw new Error("gallery_audit_job_not_found");
  const job = stored.value;
  if (job.sourceRetryUsed) return summary(job);
  if (now() >= Date.parse(job.deadline)) throw new Error("gallery_audit_deadline");
  if (job.lease && Date.parse(job.lease.until) > now()) throw new Error("audit_step_in_progress");
  if (job.state !== "error" || job.cursor !== 0 || job.results.length || job.contextsReady
    || !job.sourceIssues.includes("provider_context:spa:provider_timeout")) throw new Error("gallery_source_retry_not_allowed");
  const failure = await bucket.get(contextKey(jobId, "spa") + ".error");
  if (!failure || record(JSON.parse(await failure.text())).code !== "provider_timeout") throw new Error("gallery_source_retry_not_allowed");
  job.sourceRetryUsed = true; job.state = "starting";
  job.sourceIssues = job.sourceIssues.filter(code => code !== "provider_context:spa:provider_timeout"); delete job.lease;
  const saved = await bucket.put(key(jobId), JSON.stringify(job), { onlyIf: { etagMatches: stored.etag }, httpMetadata: metadata });
  if (!saved) { const current = await read(bucket, jobId); if (current?.value.sourceRetryUsed) return summary(current.value); throw new Error("audit_step_in_progress"); }
  return summary(job);
}
export async function readGalleryAuditDiagnostics(bucket: R2Bucket, id: string) {
  const allowed = paths.map(path => path === "spa" ? "spa" : path.slice(1).replaceAll("/", "-"));
  const contexts = [];
  for (const name of allowed) {
    const object = await bucket.get(key(id, `context/${name}.json`));
    const error = await bucket.get(key(id, `context/${name}.json.error-2`)) || await bucket.get(key(id, `context/${name}.json.error`));
    const failure = error ? record(JSON.parse(await error.text())) : null;
    contexts.push({ context: name, state: object ? "stored" : error ? "error" : "not_fetched", bytes: object?.size,
      sha256: object?.customMetadata?.sha256,
      ...(!object && failure && typeof failure.code === "string" && /^[a-z_0-9:.-]{3,150}$/.test(failure.code) ? { errorCode: failure.code } : {}) });
  }
  return contexts;
}
