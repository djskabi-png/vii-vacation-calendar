import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReviewSummary } from "../app/data/supplier-place-detail.ts";

test("review score is never shown without a positive review source", () => {
  assert.deepEqual(normalizeReviewSummary({ count: 0, score: 9.8, list: [] }), { count: 0, score: undefined });
  assert.deepEqual(normalizeReviewSummary({ count: 2, score: 9.8, list: [{}, {}] }), { count: 2, score: 9.8 });
});

test("a longer verified review list becomes the authoritative count and score", () => {
  assert.deepEqual(normalizeReviewSummary({ count: 2, score: 9.8, list: [{ score: 10 }, { score: 10 }, { score: 10 }] }), { count: 3, score: 10 });
  assert.deepEqual(normalizeReviewSummary({ count: 4, score: 9.8, list: [{ score: 10 }, { score: 10 }] }), { count: 4, score: 9.8 });
});

test("review count cannot understate the returned list", () => {
  assert.deepEqual(normalizeReviewSummary({ count: 1, list: [{}, {}] }), { count: 2, score: undefined });
});
