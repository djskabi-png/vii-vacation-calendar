import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("regional and accommodation pages preserve complete matching metadata while refreshing the country catalog", () => {
  for (const path of ["app/components/vacation-landing-route.tsx", "app/components/accommodation-landing-route.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /const initialListings = [^;]+\.slice\(/, path);
    assert.match(source, /entries=\{initialListings\} complete=\{false\}/, path);
    assert.match(source, /collectionSchema\([\s\S]*initialListings\.map/, path);
  }
  // Bound mounted cards, rather than truncating the count or excluding a cheap
  // match from sorting just because it lies outside the initial metadata cap.
  assert.match(read('app/search/page.tsx'), /initialCount=\{initialResultWindow\}/);
});
