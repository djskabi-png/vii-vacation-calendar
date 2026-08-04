import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${pathname}-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

for (const [pathname, expected] of [
  ["/", /מוצאים מקום שמתאים בדיוק לכם/],
  ["/search", /נופש ברחבי הארץ/],
  ["/business", /קסם הרימון/],
  ["/events", /מוצאים מקום לחגוג בו/],
  ["/destinations", /מוצאים את האזור שמתאים לחופשה/],
  ["/guides", /מדריכים, רעיונות והמלצות/],
  ["/contact", /יצירת קשר/],
  ["/handoff", /מרכז המידע לצוות הפיתוח/],
]) {
  test(`server renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), expected);
  });
}

test("keeps the calendar contexts and single-property behavior", async () => {
  const [calendar, search, business] = await Promise.all([
    readFile(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(calendar, /mode === "home"/);
  assert.match(calendar, /mode === "business"/);
  assert.match(search, /mode="home"/);
  assert.match(business, /mode="business"/);
  assert.match(business, /businessKind=\{scenario\}/);
  assert.match(business, /מקום אירוח שלם/);
});
