import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("booking always exposes same-tab exits to the business and site", () => {
  assert.match(client, /const bookingReturnNavigation = <nav className="booking-return-nav"/);
  assert.match(client, /data-keep-same-tab="true"/);
  assert.equal((client.match(/\{bookingReturnNavigation\}/g) || []).length, 3);
  assert.match(client, /localizedPath\("\/", language\)/);
});

test("business return preserves the booking context without duplicate query strings", () => {
  assert.match(client, /new URLSearchParams\(\{ id: props\.placeId \}\)/);
  for (const field of ["from", "till", "guests", "price", "illustrative"]) {
    assert.match(client, new RegExp(`businessReturnParams\\.set\\("${field}"`));
  }
  assert.doesNotMatch(client, /source=search&from=.*source=search/);
});

test("return navigation is responsive and keyboard visible", () => {
  assert.match(css, /\.booking-return-nav \{/);
  assert.match(css, /\.booking-return-nav a:focus-visible/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.booking-return-nav/);
});

test("return labels are localized in all supported languages", () => {
  for (const language of ["he", "en", "ru", "fr"]) {
    assert.match(client, new RegExp(`${language}: \\{ business:`));
  }
});
