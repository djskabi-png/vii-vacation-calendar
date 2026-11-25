import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyR2Restore } from '../infrastructure/cloudflare/verify-r2-restore.mjs';

test('R2 parity rejects missing files, changed keys, and different bytes at the same size', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vii-r2-restore-verification-'));
  const source = join(root, 'source');
  const restored = join(root, 'restored');
  const sourceFolder = join(source, 'gallery');
  const restoredFolder = join(restored, 'gallery');
  mkdirSync(sourceFolder, { recursive: true });
  mkdirSync(restoredFolder, { recursive: true });
  const sourceFile = join(sourceFolder, 'thumbnail.jpg');
  const restoredFile = join(restoredFolder, 'thumbnail.jpg');
  const renamed = join(restoredFolder, 'other.jpg');
  let restoredPath = restoredFile;
  try {
    writeFileSync(sourceFile, Buffer.from([255, 216, 1, 255, 217]));
    await assert.rejects(verifyR2Restore(source, restored, 1), /export_object_count_mismatch/);
    writeFileSync(restoredFile, Buffer.from([255, 216, 1, 255, 217]));
    assert.deepEqual(await verifyR2Restore(source, restored, 1), {
      scope: 'local-r2-export-key-and-content-parity',
      matchingObjects: 1,
      matchingBytes: '5',
      bucketIdentityVerified: false,
      objectMetadataVerified: false,
      productionReady: false,
    });
    await assert.rejects(verifyR2Restore(source, source, 1), /separate_export_directories_required/);
    writeFileSync(restoredFile, Buffer.from([255, 216, 2, 255, 217]));
    await assert.rejects(verifyR2Restore(source, restored, 1), /export_object_content_mismatch/);
    renameSync(restoredFile, renamed);
    restoredPath = renamed;
    await assert.rejects(verifyR2Restore(source, restored, 1), /export_object_keys_mismatch/);
  } finally {
    for (const path of [sourceFile, restoredPath]) {
      try { unlinkSync(path); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const directory of [sourceFolder, restoredFolder, source, restored, root]) rmdirSync(directory);
  }
});
