import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const locale = readFileSync(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8");

test("vacation sorting preserves the complete legacy commercial choices", () => {
  for (const option of [
    'value: "price-asc", label: "מחיר מהנמוך לגבוה"',
    'value: "price-desc", label: "מחיר מהגבוה לנמוך"',
    'value: "rating-desc", label: "דירוג מהגבוה לנמוך"',
    'value: "rating-asc", label: "דירוג מהנמוך לגבוה"',
  ]) assert.ok(search.includes(option), option);

  assert.match(search, /VACATION_SORT_VALUES\.includes/);
  assert.match(search, /compareOptionalNumber\(a\.price, b\.price, "asc"\)/);
  assert.match(search, /compareOptionalNumber\(a\.price, b\.price, "desc"\)/);
  assert.match(search, /compareOptionalNumber\(a\.score, b\.score, "desc"\)/);
  assert.match(search, /compareOptionalNumber\(a\.score, b\.score, "asc"\)/);
});

test("unknown prices and ratings are kept at the end and labels are localized", () => {
  assert.match(search, /if \(!firstKnown\) return 1/);
  assert.match(search, /if \(!secondKnown\) return -1/);
  for (const label of ["מחיר מהנמוך לגבוה", "מחיר מהגבוה לנמוך", "דירוג מהגבוה לנמוך", "דירוג מהנמוך לגבוה"]) {
    assert.ok((locale.match(new RegExp(`"${label}"`, "g")) || []).length >= 3, label);
  }
});
