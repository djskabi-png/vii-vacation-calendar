import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Cloudflare Images is declared for the responsive media worker", () => {
  assert.match(read("vite.config.ts"), /images:\s*\{\s*binding:\s*"IMAGES"\s*\}/);
});

test("event fallback never renders beside a contradictory empty state", () => {
  assert.match(read("app/components/event-last-minute.tsx"), /search\.status === "ready" && !candidates\.length && !visibleAdditionalPlaces\.length/);
});

test("preview navigation warms the responsive derivative", () => {
  const source = read("app/components/use-preview-gallery.tsx");
  assert.match(source, /responsiveCardMedia\(src\)/);
  assert.match(source, /previewImageLoader\.load\(media\.src,[\s\S]*srcSet: media\.srcSet/);
});

test("preview navigation changes the visible frame before derivative verification", () => {
  const source = read("app/components/use-preview-gallery.tsx");
  assert.match(source, /setState\(\{ key: imageKey, index: target, pending: true, error: false \}\)/);
  assert.match(source, /The loader still verifies the target and can fall back/);
});

test("open gallery clamps a refreshed selection to the surviving representative images", () => {
  const source = read("app/components/gallery-experience.tsx");
  assert.match(source, /setSelected\(\(value\) => visibleItems\.length \? Math\.min\(value, visibleItems\.length - 1\) : 0\)/);
});

test("gallery captions use supplier topic and place context", () => {
  const source = read("app/components/gallery-experience.tsx");
  assert.match(source, /function galleryItemLabel\(topic: string, placeName: string, index: number\)/);
  assert.match(source, /`\$\{topic\} ב\$\{placeName\}`/);
  assert.doesNotMatch(source, /`\$\{group\.title\} ב\$\{property\.name\}, תמונה \$\{index \+ 1\}`/);
});
