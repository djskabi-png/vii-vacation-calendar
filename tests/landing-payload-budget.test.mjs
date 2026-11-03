import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("regional vacation pages bound their first document while refreshing the complete catalog", () => {
  for (const path of ["app/components/vacation-landing-route.tsx", "app/components/accommodation-landing-route.tsx"]) {
    const source = read(path);
    assert.match(source, /const initialListings = [^;]+\.slice\(0, 60\)/, path);
    assert.match(source, /entries=\{initialListings\} complete=\{false\}/, path);
    assert.match(source, /collectionSchema\([\s\S]*initialListings\.map/, path);
  }
});
