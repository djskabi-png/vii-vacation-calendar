import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneDuplicateServerCss } from "../scripts/prune-server-css-duplicates.mjs";

async function fixture(t, files, assetDirectory = "../client") {
  const root = await mkdtemp(join(tmpdir(), "vii-css-pruning-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  files = { "dist/server/wrangler.json": JSON.stringify({ assets: { directory: assetDirectory } }), ...files };
  for (const [filename, content] of Object.entries(files)) {
    const target = join(root, filename);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

test("pruning removes only byte-identical server CSS and keeps public assets and metadata", async (t) => {
  const retained = {
    "dist/client/assets/main.css": ".card{display:flex}",
    "dist/server/index.js": "export default {};",
    "dist/server/.vite/manifest.json": '{"css":["assets/main.css"]}',
    "dist/server/__vite_rsc_assets_manifest.js": "export const assets = {};",
    "dist/client/media/photo.jpg": "supplier-image",
    "dist/server/assets/catalog.json": '{"places":702}',
  };
  const root = await fixture(t, { ...retained,
    "dist/server/assets/main.css": retained["dist/client/assets/main.css"],
    "dist/server/ssr/assets/main.css": retained["dist/client/assets/main.css"],
  });
  assert.equal((await pruneDuplicateServerCss(root)).length, 2);
  for (const [path, content] of Object.entries(retained)) assert.equal(await readFile(join(root, path), "utf8"), content);
  await assert.rejects(readFile(join(root, "dist/server/assets/main.css")), { code: "ENOENT" });
  assert.deepEqual(await pruneDuplicateServerCss(root), []);
});

test("pruning preserves different CSS and CSS with no public copy", async (t) => {
  const root = await fixture(t, {
    "dist/client/assets/main.css": "public-css",
    "dist/server/assets/main.css": "different-css",
    "dist/server/assets/server-only.css": "server-only-css",
  });
  assert.deepEqual(await pruneDuplicateServerCss(root), []);
  assert.equal(await readFile(join(root, "dist/server/assets/main.css"), "utf8"), "different-css");
  assert.equal(await readFile(join(root, "dist/server/assets/server-only.css"), "utf8"), "server-only-css");
});

test("pruning refuses a runtime that serves server assets", async (t) => {
  const root = await fixture(t, { "dist/server/assets/main.css": "css" }, "./assets");
  await assert.rejects(pruneDuplicateServerCss(root), /ASSETS directory/);
  assert.equal(await readFile(join(root, "dist/server/assets/main.css"), "utf8"), "css");
});
