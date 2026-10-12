import assert from "node:assert/strict";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { assertNoUnreviewedRemovals, compareCatalogCandidate, stageCatalogCandidate } from "../scripts/catalog-candidate-guard.mjs";

test("detects additions, changed supplier fields and removals by stable ID", () => {
  const diff = compareCatalogCandidate("spa", [
    { id: 1, title: "A", packages: [] }, { id: 2, title: "B", packages: [] }, { id: 3, title: "C", packages: [] },
  ], [
    { id: 1, title: "A", packages: [] }, { id: 2, title: "B updated", packages: [] }, { id: 4, title: "D", packages: [] },
  ]);
  assert.deepEqual(diff, { world: "spa", before: 3, after: 3, added: [4], changed: [2], removed: [3], removedChildren: [] });
  assert.throws(() => assertNoUnreviewedRemovals(diff), /current catalog preserved pending review/);
});

test("allows a candidate with no removals", () => {
  const diff = compareCatalogCandidate("rooms", [{ supplierId: 1, name: "A", rooms: [] }], [
    { supplierId: 1, name: "A", rooms: [] }, { supplierId: 2, name: "B", rooms: [] },
  ]);
  assert.doesNotThrow(() => assertNoUnreviewedRemovals(diff));
  assert.deepEqual(diff.added, [2]);
});

test("rejects duplicate and missing supplier identities", () => {
  assert.throws(() => compareCatalogCandidate("events", [{ supplierId: 1 }], [{ supplierId: 2 }, { supplierId: 2 }]), /duplicate candidate/);
  assert.throws(() => compareCatalogCandidate("events", [{ supplierId: 1 }], [{ supplierId: null }]), /invalid or duplicate candidate/);
});

test("blocks disappearing spa packages and hourly rooms within active places", () => {
  for (const [world, key] of [["spa", "packages"], ["rooms", "rooms"]]) {
    const id = world === "spa" ? { id: 1 } : { supplierId: 1 };
    const diff = compareCatalogCandidate(world, [{ ...id, [key]: [{ id: 10 }] }], [{ ...id, [key]: [] }]);
    assert.deepEqual(diff.removedChildren, [{ supplierId: 1, childId: 10 }]);
    assert.throws(() => assertNoUnreviewedRemovals(diff), /child records disappeared/);
  }
});

test("rejects duplicate child IDs in a newly added supplier place", () => {
  assert.throws(() => compareCatalogCandidate("spa", [
    { id: 1, packages: [] },
  ], [
    { id: 1, packages: [] }, { id: 2, packages: [{ id: 10 }, { id: 10 }] },
  ]), /duplicate child inventory/);
});

test("stages a reviewable candidate without changing the current catalog", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vii-candidate-"));
  const candidate = [{ supplierId: 2, name: "New" }];
  const diff = { world: "rooms", before: 1, after: 1, added: [2], changed: [], removed: [1], removedChildren: [] };
  let path;
  try {
    path = await stageCatalogCandidate("rooms", candidate, diff, pathToFileURL(`${directory}${sep}`));
    const staged = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(staged.candidate, candidate);
    assert.deepEqual(staged.diff, diff);
    assert.throws(() => assertNoUnreviewedRemovals(staged.diff), /preserved pending review/);
  } finally {
    if (path) await unlink(path);
    await rmdir(directory);
  }
});
