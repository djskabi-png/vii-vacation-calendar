import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  defaultWorldLandingPresentations,
  managedWorldLandingTypes,
  parseWorldLandingPresentation,
  validWorldLandingAttributes,
  worldLandingSourceAttributes,
} from "../app/lib/world-landing-presentation.ts";

test("every managed discovery world has a complete and distinct visual presentation", () => {
  assert.deepEqual([...managedWorldLandingTypes], ["hourly", "providers", "attractions", "trails"]);
  const titles = new Set();
  for (const type of managedWorldLandingTypes) {
    const value = parseWorldLandingPresentation(type, null);
    titles.add(value.title);
    assert.equal(value.heroImages.length, 3);
    assert.equal(value.proof.length, 3);
    assert.ok(value.heroImages.every((image) => image.src && image.alt));
  }
  assert.equal(titles.size, managedWorldLandingTypes.length);
});

test("world landing controls accept verified VII images and reject unsafe or incomplete media", () => {
  for (const type of managedWorldLandingTypes) assert.equal(validWorldLandingAttributes(worldLandingSourceAttributes(type)), true);
  const attributes = worldLandingSourceAttributes("providers");
  assert.equal(validWorldLandingAttributes({ ...attributes, worldHeroImage1: "https://unrelated.example/image.jpg" }), false);
  assert.equal(validWorldLandingAttributes({ ...attributes, worldHeroImage2Alt: "" }), false);
  assert.equal(validWorldLandingAttributes({ ...attributes, worldProof3: "" }), false);
});

test("the world family is wired to shared public rendering and independent versioned CMS controls", async () => {
  const [inventory, editor, route, landing, attractions, trails, css] = await Promise.all([
    readFile(new URL("../app/lib/content-studio-inventory.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/content-studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/content-studio/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/attractions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trails/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(inventory, /managedWorldLandingTypes\.map/);
  assert.match(inventory, /key === "landing".*type === "hourly"/s);
  assert.match(editor, /עמוד הפתיחה של עולם/);
  assert.match(route, /validWorldLandingAttributes/);
  assert.match(landing, /<DiscoveryWorldHero/);
  assert.match(attractions, /readWorldLandingPresentation\("attractions"\)/);
  assert.match(trails, /readWorldLandingPresentation\("trails"\)/);
  for (const type of managedWorldLandingTypes) assert.match(css, new RegExp(`data-world=\\"${type}\\"`));
  assert.equal(defaultWorldLandingPresentations.providers.heroImages[0].src.startsWith("/media/providers/"), true);
});
