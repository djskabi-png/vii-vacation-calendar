import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gallery = readFileSync(new URL("../app/components/gallery-experience.tsx", import.meta.url), "utf8");

test("gallery opens the full selected scope unless the caller requested an exact supplier topic", () => {
  assert.match(gallery, /const resolvedTopic = resolveGalleryTopic\(allItems, initialTopic, initialTab\)/);
  assert.match(gallery, /const \[topic, setTopic\] = useState<string \| null>\(\(\) => resolvedTopic\)/);
  assert.doesNotMatch(gallery, /const defaultTopic/);
  assert.doesNotMatch(gallery, />\{tabLabels\.all\}<small>/);
  assert.doesNotMatch(gallery, /mobileTourAll/);
});

test("mobile gallery returns to the selected scope rather than closing the gallery", () => {
  assert.match(gallery, /חזרה לגלריה/);
  assert.doesNotMatch(gallery, /חזרה לכל התמונות/);
});
