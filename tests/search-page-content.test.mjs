import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSearchPageInput, searchPageDefinition, searchPageDefinitions } from "../app/lib/search-page-content.ts";
import { GET, POST } from "../app/api/admin/search-pages/route.ts";

test("search page editor is limited to known public landing pages", () => {
  assert.ok(searchPageDefinitions.length >= 15);
  assert.equal(searchPageDefinition("/spas/spa-with-jacuzzi")?.world, "spa");
  assert.equal(searchPageDefinition("/events/search/north")?.world, "events");
  assert.equal(searchPageDefinition("/admin") || null, null);
  const good = { path: "/spas/spa-with-jacuzzi", title: "ספא עם ג'קוזי בישראל", description: "בתי ספא עם ג'קוזי, תמונות ופרטים שניתן לבדוק לפני בחירת חבילה.", status: "draft", expectedVersion: 0 };
  assert.deepEqual(parseSearchPageInput(good), good);
  assert.equal(parseSearchPageInput({ ...good, path: "/other" }), null);
  assert.equal(parseSearchPageInput({ ...good, title: "<script>alert(1)</script>" }), null);
});

test("search page CMS denies anonymous access", async () => {
  const url = "https://vii.spaplus.co/api/admin/search-pages";
  assert.equal((await GET(new Request(url))).status, 403);
  assert.equal((await POST(new Request(url, { method: "POST", headers: { origin: "https://vii.spaplus.co" }, body: "{}" }))).status, 403);
});
