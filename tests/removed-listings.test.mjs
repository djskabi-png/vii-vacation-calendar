import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const siteData = fs.readFileSync(new URL("app/data/site-data.ts", root), "utf8");
const palumboStart = siteData.indexOf('slug: "villa-palumbo-demo"');
const palumboEnd = siteData.indexOf('slug: "aqua-resort"', palumboStart);
const palumboBlock = siteData.slice(palumboStart, palumboEnd);
const activeOrderStart = siteData.indexOf("const activePropertyOrder");
const activeOrderEnd = siteData.indexOf("];", activeOrderStart);
const activeOrder = siteData.slice(activeOrderStart, activeOrderEnd);

test("Villa Palumbo is disabled and excluded from the public property order", () => {
  assert.ok(palumboStart >= 0, "the retired record remains traceable in source data");
  assert.match(palumboBlock, /active: false/);
  assert.doesNotMatch(activeOrder, /villa-palumbo-demo/);
});

test("Villa Palumbo public media has been removed", () => {
  assert.equal(fs.existsSync(new URL("public/media/villa-palumbo-demo", root)), false);
});

test("unknown retired booking ids render the not-found page", () => {
  const bookingPage = fs.readFileSync(new URL("app/booking/page.tsx", root), "utf8");
  assert.match(bookingPage, /if \(params\.place\) notFound\(\)/);
});
