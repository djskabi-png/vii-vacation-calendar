#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "app/data/legacy-gallery-media.json"), "utf8"));
const baseUrl = String(process.env.VII_MEDIA_BASE_URL || process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const checkpointPath = resolve(root, process.env.VII_MEDIA_CHECKPOINT || "project_knowledge/evidence/legacy-gallery-prewarm.json");
const concurrency = Math.max(1, Math.min(32, Number(process.env.VII_MEDIA_CONCURRENCY || 12)));
const operationId = `legacy-gallery-v1:${baseUrl}:${manifest.files.length}`;
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

async function loadCheckpoint() {
  try {
    const value = JSON.parse(await readFile(checkpointPath, "utf8"));
    return value.operationId === operationId ? value : null;
  } catch { return null; }
}

const previous = await loadCheckpoint();
const completed = new Set(previous?.completed || []);
const failures = new Map((previous?.failures || []).map((item) => [item.filename, item]));
let dirty = 0;
let saveChain = Promise.resolve();

async function saveCheckpoint(status = "running") {
  const document = {
    schemaVersion: 1,
    operationId,
    status,
    baseUrl,
    total: manifest.files.length,
    completed: [...completed].sort(),
    failures: [...failures.values()].sort((left, right) => left.filename.localeCompare(right.filename)),
    updatedAt: new Date().toISOString(),
  };
  await mkdir(dirname(checkpointPath), { recursive: true });
  const temporary = `${checkpointPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
  await rename(temporary, checkpointPath);
  dirty = 0;
}

function queueCheckpoint(status = "running") {
  saveChain = saveChain.then(() => saveCheckpoint(status));
  return saveChain;
}

async function request(filename, method, attempt = 1) {
  const url = `${baseUrl}/api/vii/media/${encodeURIComponent(filename)}`;
  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: "image/avif,image/webp,image/*", "User-Agent": "VII legacy gallery migration v1" },
      signal: AbortSignal.timeout(30_000),
    });
    const source = response.headers.get("X-VII-Media") || "";
    const contentType = response.headers.get("Content-Type") || "";
    if (response.ok && source === "stored" && (method === "HEAD" || contentType.startsWith("image/"))) return { ok: true, source };
    if (response.ok && method === "GET" && source === "migrated" && contentType.startsWith("image/")) return { ok: true, source };
    if (attempt === 1 && transientStatuses.has(response.status)) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
      return request(filename, method, 2);
    }
    return { ok: false, status: response.status, source, contentType };
  } catch (error) {
    if (attempt === 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
      return request(filename, method, 2);
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runPool(items, worker) {
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

const pending = manifest.files.filter((filename) => !completed.has(filename));
await runPool(pending, async (filename) => {
  const result = await request(filename, "GET");
  if (result.ok) {
    completed.add(filename);
    failures.delete(filename);
  } else {
    failures.set(filename, { filename, phase: "migration", ...result });
  }
  dirty += 1;
  if (dirty >= 100) await queueCheckpoint();
});
await queueCheckpoint(failures.size ? "migration_failed" : "verifying");

if (failures.size) {
  console.error(JSON.stringify({ operationId, status: "migration_failed", completed: completed.size, total: manifest.files.length, failures: failures.size, checkpointPath }, null, 2));
  process.exit(1);
}

const verificationFailures = new Map();
await runPool(manifest.files, async (filename) => {
  const result = await request(filename, "HEAD");
  if (!result.ok) verificationFailures.set(filename, { filename, phase: "verification", ...result });
});

for (const [filename, value] of verificationFailures) failures.set(filename, value);
await queueCheckpoint(failures.size ? "verification_failed" : "succeeded");
console.log(JSON.stringify({
  operationId,
  status: failures.size ? "verification_failed" : "succeeded",
  stored: completed.size - failures.size,
  total: manifest.files.length,
  failures: failures.size,
  checkpointPath,
}, null, 2));
if (failures.size) process.exit(1);
