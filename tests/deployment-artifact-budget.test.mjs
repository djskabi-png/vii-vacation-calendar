import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import {
  collectVerifiedMediaReferences,
  pruneDeploymentAssets,
} from "../scripts/prune-deployment-assets.mjs";

async function fixture(files) {
  const root = await mkdtemp(resolve(tmpdir(), "vii-deployment-budget-"));
  for (const [path, contents] of Object.entries(files)) {
    const filename = resolve(root, path);
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, contents);
  }
  return root;
}

test("verified media reachability keeps explicit runtime paths and removes unreachable output only", async () => {
  const root = await fixture({
    "app/catalog.json": JSON.stringify({ image: "/media/verified/vacation/keep.jpg" }),
    "dist/client/media/verified/vacation/keep.jpg": "keep",
    "dist/client/media/verified/vacation/remove.jpg": "remove",
  });
  try {
    const references = await collectVerifiedMediaReferences(root);
    assert.deepEqual([...references], ["/media/verified/vacation/keep.jpg"]);
    const result = await pruneDeploymentAssets(root, { maxOutputBytes: 1024 });
    assert.equal(result.removedUnreferencedFiles, 1);
    assert.equal(await readFile(resolve(root, "dist/client/media/verified/vacation/keep.jpg"), "utf8"), "keep");
    await assert.rejects(readFile(resolve(root, "dist/client/media/verified/vacation/remove.jpg")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a missing referenced verified-media file fails closed", async () => {
  const root = await fixture({
    "app/catalog.ts": "export const image = '/media/verified/vacation/missing.jpg';",
    "dist/client/placeholder.txt": "present",
  });
  try {
    await assert.rejects(
      pruneDeploymentAssets(root, { maxOutputBytes: 1024 }),
      /Referenced verified media is missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a dynamic verified-media path fails closed instead of deleting unknown assets", async () => {
  const root = await fixture({
    "app/catalog.ts": "export const image = '/media/verified/' + slug;",
    "dist/client/media/verified/vacation/unknown.jpg": "unknown",
  });
  try {
    await assert.rejects(
      pruneDeploymentAssets(root, { maxOutputBytes: 1024 }),
      /Dynamic verified-media path is not safe to prune/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an oversized deployment artifact fails closed", async () => {
  const root = await fixture({
    "app/empty.ts": "export {};",
    "dist/client/large.bin": "1234567890",
  });
  try {
    await assert.rejects(
      pruneDeploymentAssets(root, { maxOutputBytes: 5 }),
      /above the 0\.00 MiB release budget/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
