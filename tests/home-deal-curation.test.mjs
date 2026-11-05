import assert from "node:assert/strict";
import { test } from "node:test";
import { applyHomeDealCuration, curateHomeDeals } from "../app/lib/home-deal-curation.ts";
import { readPublishedItems } from "../app/lib/content-studio.ts";
import { DatabaseSync } from "node:sqlite";

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

test("projected curation preserves published, scheduled, archived and draft semantics without loading editorial bodies", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`CREATE TABLE vii_content_items (id TEXT,entity_key TEXT,content_type TEXT,locale TEXT,status TEXT,scheduled_at TEXT,version INTEGER,published_version INTEGER);
    CREATE TABLE vii_content_versions (item_id TEXT,version INTEGER,content_json TEXT);`);
  const transferred = [];
  const db = { prepare(query) { let args = []; return {
    bind(...values) { args = values; return this; }, async all() {
      const results = sql.prepare(query).all(...args); transferred.push(JSON.stringify(results).length); return { results };
    },
  }; } };
  const insert = (id, status, scheduledAt, published, latest, oldAttrs, newAttrs) => {
    const item = `vacation:${id}:he`;
    sql.prepare("INSERT INTO vii_content_items VALUES (?,?, 'vacation','he',?,?,?,?)").run(item, String(id), status, scheduledAt, latest, published);
    for (const [version, attrs] of [[1, oldAttrs], [2, newAttrs]]) {
      sql.prepare("INSERT INTO vii_content_versions VALUES (?,?,?)").run(item, version, JSON.stringify({ ...content(attrs), body: "טקסט ארוך ".repeat(3000) }));
    }
  };
  try {
    insert(11, "published", null, 1, 2, { homeDealPlacements: "tomorrow", homeDealOrder: "2" }, { homeDealHidden: "true" });
    insert(12, "scheduled", "2000-01-01T00:00:00.000Z", 1, 2, {}, { homeDealHidden: "true" });
    insert(13, "scheduled", "2999-01-01T00:00:00.000Z", 1, 2, { homeDealOrder: "3", homeDealPlacements: "tomorrow" }, { homeDealHidden: "true" });
    insert(14, "archived", null, null, 2, { homeDealHidden: "true" }, { homeDealHidden: "true" });
    insert(15, "draft", null, null, 2, {}, { homeDealHidden: "true" });
    const deals = [11, 12, 13, 14, 15, 16].map(deal);
    const expected = applyHomeDealCuration(deals, await readPublishedItems(db, "vacation", "he"), "tomorrow");
    assert.deepEqual(await curateHomeDeals(db, deals, "tomorrow"), expected);
    assert.ok(transferred[1] < transferred[0] / 100, "projection must remove large unconsumed content");
    assert.deepEqual(await curateHomeDeals(db, [], "tomorrow"), []);
    assert.equal(transferred.length, 2, "empty deals require no curation query");
  } finally { sql.close(); }
});
