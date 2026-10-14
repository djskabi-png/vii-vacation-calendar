import assert from "node:assert/strict";
import { test } from "node:test";
import { applyHomeDealCuration } from "../app/lib/home-deal-curation.ts";

const content = (attributes) => ({ title: "מקום", summary: "תקציר מספיק ארוך לפרסום המקום במערכת.", body: "", metaTitle: "", metaDescription: "", slug: "", imageAlt: "", indexable: false, links: [], attributes });
const deal = (siteID) => ({ siteID, name: `מקום ${siteID}`, image: "https://www.vii.co.il/a.jpg", city: "", area: "", score: null, reviewCount: 0, from: "2026-10-15", till: "2026-10-16", total: 900, nights: 1, priceGuests: 2 });

test("published homepage placement promotes only the selected period", () => {
  const items = [{ key: "11", content: content({ homeDealPlacements: "tomorrow,holidays", homeDealOrder: "2" }) }];
  assert.equal(applyHomeDealCuration([deal(11)], items, "tomorrow")[0].curatedRank, 2);
  assert.equal(applyHomeDealCuration([deal(11)], items, "weekend")[0].curatedRank, undefined);
});

test("published hide removes a property from every homepage availability rail", () => {
  const items = [{ key: "11", content: content({ homeDealHidden: "true", homeDealPlacements: "tomorrow" }) }];
  assert.deepEqual(applyHomeDealCuration([deal(11), deal(12)], items, "tomorrow").map((item) => item.siteID), [12]);
});

test("invalid editor keys and ranks cannot corrupt the organic result", () => {
  const items = [{ key: "not-an-id", content: content({ homeDealPlacements: "tomorrow" }) }, { key: "11", content: content({ homeDealPlacements: "unknown,tomorrow", homeDealOrder: "99999" }) }];
  assert.equal(applyHomeDealCuration([deal(11)], items, "tomorrow")[0].curatedRank, 500);
});
