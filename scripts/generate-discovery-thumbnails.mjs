import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Next's pinned image dependency is used at build time only, never in a Worker.
const sharp = createRequire(import.meta.resolve('next'))('sharp');
const sources = ['app/lib/homepage-presentation.ts', 'app/lib/world-popular-search-defaults.ts'];
const manifestPath = 'app/data/discovery-thumbnails.generated.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const settings = { width: 192, quality: 86, version: 1 };

export async function generateDiscoveryThumbnails({ root = process.cwd(), write = false } = {}) {
  const paths = new Set();
  for (const source of sources) {
    const text = await readFile(resolve(root, source), 'utf8');
    for (const match of text.matchAll(/\/media\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp|avif)/gi)) paths.add(match[0]);
  }
  const entries = {};
  for (const source of [...paths].sort()) {
    if (source.split('/').includes('..')) throw Error('thumbnail_source_path_invalid');
    const original = await readFile(resolve(root, 'public', '.' + source));
    const sourceSha256 = digest(original);
    const fingerprint = digest(Buffer.concat([original, Buffer.from(JSON.stringify(settings))])).slice(0, 20);
    const src = `/assets/vii-thumbnail-${fingerprint}.webp`;
    const bytes = await sharp(original, { limitInputPixels: 40_000_000 })
      .rotate().resize({ width: settings.width, withoutEnlargement: true })
      .webp({ quality: settings.quality }).toBuffer();
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) throw Error('thumbnail_dimensions_missing:' + source);
    const target = resolve(root, 'public', '.' + src);
    if (write) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    } else {
      const stored = await readFile(target);
      if (digest(stored) !== digest(bytes)) throw Error('thumbnail_output_drift:' + source);
    }
    entries[source] = { src, width, height, sourceSha256, sha256: digest(bytes), sourceBytes: original.length, bytes: bytes.length };
  }
  const manifest = JSON.stringify({ version: settings.version, settings, entries }, null, 2) + '\n';
  if (write) await writeFile(resolve(root, manifestPath), manifest);
  else if (await readFile(resolve(root, manifestPath), 'utf8') !== manifest) throw Error('thumbnail_manifest_drift');
  return { count: paths.size, sourceBytes: Object.values(entries).reduce((sum, row) => sum + row.sourceBytes, 0), bytes: Object.values(entries).reduce((sum, row) => sum + row.bytes, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await generateDiscoveryThumbnails({ write: process.argv.includes('--write') })));
}
