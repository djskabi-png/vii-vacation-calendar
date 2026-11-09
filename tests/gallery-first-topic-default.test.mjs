import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gallery = readFileSync(new URL("../app/components/gallery-experience.tsx", import.meta.url), "utf8");

test("gallery opens the first supplier topic instead of an aggregate all-images view", () => {
  assert.match(gallery, /const defaultTopic = useMemo\(\(\) => \{ const item = allItems\.find/);
  assert.match(gallery, /return item\?\.topicKey \|\| item\?\.topic \|\| null/);
  assert.match(gallery, /initialTab === "all" \? defaultTopic : null/);
  assert.doesNotMatch(gallery, />\{tabLabels\.all\}<small>/);
  assert.doesNotMatch(gallery, /mobileTourAll/);
});

test("mobile gallery returns to the selected gallery rather than all images", () => {
  assert.match(gallery, /חזרה לגלריה/);
  assert.doesNotMatch(gallery, /חזרה לכל התמונות/);
});
