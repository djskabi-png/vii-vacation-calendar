import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");

test("event search always exposes direct participant entry", () => {
  assert.match(source, /aria-label="הקלדת כמות משתתפים"/);
  assert.doesNotMatch(
    source,
    /eventPlaces\.some\(\(place\) => place\.capacityScope !== "unit"\) && <fieldset><legend>כמות משתתפים/,
  );
});
