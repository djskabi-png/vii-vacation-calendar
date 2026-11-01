import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("shared property and catalog prices isolate the shekel symbol before the amount", async () => {
  const [propertyCard, catalogPrice] = await Promise.all([
    source("app/components/property-card.tsx"),
    source("app/components/catalog-starting-price.tsx"),
  ]);

  assert.match(propertyCard, /className="stay-card__price-value" dir="ltr"/);
  assert.match(propertyCard, /stay-card__currency[^>]*[^]*?\\u20AA[^]*?stay-card__price-number/);
  assert.match(catalogPrice, /<bdi dir="ltr">₪&nbsp;\{amount\.toLocaleString\(language\)\}<\/bdi>/);
});

test("public Hebrew price surfaces keep the shekel symbol before dynamic amounts", async () => {
  const paths = [
    "app/booking/client-page.tsx",
    "app/business/client-page.tsx",
    "app/calendar-demo.tsx",
    "app/components/event-last-minute.tsx",
    "app/components/spa-package-deals.tsx",
    "app/components/vacation-booking-hub.tsx",
    "app/gift-card/gift-card-builder.tsx",
    "app/search/page.tsx",
  ];

  for (const path of paths) {
    const text = await source(path);
    assert.doesNotMatch(text, /toLocaleString\([^\n]*\)[^\n]{0,20} ₪/, `${path} still renders an amount before the shekel symbol`);
  }
});
