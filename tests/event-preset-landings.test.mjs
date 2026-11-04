import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("event deal presets have separate canonical pages and use fixed preset data", async () => {
  const shared = await read("app/events/deal-preset-page.tsx");
  assert.match(shared, /EventDealPresetId/);
  assert.match(shared, /fixedPreset=\{preset\}/);
  assert.match(shared, /faqSchema/);
  assert.match(shared, /available_unpriced|ללא מחיר/);
  for (const [file, preset, path] of [
    ["app/events/last-minute/page.tsx", "lastminute", "/events/last-minute"],
    ["app/events/thursday/page.tsx", "thursday", "/events/thursday"],
    ["app/events/friday/page.tsx", "friday", "/events/friday"],
  ]) {
    const source = await read(file);
    assert.match(source, new RegExp(`preset=\\"${preset}\\"`));
    if (file.includes("last-minute")) assert.match(source, /eventPresetMetadata\("lastminute"/);
    assert.ok(shared.includes(path) || file.includes(preset === "lastminute" ? "last-minute" : preset));
  }
});

test("event preset pages are in the events sitemap section", async () => {
  const source = await read("app/lib/sitemap-inventory.ts");
  assert.match(source, /\/events\/last-minute/);
  assert.match(source, /\/events\/thursday/);
  assert.match(source, /\/events\/friday/);
});
