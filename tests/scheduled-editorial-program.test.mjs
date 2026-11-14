import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";
import { scheduledEditorialProgram } from "../app/data/scheduled-editorial-program.ts";
import { israelDateTimeInputValue, israelLocalDateTimeToIso } from "../app/lib/israel-date-time.ts";
import { isMagazineArticlePublicAt, sortMagazineArticlesByPublication } from "../app/lib/magazine-schedule.ts";

const worlds = ["vacations", "events", "hourly", "spa", "attractions", "trails", "providers", "corporate"];
const local = value => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(value)).reduce((row, part) => (part.type === "literal" ? row : { ...row, [part.type]: part.value }), {});
  return { ...parts, date: `${parts.year}-${parts.month}-${parts.day}` };
};

test("editorial program has exactly fifteen substantial scheduled articles in every public world", async () => {
  assert.equal(scheduledEditorialProgram.length, 120);
  assert.equal(new Set(scheduledEditorialProgram.map(article => article.slug)).size, 120);
  for (const world of worlds) assert.equal(scheduledEditorialProgram.filter(article => article.world === world).length, 15, world);
  for (const article of scheduledEditorialProgram) {
    assert.match(article.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(article.publicationManaged, true);
    assert.ok(article.scheduledAt && article.publishedAt && article.modifiedAt);
    assert.ok(article.title.length >= 20 && article.excerpt.length >= 70);
    assert.ok(article.intro.length >= 500);
    assert.ok(article.sections.length >= 6);
    const body = [article.intro, ...article.sections.flatMap(section => section.paragraphs), article.takeaway].join(" ");
    assert.ok(body.length >= 4_500, `${article.slug} body too short: ${body.length}`);
    assert.ok(article.faqs?.length >= 3 && article.checklist.length >= 5);
    assert.ok(article.imageAlt.length >= 20 && article.imageTitle && article.imageCredit);
    assert.ok(article.relatedSearches?.length >= 3);
    for (const link of article.relatedSearches || []) {
      assert.match(link.href, /^\/(?!\/)/);
      assert.ok(!link.href.includes("?"), `${article.slug} uses parameter URL ${link.href}`);
    }
    await access(new URL(`../public${article.image}`, import.meta.url));
  }
});

test("editorial articles remain materially distinct instead of repeating one template", () => {
  const grams = value => {
    const words = value.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/);
    return new Set(words.slice(0, -4).map((_, index) => words.slice(index, index + 5).join(" ")));
  };
  const documents = scheduledEditorialProgram.map(article => ({
    slug: article.slug,
    grams: grams(article.sections.flatMap(section => [section.title, ...section.paragraphs]).join(" ")),
  }));
  let maximum = 0; let pair = [];
  for (let left = 0; left < documents.length; left += 1) {
    for (let right = left + 1; right < documents.length; right += 1) {
      const a = documents[left].grams; const b = documents[right].grams;
      let overlap = 0;
      for (const gram of a) if (b.has(gram)) overlap += 1;
      const score = overlap / Math.min(a.size, b.size);
      if (score > maximum) { maximum = score; pair = [documents[left].slug, documents[right].slug]; }
    }
  }
  assert.ok(maximum <= 0.82, `editorial similarity ${maximum.toFixed(3)} is too high for ${pair.join(" / ")}`);
});

test("five-week calendar publishes three articles per world and rests on Monday and Saturday", () => {
  const weeks = new Map();
  for (const article of scheduledEditorialProgram) {
    const value = local(article.scheduledAt); const sunday = new Date(`${value.date}T12:00:00Z`); const weekday = value.weekday;
    const offset = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[weekday];
    sunday.setUTCDate(sunday.getUTCDate() - offset); const week = sunday.toISOString().slice(0, 10);
    const key = `${week}:${article.world}`; weeks.set(key, (weeks.get(key) || 0) + 1);
    assert.ok(!["Mon", "Sat"].includes(weekday), `${article.slug} scheduled on ${weekday}`);
  }
  assert.equal(new Set([...weeks.keys()].map(key => key.split(":")[0])).size, 5);
  for (const count of weeks.values()) assert.equal(count, 3);
  for (const world of worlds) assert.equal([...weeks.keys()].filter(key => key.endsWith(`:${world}`)).length, 5);

  const byDate = Object.groupBy(scheduledEditorialProgram, article => local(article.scheduledAt).date);
  for (const articles of Object.values(byDate)) {
    const weekday = local(articles[0].scheduledAt).weekday;
    assert.equal(articles.length, weekday === "Sun" || weekday === "Thu" ? 8 : 4);
    const hours = articles.map(article => Number(local(article.scheduledAt).hour)).sort((a,b) => a-b);
    assert.deepEqual(hours, weekday === "Sun" || weekday === "Thu" ? [10,11,12,13,14,15,16,17] : weekday === "Wed" ? [10,11,12,13] : [9,10,11,12]);
  }
});

test("Israel local schedule conversion round-trips standard and daylight time", () => {
  for (const value of ["2026-11-15T10:00", "2027-03-28T10:00", "2027-10-31T10:00"]) {
    const iso = israelLocalDateTimeToIso(value); assert.ok(iso, value); assert.equal(israelDateTimeInputValue(iso), value);
  }
});

test("future program articles fail closed and become public at their exact instant", () => {
  const article = scheduledEditorialProgram[0]; const due = new Date(article.scheduledAt).getTime();
  assert.equal(isMagazineArticlePublicAt(article, new Date(due - 1).toISOString()), false);
  assert.equal(isMagazineArticlePublicAt(article, new Date(due).toISOString()), true);
});

test("public magazine ordering places the newest released article first", () => {
  const sorted = sortMagazineArticlesByPublication(scheduledEditorialProgram.slice(0, 6));
  for (let index = 1; index < sorted.length; index += 1) assert.ok(sorted[index - 1].scheduledAt >= sorted[index].scheduledAt);
});

test("admin inventory keeps enough room for the complete editorial program", async () => {
  const route = await readFile(new URL("../app/api/admin/content-studio/route.ts", import.meta.url), "utf8");
  assert.match(route, /selectedType === "magazine" \? 240 : 80/);
  const page = await readFile(new URL("../app/admin/content-studio/page.tsx", import.meta.url), "utf8");
  assert.match(page, /magazineWorld/); assert.match(page, /magazineStatus/); assert.match(page, /magazineFrom/); assert.match(page, /magazineTo/);
  assert.match(page, /israelDateTimeInputValue/); assert.match(page, /israelLocalDateTimeToIso/);
  assert.match(page, /magazineChecklist/); assert.match(page, /checklistJson/);
  assert.match(page, /magazineFaqLines/); assert.match(page, /faqJson/);
  assert.match(page, /tab === "links"/);
});
