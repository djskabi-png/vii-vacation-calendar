import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${pathname}-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the integrated homepage", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /מוצאים מקום, בוחרים תאריך ויוצאים לחופשה/);
  assert.match(html, /יעדים מומלצים/);
  assert.match(html, /תאריך מבוקש/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("server-renders the business-page demonstration", async () => {
  const response = await render("/business");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /קסם הרימון/);
  assert.match(html, /בצעו הזמנה אונליין בקלות/);
  assert.match(html, /4 סוויטות/);
});

test("keeps the two calendar contexts explicit in source", async () => {
  const [calendar, homepage, business] = await Promise.all([
    readFile(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(calendar, /mode === "home"/);
  assert.match(calendar, /mode === "business"/);
  assert.match(calendar, /המחשת תפקוד/);
  assert.match(homepage, /mode="home"/);
  assert.match(business, /mode="business"/);
});
