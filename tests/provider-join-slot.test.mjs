import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("provider join slot is visible among results without counting as a provider", async () => {
  const [providers, progressive] = await Promise.all([
    readFile(new URL("app/components/provider-results.tsx", root), "utf8"),
    readFile(new URL("app/components/progressive-results.tsx", root), "utf8"),
  ]);
  assert.match(providers, /featuredItem=\{<ProviderJoinCard \/>\}/);
  assert.match(providers, /href="\/join\/providers#provider-pricing"/);
  assert.match(providers, /filtered\.length} ספקים מתאימים/);
  assert.match(progressive, /visibleItems\.slice\(0, featuredAfter\)\}\{featuredItem\}\{visibleItems\.slice\(featuredAfter\)/);
  assert.match(progressive, /items\.length - visibleItems\.length/);
});
