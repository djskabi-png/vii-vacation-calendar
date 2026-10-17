import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("business complements keep provider, nearby and trail rails bounded on mobile", () => {
  assert.match(source, /id="vacation-detail-providers"/);
  assert.match(source, /id="vacation-detail-nearby"/);
  assert.match(source, /id="vacation-detail-trails"/);
  assert.match(source, /id="vacation-detail-similar"/);
  assert.match(source, /className="property-provider-strip__rail"/);
  assert.match(source, /discovery-grid discovery-grid--compact/);
  assert.match(source, /trail-grid trail-grid--business/);
});
