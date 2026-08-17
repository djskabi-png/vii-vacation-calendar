import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/components/accommodation-landing-route.tsx", import.meta.url), "utf8");
const search = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("accommodation landing passes page-specific guide and FAQ content to the visible page", () => {
  assert.match(route, /guideTitle/);
  assert.match(route, /guideParagraphs/);
  assert.match(route, /faqs,/);
  assert.match(search, /id="accommodation-guide"/);
  assert.match(search, /id="accommodation-faq"/);
  assert.match(search, /שאלות ותשובות על \{landing\.breadcrumb\}/);
});

test("landing content avoids a duplicate guide navigation block", () => {
  assert.doesNotMatch(search, /href="#accommodation-guide"/);
  assert.doesNotMatch(search, /href="#accommodation-faq"/);
  assert.doesNotMatch(search, /<Link href="\/questions">שאלות ותשובות<\/Link>/);
  assert.doesNotMatch(search, /<Link href="\/guides">מדריכי נופש<\/Link>/);
});

test("page guide and FAQ remain readable and keyboard accessible on mobile", () => {
  assert.match(css, /\.accommodation-page-guide/);
  assert.match(css, /\.accommodation-page-faq summary:focus-visible/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.accommodation-page-guide,\.accommodation-page-faq/);
});
