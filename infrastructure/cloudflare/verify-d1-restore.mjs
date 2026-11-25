import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

const identifier = name => '"' + name.replaceAll('"', '""') + '"';
const sha256 = value => createHash('sha256').update(value).digest('hex');

function readSchema(database) {
  return database.prepare(
    "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name COLLATE BINARY",
  ).all().filter(({ name, tbl_name: table }) =>
    // D1 owns _cf_ metadata. SQLite statistics are rebuilt by the target.
    !name.startsWith('_cf_') && !table.startsWith('_cf_')
    && (!name.startsWith('sqlite_') || name.startsWith('sqlite_autoindex_') || name === 'sqlite_sequence'));
}

function rowDigest(row) {
  // Preserve SQLite storage classes, including integers outside the JS safe
  // integer range and BLOB bytes. Each nested value has an explicit boundary.
  return sha256(JSON.stringify(row.map(value => {
    if (value instanceof Uint8Array) return ['blob', Buffer.from(value).toString('hex')];
    if (typeof value === 'bigint') return ['integer', String(value)];
    if (typeof value === 'number') {
      const bytes = Buffer.allocUnsafe(8);
      bytes.writeDoubleBE(value);
      return ['real', bytes.toString('hex')];
    }
    return value;
  })));
}

function tableProof(database, table) {
  const tableName = identifier(table);
  const columns = database.prepare('PRAGMA table_xinfo(' + tableName + ')').all();
  const projection = columns.filter(column => column.hidden !== 1).flatMap(({ name }) => {
    const field = identifier(name);
    const storageClass = 'typeof(' + field + ')';
    // Preserve embedded NULs and raw SQLite text bytes without a JS decode.
    return [storageClass, `CASE WHEN ${storageClass} = 'text' THEN CAST(${field} AS BLOB) ELSE ${field} END`];
  });
  const statement = database.prepare('SELECT ' + projection.join(', ') + ' FROM ' + tableName);
  statement.setReturnArrays(true);
  statement.setReadBigInts(true);
  const rows = Array.from(statement.iterate(), rowDigest).sort();
  const hash = createHash('sha256');
  for (const row of rows) hash.update(row);
  return { rows: rows.length, sha256: hash.digest('hex') };
}

function openSnapshot(file) {
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    database.exec('PRAGMA trusted_schema = OFF; BEGIN');
    const integrity = database.prepare('PRAGMA integrity_check(1)').get();
    if (integrity?.integrity_check !== 'ok') throw Error('integrity_check_failed');
    if (database.prepare('PRAGMA foreign_key_check').get()) throw Error('foreign_key_check_failed');
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function verifyD1Restore(sourceFile, restoredFile) {
  const sourceFileStat = statSync(sourceFile, { bigint: true });
  const restoredFileStat = statSync(restoredFile, { bigint: true });
  if (!sourceFileStat.isFile() || !restoredFileStat.isFile()) throw Error('snapshot_file_required');
  if (sourceFileStat.dev === restoredFileStat.dev && sourceFileStat.ino === restoredFileStat.ino) {
    throw Error('separate_snapshot_files_required');
  }

  const source = openSnapshot(sourceFile);
  let restored;
  try {
    restored = openSnapshot(restoredFile);
    const schema = readSchema(source);
    if (JSON.stringify(schema) !== JSON.stringify(readSchema(restored))) throw Error('schema_mismatch');
    const tables = schema.filter(object => object.type === 'table');
    if (!tables.length) throw Error('snapshot_has_no_tables');

    let rowCount = 0;
    for (const { name } of tables) {
      const before = tableProof(source, name);
      const after = tableProof(restored, name);
      if (before.rows !== after.rows || before.sha256 !== after.sha256) throw Error('table_rows_mismatch');
      rowCount += before.rows;
    }

    return {
      scope: 'application-sqlite-snapshot-parity',
      matchingTables: tables.length,
      matchingRows: rowCount,
      schemaObjects: schema.length,
      sourceIdentityVerified: false,
      mediaVerified: false,
      productionReady: false,
    };
  } finally {
    restored?.close();
    source.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) {
    console.error('Usage: node infrastructure/cloudflare/verify-d1-restore.mjs SOURCE.sqlite RESTORED.sqlite');
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(verifyD1Restore(process.argv[2], process.argv[3])));
    } catch (error) {
      // SQLite errors can include values, paths, or schema details.
      const safeCodes = new Set(['snapshot_file_required', 'separate_snapshot_files_required', 'integrity_check_failed',
        'foreign_key_check_failed', 'schema_mismatch', 'snapshot_has_no_tables', 'table_rows_mismatch']);
      console.error(safeCodes.has(error?.message) ? error.message : 'snapshot_comparison_failed');
      process.exitCode = 1;
    }
  }
}
