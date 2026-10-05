import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(readFileSync(new URL("../app/data/sergey-public-catalog.json", import.meta.url)));
const details = JSON.parse(readFileSync(new URL("../app/data/sergey-place-details.json", import.meta.url)));

test("every published supplier review count has a matching review record", () => {
  for (const place of catalog.places) {
    const reviews = details.details[place.slug]?.reviews;
    assert.ok(Array.isArray(reviews), place.slug);
    assert.equal(reviews.length, place.reviews || 0, place.slug);
    assert.equal(new Set(reviews.map((review) => review.id)).size, reviews.length, place.slug);
  }
});

test("supplier replies and photo filenames retain their review association", () => {
  const reviews = Object.values(details.details).flatMap((place) => place.reviews);
  assert.ok(reviews.some((review) => review.response));
  assert.ok(reviews.some((review) => review.pictureFiles.length));
  for (const review of reviews) {
    assert.equal(typeof review.response, "string");
    assert.ok(Array.isArray(review.pictureFiles));
    assert.ok(review.pictureFiles.every((file) => /^[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(file)));
  }
});
