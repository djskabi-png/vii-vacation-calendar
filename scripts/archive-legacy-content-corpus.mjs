import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const root = process.cwd();
const source = resolve(process.argv[2] || "project_knowledge/legacy-content-snapshot-20261114/legacy-content-corpus.json");
const archive = `${source}.gz`;
const manifestPath = source.replace(/\.json$/i, "-archive-manifest.json");

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

await pipeline(createReadStream(source), createGzip({ level: 9 }), createWriteStream(archive));
const corpus = JSON.parse(await readFile(source, "utf8"));
const [sourceStat, archiveStat, sourceSha256, archiveSha256] = await Promise.all([
  stat(source), stat(archive), sha256(source), sha256(archive),
]);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: source.slice(root.length + 1).replaceAll("\\", "/"),
  archive: archive.slice(root.length + 1).replaceAll("\\", "/"),
  rows: corpus.rows?.length || 0,
  sourceBytes: sourceStat.size,
  archiveBytes: archiveStat.size,
  sourceSha256,
  archiveSha256,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
