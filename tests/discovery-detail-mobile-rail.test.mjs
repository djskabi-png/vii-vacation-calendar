import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8");

test("discovery detail related cards use a bounded mobile rail", () => {
  assert.match(source, /id="discovery-detail-related"/);
  assert.match(source, /className="discovery-grid"/);
  assert.match(source, /<HomeMobileRail/);
});
