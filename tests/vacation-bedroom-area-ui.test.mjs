import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const searchSource = fs.readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const businessSource = fs.readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const apiSource = fs.readFileSync(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");

test("bedroom count is a URL-backed filter and not a sort option", () => {
  assert.match(searchSource, /<legend>מספר חדרי שינה<\/legend>/);
  assert.match(searchSource, /property\.bedrooms \|\| 0\) >= bedrooms/);
  assert.match(searchSource, /bedrooms: draftFilters\.bedrooms \? String\(draftFilters\.bedrooms\) : null/);
  const sortOptions = searchSource.slice(searchSource.indexOf("const vacationSortOptions"), searchSource.indexOf("const router = useRouter"));
  assert.doesNotMatch(sortOptions, /חדרי שינה/);
  assert.match(apiSource, /detail\?\.rooms\?\.reduce/);
});

test("verified supplier areas are promoted into the first property summary", () => {
  assert.match(businessSource, /const areaHighlights = \(property\.roomOptions \|\| \[\]\)/);
  assert.match(businessSource, /גודל המתחם \$\{totalArea\} מ״ר/);
  assert.match(businessSource, /שטח בנוי \$\{builtArea\} מ״ר/);
  assert.match(businessSource, /const highlights = \[\.\.\.areaHighlights/);
});
