import { createHash } from 'node:crypto';
import { convertCatalogSnapshot } from './catalog-converter.mjs';

// Independent consumer: no application helper, authorization or network calls.
// The caller owns private artifact handling. Never print or commit raw rows.
const seed = 'vii-active-catalog-snapshot-v1';
const worlds = new Set(['vacations', 'events', 'rooms', 'spa']);
export function verifyActiveCatalogSnapshot(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 28 * 1024 * 1024 || !text.endsWith('\n')) throw new Error('invalid_snapshot_stream');
  const lines = text.slice(0, -1).split('\n');
  if (lines.length < 14 || lines.length > 5010) throw new Error('invalid_snapshot_stream');
  let manifest, footer, chain = seed;
  const snapshot = { runs: [], entries: [], states: [] };
  const counts = { run: 0, entry: 0, state: 0 };
  const identities = new Set();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line || Buffer.byteLength(line) > 4_000_000) throw new Error('invalid_snapshot_row');
    let value;
    try { value = JSON.parse(line); } catch { throw new Error('invalid_snapshot_row'); }
    if (index === lines.length - 1) {
      footer = value;
      break;
    }
    chain = createHash('sha256').update(chain + '\n' + line + '\n').digest('hex');
    if (index === 0) {
      manifest = value;
      if (value.type !== 'manifest' || value.format !== seed || value.scope !== 'four-active-catalog-generations' ||
        value.consistency !== 'one-read-only-sql-statement' || value.hashAlgorithm !== 'sha256-chain-v1' ||
        value.fullDatabaseExport !== false || value.migrationVerified !== false || value.targetReadVerified !== false || value.fullLaunchReady !== false) throw new Error('invalid_snapshot_manifest');
      continue;
    }
    if (!Object.hasOwn(counts, value.type) || !worlds.has(value.world) || typeof value.key !== 'string' ||
      !value.key || value.key.length > 300 || identities.has(value.type + ':' + value.key) || typeof value.data !== 'string') throw new Error('invalid_snapshot_row');
    identities.add(value.type + ':' + value.key);
    let row;
    try { row = JSON.parse(value.data); } catch { throw new Error('invalid_snapshot_row'); }
    if (!row || row.world !== value.world || (value.type === 'state' ? row.world : row.id) !== value.key) throw new Error('invalid_snapshot_identity');
    if (value.type === 'entry') {
      if (typeof value.summary !== 'string' || (value.detail !== null && typeof value.detail !== 'string')) throw new Error('invalid_snapshot_payload');
      snapshot.entries.push({ ...row, summaryJson: value.summary, detailJson: value.detail });
    } else {
      if (value.summary !== null || value.detail !== null) throw new Error('invalid_snapshot_payload');
      snapshot[value.type === 'run' ? 'runs' : 'states'].push(row);
    }
    counts[value.type]++;
  }
  if (!footer || footer.type !== 'complete' || footer.sha256 !== chain || footer.rows !== lines.length - 2 ||
    counts.run !== 4 || counts.state !== 4 || !manifest.counts ||
    Object.keys(counts).some(key => counts[key] !== manifest.counts[key])) throw new Error('incomplete_or_corrupt_snapshot');
  const canonical = convertCatalogSnapshot(snapshot);
  for (const state of canonical.states) {
    if (!state.active_run_id || state.active_count < 1 || state.lock_run_id !== null || state.lock_until !== null || !state.accepted_at) throw new Error('invalid_snapshot_generation');
  }
  if (canonical.runs.some(run => run.status !== 'accepted') || canonical.entries.some(entry => !canonical.states.some(s => s.active_run_id === entry.run_id && s.world === entry.world))) throw new Error('invalid_snapshot_generation');
  return { snapshot, canonical, proof: { integrityVerified: true, counts, sha256: chain,
    claimedConsistency: manifest.consistency, sourceConsistencyVerified: false,
    fullDatabaseExport: false, targetReadVerified: false, migrationVerified: false, fullLaunchReady: false } };
}
