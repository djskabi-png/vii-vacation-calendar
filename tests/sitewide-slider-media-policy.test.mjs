import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isBannedPublicMedia,
  resolvePublicSliderMedia,
  topicFallbackImage,
} from "../app/lib/public-media-policy.ts";

const banned = "/media/c3a6274bfd08091a.jpeg";

test("legacy unavailable-place media is rejected with query strings and legacy absolute URLs", () => {
  assert.equal(isBannedPublicMedia(banned), true);
  assert.equal(isBannedPublicMedia(`${banned}?cache=old`), true);
  assert.equal(isBannedPublicMedia(`https://www.vii.co.il${banned}#slide`), true);
});

test("slider fallback media follows the requested subject instead of reusing one generic image", () => {
  const topics = [
    "דירות נופש בעיר",
    "צימרים ובקתות בצפון",
    "וילות עם בריכה",
    "אירועים ומסיבות",
    "ספא ועיסוי",
    "אטרקציות ופעילויות",
  ];
  const replacements = topics.map((topic) => topicFallbackImage(topic));
  assert.equal(new Set(replacements).size, topics.length);
  replacements.forEach((image) => assert.match(image, /^\/media\//));
});

test("approved slider media is preserved while banned media is replaced and labeled by callers", () => {
  const approved = "/media/verified/vacation/vacation-tel-aviv-resort-1.jpg";
  assert.deepEqual(resolvePublicSliderMedia({ image: approved, topic: "דירות נופש" }), {
    image: approved,
    fallbackApplied: false,
  });
  const replacement = resolvePublicSliderMedia({ image: banned, topic: "דירות נופש" });
  assert.equal(replacement.fallbackApplied, true);
  assert.notEqual(replacement.image, banned);
  assert.match(replacement.image, /tel-aviv-resort/);
});

test("all public slider data boundaries apply the shared media policy", async () => {
  const [homepage, events, discoveryCard] = await Promise.all([
    readFile(new URL("../app/lib/homepage-presentation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/event-landing-presentation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/discovery-card.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(homepage, /resolvePublicSliderMedia/);
  assert.match(events, /isBannedPublicMedia/);
  assert.match(events, /resolvePublicSliderMedia/);
  assert.match(discoveryCard, /resolvePublicSliderMedia/);
  assert.doesNotMatch(homepage, /image:\s*["']\/media\/c3a6274bfd08091a\.jpeg["']/);
});
