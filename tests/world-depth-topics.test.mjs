import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { activityDepthTopics, findDepthTopic, trailDepthTopics } from "../app/lib/world-depth-topics.ts";
import { worldDepthCopy } from "../app/lib/world-depth-copy.ts";
import { trails } from "../app/data/trail-data.ts";

test("trail depth taxonomy has explicit native translations, not machine homonyms", () => {
  const dictionary = JSON.parse(readFileSync(new URL("../app/data/world-depth-translations.json", import.meta.url), "utf8"));
  const labels = new Set(trails.flatMap(trail => [trail.region, trail.difficulty, ...trail.nature]));
  for (const label of labels) for (const locale of ["en", "fr", "ru"]) {
    assert.ok(dictionary[label]?.[locale]?.length > 1, `${locale}: ${label}`);
    assert.doesNotMatch(dictionary[label][locale], /[\u0590-\u05ff]/);
  }
  assert.equal(dictionary["אצבע הגליל"].en, "Galilee Panhandle");
  assert.equal(dictionary["ביצה"].en, "Wetland");
  assert.equal(dictionary["קניון בזלתי"].en, "Basalt canyon");
  assert.equal(dictionary["הערבה התיכונה"].fr, "Arava centrale");
  assert.equal(dictionary["גליל תחתון"].ru, "Нижняя Галилея");
});

test("depth topics use only supported attraction filters", () => {
  assert.ok(activityDepthTopics.length >= 6);
  for (const topic of activityDepthTopics) assert.ok(topic.params.area || topic.params.type);
  assert.equal(findDepthTopic(activityDepthTopics, "center")?.params.area, "מרכז ותל אביב");
  assert.equal(findDepthTopic(activityDepthTopics, "missing"), null);
});

test("depth topics use only supported trail filters", () => {
  assert.ok(trailDepthTopics.length >= 8);
  for (const topic of trailDepthTopics) assert.ok(topic.params.area || topic.params.nature || topic.params.difficulty);
  assert.equal(findDepthTopic(trailDepthTopics, "easy")?.params.difficulty, "קל");
});

test("bounded topic pages have self canonicals, unknown-topic recovery and localized conflicting-query redirects", () => {
  for (const world of ["attractions", "trails"]) {
    const source = readFileSync(new URL(`../app/${world}/explore/[topic]/page.tsx`, import.meta.url), "utf8");
    assert.match(source, /generateMetadata/);
    assert.match(source, /alternates: \{ canonical:/);
    assert.match(source, /if \(!topic\) notFound\(\)/);
    assert.match(source, /x-vii-locale/);
    assert.match(source, /\.\.\.topic\.params, \.\.\.explicit/);
  }
  for (const topic of [...activityDepthTopics, ...trailDepthTopics]) assert.match(topic.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test("every bounded topic has server-ready localized heading and metadata copy", () => {
  for (const [topics, world] of [[activityDepthTopics, "activities"], [trailDepthTopics, "trails"]]) {
    for (const topic of topics) for (const locale of ["en", "fr", "ru"]) {
      const copy = worldDepthCopy(topic.label, locale, world);
      assert.ok(copy.title.length > 4);
      assert.doesNotMatch(copy.title + copy.description, /[\u0590-\u05ff]/);
    }
  }
});
