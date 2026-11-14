#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const archivePath = resolve(root, "app/data/inactive-business-archive.generated.json");
const archiveBytes = await readFile(archivePath);
const archive = JSON.parse(archiveBytes.toString("utf8"));
const filenames = [...new Set(
  archive.records.flatMap((record) => record.images || [])
    .map((value) => basename(String(value)))
    .filter((value) => /^[A-Za-z0-9._-]+$/.test(value)),
)].sort();
const baseUrl = String(process.env.VII_MEDIA_BASE_URL || process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const checkpointPath = resolve(root, process.env.VII_MEDIA_CHECKPOINT || "project_knowledge/evidence/inactive-business-media-prewarm.json");
const concurrency = Math.max(1, Math.min(24, Number(process.env.VII_MEDIA_CONCURRENCY || 12)));
const archiveHash = createHash("sha256").update(archiveBytes).digest("hex");
const operationId = `inactive-business-media-v1:${baseUrl}:${archiveHash}:${filenames.length}`;
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const acceptedSources = new Set(["stored", "catalog-imported", "migrated"]);

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
    archiveHash,
    total: filenames.length,
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
      headers: { Accept: "image/avif,image/webp,image/*", "User-Agent": "VII inactive business media archive v1" },
      signal: AbortSignal.timeout(30_000),
    });
    const source = response.headers.get("X-VII-Media") || "";
    const contentType = response.headers.get("Content-Type") || "";
    if (response.ok && acceptedSources.has(source) && (method === "HEAD" || contentType.startsWith("image/"))) {
      return { ok: true, source };
    }
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
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(workers);
}

await runPool(filenames.filter((filename) => !completed.has(filename)), async (filename) => {
  const result = await request(filename, "GET");
  if (result.ok) {
    completed.add(filename);
    failures.delete(filename);
  } else {
    failures.set(filename, { filename, phase: "archive", ...result });
  }
  dirty += 1;
  if (dirty >= 100) await queueCheckpoint();
});
await queueCheckpoint(failures.size ? "archive_failed" : "verifying");

if (!failures.size) {
  await runPool(filenames, async (filename) => {
    const result = await request(filename, "HEAD");
    if (!result.ok) failures.set(filename, { filename, phase: "verification", ...result });
  });
}

await queueCheckpoint(failures.size ? "verification_failed" : "succeeded");
console.log(JSON.stringify({
  operationId,
  status: failures.size ? "verification_failed" : "succeeded",
  stored: completed.size - failures.size,
  total: filenames.length,
  failures: failures.size,
  checkpointPath,
}, null, 2));
if (failures.size) process.exit(1);
