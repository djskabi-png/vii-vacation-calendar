import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { encodeRetainedAsset, retainedAssetKey, readRetainedAsset } from '../src/retained-assets.ts';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * Compare an already stored envelope without trusting its build metadata.
 * A content-addressed asset may legitimately have been retained by an older
 * qualified release.  Path, envelope integrity, body digest and expiry still
 * have to pass before it can be reused.
 */
export async function inspectExistingRetainedAsset(encoded, row, now = Date.now(), requiredRetentionMs = 0) {
  if (!encoded) return { status: 'missing' };
  const response = await readRetainedAsset(new Request('https://vii.spaplus.co' + row.path), {
    async get() { return { size: encoded.length, body: new Blob([encoded]).stream() }; },
  }, { now });
  if (!response) return { status: 'conflict', reason: 'invalid_or_expired_existing_asset' };
  const body = Buffer.from(await response.arrayBuffer());
  if (hash(body) !== row.sha256) return { status: 'conflict', reason: 'existing_asset_body_digest_mismatch' };
  if (encoded.length < 5) return { status: 'conflict', reason: 'invalid_existing_envelope' };
  const metadataLength = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength).getUint32(0);
  if (metadataLength < 1 || metadataLength > 4096 || 4 + metadataLength > encoded.length) return { status: 'conflict', reason: 'invalid_existing_envelope' };
  let metadata;
  try { metadata = JSON.parse(Buffer.from(encoded.subarray(4, 4 + metadataLength)).toString('utf8')); } catch { return { status: 'conflict', reason: 'invalid_existing_metadata' }; }
  if (metadata.path !== row.path || metadata.bytes !== body.length || metadata.sha256 !== row.sha256 || !Number.isSafeInteger(metadata.retainUntil) || metadata.retainUntil <= now) {
    return { status: 'conflict', reason: 'existing_asset_identity_or_expiry_mismatch' };
  }
  const remainingMs = metadata.retainUntil - now;
  if (remainingMs <= requiredRetentionMs) return { status: 'extend', remainingMs, source: metadata.source, buildId: metadata.buildId, retainUntil: metadata.retainUntil };
  return { status: 'reuse', remainingMs, source: metadata.source, buildId: metadata.buildId, retainUntil: metadata.retainUntil };
}

/** Preflight the COMPLETE inventory before any write. Each write is reserved
 * durably, never retried, and read back byte-for-byte before acknowledgement. */
export async function captureRetainedAssets(plan, folder, transport, receipt, save, now = Date.now()) {
  if (receipt.state !== 'reserved_before_preflight') throw Error('existing_operation_requires_reconciliation');
  if (plan.schemaVersion !== 1 || !Array.isArray(plan.assets) || plan.assets.length > 2048) throw Error('invalid_asset_plan');
  const requiredRetentionMs = plan.requiredRetentionMs ?? 7 * 86400000;
  if (!Number.isSafeInteger(requiredRetentionMs) || requiredRetentionMs < 86400000 || requiredRetentionMs > 7 * 86400000) throw Error('invalid_retention_window');
  const paths = new Set();
  const prepared = [];
  for (const row of plan.assets) {
    if (paths.has(row.path) || row.file !== row.path.split('/').pop()) throw Error('duplicate_or_invalid_asset_path');
    paths.add(row.path);
    const body = readFileSync(resolve(folder, row.file));
    if (body.length !== row.bytes || hash(body) !== row.sha256) throw Error('source_asset_digest_mismatch');
    const key = await retainedAssetKey(row.path);
    const identity = { path: row.path, source: plan.source, buildId: plan.buildId, createdAt: now, retainUntil: now + 7 * 86400000 };
    const encoded = await encodeRetainedAsset(identity, body, now);
    const existing = await transport.read(key);
    if (existing !== null) {
      const decision = await inspectExistingRetainedAsset(existing, row, now, requiredRetentionMs);
      if (decision.status === 'conflict') throw Error('existing_asset_conflict:' + row.path + ':' + decision.reason);
      prepared.push({ row, key, encoded: decision.status === 'extend' ? encoded : undefined, skip: decision.status === 'reuse', existing: decision });
    } else prepared.push({ row, key, encoded, skip: false, existing: { status: 'missing' } });
  }
  Object.assign(receipt, { state: 'complete_inventory_preflight_passed', count: prepared.length, writes: [],
    reused: prepared.filter(item => item.skip).map(item => ({ path: item.row.path, key: item.key, source: item.existing.source, buildId: item.existing.buildId, retainUntil: new Date(item.existing.retainUntil).toISOString(), remainingMs: item.existing.remainingMs })),
    checkedAt: new Date(now).toISOString() }); save(receipt);
  for (const item of prepared) {
    if (item.skip) continue;
    const op = { path: item.row.path, key: item.key, payloadSha256: hash(item.encoded), state: 'reserved_before_single_put' };
    receipt.writes.push(op); receipt.state = 'writing'; save(receipt);
    try {
      await transport.write(item.key, item.encoded);
      const bytes = await transport.read(item.key);
      if (!bytes || hash(bytes) !== op.payloadSha256) throw Error('retained_asset_readback_mismatch');
      op.state = 'verified'; save(receipt);
    } catch (error) { op.state = 'reconciliation_required'; receipt.state = 'reconciliation_required'; save(receipt); throw error; }
  }
  receipt.state = 'complete'; receipt.finishedAt = new Date().toISOString(); save(receipt);
  return receipt;
}

