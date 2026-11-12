import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function loadHelpers() {
  const source = await readFile(new URL("../app/lib/library-reconciliation.ts", import.meta.url), "utf8");
  const compiled = stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm, ""), { mode: "strip" })
    .replace(/export /g, "");
  return new Function(`${compiled};return {LIBRARY_PAGE_SIZE,LIBRARY_VALIDATION_BATCH_SIZE,libraryValidationItems,reconcileCheckedLibraryItems};`)();
}

test("library reconciliation removes only confirmed missing keys", async () => {
  const { reconcileCheckedLibraryItems } = await loadHelpers();
  const items = [{ key: "spa:current" }, { key: "spa:no-image" }, { key: "spa:missing" }, { key: "legacy:unchecked" }];
  const checked = new Set(["spa:current", "spa:no-image", "spa:missing"]);
  const existing = new Set(["spa:current", "spa:no-image"]);
  assert.deepEqual(reconcileCheckedLibraryItems(items, checked, existing), [items[0], items[1], items[3]]);
  assert.deepEqual(reconcileCheckedLibraryItems(items, new Set(), new Set()), items);
});

test("library validation covers all supported worlds, deduplicates and rejects unsafe identifiers", async () => {
  const { libraryValidationItems, LIBRARY_PAGE_SIZE, LIBRARY_VALIDATION_BATCH_SIZE } = await loadHelpers();
  const worlds = ["vacation", "events", "corporate", "spa", "hourly", "providers", "activities", "trails"];
  const input = worlds.map((world) => ({ world, id: world === "corporate" ? "corporate-experiences" : `${world}-1`, key: `${world}:${world}-1` }));
  input.push(input[0], { world: "spa", id: "../../unsafe", key: "spa:../../unsafe" });
  assert.deepEqual(libraryValidationItems(input).map(({ world }) => world), worlds);
  assert.equal(LIBRARY_PAGE_SIZE, 9);
  assert.equal(LIBRARY_VALIDATION_BATCH_SIZE, 50);
});
