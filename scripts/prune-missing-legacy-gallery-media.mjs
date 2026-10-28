#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checkpointPath = resolve(root, process.env.VII_MEDIA_CHECKPOINT || "project_knowledge/evidence/legacy-gallery-prewarm.json");
const manifestPath = resolve(root, "app/data/legacy-gallery-media.json");
const jsonTargets = [
  "app/data/accepted-runtime-catalog-state.json",
  "app/data/sergey-hourly-catalog.json",
  "app/data/sergey-place-details.json",
  "app/data/sergey-public-catalog.json",
];

const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
const failed = new Set((checkpoint.failures || []).map((item) => item?.filename).filter(Boolean));
if (!failed.size) throw new Error("The migration checkpoint has no failed media to prune.");

const routeFor = (filename) => `/api/vii/media/${encodeURIComponent(filename)}`;
const failedRoutes = new Set([...failed].flatMap((filename) => [routeFor(filename), `/api/vii/media/${filename}`]));
const isFailedRoute = (value) => typeof value === "string" && failedRoutes.has(value);

function prune(value) {
  if (Array.isArray(value)) return value.filter((item) => !isFailedRoute(item)).map(prune);
  if (!value || typeof value !== "object") return value;
  for (const [key, child] of Object.entries(value)) {
    if (isFailedRoute(child)) {
      if (key !== "image") delete value[key];
      continue;
    }
    value[key] = prune(child);
  }
  if (isFailedRoute(value.image)) {
    const replacement = Array.isArray(value.images) ? value.images.find((item) => typeof item === "string" && !isFailedRoute(item)) : null;
    if (replacement) value.image = replacement;
    else delete value.image;
  }
  return value;
}

const targetResults = [];
for (const target of jsonTargets) {
  const path = resolve(root, target);
  const source = await readFile(path, "utf8");
  const before = [...failedRoutes].reduce((count, route) => count + source.split(route).length - 1, 0);
  if (!before) {
    targetResults.push({ target, removedReferences: 0 });
    continue;
  }
  const document = prune(JSON.parse(source));
  const pretty = source.includes("\n  \"");
  const next = `${JSON.stringify(document, null, pretty ? 2 : 0)}\n`;
  const remaining = [...failedRoutes].filter((route) => next.includes(route));
  if (remaining.length) throw new Error(`${target} still references ${remaining.length} failed media routes.`);
  await writeFile(path, next, "utf8");
  targetResults.push({ target, removedReferences: before });
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const previousTotal = manifest.files.length;
manifest.files = manifest.files.filter((filename) => !failed.has(filename));
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  checkpointStatus: checkpoint.status,
  failedObjects: failed.size,
  previousTotal,
  nextTotal: manifest.files.length,
  targets: targetResults,
}, null, 2));