export function verifyRetainedPredecessor(receipt, source, archiveSha256) {
  if (receipt.state !== 'complete' || receipt.source !== source || receipt.archiveSha256 !== archiveSha256
    || !Number.isInteger(receipt.count) || receipt.count < 0 || receipt.count > 2048
    || !Array.isArray(receipt.writes) || receipt.writes.length > receipt.count
    || receipt.writes.some(row => row.state !== 'verified')
    || new Set(receipt.writes.map(row => row.key)).size !== receipt.writes.length) throw Error('retained_predecessor_not_verified');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv[2] === '--verify-receipt') {
  const [file, source, archiveSha256] = process.argv.slice(3);
  verifyRetainedPredecessor(JSON.parse(readFileSync(file)), source, archiveSha256);
  console.log('RETAINED_PREDECESSOR_VERIFIED');
} else if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [planFile, receiptFile, flag] = process.argv.slice(2);
  if (!planFile || !receiptFile || flag !== '--apply') throw Error('explicit_plan_receipt_apply_required');
  if (existsSync(receiptFile)) throw Error('existing_operation_requires_reconciliation');
  const planBytes = readFileSync(planFile), plan = JSON.parse(planBytes);
  const receipt = { operation: 'retain-qualified-predecessor-assets', attempt: 1, state: 'reserved_before_preflight', planSha256: hash(planBytes), archiveSha256: plan.archiveSha256, source: plan.source, buildId: plan.buildId };
  const save = value => writeFileSync(receiptFile, JSON.stringify(value, null, 2)); save(receipt);
  let token = /^oauth_token\s*=\s*"([^"]+)"/m.exec(readFileSync('C:/Users/Adir/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8'))?.[1];
  if (!token) throw Error('official_wrangler_oauth_unavailable');
  const deadline = Date.now() + 300000;
  // This is the same official REST route used by installed Wrangler r2 object.
  const base = 'https://api.cloudflare.com/client/v4/accounts/45b2f6dcf2cfe44204d2c470cbe682d9/r2/buckets/vii-public-document-cache/objects/';
  const request = async (key, bytes) => {
    if (Date.now() >= deadline) throw Error('retention_operation_deadline');
    return fetch(base + key, { method: bytes ? 'PUT' : 'GET', headers: { Authorization: 'Bearer ' + token, ...(bytes ? { 'Content-Type': 'application/octet-stream', 'cf-r2-data-catalog-check': 'true' } : {}) }, body: bytes, signal: AbortSignal.timeout(Math.min(15000, deadline - Date.now())) });
  };
  try {
    await captureRetainedAssets(plan, dirname(resolve(planFile)), {
      async read(key) {
        const r = await request(key);
        if (r.status === 404) { await r.body?.cancel(); return null; }
        if (!r.ok) { await r.body?.cancel(); throw Error('r2_read_' + r.status); }
        const reader = r.body.getReader(), parts = []; let size = 0;
        try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 8 * 1024 * 1024 + 4100) { await reader.cancel(); throw Error('r2_object_oversize'); } parts.push(part.value); } }
        finally { reader.releaseLock(); }
        return Buffer.concat(parts);
      },
      async write(key, bytes) { const r = await request(key, bytes); await r.arrayBuffer(); if (!r.ok) throw Error('r2_write_' + r.status); },
    }, receipt, save);
    console.log(JSON.stringify({ state: receipt.state, planned: receipt.count, written: receipt.writes.length }));
  } catch (error) { if (receipt.state !== 'reconciliation_required') { receipt.state = 'preflight_failed_no_writes'; receipt.reason = error.message; save(receipt); } throw error; }
  finally { token = undefined; }
}
