import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const jsonTargets = [
  "app/data/accepted-runtime-catalog-state.json",
  "app/data/sergey-hourly-catalog.json",
  "app/data/sergey-place-details.json",
  "app/data/sergey-public-catalog.json",
];
const sourceTargets = ["app/lib/event-landing-presentation.ts"];
const legacyPattern = /https:\/\/(?:www\.)?vii\.co\.il\/gallery\/([A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp))/gi;
const files = new Set();

function replaceLegacyUrls(source) {
  return source.replace(legacyPattern, (_match, filename) => {
    files.add(filename);
    return `/api/vii/media/${filename}`;
  });
}

for (const target of [...jsonTargets, ...sourceTargets]) {
  const path = resolve(root, target);
  const source = await readFile(path, "utf8");
  const next = replaceLegacyUrls(source);
  if (target.endsWith(".json")) JSON.parse(next);
  if (next !== source) await writeFile(path, next, "utf8");
}

// Preserve previously migrated names when the source catalogs have already
// been rewritten. This makes the operation deterministic and idempotent.
const manifestPath = resolve(root, "app/data/legacy-gallery-media.json");
try {
  const existing = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const filename of Array.isArray(existing.files) ? existing.files : []) files.add(filename);
} catch { /* First migration has no manifest. */ }

const manifest = {
  schemaVersion: 1,
  source: "verified VII catalog gallery URLs",
  objectPrefix: "legacy-gallery/v1/",
  files: [...files].sort((a, b) => a.localeCompare(b)),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ migratedFiles: manifest.files.length, targets: [...jsonTargets, ...sourceTargets] }, null, 2));
