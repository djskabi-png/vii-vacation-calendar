import assert from "node:assert/strict";
import test from "node:test";
import { isBusinessDepthRoute } from "../app/lib/new-tab-policy.ts";

test("all place-detail families open separately while search and collection pages retain their navigation", () => {
  for (const locale of ["", "/en", "/fr", "/ru"]) {
    for (const path of ["/trails", "/trails/explore", "/trails/explore/water", "/trails/explore/north", "/attractions/explore/center", "/providers/food", "/spas/spa-with-pool"]) {
      assert.equal(isBusinessDepthRoute(locale + path), false, locale + path);
    }
    for (const path of ["/business", "/business?id=vacation-164", "/trails/snir-hatzbani", "/trails/explorer-canyon", "/events/place/event-2", "/discover/place/spa-248", "/guides/weekend"]) {
      assert.equal(isBusinessDepthRoute(locale + path), true, locale + path);
    }
  }
});
