import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ensureContentItem, readContentItem, saveContentItem } from "../app/lib/content-studio.ts";
import { fallbackHolidayForSlug, holidayContentSource, holidayImageSources, readHolidayCardMedia, readHolidayWorld } from "../app/lib/holiday-world.ts";

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(await readFile(new URL("../drizzle/0008_content_studio.sql", import.meta.url), "utf8"));
  return { queries: 0, sqlite, close() { sqlite.close(); },
    prepare(sql) { this.queries++; let values = []; return {
      bind(...args) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
    }; },
  };
}

async function change(db, item, content, status = "published", scheduledAt = null) {
  const result = await saveContentItem(db, { id: item.id, expectedVersion: item.version, content, status, scheduledAt, action: "save" }, "qa");
  assert.ok(!result.error);
  return readContentItem(db, item.id);
}

test("holiday hub and detail read the same published image, alternative and edited title in one hub query", async () => {
  const db = await database();
  try {
    const holiday = fallbackHolidayForSlug("hanukkah");
    const item = await ensureContentItem(db, holidayContentSource(holiday));
    await change(db, item, { ...item.draft, imageAlt: "חנוכייה דולקת", attributes: { ...item.draft.attributes, holidayHeroImage: "/images/managed-hanukkah.webp", holidayHeroImageTitle: "חנוכה בעריכת האתר" } });
    db.queries = 0;
    const [card] = await readHolidayCardMedia([holiday], db);
    assert.equal(db.queries, 1, "the hub must not issue per-card CMS reads");
    const detail = await readHolidayWorld(holiday, db);
    assert.equal(card.src, detail.heroImage);
    assert.equal(card.alt, detail.heroImageAlt);
    assert.equal(card.title, detail.heroImageTitle);
    assert.equal(card.title, "חנוכה בעריכת האתר");
    assert.equal(card.mobileSrc, card.src, "unverified custom mobile filenames must not be invented");
  } finally { db.close(); }
});

test("draft and future scheduled image edits never replace the published hub image; archive returns the same defaults as detail", async () => {
  const db = await database();
  try {
    const holiday = fallbackHolidayForSlug("passover");
    let item = await ensureContentItem(db, holidayContentSource(holiday));
    item = await change(db, item, { ...item.draft, imageAlt: "שולחן פסח", attributes: { ...item.draft.attributes, holidayHeroImage: "/images/published-passover.webp", holidayHeroImageTitle: "פסח" } });
    item = await change(db, item, { ...item.draft, attributes: { ...item.draft.attributes, holidayHeroImage: "/images/draft.webp" } }, "draft");
    assert.equal((await readHolidayCardMedia([holiday], db))[0].src, "/images/published-passover.webp");
    item = await change(db, item, item.draft, "scheduled", "2999-01-01T00:00:00.000Z");
    assert.equal((await readHolidayCardMedia([holiday], db))[0].src, "/images/published-passover.webp");
    await change(db, item, item.draft, "archived");
    const [card] = await readHolidayCardMedia([holiday], db);
    assert.equal(card.src, (await readHolidayWorld(holiday, db)).heroImage);
    assert.equal(card.src, "/images/holidays/passover.webp");
  } finally { db.close(); }
});

test("all nineteen holiday identities and repeated years keep their own optimized media, order and semantic metadata", async () => {
  const slugs = ["sigd", "hanukkah", "new-years-eve", "ramadan", "valentines-day", "eid-al-fitr", "purim", "passover", "nabi-shuayb", "mimouna", "memorial-day", "independence-day", "eid-al-adha", "lag-baomer", "shavuot", "rosh-hashana", "yom-kippur", "sukkot", "simchat-torah"];
  const holidays = slugs.map(fallbackHolidayForSlug);
  holidays.push({ ...holidays[1], id: 9999, from: "2028-12-01", till: "2028-12-09" });
  const db = await database();
  try {
    const cards = await readHolidayCardMedia(holidays, db);
    assert.equal(db.queries, 1);
    assert.equal(cards.length, 20);
    for (const [index, card] of cards.entries()) {
      const slug = slugs[index] || "hanukkah";
      assert.equal(card.src, `/images/holidays/${slug}.webp`);
      assert.equal(card.mobileSrc, `/images/holidays/${slug}-mobile.webp`);
      assert.equal(card.alt, holidays[index].name);
      assert.equal(card.title, holidays[index].name);
      await readFile(new URL(`../public${card.mobileSrc}`, import.meta.url));
    }
  } finally { db.close(); }
});

test("unavailable CMS and empty inventory preserve safe existing holiday imagery without per-card requests", async () => {
  const holiday = fallbackHolidayForSlug("sukkot");
  const failure = { prepare() { throw new Error("CMS unavailable"); } };
  const [card] = await readHolidayCardMedia([holiday], failure);
  assert.equal(card.src, "/images/holidays/sukkot.webp");
  assert.equal(card.title, holiday.name);
  assert.deepEqual(await readHolidayCardMedia([], failure), []);
  assert.equal(holidayImageSources("/images/holidays/custom-cms.webp").mobileSrc, "/images/holidays/custom-cms.webp");
});
