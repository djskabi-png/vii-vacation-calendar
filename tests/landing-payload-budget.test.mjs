import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("regional and accommodation pages preserve complete matching identities without an unbounded edge payload", () => {
  const regional = read("app/components/vacation-landing-route.tsx");
  const accommodation = read("app/components/accommodation-landing-route.tsx");
  assert.doesNotMatch(regional, /const initialListings = [^;]+\.slice\(/);
  assert.match(regional, /entries=\{initialListings\} complete=\{false\}/);
  assert.match(accommodation, /publicVacationLandingSeedProperties\(landing\.listings\.slice\(0, 60\)\)/);
  assert.match(accommodation, /const structuredListings = initialListings/);
  assert.match(accommodation, /entries=\{initialListings\} complete=\{false\}/);
  assert.match(read("app/lib/public-vacation-search.ts"), /publicVacationLandingSeedProperties[\s\S]*dateQuotes: undefined[\s\S]*roomOptions: undefined/);
  // Bound mounted cards, rather than truncating the count or excluding a cheap
  // match from sorting just because it lies outside the initial metadata cap.
  assert.match(read('app/search/page.tsx'), /initialCount=\{initialResultWindow\}/);
});
