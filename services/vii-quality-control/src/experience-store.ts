import type { D1Database } from '../../../types/cloudflare-runtime';
import { initializeSchemaOnce } from '../../../app/lib/schema-initializer.ts';
import { parseExperienceBatch, histogramUpperBound } from '../../../shared/experience-metrics.ts';

type Store = Pick<D1Database, 'prepare' | 'batch'>;
type BatchRow = { payload_hash: string; status: string };
const dimensions = 'window_start,source_version,build_id,world,route_kind,device,locale,network,cache,metric,status,upper_bound';
const digest = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('');

export function ensureExperienceSchema(db: Store) {
  return initializeSchemaOnce(db, 'quality-experience-v1', async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS quality_experience_batches (id TEXT PRIMARY KEY,payload_hash TEXT NOT NULL,build_id TEXT NOT NULL,received_at INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('reserved','applied')))`),
      db.prepare(`CREATE INDEX IF NOT EXISTS quality_experience_batches_age ON quality_experience_batches(received_at)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS quality_experience_bins (${dimensions.split(',').map(name => `${name} ${['window_start','upper_bound'].includes(name) ? 'INTEGER' : 'TEXT'} NOT NULL`).join(',')},count INTEGER NOT NULL CHECK(count>=0),PRIMARY KEY(${dimensions}))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS quality_experience_observations (id TEXT PRIMARY KEY,context_hash TEXT NOT NULL,metric TEXT NOT NULL,window_start INTEGER NOT NULL,revision INTEGER NOT NULL,status TEXT NOT NULL,upper_bound INTEGER NOT NULL,sample_hash TEXT NOT NULL,first_received_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS quality_experience_observations_age ON quality_experience_observations(first_received_at)`),
    ]);
  });
}

/** Reservation, histogram movement and revisions commit in one D1 transaction.
 * An observation identifies one metric, never a visitor or session. */
export async function ingestExperienceBatch(db: Store, input: unknown, opts: { sourceVersion: string; buildId: string; now?: number }) {
  const now = opts.now ?? Date.now();
  if (!/^[0-9a-f]{40}$/.test(opts.sourceVersion) || !Number.isSafeInteger(now)) return { status: 'invalid' as const };
  const batch = parseExperienceBatch(input, now);
  if (!batch || batch.buildId !== opts.buildId) return { status: 'invalid' as const };
  await ensureExperienceSchema(db);
  const payloadHash = await digest([opts.sourceVersion, batch]);
  const existing = await db.prepare('SELECT payload_hash,status FROM quality_experience_batches WHERE id=?').bind(batch.batchId).first<BatchRow>();
  if (existing) {
    if (existing.payload_hash !== payloadHash) return { status: 'conflict' as const };
    return { status: existing.status === 'applied' ? 'duplicate' as const : 'blocked' as const };
  }
  const contextHash = await digest([opts.sourceVersion, batch.buildId, batch.sampleRateBps, batch.context]);
  const samples = await Promise.all(batch.samples.map(async sample => ({ ...sample, hash: await digest(sample), bound: histogramUpperBound(sample.metric, sample.status, sample.value) })));
  const conflict = samples.map(() => '(id=? AND (context_hash<>? OR metric<>? OR (revision=? AND sample_hash<>?)))').join(' OR ');
  const conflictValues = samples.flatMap(sample => [sample.observationId, contextHash, sample.metric, sample.revision, sample.hash]);
  const statements = [db.prepare(`INSERT OR IGNORE INTO quality_experience_batches(id,payload_hash,build_id,received_at,status) SELECT ?,?,?,?,'reserved' WHERE NOT EXISTS(SELECT 1 FROM quality_experience_observations WHERE ${conflict})`).bind(batch.batchId, payloadHash, batch.buildId, now, ...conflictValues)];
  const guard = `EXISTS(SELECT 1 FROM quality_experience_batches WHERE id=? AND payload_hash=? AND status='reserved')`;
  const guardValues = [batch.batchId, payloadHash];
  const windowStart = Math.floor(now / 300000) * 300000;
  for (const sample of samples) {
    const context = [opts.sourceVersion, batch.buildId, batch.context.world, batch.context.routeKind, batch.context.device, batch.context.locale, batch.context.network, batch.context.cache, sample.metric];
    const newer = 'SELECT 1 FROM quality_experience_observations WHERE id=? AND revision>=?';
    statements.push(db.prepare(`UPDATE quality_experience_bins SET count=count-1 WHERE ${dimensions.split(',').slice(1,10).map(name => `${name}=?`).join(' AND ')} AND (window_start,status,upper_bound) IN (SELECT window_start,status,upper_bound FROM quality_experience_observations WHERE id=? AND revision<?) AND ${guard}`).bind(...context, sample.observationId, sample.revision, ...guardValues));
    statements.push(db.prepare(`INSERT INTO quality_experience_bins(${dimensions},count) SELECT COALESCE((SELECT window_start FROM quality_experience_observations WHERE id=?),?),${Array(11).fill('?').join(',')},1 WHERE ${guard} AND NOT EXISTS(${newer}) ON CONFLICT(${dimensions}) DO UPDATE SET count=count+1`).bind(sample.observationId, windowStart, ...context, sample.status, sample.bound, ...guardValues, sample.observationId, sample.revision));
    statements.push(db.prepare(`INSERT INTO quality_experience_observations(id,context_hash,metric,window_start,revision,status,upper_bound,sample_hash,first_received_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,upper_bound=excluded.upper_bound,sample_hash=excluded.sample_hash,updated_at=excluded.updated_at WHERE quality_experience_observations.revision<excluded.revision`).bind(sample.observationId, contextHash, sample.metric, windowStart, sample.revision, sample.status, sample.bound, sample.hash, now, now, ...guardValues));
  }
  statements.push(db.prepare(`UPDATE quality_experience_batches SET status='applied' WHERE id=? AND payload_hash=? AND status='reserved'`).bind(...guardValues));
  const results = await db.batch(statements);
  const recorded = await db.prepare('SELECT payload_hash,status FROM quality_experience_batches WHERE id=?').bind(batch.batchId).first<BatchRow>();
  if (!recorded || recorded.payload_hash !== payloadHash) return { status: 'conflict' as const };
  if (recorded.status !== 'applied') return { status: 'blocked' as const };
  return { status: results[0]?.meta?.changes === 0 ? 'duplicate' as const : 'applied' as const, batchId: batch.batchId };
}

/** Every invocation has a fixed delete budget, independent of history size. */
export async function pruneExperience(db: Store, now = Date.now()) {
  await ensureExperienceSchema(db);
  await db.batch([
    db.prepare('DELETE FROM quality_experience_batches WHERE id IN (SELECT id FROM quality_experience_batches WHERE received_at<? ORDER BY received_at LIMIT 500)').bind(now - 86400000),
    db.prepare('DELETE FROM quality_experience_observations WHERE id IN (SELECT id FROM quality_experience_observations WHERE first_received_at<? ORDER BY first_received_at LIMIT 500)').bind(now - 86400000),
    db.prepare('DELETE FROM quality_experience_bins WHERE rowid IN (SELECT rowid FROM quality_experience_bins WHERE window_start<? ORDER BY window_start LIMIT 500)').bind(now - 30 * 86400000),
  ]);
}
