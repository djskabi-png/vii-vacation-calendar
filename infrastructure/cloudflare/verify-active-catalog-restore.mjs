import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { activeCatalogSnapshot } from '../../app/lib/catalog-snapshot.ts';
import { verifyActiveCatalogSnapshot } from '../postgres/catalog-snapshot-reader.mjs';

const migrations = ['0002_sour_tigra.sql', '0003_catalog_diagnostics.sql'];
const tables = [
  ['supplier_catalog_runs', 'runs', 'id world source status startedAt finishedAt beforeCount candidateCount addedCount changedCount removedCount errorCode diagnosticsJson'],
  ['supplier_catalog_entries', 'entries', 'id runId world supplierId summaryJson detailJson'],
  ['supplier_catalog_state', 'states', 'world activeRunId acceptedAt activeCount lockRunId lockUntil'],
];

export async function verifyLocalCatalogRestore(wire) {
  const original = verifyActiveCatalogSnapshot(wire);
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON; BEGIN');
    for (const migration of migrations) {
      database.exec(readFileSync(new URL(`../../drizzle/${migration}`, import.meta.url), 'utf8'));
    }
    for (const [table, family, fields] of tables) {
      const properties = fields.split(' ');
      const columns = properties.map(property => property.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`));
      const placeholders = properties.map(() => '?');
      const insert = database.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`);
      for (const row of original.snapshot[family]) insert.run(...properties.map(property => row[property]));
    }
    database.exec('COMMIT');
    if (database.prepare('PRAGMA foreign_key_check').all().length) throw Error('catalog_restore_integrity_failed');

    const readOnlyAdapter = { prepare: sql => ({ all: async () => ({ success: true, results: database.prepare(sql).all() }) }) };
    const restored = verifyActiveCatalogSnapshot(await new Response(await activeCatalogSnapshot(readOnlyAdapter)).text());
    if (restored.proof.sha256 !== original.proof.sha256) throw Error('catalog_restore_hash_mismatch');

    return {
      scope: 'four-active-catalog-generations',
      storage: 'in-memory-sqlite',
      exactRoundTrip: true,
      sha256: restored.proof.sha256,
      counts: restored.proof.counts,
      fullDatabaseExport: false,
      cloudTargetVerified: false,
      productionReady: false,
    };
  } finally {
    database.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    console.error('Usage: node infrastructure/cloudflare/verify-active-catalog-restore.mjs SNAPSHOT.ndjson');
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(await verifyLocalCatalogRestore(readFileSync(process.argv[2], 'utf8'))));
    } catch {
      console.error('The catalog snapshot could not be verified and restored locally.');
      process.exitCode = 1;
    }
  }
}
