import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { verifyD1Restore } from '../infrastructure/cloudflare/verify-d1-restore.mjs';

test('D1 parity detects changed data and schema even when the table counts match', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vii-restore-verification-'));
  const source = join(directory, 'source.sqlite');
  const target = join(directory, 'restored.sqlite');
  const files = [];
  const schema = 'CREATE TABLE records (value); CREATE INDEX records_value ON records(value);';
  const values = ["CAST(X'410042' AS TEXT)", '9223372036854775807', "X'410042'", '42.5', 'NULL', 'NULL'];

  function write(file, sql) {
    const db = new DatabaseSync(file);
    if (!files.includes(file)) files.push(file);
    try { db.exec(sql); }
    finally { db.close(); }
  }

  try {
    write(source, schema + 'INSERT INTO records VALUES (' + values.join('), (') + ');');
    write(target, schema + 'INSERT INTO records VALUES (' + values.toReversed().join('), (') + ');');
    assert.deepEqual(verifyD1Restore(source, target), {
      scope: 'application-sqlite-snapshot-parity',
      matchingTables: 1,
      matchingRows: 6,
      schemaObjects: 2,
      sourceIdentityVerified: false,
      mediaVerified: false,
      productionReady: false,
    });
    assert.throws(() => verifyD1Restore(source, source), /separate_snapshot_files_required/);
    write(target, "UPDATE records SET value = CAST(X'410043' AS TEXT) WHERE typeof(value) = 'text';");
    assert.throws(() => verifyD1Restore(source, target), /table_rows_mismatch/);
    write(target, 'DROP INDEX records_value;');
    assert.throws(() => verifyD1Restore(source, target), /schema_mismatch/);
  } finally {
    for (const file of files) unlinkSync(file);
    rmdirSync(directory);
  }
});
