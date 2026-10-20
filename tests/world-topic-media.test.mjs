import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { resolveWorldTopicImage, validWorldTopicImage, worldTopicMedia, worldTopicImageCopy } from "../app/lib/world-topic-media.ts";
import { parseWorldLandingPresentation, managedWorldLandingTypes, worldLandingSourceAttributes } from "../app/lib/world-landing-presentation.ts";
import { parseEventLandingPresentation, eventLandingSourceAttributes } from "../app/lib/event-landing-presentation.ts";

test("all six world headers have distinct local topic assets with bounded responsive sizes", async () => {
  assert.equal(new Set(Object.values(worldTopicMedia).map(i => i.src)).size, 6);
  for (const [world, image] of Object.entries(worldTopicMedia)) {
    assert.match(image.src, new RegExp(`/world-heroes/${world}-v1\\.webp$`));
    assert.ok(image.alt.length > 12);
    for (const [src, budget] of [[image.src, 240000], [image.src.replace(".webp", "-small.webp"), 85000]]) {
      const file = new URL(`../public${src}`, import.meta.url);
      const bytes = await readFile(file);
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
      assert.ok((await stat(file)).size < budget);
    }
  }
});

test("old saved business collages cannot override a new world header", () => {
  const content = { attributes: { worldHeroImage1: "/media/providers/maor-natan-1.jpg", worldHeroImage1Alt: "Business identity", worldHeroImage2: "/media/old.jpg", eventHeroImage1: "https://www.vii.co.il/gallery/old.jpg" } };
  for (const world of managedWorldLandingTypes) {
    const presentation = parseWorldLandingPresentation(world, content);
    assert.deepEqual(presentation.heroImages, [worldTopicMedia[world]]);
    assert.ok(worldLandingSourceAttributes(world).worldTopicImage);
  }
  assert.deepEqual(parseEventLandingPresentation(content).heroImages, [worldTopicMedia.events]);
  assert.ok(eventLandingSourceAttributes().eventTopicImage);
});

test("topic overrides are intentional, safe and do not fall back to supplier gallery photos", () => {
  assert.deepEqual(resolveWorldTopicImage("spa", "/media/world-heroes/spa-curated.webp", "תמונת תחום בעריכה"), {src:"/media/world-heroes/spa-curated.webp",alt:"תמונת תחום בעריכה"});
  for (const src of ["https://www.vii.co.il/gallery/place.jpg", "/media/providers/person.jpg", "//external.invalid/x.webp", "/media/world-heroes/../place.jpg", "/media/world-heroes/spa.webp?redirect=1"]) {
    assert.equal(validWorldTopicImage(src, "Description"), false);
    assert.deepEqual(resolveWorldTopicImage("spa", src, "Description"), worldTopicMedia.spa);
  }
  assert.equal(validWorldTopicImage(worldTopicMedia.spa.src, ""), false);
});

test("shared visual has one decorative topic image, no production label and no business links or collage", async () => {
  const component = await readFile(new URL("../app/components/world-topic-image.tsx", import.meta.url), "utf8");
  assert.equal((component.match(/<img /g) || []).length, 1);
  assert.match(component, /alt="" title="" data-image-role="decorative"/);
  assert.doesNotMatch(component, /figcaption|Illustrative image|תמונת המחשה/);
  assert.match(component, /srcSet=/); assert.match(component, /width=\{1200\} height=\{800\}/);
  assert.doesNotMatch(component, /<a |<Link |item\.name|figures\.map|fetch\(/);
  for (const file of ["discovery-world-hero.tsx", "world-landing.tsx", "../events/page.tsx"]) {
    const path = file.startsWith("../") ? `../app/${file.slice(3)}` : `../app/components/${file}`;
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /<WorldTopicImage/);
    assert.doesNotMatch(source, /spaHeroImages|presentation\.heroImages\.map/);
  }
  const inventory = await readFile(new URL("../app/lib/content-studio-inventory.ts", import.meta.url), "utf8");
  assert.match(inventory, /key === "landing" && type === "spa"\) return "\/spas"/);
});

test("topic metadata is localized before hydration with the verified request locale", () => {
  for (const image of Object.values(worldTopicMedia)) {
    for (const locale of ["en", "fr", "ru"]) {
      const copy = worldTopicImageCopy(image, locale);
      assert.doesNotMatch(copy.alt + copy.caption, /[\u0590-\u05ff]/);
      assert.ok(copy.alt.length > 15);
    }
    assert.deepEqual(worldTopicImageCopy(image, "he"), {alt:image.alt,caption:"תמונת המחשה"});
    assert.deepEqual(worldTopicImageCopy(image, "untrusted"), {alt:image.alt,caption:"תמונת המחשה"});
  }
});

test("mobile world entry removes the whole visual row without hiding desktop or business photos", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const rule = css.slice(css.indexOf("/* Mobile world entry prioritizes"));
  assert.match(rule, /@media \(max-width:720px\)/);
  for (const prefix of ["spa-discovery-hero", "events-hero", "discovery-world-hero"]) {
    assert.ok(rule.includes(`.${prefix}__visual`));
    assert.ok(rule.includes(`.${prefix}__layout`));
  }
  assert.match(rule, /__visual \{ display:none; \}/);
  assert.match(rule, /grid-template-areas:"content" "search"/);
  assert.doesNotMatch(rule, /img|\.place-|\.discovery-card|\.world-topic-image/);
});
