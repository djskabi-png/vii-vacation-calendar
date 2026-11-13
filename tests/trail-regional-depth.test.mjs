import test from "node:test";
import assert from "node:assert/strict";
import { trails } from "../app/data/trail-data.ts";
import { trailDepthTopics } from "../app/lib/world-depth-topics.ts";

const added = ["poleg-udim-loop", "ilanot-arboretum", "alonei-kadima", "migdal-tzedek-classic", "einot-gibton", "britannia-pistacia-trail", "hurvat-burgin-loop", "beit-guvrin-caves"];

test("regional trail expansion is detailed and source-backed", () => {
  for (const slug of added) {
    const trail = trails.find((item) => item.slug === slug);
    assert.ok(trail, `${slug} must exist`);
    assert.ok(/parks\.org\.il|kkl\.org\.il/.test(trail.officialSource), `${slug} must use an official source`);
    assert.ok(trail.highlights.length >= 4, `${slug} must include useful highlights`);
    assert.ok(trail.dayPlan.length >= 3, `${slug} must include a usable plan`);
    assert.ok(trail.safety.length >= 3, `${slug} must include safety guidance`);
    assert.ok(trail.image && trail.imageCredit && trail.imageSource && trail.imageLicense, `${slug} must include a traceable public image`);
  }
});

test("Sharon and Lowlands collections are discoverable and deep", () => {
  assert.ok(trailDepthTopics.some((topic) => topic.slug === "sharon" && topic.params.area === "מרכז" && topic.params.q === "שרון"));
  assert.ok(trailDepthTopics.some((topic) => topic.slug === "lowlands" && topic.params.area === "מרכז" && topic.params.q === "שפלה"));
  assert.ok(trails.filter((trail) => `${trail.region} ${trail.areaTags.join(" ")}`.includes("שרון")).length >= 4);
  assert.ok(trails.filter((trail) => `${trail.region} ${trail.areaTags.join(" ")}`.includes("שפלה")).length >= 4);
  assert.equal(new Set(trails.map((trail) => trail.slug)).size, trails.length, "trail slugs must remain unique");
});
