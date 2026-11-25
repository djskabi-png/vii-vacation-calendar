import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

function nested(root, path) {
  const offset = relative(root, path);
  return !offset || (!isAbsolute(offset) && !/^\.\.(?:[/\\]|$)/.test(offset));
}

async function filesIn(root) {
  const objects = new Map();
  async function visit(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const key = prefix + entry.name;
      if (entry.isDirectory()) await visit(path, key + '/');
      else if (entry.isFile()) objects.set(key, path);
      else throw Error('unsupported_export_entry');
    }
  }
  await visit(root, '');
  return objects;
}

async function fileProof(path) {
  const before = await lstat(path, { bigint: true });
  if (!before.isFile()) throw Error('unsupported_export_entry');
  const hash = createHash('sha256');
  let bytes = 0n;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    bytes += BigInt(chunk.length);
  }
  const after = await lstat(path, { bigint: true });
  if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino
      || before.size !== bytes || after.size !== bytes || before.ctimeNs !== after.ctimeNs) {
    throw Error('export_changed_during_check');
  }
  return { bytes, sha256: hash.digest('hex') };
}

export async function verifyR2Restore(sourceDirectory, restoredDirectory, recordedObjectCount) {
  if (!Number.isSafeInteger(recordedObjectCount) || recordedObjectCount < 1) throw Error('source_object_count_required');
  const [source, restored] = await Promise.all([realpath(sourceDirectory), realpath(restoredDirectory)]);
  if (nested(source, restored) || nested(restored, source)) throw Error('separate_export_directories_required');
  const [before, after] = await Promise.all([filesIn(source), filesIn(restored)]);
  if (before.size !== recordedObjectCount || after.size !== recordedObjectCount) throw Error('export_object_count_mismatch');
  let bytes = 0n;
  for (const [key, sourcePath] of before) {
    const restoredPath = after.get(key);
    if (!restoredPath) throw Error('export_object_keys_mismatch');
    const [left, right] = await Promise.all([fileProof(sourcePath), fileProof(restoredPath)]);
    if (left.bytes !== right.bytes || left.sha256 !== right.sha256) throw Error('export_object_content_mismatch');
    bytes += left.bytes;
  }
  return {
    scope: 'local-r2-export-key-and-content-parity',
    matchingObjects: recordedObjectCount,
    matchingBytes: String(bytes),
    bucketIdentityVerified: false,
    objectMetadataVerified: false,
    productionReady: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 5 || !/^[1-9]\d*$/.test(process.argv[4])) {
    console.error('Usage: node infrastructure/cloudflare/verify-r2-restore.mjs SOURCE_DIR RESTORED_DIR SOURCE_OBJECT_COUNT');
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(await verifyR2Restore(process.argv[2], process.argv[3], Number(process.argv[4]))));
    } catch (error) {
      const safeCodes = new Set(['source_object_count_required', 'separate_export_directories_required',
        'unsupported_export_entry', 'export_changed_during_check', 'export_object_count_mismatch',
        'export_object_keys_mismatch', 'export_object_content_mismatch']);
      console.error(safeCodes.has(error?.message) ? error.message : 'media_export_comparison_failed');
      process.exitCode = 1;
    }
  }
}
