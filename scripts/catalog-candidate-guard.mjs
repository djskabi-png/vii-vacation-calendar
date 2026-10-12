import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function supplierId(world, entry) {
  return world === "spa" ? entry.id : entry.supplierId;
}

function childIds(world, entry) {
  const children = world === "spa" ? entry.packages : world === "rooms" ? entry.rooms : null;
  if (children === null) return [];
  if (!Array.isArray(children)) throw new Error(`${world}: missing child inventory for supplier ${supplierId(world, entry)}`);
  const ids = children.map((child) => child.id);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new Error(`${world}: invalid or duplicate child inventory for supplier ${supplierId(world, entry)}`);
  }
  return ids;
}

export function compareCatalogCandidate(world, previous, incoming) {
  if (!Array.isArray(previous) || !Array.isArray(incoming) || !previous.length || !incoming.length) {
    throw new Error(`${world}: missing current or candidate catalog`);
  }
  const index = (entries, label) => {
    const records = new Map();
    for (const entry of entries) {
      const id = supplierId(world, entry);
      if (!Number.isSafeInteger(id) || id <= 0 || records.has(id)) {
        throw new Error(`${world}: invalid or duplicate ${label} supplier ID`);
      }
      records.set(id, entry);
    }
    return records;
  };
  const before = index(previous, "current");
  const after = index(incoming, "candidate");
  for (const entry of incoming) childIds(world, entry);
  const added = [];
  const changed = [];
  const removed = [];
  const removedChildren = [];
  for (const [id, entry] of after) {
    if (!before.has(id)) added.push(id);
    else {
      if (!isDeepStrictEqual(entry, before.get(id))) changed.push(id);
      const nextChildren = new Set(childIds(world, entry));
      for (const childId of childIds(world, before.get(id))) {
        if (!nextChildren.has(childId)) removedChildren.push({ supplierId: id, childId });
      }
    }
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  for (const ids of [added, changed, removed]) ids.sort((a, b) => a - b);
  removedChildren.sort((a, b) => a.supplierId - b.supplierId || a.childId - b.childId);
  return { world, before: before.size, after: after.size, added, changed, removed, removedChildren };
}

export function assertNoUnreviewedRemovals(diff, stagedPath = "") {
  if (diff.removed.length || diff.removedChildren.length) {
    throw new Error(`${diff.world}: ${diff.removed.length} supplier records and ${diff.removedChildren.length} child records disappeared; current catalog preserved pending review${stagedPath ? `; candidate: ${stagedPath}` : ""}`);
  }
}

export async function stageCatalogCandidate(world, candidate, diff, directory = pathToFileURL(`${join(tmpdir(), "vii-catalog-sync-candidates")}${sep}`)) {
  await mkdir(directory, { recursive: true });
  const path = new URL(`${world}-${randomUUID()}.json`, directory);
  await writeFile(path, `${JSON.stringify({ stagedAt: new Date().toISOString(), world, diff, candidate })}\n`, { flag: "wx" });
  return fileURLToPath(path);
}
